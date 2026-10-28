/**
 * Campus Black Box - AI-Powered Campus Problem Intelligence and Resolution System
 * Unified Production Server (Node.js built-in runtime + SQLite DatabaseSync)
 *
 * Iteration 4 Architecture:
 * - Strict Separation: Reporter Site vs Staff Portal
 * - Separate Authentication & Audience Enforced JWTs ('reporter' | 'staff')
 * - Intelligence Layer: Duplicate Detection (0.55 threshold) with Privacy Boundary (FR-20)
 * - Report Updates API (POST /api/reports/:id/updates)
 * - Priority Evaluation & 8 Safety Overrides (FR-18, FR-19; Priority is STAFF-ONLY)
 * - Category Correction Loop (category_corrections table & CSV export) (FR-17)
 * - AI Telemetry logging (ai_predictions with v1.1-rules-tfidf) (FR-21)
 * - Staff Triage Multi-filter & Heat Map Drill-down (FR-13, FR-14, FR-15, FR-25)
 * - Sub-path Relative Asset Resolution & 44px Responsive Mobile
 * - Zero External Dependencies
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "cbb-production-secret-key-32chars!!";
const DB_PATH = path.join(__dirname, "campus_blackbox.db");
const PUBLIC_DIR = path.join(__dirname, "public");
const UPLOADS_DIR = path.join(__dirname, "uploads");

// Ensure directories exist
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// -------------------------------------------------------------
// 1. CRYPTO & JWT HELPERS
// -------------------------------------------------------------

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;
  const parts = stored.split(":");
  if (parts.length !== 2) {
    return stored === `hash_${password}` || stored === password;
  }
  const [salt, key] = parts;
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(key));
  } catch {
    return false;
  }
}

function signJwt(payload, expiresInSeconds = 86400) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };
  const body = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  if (expectedSig !== parts[2]) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------
// 2. RATE LIMITING, THROTTLING & URL SANITIZATION
// -------------------------------------------------------------

const loginFailures = new Map(); // key: `${email}:${clientIp}` -> { count, resetAt }
const reportRateLimits = new Map(); // key: `${userId}:${clientIp}` -> [timestamp, ...]
const predictRateLimits = new Map(); // key: `${clientIp}` -> [timestamp, ...]

function getClientIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "127.0.0.1";
}

function checkLoginThrottling(email, clientIp) {
  const key = `${email}:${clientIp}`;
  const entry = loginFailures.get(key);
  if (!entry) return true;
  const now = Date.now();
  if (now > entry.resetAt) {
    loginFailures.delete(key);
    return true;
  }
  return entry.count < 5;
}

function recordLoginFailure(email, clientIp) {
  const key = `${email}:${clientIp}`;
  const now = Date.now();
  const entry = loginFailures.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };
  entry.count++;
  if (entry.count >= 5 && entry.resetAt <= now) {
    entry.resetAt = now + 15 * 60 * 1000;
  }
  loginFailures.set(key, entry);
}

function clearLoginFailure(email, clientIp) {
  const key = `${email}:${clientIp}`;
  loginFailures.delete(key);
}

function checkRateLimit(map, key, maxRequests, windowMs) {
  const now = Date.now();
  const timestamps = (map.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return false;
  }
  timestamps.push(now);
  map.set(key, timestamps);
  return true;
}

function validateReturnUrl(returnUrl, isStaff = false) {
  if (!returnUrl || typeof returnUrl !== "string") {
    return isStaff ? "/staff/admin" : "/report";
  }
  const trimmed = returnUrl.trim();
  // Must start with single slash, no protocol relative or backslash
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\")) {
    return isStaff ? "/staff/admin" : "/report";
  }
  // No scheme before slash
  if (trimmed.includes(":") && trimmed.indexOf(":") < trimmed.indexOf("/", 1)) {
    return isStaff ? "/staff/admin" : "/report";
  }
  // Reporter returnUrl cannot enter /staff
  if (!isStaff && trimmed.startsWith("/staff")) {
    return "/report";
  }
  // Staff returnUrl must stay in /staff
  if (isStaff && !trimmed.startsWith("/staff")) {
    return "/staff/admin";
  }
  return trimmed;
}

function validateImageMagicBytes(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) {
    return ".jpg";
  }
  // PNG: 89 50 4E 47 (0x89 'P' 'N' 'G')
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return ".png";
  }
  // WebP: RIFF (4 bytes) ... WEBP (4 bytes)
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) {
    return ".webp";
  }
  return null;
}

// -------------------------------------------------------------
// 3. DATABASE INITIALIZATION & MIGRATIONS
// -------------------------------------------------------------

const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    department TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    block TEXT NOT NULL,
    room TEXT NOT NULL,
    floor INTEGER DEFAULT 1,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    location_type TEXT DEFAULT 'classroom',
    qr_token TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    location_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    suggested_category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'pending',
    photo_url TEXT,
    photo_path TEXT,
    assigned_to INTEGER,
    priority_overridden_by INTEGER,
    priority_override_reason TEXT,
    safety_rule_matched TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(location_id) REFERENCES locations(id),
    FOREIGN KEY(assigned_to) REFERENCES users(id),
    FOREIGN KEY(priority_overridden_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS resolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    staff_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(report_id) REFERENCES reports(id),
    FOREIGN KEY(staff_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS status_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    from_status TEXT,
    to_status TEXT NOT NULL,
    changed_by INTEGER,
    changed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(report_id) REFERENCES reports(id),
    FOREIGN KEY(changed_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    report_id INTEGER NOT NULL,
    message TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(report_id) REFERENCES reports(id)
  );

  CREATE TABLE IF NOT EXISTS ai_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    predicted_category TEXT NOT NULL,
    category_confidence REAL NOT NULL,
    priority_score TEXT NOT NULL,
    duplicate_score REAL,
    duplicate_of INTEGER,
    model_version TEXT DEFAULT 'v1.1-rules-tfidf',
    safety_rule_matched TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(report_id) REFERENCES reports(id)
  );

  CREATE TABLE IF NOT EXISTS report_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(report_id) REFERENCES reports(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS category_corrections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    suggested_category TEXT,
    final_category TEXT NOT NULL,
    corrected_by INTEGER NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(report_id) REFERENCES reports(id),
    FOREIGN KEY(corrected_by) REFERENCES users(id)
  );
`);

// Migrations
try {
  const locCols = db.prepare("PRAGMA table_info(locations)").all();
  if (!locCols.some(c => c.name === "qr_token")) {
    db.exec("ALTER TABLE locations ADD COLUMN qr_token TEXT UNIQUE");
  }
} catch {}

try {
  const repCols = db.prepare("PRAGMA table_info(reports)").all();
  if (!repCols.some(c => c.name === "photo_path")) {
    db.exec("ALTER TABLE reports ADD COLUMN photo_path TEXT");
  }
  if (!repCols.some(c => c.name === "priority_overridden_by")) {
    db.exec("ALTER TABLE reports ADD COLUMN priority_overridden_by INTEGER");
  }
  if (!repCols.some(c => c.name === "priority_override_reason")) {
    db.exec("ALTER TABLE reports ADD COLUMN priority_override_reason TEXT");
  }
  if (!repCols.some(c => c.name === "safety_rule_matched")) {
    db.exec("ALTER TABLE reports ADD COLUMN safety_rule_matched TEXT");
  }
} catch {}

try {
  const predCols = db.prepare("PRAGMA table_info(ai_predictions)").all();
  if (!predCols.some(c => c.name === "safety_rule_matched")) {
    db.exec("ALTER TABLE ai_predictions ADD COLUMN safety_rule_matched TEXT");
  }
} catch {}

// -------------------------------------------------------------
// 4. AI & INTELLIGENCE ENGINE (TF-IDF, Duplicate, Safety Rules)
// -------------------------------------------------------------

const CATEGORY_CORPUS = {
  "Electrical": [
    "light tube not working flicker dark tube light bulb burnt switch sparking",
    "power socket outlet plug broken burnt loose no electricity power cut breaker tripped",
    "ceiling fan regulator speed not rotating screeching noise fan capacitor dead capacitor burnt",
    "exposed wire hanging electric shock hazard sparking switchboard switch board burnt",
    "short circuit fuse blown no power in room extension cord broken"
  ],
  "IT/Wi-Fi": [
    "wifi campus network not connecting disconnects slow internet connection speed dead zone",
    "lan ethernet cable port wall socket broken no signal ip address failed",
    "eduroam login captive portal down gateway timeout cannot connect to college wifi",
    "router red light flashing high ping latency network packet drop no internet access",
    "server connection unreachable laboratory lan switches offline wifi access point dead"
  ],
  "Equipment": [
    "projector hdmi display no signal lamp burnt remote missing blurry screen inverted image",
    "air conditioner ac not cooling hot air leaking water remote control dead thermostat broken",
    "lab computer monitor blue screen pc won't boot keyboard mouse damaged hard disk error",
    "speaker microphone sound audio amplifier buzzing feedback aux cord broken podium mic dead",
    "smart board interactive whiteboard touch calibration not responding stylus pen lost"
  ],
  "Water": [
    "water cooler dispenser empty filter leaking dirty water strange taste no cold water",
    "washroom tap dripping continuous water leakage pipe burst flooding bathroom floor",
    "toilet flush not working low water pressure pipeline clogged basin sink jammed",
    "water overhead tank overflow ceiling seepage drip leak dripping water on desks",
    "drainage blocked dirty stagnant water smell sewage pipe backup"
  ],
  "Cleanliness": [
    "trash garbage bin overflowing waste paper plastic food spill smell dirty room",
    "washroom dirty unclean foul smell no handwash liquid soap empty dirty mirrors",
    "dust on desks floor sweeping mop required litter scattered corridor untidy",
    "cobwebs in corners stains on walls chalkboard white board marker stains uncleaned"
  ],
  "Furniture": [
    "broken chair cracked seat missing armrest leg bent bench unstable wheel broken",
    "desk table wobbling damaged drawer handle broken sharp wooden edge peeling",
    "podium lectern broken hinge door loose classroom benches detached from floor"
  ],
  "Safety": [
    "exposed wire hanging electric shock hazard sparking switchboard danger fire hazard",
    "fire extinguisher missing expired uninspected broken pressure gauge safety valve",
    "broken window glass sharp shards staircase handrail railing loose loose tiles trip hazard",
    "emergency exit door jammed locked hallway blocked dangerous dark staircase emergency light"
  ],
  "Accessibility": [
    "ramp railing broken steep wheelchair ramp blocked elevator lift not working buttons broken",
    "braille signage missing broken accessible toilet locked door too narrow obstacle on walkway",
    "tactile paving missing handicap ramp incline too steep broken assistance bell"
  ]
};

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function getTermFreq(tokens) {
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  return tf;
}

const categoryProfiles = {};
for (const [cat, docs] of Object.entries(CATEGORY_CORPUS)) {
  const allTokens = docs.flatMap(tokenize);
  categoryProfiles[cat] = getTermFreq(allTokens);
}

function cosineSimilarity(tfA, tfB) {
  const keys = new Set([...Object.keys(tfA), ...Object.keys(tfB)]);
  let dotProduct = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const valA = tfA[k] || 0;
    const valB = tfB[k] || 0;
    dotProduct += valA * valB;
    magA += valA * valA;
    magB += valB * valB;
  }
  if (magA === 0 || magB === 0) return 0;
  return dotProduct / (Math.sqrt(magA) * Math.sqrt(magB));
}

function classifyCategory(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return { category: "Equipment", confidence: 0.5 };
  }

  const inputTf = getTermFreq(tokens);
  let bestCat = "Equipment";
  let bestSim = 0;

  for (const [cat, profileTf] of Object.entries(categoryProfiles)) {
    const sim = cosineSimilarity(inputTf, profileTf);
    if (sim > bestSim) {
      bestSim = sim;
      bestCat = cat;
    }
  }

  if (bestSim < 0.05) {
    return { category: "Equipment", confidence: 0.55 };
  }

  const confidence = Math.min(0.99, Number((0.65 + bestSim * 0.45).toFixed(2)));
  return { category: bestCat, confidence };
}

// -------------------------------------------------------------
// SAFETY RULES & PRIORITY PREDICTION (FR-18, FR-19)
// -------------------------------------------------------------

const SAFETY_RULES = [
  {
    name: "exposed_sparking_wire",
    regex: /(exposed|sparking)\s+wire|wire\s+(exposed|sparking)|sparking\s+switchboard/i,
    description: "Exposed or sparking electrical wiring detected"
  },
  {
    name: "smoke_fire_flame",
    regex: /\b(smoke|fire|flame)\b/i,
    description: "Smoke or fire hazard detected"
  },
  {
    name: "gas_leak",
    regex: /\bgas\s+leak\b/i,
    description: "Hazardous gas leakage detected"
  },
  {
    name: "short_circuit",
    regex: /\bshort\s+circuit\b/i,
    description: "Electrical short circuit hazard detected"
  },
  {
    name: "flooding_electrical",
    regex: /(flood|flooding|leaking\s+water).*(electric|power|socket|wire|switch)|(electric|power|socket|wire|switch).*(flood|flooding|leaking\s+water)/i,
    description: "Flooding near electrical equipment detected"
  },
  {
    name: "broken_stair_railing",
    regex: /(broken|loose)\s+(stair|staircase)?\s*(railing|handrail)|(stair|staircase)?\s*(railing|handrail)\s+(broken|loose)/i,
    description: "Damaged staircase handrail or safety railing"
  },
  {
    name: "stuck_lift_with_person",
    regex: /(lift|elevator).*(stuck|trapped).*(person|someone|student|faculty|people|inside)|(person|someone|student|faculty|people|inside).*(stuck|trapped).*(lift|elevator)/i,
    description: "Passenger trapped in non-functioning elevator"
  }
];

function evaluateSafetyRules(text) {
  if (!text) return null;
  for (const rule of SAFETY_RULES) {
    if (rule.regex.test(text)) {
      return rule;
    }
  }
  return null;
}

function computePriority(text, category, duplicateCount = 0) {
  const safetyMatch = evaluateSafetyRules(text);
  if (safetyMatch) {
    return {
      priority: "critical",
      priority_score: "critical",
      safety_rule_matched: safetyMatch.name,
      reason: `Safety rule override: ${safetyMatch.name}`
    };
  }

  const categoryPrios = {
    "Safety": "critical",
    "Electrical": "high",
    "Water": "high",
    "Equipment": "medium",
    "IT/Wi-Fi": "medium",
    "Cleanliness": "low",
    "Furniture": "low",
    "Accessibility": "medium"
  };

  let prio = categoryPrios[category] || "medium";
  let escalated = false;

  if (duplicateCount >= 2) {
    if (prio === "low") prio = "medium";
    else if (prio === "medium") prio = "high";
    else if (prio === "high") prio = "critical";
    escalated = true;
  }

  return {
    priority: prio,
    priority_score: prio,
    safety_rule_matched: null,
    reason: `Category default (${category})${escalated ? " + duplicate escalation" : ""}`
  };
}

// -------------------------------------------------------------
// DUPLICATE DETECTION (FR-20, DUPLICATE_THRESHOLD = 0.55)
// -------------------------------------------------------------

const DUPLICATE_THRESHOLD = 0.55;

function detectDuplicates(newText, locationId) {
  if (!newText || newText.length < 15 || !locationId) {
    return { isDuplicate: false, matchScore: 0, matchedReportId: null };
  }

  // Open reports in SAME location only
  const openReports = db.prepare(`
    SELECT id, description, category, status, created_at
    FROM reports
    WHERE location_id = ? AND status != 'resolved'
    ORDER BY id DESC LIMIT 50
  `).all(locationId);

  if (openReports.length === 0) {
    return { isDuplicate: false, matchScore: 0, matchedReportId: null };
  }

  const newTokens = tokenize(newText);
  const newTf = getTermFreq(newTokens);
  let highestSim = 0;
  let matchedReport = null;

  for (const rep of openReports) {
    const repTokens = tokenize(rep.description);
    const repTf = getTermFreq(repTokens);
    const sim = cosineSimilarity(newTf, repTf);
    if (sim > highestSim) {
      highestSim = sim;
      matchedReport = rep;
    }
  }

  const isDup = highestSim >= DUPLICATE_THRESHOLD;
  if (!isDup || !matchedReport) {
    return {
      isDuplicate: false,
      matchScore: Number(highestSim.toFixed(2)),
      matchedReportId: null
    };
  }

  const createdTime = new Date(matchedReport.created_at).getTime();
  const hoursAgo = Math.max(0, Math.round((Date.now() - createdTime) / (3600 * 1000)));

  // PRIVACY BOUNDARY (FR-20, AC6.2):
  // Return prompt payload with category, status, hours_ago, but STRICTLY NO description or reporter identity
  return {
    isDuplicate: true,
    matchScore: Number(highestSim.toFixed(2)),
    matchedReportId: matchedReport.id,
    category: matchedReport.category,
    status: matchedReport.status,
    hours_ago: hoursAgo
  };
}

// -------------------------------------------------------------
// 5. DATA SEEDING (Idempotent: resets if requested or empty)
// -------------------------------------------------------------

function seedData(forceReset = false) {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (!forceReset && userCount > 0) {
    return;
  }

  console.log("Seeding Campus Black Box sample data with strict lifecycle rules...");

  db.exec(`
    DROP TABLE IF EXISTS category_corrections;
    DROP TABLE IF EXISTS report_updates;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS status_history;
    DROP TABLE IF EXISTS ai_predictions;
    DROP TABLE IF EXISTS resolutions;
    DROP TABLE IF EXISTS reports;
    DROP TABLE IF EXISTS locations;
    DROP TABLE IF EXISTS users;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      department TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block TEXT NOT NULL,
      room TEXT NOT NULL,
      floor INTEGER DEFAULT 1,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_type TEXT DEFAULT 'classroom',
      qr_token TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      location_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      suggested_category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'pending',
      photo_url TEXT,
      photo_path TEXT,
      assigned_to INTEGER,
      priority_overridden_by INTEGER,
      priority_override_reason TEXT,
      safety_rule_matched TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(location_id) REFERENCES locations(id),
      FOREIGN KEY(assigned_to) REFERENCES users(id),
      FOREIGN KEY(priority_overridden_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS resolutions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      staff_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      remarks TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(report_id) REFERENCES reports(id),
      FOREIGN KEY(staff_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS status_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by INTEGER,
      changed_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(report_id) REFERENCES reports(id),
      FOREIGN KEY(changed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      report_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      read_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );

    CREATE TABLE IF NOT EXISTS ai_predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      predicted_category TEXT NOT NULL,
      category_confidence REAL NOT NULL,
      priority_score TEXT NOT NULL,
      duplicate_score REAL,
      duplicate_of INTEGER,
      model_version TEXT DEFAULT 'v1.1-rules-tfidf',
      safety_rule_matched TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );

    CREATE TABLE IF NOT EXISTS report_updates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(report_id) REFERENCES reports(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS category_corrections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER NOT NULL,
      suggested_category TEXT,
      final_category TEXT NOT NULL,
      corrected_by INTEGER NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(report_id) REFERENCES reports(id),
      FOREIGN KEY(corrected_by) REFERENCES users(id)
    );
  `);

  const demoPassword = process.env.DEMO_PASSWORD || "DemoPass123!";
  const passwordHash = hashPassword(demoPassword);

  // Seed Users
  const users = [
    { id: 1, name: "Student", email: "student@campus.edu", role: "student", dept: "Computer Science" },
    { id: 2, name: "Faculty", email: "faculty@campus.edu", role: "faculty", dept: "Engineering" },
    { id: 3, name: "Technician 1", email: "tech1@campus.edu", role: "maintenance", dept: "Electrical & Facilities" },
    { id: 4, name: "Technician 2", email: "tech2@campus.edu", role: "maintenance", dept: "Hardware & IT Support" },
    { id: 5, name: "Admin", email: "admin@campus.edu", role: "admin", dept: "Campus Operations" },
    { id: 6, name: "Super Admin", email: "superadmin@campus.edu", role: "super_admin", dept: "System Administration" }
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const u of users) {
    insertUser.run(u.id, u.name, u.email, passwordHash, u.role, u.dept);
  }

  // Seed Locations
  const locationList = [
    { id: 1, block: "Block 1", room: "Room 114", floor: 1, lat: 28.6445, lng: 77.2167, type: "classroom", qr: "qr_b1_114_k8a9" },
    { id: 2, block: "Block 1", room: "Room 207", floor: 2, lat: 28.6446, lng: 77.2168, type: "classroom", qr: "qr_b1_207_m3b4" },
    { id: 3, block: "Block 1", room: "Room 102", floor: 1, lat: 28.6447, lng: 77.2169, type: "lab", qr: "qr_b1_102_p7x1" },
    { id: 4, block: "Block 2", room: "Ground floor", floor: 0, lat: 28.6448, lng: 77.2172, type: "corridor", qr: "qr_b2_gf_c4v8" },
    { id: 5, block: "Block 2", room: "1st floor", floor: 1, lat: 28.6449, lng: 77.2173, type: "washroom", qr: "qr_b2_1f_z9t2" },
    { id: 6, block: "Block 3", room: "Room 302", floor: 3, lat: 28.6442, lng: 77.2175, type: "lecture_hall", qr: "qr_b3_302_x2m1" },
    { id: 7, block: "Block 3", room: "Room 105", floor: 1, lat: 28.6441, lng: 77.2174, type: "lab", qr: "qr_b3_105_w5n6" },
    { id: 8, block: "Block 4", room: "2nd floor", floor: 2, lat: 28.6450, lng: 77.2160, type: "corridor", qr: "qr_b4_2f_h1q7" },
    { id: 9, block: "Library", room: "1st floor", floor: 1, lat: 28.6440, lng: 77.2165, type: "corridor", qr: "qr_lib_1f_y3d5" }
  ];

  const insertLoc = db.prepare(`
    INSERT INTO locations (id, block, room, floor, latitude, longitude, location_type, qr_token)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const l of locationList) {
    insertLoc.run(l.id, l.block, l.room, l.floor, l.lat, l.lng, l.type, l.qr);
  }

  // Seed 8 Sample Reports with strict rule conformance:
  const sampleReports = [
    {
      id: 1,
      userId: 2, // Faculty
      locId: 6,  // Block 3 · Room 302
      desc: "Projector shows blank screen",
      cat: "Equipment",
      prio: "medium",
      safetyRule: null,
      status: "in_progress",
      assignedTo: 3, // Technician 1
      photo: "/samples/projector.webp",
      ageHours: 4,
      resolvedAt: null
    },
    {
      id: 2,
      userId: 1, // Student
      locId: 1,  // Block 1 · Room 114
      desc: "Ceiling fan not rotating",
      cat: "Electrical",
      prio: "low",
      safetyRule: null,
      status: "pending",
      assignedTo: null,
      photo: "/samples/ceiling-fan.webp",
      ageHours: 6,
      resolvedAt: null
    },
    {
      id: 3,
      userId: 2, // Faculty
      locId: 4,  // Block 2 · Ground floor
      desc: "Water leaking near staircase",
      cat: "Water",
      prio: "high",
      safetyRule: null,
      status: "assigned",
      assignedTo: 3, // Technician 1
      photo: "/samples/water-leak.webp",
      ageHours: 8,
      resolvedAt: null
    },
    {
      id: 4,
      userId: 1, // Student
      locId: 7,  // Block 3 · Room 105
      desc: "Exposed wire near switchboard",
      cat: "Safety",
      prio: "critical",
      safetyRule: "exposed_sparking_wire",
      status: "assigned",
      assignedTo: 4, // Technician 2
      photo: "/samples/exposed-wire.webp",
      ageHours: 2,
      resolvedAt: null
    },
    {
      id: 5,
      userId: 2, // Faculty
      locId: 9,  // Library · 1st floor
      desc: "Wi-Fi dead zone in corridor",
      cat: "IT/Wi-Fi",
      prio: "medium",
      safetyRule: null,
      status: "pending",
      assignedTo: null,
      photo: "/samples/wifi-deadzone.webp",
      ageHours: 14,
      resolvedAt: null
    },
    {
      id: 6,
      userId: 1, // Student
      locId: 2,  // Block 1 · Room 207
      desc: "Broken chair",
      cat: "Furniture",
      prio: "low",
      safetyRule: null,
      status: "resolved",
      assignedTo: 3, // Technician 1
      photo: "/samples/broken-chair.webp",
      ageHours: 24,
      resolvedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    },
    {
      id: 7,
      userId: 1, // Student
      locId: 8,  // Block 4 · 2nd floor
      desc: "Dark corridor, light not working",
      cat: "Safety",
      prio: "high",
      safetyRule: null,
      status: "in_progress",
      assignedTo: 4, // Technician 2
      photo: "/samples/dark-corridor.webp",
      ageHours: 18,
      resolvedAt: null
    },
    {
      id: 8,
      userId: 1, // Student
      locId: 5,  // Block 2 · 1st floor
      desc: "Dirty washroom",
      cat: "Cleanliness",
      prio: "medium",
      safetyRule: null,
      status: "pending",
      assignedTo: null,
      photo: "/samples/dirty-washroom.webp",
      ageHours: 7,
      resolvedAt: null
    }
  ];

  const insertReport = db.prepare(`
    INSERT INTO reports (
      id, user_id, location_id, description, category, suggested_category,
      priority, safety_rule_matched, status, photo_url, photo_path, assigned_to,
      created_at, updated_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), datetime('now'), ?)
  `);

  const insertResolution = db.prepare(`
    INSERT INTO resolutions (report_id, staff_id, action, remarks, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  const insertPrediction = db.prepare(`
    INSERT INTO ai_predictions (
      report_id, predicted_category, category_confidence, priority_score, duplicate_score,
      model_version, safety_rule_matched
    ) VALUES (?, ?, ?, ?, ?, 'v1.1-rules-tfidf', ?)
  `);

  const insertStatusHistory = db.prepare(`
    INSERT INTO status_history (report_id, from_status, to_status, changed_by, changed_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  const insertNotification = db.prepare(`
    INSERT INTO notifications (user_id, report_id, message, read_at, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  for (const r of sampleReports) {
    const ageOffset = `-${r.ageHours} hours`;
    insertReport.run(
      r.id,
      r.userId,
      r.locId,
      r.desc,
      r.cat,
      r.cat,
      r.prio,
      r.safetyRule,
      r.status,
      r.photo,
      r.photo,
      r.assignedTo,
      ageOffset,
      r.resolvedAt
    );

    insertPrediction.run(r.id, r.cat, 0.95, r.prio, 0.10, r.safetyRule);

    // Initial status history: creation
    insertStatusHistory.run(r.id, null, "pending", r.userId, ageOffset);

    if (r.status === "assigned" || r.status === "in_progress" || r.status === "resolved") {
      insertResolution.run(
        r.id,
        5, // Admin
        `Assigned incident to maintenance staff (#${r.assignedTo})`,
        "Work order dispatched",
        ageOffset
      );
      insertStatusHistory.run(r.id, "pending", "assigned", 5, ageOffset);
    }

    if (r.status === "in_progress" || r.status === "resolved") {
      insertResolution.run(
        r.id,
        r.assignedTo,
        "Technician accepted work order and started on-site diagnostic",
        "Tools prepped",
        ageOffset
      );
      insertStatusHistory.run(r.id, "assigned", "in_progress", r.assignedTo, ageOffset);
    }

    if (r.status === "resolved") {
      insertResolution.run(
        r.id,
        r.assignedTo,
        "Replaced damaged chair structural backrest and verified load stability",
        "Tested safe for student use",
        "-3 hours"
      );
      insertStatusHistory.run(r.id, "in_progress", "resolved", r.assignedTo, "-3 hours");
      insertNotification.run(r.userId, r.id, "Your incident #6 has been resolved: Replaced damaged chair structural backrest", "-2 hours", "-3 hours");
    }
  }

  // Seed sample report updates (Goal 3a)
  db.prepare(`
    INSERT INTO report_updates (report_id, user_id, text, created_at)
    VALUES (1, 1, 'Observed projector display flickers every 10 seconds during morning lecture', datetime('now', '-2 hours'))
  `).run();

  // Seed sample category corrections (Goal 3c)
  db.prepare(`
    INSERT INTO category_corrections (report_id, suggested_category, final_category, corrected_by, role, created_at)
    VALUES (2, 'Equipment', 'Electrical', 2, 'faculty', datetime('now', '-5 hours'))
  `).run();

  // Active notifications
  insertNotification.run(1, 4, "Your incident #4 status updated to Assigned", null, "-1 hour");
  insertNotification.run(2, 1, "Your incident #1 status updated to In progress", null, "-2 hours");
  insertNotification.run(2, 3, "Your incident #3 status updated to Assigned", null, "-7 hours");

  console.log("Database seeded successfully with authenticated users and strict lifecycle rules!");
}

// Reseed on startup if database is missing tables or records
try {
  const existingUsers = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const existingLocations = db.prepare("SELECT COUNT(*) as c FROM locations").get().c;
  if (existingUsers < 6 || existingLocations < 9) {
    seedData(true);
  }
} catch {
  seedData(true);
}

// -------------------------------------------------------------
// 6. REQUEST PARSING & RESPONSE HELPERS
// -------------------------------------------------------------

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({ raw: body });
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

function getAuthUser(req) {
  const authHeader = req.headers["authorization"] || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  const payload = verifyJwt(token);
  if (!payload || !payload.userId) return null;

  const user = db.prepare("SELECT id, name, email, role, department FROM users WHERE id = ?").get(payload.userId);
  if (!user) return null;
  user.aud = payload.aud || null;
  return user;
}

// -------------------------------------------------------------
// 7. REQUEST HANDLER & REST ROUTING
// -------------------------------------------------------------

async function handleRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const clientIp = getClientIp(req);

  // Handle CORS Pre-flight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  // -------------------------------------------------------------
  // CONFIG & UTILITY ENDPOINTS
  // -------------------------------------------------------------

  if (pathname === "/api/config" && method === "GET") {
    const isDemo = process.env.DEMO_MODE === "true" || process.env.DEMO_MODE !== "false";
    return sendJson(res, 200, { demo_mode: isDemo });
  }

  if (pathname === "/api/validate-return-url" && method === "GET") {
    const rawUrl = parsedUrl.searchParams.get("url") || "";
    const portal = parsedUrl.searchParams.get("portal") === "staff";
    const sanitized = validateReturnUrl(rawUrl, portal);
    const isValid = sanitized === rawUrl;
    return sendJson(res, 200, { valid: isValid, sanitized });
  }

  // -------------------------------------------------------------
  // AUTHENTICATION: SEPARATE REPORTER VS STAFF (FR-1, FR-2, FR-3)
  // -------------------------------------------------------------

  // 1. REPORTER LOGIN: Student and Faculty only
  if (pathname === "/api/auth/login" && method === "POST") {
    if (!checkLoginThrottling(clientIp, clientIp)) {
      return sendJson(res, 429, { detail: "Too many failed login attempts. Please try again after 15 minutes." });
    }

    const body = await parseRequestBody(req);
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return sendJson(res, 400, { detail: "Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(email);
    // Generic rejection: no role enumeration, must be student or faculty
    if (!user || (user.role !== "student" && user.role !== "faculty") || !verifyPassword(password, user.password_hash)) {
      recordLoginFailure(clientIp, clientIp);
      return sendJson(res, 401, { detail: "Invalid credentials" });
    }

    clearLoginFailure(clientIp, clientIp);

    const token = signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      aud: "reporter"
    });

    return sendJson(res, 200, {
      token,
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  }

  // 2. STAFF LOGIN: Maintenance, Admin, Super Admin only
  if (pathname === "/api/staff/auth/login" && method === "POST") {
    if (!checkLoginThrottling(clientIp, clientIp)) {
      return sendJson(res, 429, { detail: "Too many failed login attempts. Please try again after 15 minutes." });
    }

    const body = await parseRequestBody(req);
    const email = (body.email || "").trim().toLowerCase();
    const password = body.password || "";

    if (!email || !password) {
      return sendJson(res, 400, { detail: "Email and password are required" });
    }

    const user = db.prepare("SELECT * FROM users WHERE LOWER(email) = ?").get(email);
    // Generic rejection: must be staff role
    if (!user || (user.role !== "maintenance" && user.role !== "admin" && user.role !== "super_admin") || !verifyPassword(password, user.password_hash)) {
      recordLoginFailure(clientIp, clientIp);
      return sendJson(res, 401, { detail: "Invalid credentials" });
    }

    clearLoginFailure(clientIp, clientIp);

    const token = signJwt({
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      aud: "staff"
    });

    return sendJson(res, 200, {
      token,
      access_token: token,
      token_type: "bearer",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department
      }
    });
  }

  // Current session profiles
  if (pathname === "/api/auth/me" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "reporter") return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });
    return sendJson(res, 200, { user });
  }

  if (pathname === "/api/staff/auth/me" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "staff") return sendJson(res, 403, { detail: "Forbidden: Staff portal access required" });
    return sendJson(res, 200, { user });
  }

  // -------------------------------------------------------------
  // PUBLIC & SHARED ENDPOINTS (LOCATIONS, QR, AI PREDICTION)
  // -------------------------------------------------------------

  // QR Location Deep-Link Lookup (Public)
  const qrLookupMatch = pathname.match(/^\/api\/locations\/qr\/([a-zA-Z0-9_\-]+)$/);
  if (qrLookupMatch && method === "GET") {
    const token = qrLookupMatch[1];
    const loc = db.prepare("SELECT id, block, room, floor, location_type, qr_token FROM locations WHERE qr_token = ?").get(token);
    if (!loc) {
      return sendJson(res, 404, { detail: "Invalid or inactive QR token" });
    }
    return sendJson(res, 200, { location: loc });
  }

  // Locations List (Public)
  if (pathname === "/api/locations" && method === "GET") {
    const locations = db.prepare(`
      SELECT l.*,
        COUNT(r.id) as total_reports,
        SUM(CASE WHEN r.status != 'resolved' THEN 1 ELSE 0 END) as open_reports
      FROM locations l
      LEFT JOIN reports r ON l.id = r.location_id
      GROUP BY l.id
      ORDER BY l.block, l.room
    `).all();
    return sendJson(res, 200, { locations });
  }

  // AI Suggestion Preview (Rate limited: 60/min)
  // NOTE (AC6.5): Priority is STAFF-ONLY, so this endpoint returns NO priority to reporters.
  if (pathname === "/api/ai/predict" && method === "POST") {
    if (!checkRateLimit(predictRateLimits, clientIp, 60, 60 * 1000)) {
      return sendJson(res, 429, { detail: "Rate limit exceeded for AI suggestions. Please slow down." });
    }

    const body = await parseRequestBody(req);
    const text = (body.description || "").trim();
    const locId = Number(body.location_id) || 1;

    // Rule: if text < 15 characters, neutral state
    if (text.length < 15) {
      return sendJson(res, 200, {
        category: null,
        confidence: null,
        duplicate: { isDuplicate: false, matchScore: 0, matchedReportId: null },
        message: "Suggestion appears after you describe the problem"
      });
    }

    const catResult = classifyCategory(text);
    const dupResult = detectDuplicates(text, locId);

    return sendJson(res, 200, {
      category: catResult.category,
      confidence: catResult.confidence,
      duplicate: dupResult,
      model_version: "v1.1-rules-tfidf",
      label: "Rule-based suggestion (prototype)"
    });
  }

  // Authenticated Photo Download
  const photoMatch = pathname.match(/^\/api\/photos\/([a-zA-Z0-9_\-\.]+)$/);
  if (photoMatch && method === "GET") {
    const filename = photoMatch[1];
    const user = getAuthUser(req);
    if (!user) {
      return sendJson(res, 401, { detail: "Authentication required to access photos" });
    }

    const report = db.prepare("SELECT user_id, assigned_to FROM reports WHERE photo_path LIKE ?").get(`%${filename}`);
    if (report) {
      const isOwner = user.aud === "reporter" && user.id === report.user_id;
      const isStaff = user.aud === "staff";
      if (!isOwner && !isStaff) {
        return sendJson(res, 403, { detail: "Forbidden: You are not authorized to view this photo" });
      }
    } else if (user.aud !== "staff") {
      return sendJson(res, 403, { detail: "Forbidden: You are not authorized to view this photo" });
    }

    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return sendJson(res, 404, { detail: "Photo file not found on disk" });
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    return fs.createReadStream(filePath).pipe(res);
  }

  // -------------------------------------------------------------
  // REPORTER ENDPOINTS: Create & Track Only (FR-5, FR-8, FR-9)
  // -------------------------------------------------------------

  // Report Updates Submission (POST /api/reports/:id/updates) (FR-20, AC6.3)
  const repUpdateMatch = pathname.match(/^\/api\/reports\/(\d+)\/updates$/);
  if (repUpdateMatch && method === "POST") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "reporter") return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });

    const reportId = Number(repUpdateMatch[1]);
    const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
    if (!report) return sendJson(res, 404, { detail: "Report not found" });

    // AC6.3: 400 if resolved
    if (report.status === "resolved") {
      return sendJson(res, 400, { detail: "Cannot add updates to a resolved report" });
    }

    const rateKey = `update:${user.id}:${clientIp}`;
    if (!checkRateLimit(reportRateLimits, rateKey, 20, 10 * 60 * 1000)) {
      return sendJson(res, 429, { detail: "Rate limit exceeded for updates. Please slow down." });
    }

    const body = await parseRequestBody(req);
    const text = (body.text || body.description || "").trim();
    if (!text) {
      return sendJson(res, 400, { detail: "Update text is required" });
    }
    if (text.length > 1000) {
      return sendJson(res, 400, { detail: "Update text must not exceed 1000 characters" });
    }

    const resUpdate = db.prepare(`
      INSERT INTO report_updates (report_id, user_id, text, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(reportId, user.id, text);

    // In-app notification
    db.prepare(`
      INSERT INTO notifications (user_id, report_id, message, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(user.id, reportId, `You added notes to incident #${reportId}`);

    if (report.user_id !== user.id) {
      db.prepare(`
        INSERT INTO notifications (user_id, report_id, message, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(report.user_id, reportId, `A student/faculty member added additional details to your report #${reportId}`);
    }

    return sendJson(res, 201, {
      success: true,
      message: "Update recorded successfully",
      update_id: Number(resUpdate.lastInsertRowid),
      report_id: reportId
    });
  }

  // Report Creation (Student & Faculty only, rate limited 10/10min, max 1000 chars)
  if (pathname === "/api/reports" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) {
      return sendJson(res, 401, { detail: "Authentication required to report an incident" });
    }
    if (user.aud !== "reporter") {
      return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });
    }

    const rateKey = `${user.id}:${clientIp}`;
    if (!checkRateLimit(reportRateLimits, rateKey, 10, 10 * 60 * 1000)) {
      return sendJson(res, 429, { detail: "Rate limit exceeded for report submissions. Please wait before submitting again." });
    }

    const body = await parseRequestBody(req);
    const description = (body.description || "").trim();
    const locationId = Number(body.location_id);

    if (!description) {
      return sendJson(res, 400, { detail: "Description is required" });
    }
    if (description.length > 1000) {
      return sendJson(res, 400, { detail: "Description must not exceed 1000 characters" });
    }
    if (!locationId || isNaN(locationId)) {
      return sendJson(res, 400, { detail: "Valid location_id is required" });
    }

    const locExists = db.prepare("SELECT id FROM locations WHERE id = ?").get(locationId);
    if (!locExists) {
      return sendJson(res, 400, { detail: "Specified location does not exist" });
    }

    // Photo processing (base64 JSON, magic bytes check, max 5MB)
    let photoPath = null;
    let photoUrl = body.photo_url || null;

    if (body.photo_data) {
      let rawBase64 = String(body.photo_data);
      if (rawBase64.includes(";base64,")) {
        rawBase64 = rawBase64.split(";base64,")[1];
      }
      const photoBuffer = Buffer.from(rawBase64, "base64");

      if (photoBuffer.length > 5 * 1024 * 1024) {
        return sendJson(res, 413, { detail: "File size exceeds 5MB limit." });
      }

      const ext = validateImageMagicBytes(photoBuffer);
      if (!ext) {
        return sendJson(res, 400, { detail: "Invalid file type. Only JPEG, PNG, and WebP images are permitted." });
      }

      const filename = `${crypto.randomBytes(16).toString("hex")}${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), photoBuffer);
      photoPath = `/api/photos/${filename}`;
      photoUrl = `/api/photos/${filename}`;
    }

    // AI Classification & Duplicate Check
    const catResult = classifyCategory(description);
    const dupResult = detectDuplicates(description, locationId);
    const userCategory = body.category && body.category !== "Other" ? body.category : catResult.category;
    const prioResult = computePriority(description, userCategory, dupResult.isDuplicate ? 2 : 0);

    const insert = db.prepare(`
      INSERT INTO reports (
        user_id, location_id, description, category, suggested_category,
        priority, status, photo_url, photo_path, assigned_to,
        safety_rule_matched, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, NULL, ?, datetime('now'), datetime('now'))
    `);

    const result = insert.run(
      user.id,
      locationId,
      description,
      userCategory,
      catResult.category,
      prioResult.priority,
      photoUrl,
      photoPath,
      prioResult.safety_rule_matched
    );

    const reportId = Number(result.lastInsertRowid);

    // Initial status_history record (creation)
    db.prepare(`
      INSERT INTO status_history (report_id, from_status, to_status, changed_by, changed_at)
      VALUES (?, NULL, 'pending', ?, datetime('now'))
    `).run(reportId, user.id);

    // Category correction loop (FR-17, AC6.6)
    if (userCategory !== catResult.category) {
      db.prepare(`
        INSERT INTO category_corrections (report_id, suggested_category, final_category, corrected_by, role, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(reportId, catResult.category, userCategory, user.id, user.role);
    }

    // Record AI Telemetry (FR-21, AC6.7)
    db.prepare(`
      INSERT INTO ai_predictions (
        report_id, predicted_category, category_confidence, priority_score,
        duplicate_score, duplicate_of, model_version, safety_rule_matched
      ) VALUES (?, ?, ?, ?, ?, ?, 'v1.1-rules-tfidf', ?)
    `).run(
      reportId,
      catResult.category,
      catResult.confidence,
      prioResult.priority_score,
      dupResult.matchScore,
      dupResult.matchedReportId,
      prioResult.safety_rule_matched
    );

    const createdReport = db.prepare(`
      SELECT r.*, l.block, l.room, u.name as reporter_name, u.role as reporter_role
      FROM reports r
      LEFT JOIN locations l ON r.location_id = l.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.id = ?
    `).get(reportId);

    // CRITICAL: Priority is STAFF-ONLY, omit from reporter response (AC6.5)
    delete createdReport.priority;
    delete createdReport.priority_overridden_by;
    delete createdReport.priority_override_reason;

    return sendJson(res, 201, {
      report: createdReport,
      prediction: {
        predicted_category: catResult.category,
        category_confidence: catResult.confidence,
        duplicate_score: dupResult.matchScore,
        duplicate_of: dupResult.matchedReportId,
        is_duplicate: dupResult.isDuplicate,
        model_version: "v1.1-rules-tfidf"
      }
    });
  }

  // Reporter: Get Own Reports (GET /api/reports/mine) (FR-8, AC6.5)
  if (pathname === "/api/reports/mine" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "reporter") return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });

    // Returns reports created by user OR contributed to via report_updates
    const reports = db.prepare(`
      SELECT DISTINCT r.id, r.description, r.category, r.status, r.photo_url, r.photo_path,
             r.created_at, r.updated_at, r.resolved_at,
             l.block, l.room, l.location_type
      FROM reports r
      LEFT JOIN locations l ON r.location_id = l.id
      LEFT JOIN report_updates ru ON r.id = ru.report_id
      WHERE r.user_id = ? OR ru.user_id = ?
      ORDER BY r.created_at DESC
    `).all(user.id, user.id);

    // Note: r.priority is strictly NOT included, fulfilling AC6.5
    return sendJson(res, 200, { reports });
  }

  // Reporter: View Single Report Details (Ownership enforced, sanitized) (FR-9, AC6.5)
  const repDetailMatch = pathname.match(/^\/api\/reports\/(\d+)$/);
  if (repDetailMatch && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });

    // Staff tokens must use /api/staff/reports/:id
    if (user.aud !== "reporter") {
      return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required. Staff must use /api/staff/reports/:id" });
    }

    const reportId = Number(repDetailMatch[1]);
    const report = db.prepare(`
      SELECT r.id, r.user_id, r.description, r.category, r.status, r.photo_url, r.photo_path,
             r.created_at, r.updated_at, r.resolved_at,
             l.block, l.room, l.location_type
      FROM reports r
      LEFT JOIN locations l ON r.location_id = l.id
      WHERE r.id = ?
    `).get(reportId);

    if (!report) return sendJson(res, 404, { detail: "Report not found" });

    // Ownership or contributed updates check
    const hasContributed = db.prepare("SELECT id FROM report_updates WHERE report_id = ? AND user_id = ?").get(reportId, user.id);
    if (report.user_id !== user.id && !hasContributed) {
      return sendJson(res, 403, { detail: "Forbidden: You can only view your own reports" });
    }

    // Reporter view: Include resolution action if resolved, but NO priority or internal remarks
    let resolutionAction = null;
    if (report.status === "resolved") {
      const resRecord = db.prepare("SELECT action FROM resolutions WHERE report_id = ? ORDER BY id DESC LIMIT 1").get(reportId);
      if (resRecord) resolutionAction = resRecord.action;
    }

    const updates = db.prepare(`
      SELECT text, created_at FROM report_updates WHERE report_id = ? ORDER BY created_at ASC
    `).all(reportId);

    return sendJson(res, 200, {
      report: {
        ...report,
        resolution_action: resolutionAction,
        updates
      }
    });
  }

  // Reporter: View Status History for Own Report
  const repHistoryMatch = pathname.match(/^\/api\/reports\/(\d+)\/history$/);
  if (repHistoryMatch && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "reporter") return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });

    const reportId = Number(repHistoryMatch[1]);
    const report = db.prepare("SELECT user_id, status FROM reports WHERE id = ?").get(reportId);
    if (!report) return sendJson(res, 404, { detail: "Report not found" });

    const hasContributed = db.prepare("SELECT id FROM report_updates WHERE report_id = ? AND user_id = ?").get(reportId, user.id);
    if (report.user_id !== user.id && !hasContributed) {
      return sendJson(res, 403, { detail: "Forbidden: You can only view your own report history" });
    }

    const history = db.prepare(`
      SELECT from_status, to_status, changed_at
      FROM status_history
      WHERE report_id = ?
      ORDER BY changed_at ASC, id ASC
    `).all(reportId);

    return sendJson(res, 200, { history });
  }

  // Reporter: Notifications
  if (pathname === "/api/notifications" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "reporter") return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });

    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC LIMIT 50
    `).all(user.id);

    const unreadCount = notifications.filter(n => !n.read_at).length;
    return sendJson(res, 200, { notifications, unread_count: unreadCount });
  }

  const notifReadMatch = pathname.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (notifReadMatch && method === "PUT") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "reporter") return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });

    const notifId = Number(notifReadMatch[1]);
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?").run(notifId, user.id);
    return sendJson(res, 200, { success: true });
  }

  if (pathname === "/api/notifications/read-all" && method === "PUT") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud !== "reporter") return sendJson(res, 403, { detail: "Forbidden: Reporter portal access required" });

    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(user.id);
    return sendJson(res, 200, { success: true });
  }

  // Legacy GET /api/reports endpoint
  if (pathname === "/api/reports" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { detail: "Authentication required" });
    if (user.aud === "staff") {
      return sendJson(res, 403, { detail: "Forbidden: Staff must query /api/staff/reports" });
    }
    const reports = db.prepare(`
      SELECT r.id, r.description, r.category, r.status, r.photo_url, r.photo_path,
             r.created_at, r.updated_at, r.resolved_at, l.block, l.room
      FROM reports r
      LEFT JOIN locations l ON r.location_id = l.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `).all(user.id);
    return sendJson(res, 200, { reports });
  }

  // -------------------------------------------------------------
  // STAFF PORTAL ENDPOINTS (/api/staff/*)
  // -------------------------------------------------------------

  if (pathname.startsWith("/api/staff/")) {
    const user = getAuthUser(req);
    if (!user) {
      return sendJson(res, 401, { detail: "Authentication required" });
    }
    // Strict audience enforcement: reporter token on /api/staff/* returns 403 (AC5.1)
    if (user.aud !== "staff") {
      return sendJson(res, 403, { detail: "Forbidden: Staff portal access required" });
    }

    // 1. Staff: List Reports with Whitelist Filter Validation (FR-13, AC6.8)
    if (pathname === "/api/staff/reports" && method === "GET") {
      const status = parsedUrl.searchParams.get("status");
      const category = parsedUrl.searchParams.get("category");
      const priority = parsedUrl.searchParams.get("priority");
      const block = parsedUrl.searchParams.get("block");
      const search = parsedUrl.searchParams.get("search");

      // Filter parameter whitelists (AC6.8)
      const ALLOWED_STATUSES = new Set(["all", "pending", "assigned", "in_progress", "resolved"]);
      const ALLOWED_CATEGORIES = new Set(["Electrical", "IT/Wi-Fi", "Equipment", "Water", "Cleanliness", "Furniture", "Safety", "Accessibility"]);
      const ALLOWED_BLOCKS = new Set(["Block 1", "Block 2", "Block 3", "Block 4", "Library"]);
      const ALLOWED_PRIORITIES = new Set(["critical", "high", "medium", "low", "Critical", "High", "Medium", "Low"]);

      if (status && !ALLOWED_STATUSES.has(status)) {
        return sendJson(res, 400, { detail: `Invalid filter parameter: status='${status}'` });
      }
      if (category && !ALLOWED_CATEGORIES.has(category)) {
        return sendJson(res, 400, { detail: `Invalid filter parameter: category='${category}'` });
      }
      if (block && !ALLOWED_BLOCKS.has(block)) {
        return sendJson(res, 400, { detail: `Invalid filter parameter: block='${block}'` });
      }
      if (priority && !ALLOWED_PRIORITIES.has(priority)) {
        return sendJson(res, 400, { detail: `Invalid filter parameter: priority='${priority}'` });
      }

      let query = `
        SELECT r.*,
               u.name as reporter_name, u.role as reporter_role, u.email as reporter_email,
               l.block, l.room, l.latitude, l.longitude,
               s.name as assignee_name, s.role as assignee_role,
               p.category_confidence, p.duplicate_score,
               COALESCE(upd.cnt, 0) as similar_updates_count
        FROM reports r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN locations l ON r.location_id = l.id
        LEFT JOIN users s ON r.assigned_to = s.id
        LEFT JOIN ai_predictions p ON r.id = p.report_id
        LEFT JOIN (SELECT report_id, COUNT(*) as cnt FROM report_updates GROUP BY report_id) upd ON r.id = upd.report_id
        WHERE 1=1
      `;
      const params = [];

      // Technicians see ONLY tickets where assigned_to = their id (FR-3, AC5.3)
      if (user.role === "maintenance") {
        query += " AND r.assigned_to = ?";
        params.push(user.id);
      }

      if (status && status !== "all") {
        query += " AND r.status = ?";
        params.push(status);
      }
      if (category) {
        query += " AND r.category = ?";
        params.push(category);
      }
      if (priority) {
        query += " AND LOWER(r.priority) = LOWER(?)";
        params.push(priority);
      }
      if (block) {
        query += " AND l.block = ?";
        params.push(block);
      }
      if (search) {
        query += " AND (r.description LIKE ? OR l.room LIKE ? OR r.category LIKE ?)";
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      query += " ORDER BY r.created_at DESC";
      const reports = db.prepare(query).all(...params);
      return sendJson(res, 200, { reports, total: reports.length });
    }

    // 2. Staff: Single Report Detail
    const staffRepDetail = pathname.match(/^\/api\/staff\/reports\/(\d+)$/);
    if (staffRepDetail && method === "GET") {
      const reportId = Number(staffRepDetail[1]);
      const report = db.prepare(`
        SELECT r.*,
               u.name as reporter_name, u.role as reporter_role, u.email as reporter_email,
               l.block, l.room, l.latitude, l.longitude,
               s.name as assignee_name, s.role as assignee_role
        FROM reports r
        LEFT JOIN users u ON r.user_id = u.id
        LEFT JOIN locations l ON r.location_id = l.id
        LEFT JOIN users s ON r.assigned_to = s.id
        WHERE r.id = ?
      `).get(reportId);

      if (!report) return sendJson(res, 404, { detail: "Report not found" });

      if (user.role === "maintenance" && report.assigned_to !== user.id) {
        return sendJson(res, 403, { detail: "Forbidden: You can only view tickets assigned to you" });
      }

      const resolutions = db.prepare(`
        SELECT res.*, u.name as staff_name, u.role as staff_role
        FROM resolutions res
        LEFT JOIN users u ON res.staff_id = u.id
        WHERE res.report_id = ?
        ORDER BY res.created_at ASC
      `).all(reportId);

      const updates = db.prepare(`
        SELECT ru.*, u.name as user_name, u.role as user_role
        FROM report_updates ru
        LEFT JOIN users u ON ru.user_id = u.id
        WHERE ru.report_id = ?
        ORDER BY ru.created_at ASC
      `).all(reportId);

      return sendJson(res, 200, { report, resolutions, updates });
    }

    // 3. Staff: Priority Override (PATCH /api/staff/reports/:id/priority) (FR-18, FR-19, Goal 3b)
    const staffPrioMatch = pathname.match(/^\/api\/staff\/reports\/(\d+)\/priority$/);
    if (staffPrioMatch && (method === "PATCH" || method === "PUT")) {
      if (user.role !== "admin" && user.role !== "super_admin") {
        return sendJson(res, 403, { detail: "Only administrators can override ticket priority" });
      }
      const reportId = Number(staffPrioMatch[1]);
      const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
      if (!report) return sendJson(res, 404, { detail: "Report not found" });

      const body = await parseRequestBody(req);
      const newPrio = (body.priority || "").toLowerCase();
      const validPrios = ["critical", "high", "medium", "low"];
      if (!validPrios.includes(newPrio)) {
        return sendJson(res, 400, { detail: "Priority must be critical, high, medium, or low" });
      }

      const reason = (body.reason || `Manual override by Admin (${user.name})`).trim();
      db.prepare(`
        UPDATE reports SET
          priority = ?,
          priority_overridden_by = ?,
          priority_override_reason = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(newPrio, user.id, reason, reportId);

      const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
      return sendJson(res, 200, { success: true, report: updated });
    }

    // 4. Staff: Category Correction (PATCH /api/staff/reports/:id/category) (FR-17, AC6.6)
    const staffCatMatch = pathname.match(/^\/api\/staff\/reports\/(\d+)\/category$/);
    if (staffCatMatch && (method === "PATCH" || method === "PUT")) {
      if (user.role !== "admin" && user.role !== "super_admin") {
        return sendJson(res, 403, { detail: "Only administrators can correct incident category" });
      }
      const reportId = Number(staffCatMatch[1]);
      const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
      if (!report) return sendJson(res, 404, { detail: "Report not found" });

      const body = await parseRequestBody(req);
      const newCat = (body.category || "").trim();
      const validCats = ["Electrical", "IT/Wi-Fi", "Equipment", "Water", "Cleanliness", "Furniture", "Safety", "Accessibility"];
      if (!validCats.includes(newCat)) {
        return sendJson(res, 400, { detail: "Invalid category selection" });
      }

      db.prepare(`
        INSERT INTO category_corrections (report_id, suggested_category, final_category, corrected_by, role, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(reportId, report.category, newCat, user.id, user.role);

      db.prepare(`
        UPDATE reports SET
          category = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(newCat, reportId);

      const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
      return sendJson(res, 200, { success: true, report: updated });
    }

    // 5. Staff: Category Corrections Export (GET /api/staff/corrections/export) (FR-17, AC6.6)
    if (pathname === "/api/staff/corrections/export" && method === "GET") {
      const rows = db.prepare(`
        SELECT c.id, c.report_id, c.suggested_category, c.final_category,
               u.name as corrected_by_name, c.role, c.created_at
        FROM category_corrections c
        LEFT JOIN users u ON c.corrected_by = u.id
        ORDER BY c.id ASC
      `).all();

      let csv = "id,report_id,suggested_category,final_category,corrected_by,role,created_at\r\n";
      for (const r of rows) {
        csv += `${r.id},${r.report_id},"${r.suggested_category || ""}","${r.final_category || ""}","${r.corrected_by_name || r.role}","${r.role}","${r.created_at}"\r\n`;
      }

      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"category_corrections.csv\"",
        "Access-Control-Allow-Origin": "*"
      });
      return res.end(csv);
    }

    // 6. Staff: Block Heat Map Drill-down Summary (GET /api/staff/blocks/:block/summary) (FR-15, FR-25, AC6.9)
    const blockMatch = pathname.match(/^\/api\/staff\/blocks\/([^\/]+)\/summary$/);
    if (blockMatch && method === "GET") {
      const blockName = decodeURIComponent(blockMatch[1]);
      const total = db.prepare("SELECT COUNT(*) as c FROM reports r JOIN locations l ON r.location_id = l.id WHERE l.block = ?").get(blockName).c;
      const open = db.prepare("SELECT COUNT(*) as c FROM reports r JOIN locations l ON r.location_id = l.id WHERE l.block = ? AND r.status != 'resolved'").get(blockName).c;
      const resolved = db.prepare("SELECT COUNT(*) as c FROM reports r JOIN locations l ON r.location_id = l.id WHERE l.block = ? AND r.status = 'resolved'").get(blockName).c;

      const topCats = db.prepare(`
        SELECT r.category, COUNT(*) as count
        FROM reports r
        JOIN locations l ON r.location_id = l.id
        WHERE l.block = ?
        GROUP BY r.category
        ORDER BY count DESC
      `).all(blockName);

      const resolvedDiffs = db.prepare(`
        SELECT (julianday(r.resolved_at) - julianday(r.created_at)) * 24.0 as hours
        FROM reports r
        JOIN locations l ON r.location_id = l.id
        WHERE l.block = ? AND r.status = 'resolved' AND r.resolved_at IS NOT NULL
      `).all(blockName);

      let avgHours = 0;
      if (resolvedDiffs.length > 0) {
        const sum = resolvedDiffs.reduce((acc, x) => acc + (Number(x.hours) || 0), 0);
        avgHours = Number((sum / resolvedDiffs.length).toFixed(1));
      }

      return sendJson(res, 200, {
        block: blockName,
        total_reports: total,
        open_reports: open,
        resolved_reports: resolved,
        top_categories: topCats,
        avg_resolution_hours: avgHours,
        notice: "Patterns are leads to investigate, not proven causes"
      });
    }

    // 7. Staff: Update / Transition Ticket (PUT/PATCH /api/staff/reports/:id)
    const staffRepUpdate = pathname.match(/^\/api\/staff\/reports\/(\d+)$/);
    if (staffRepUpdate && (method === "PUT" || method === "PATCH")) {
      const reportId = Number(staffRepUpdate[1]);
      const body = await parseRequestBody(req);

      const existing = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
      if (!existing) return sendJson(res, 404, { detail: "Report not found" });

      const currentStatus = existing.status;
      const requestedStatus = body.status !== undefined ? body.status : currentStatus;
      const requestedAssignee = body.assigned_to !== undefined ? Number(body.assigned_to) : existing.assigned_to;
      const requestedCategory = body.category !== undefined ? body.category : existing.category;
      const requestedPriority = body.priority !== undefined ? body.priority : existing.priority;
      const remarks = (body.remarks || "").trim();

      if (remarks.length > 1000) {
        return sendJson(res, 400, { detail: "Remarks must not exceed 1000 characters" });
      }

      if (currentStatus === "resolved" && requestedStatus !== "resolved") {
        return sendJson(res, 400, { detail: "Resolved tickets cannot be reopened" });
      }

      if (requestedStatus !== currentStatus) {
        if (currentStatus === "pending" && requestedStatus === "assigned") {
          if (user.role !== "admin" && user.role !== "super_admin") {
            return sendJson(res, 403, { detail: "Only administrators can assign tickets" });
          }
          if (!requestedAssignee) {
            return sendJson(res, 400, { detail: "Must choose an active Maintenance technician when assigning" });
          }
          const staffUser = db.prepare("SELECT id, role, name FROM users WHERE id = ?").get(requestedAssignee);
          if (!staffUser || staffUser.role !== "maintenance") {
            return sendJson(res, 400, { detail: "Assignee must be an active maintenance technician" });
          }
          db.prepare(`
            INSERT INTO resolutions (report_id, staff_id, action, remarks, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).run(reportId, user.id, `Assigned to technician ${staffUser.name} (#${staffUser.id})`, remarks || null);

          db.prepare(`
            INSERT INTO status_history (report_id, from_status, to_status, changed_by, changed_at)
            VALUES (?, 'pending', 'assigned', ?, datetime('now'))
          `).run(reportId, user.id);

          db.prepare(`
            INSERT INTO notifications (user_id, report_id, message, created_at)
            VALUES (?, ?, ?, datetime('now'))
          `).run(existing.user_id, reportId, `Your incident #${reportId} status updated to Assigned`);
        } else if (currentStatus === "assigned" && requestedStatus === "in_progress") {
          const isAssignee = user.role === "maintenance" && user.id === existing.assigned_to;
          const isAdmin = user.role === "admin" || user.role === "super_admin";
          if (!isAssignee && !isAdmin) {
            return sendJson(res, 403, { detail: "Only the assigned technician or an admin can start work on this ticket" });
          }
          db.prepare(`
            INSERT INTO resolutions (report_id, staff_id, action, remarks, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).run(reportId, user.id, "Started work on incident", remarks || null);

          db.prepare(`
            INSERT INTO status_history (report_id, from_status, to_status, changed_by, changed_at)
            VALUES (?, 'assigned', 'in_progress', ?, datetime('now'))
          `).run(reportId, user.id);

          db.prepare(`
            INSERT INTO notifications (user_id, report_id, message, created_at)
            VALUES (?, ?, ?, datetime('now'))
          `).run(existing.user_id, reportId, `Your incident #${reportId} status updated to In progress`);
        } else {
          return sendJson(res, 400, {
            detail: `Invalid status transition from '${currentStatus}' to '${requestedStatus}'. Allowed flow: Pending -> Assigned -> In Progress -> Resolved.`
          });
        }
      } else {
        if (requestedAssignee !== existing.assigned_to) {
          if (user.role !== "admin" && user.role !== "super_admin") {
            return sendJson(res, 403, { detail: "Only administrators can reassign tickets" });
          }
          const staffUser = db.prepare("SELECT id, role, name FROM users WHERE id = ?").get(requestedAssignee);
          if (!staffUser || staffUser.role !== "maintenance") {
            return sendJson(res, 400, { detail: "Assignee must be an active maintenance technician" });
          }
          db.prepare(`
            INSERT INTO resolutions (report_id, staff_id, action, remarks, created_at)
            VALUES (?, ?, ?, ?, datetime('now'))
          `).run(reportId, user.id, `Reassigned ticket to technician ${staffUser.name} (#${staffUser.id})`, remarks || null);
        }
      }

      db.prepare(`
        UPDATE reports SET
          status = ?,
          assigned_to = ?,
          category = ?,
          priority = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(requestedStatus, requestedAssignee, requestedCategory, requestedPriority, reportId);

      const updated = db.prepare(`
        SELECT r.*, l.block, l.room, s.name as assignee_name, u.name as reporter_name
        FROM reports r
        LEFT JOIN locations l ON r.location_id = l.id
        LEFT JOIN users s ON r.assigned_to = s.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.id = ?
      `).get(reportId);

      return sendJson(res, 200, {
        ...updated,
        report: updated
      });
    }

    // 8. Staff: Resolve Ticket (POST /api/staff/reports/:id/resolve)
    const staffResolve = pathname.match(/^\/api\/staff\/reports\/(\d+)\/resolve$/);
    if (staffResolve && method === "POST") {
      const reportId = Number(staffResolve[1]);
      const body = await parseRequestBody(req);

      const existing = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
      if (!existing) return sendJson(res, 404, { detail: "Report not found" });

      if (existing.status === "pending") {
        return sendJson(res, 400, {
          detail: "Cannot resolve a Pending ticket. Tickets must transition: Pending -> Assigned -> In Progress -> Resolved."
        });
      }

      const isAssignee = user.role === "maintenance" && user.id === existing.assigned_to;
      const isAdmin = user.role === "admin" || user.role === "super_admin";
      if (!isAssignee && !isAdmin) {
        return sendJson(res, 403, { detail: "Forbidden: You are not authorized to resolve this ticket" });
      }

      const actionText = (body.action || "").trim();
      const remarks = (body.remarks || "").trim();
      if (!actionText) {
        return sendJson(res, 400, { detail: "Resolution action text is required" });
      }
      if (actionText.length > 1000) {
        return sendJson(res, 400, { detail: "Action text must not exceed 1000 characters" });
      }
      if (remarks.length > 1000) {
        return sendJson(res, 400, { detail: "Remarks must not exceed 1000 characters" });
      }

      db.prepare(`
        INSERT INTO resolutions (report_id, staff_id, action, remarks, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(reportId, user.id, actionText, remarks || null);

      db.prepare(`
        INSERT INTO status_history (report_id, from_status, to_status, changed_by, changed_at)
        VALUES (?, ?, 'resolved', ?, datetime('now'))
      `).run(reportId, existing.status, user.id);

      db.prepare(`
        INSERT INTO notifications (user_id, report_id, message, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(existing.user_id, reportId, `Your incident #${reportId} has been resolved: ${actionText}`);

      db.prepare(`
        UPDATE reports SET
          status = 'resolved',
          resolved_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?
      `).run(reportId);

      const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
      return sendJson(res, 200, {
        success: true,
        message: "Ticket marked resolved",
        report: updated
      });
    }

    // 9. Staff: Analytics Summary
    if (pathname === "/api/staff/analytics/summary" && method === "GET") {
      const total = db.prepare("SELECT COUNT(*) as count FROM reports").get().count;
      const pending = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'pending'").get().count;
      const assigned = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'assigned'").get().count;
      const inProgress = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'in_progress'").get().count;
      const resolved = db.prepare("SELECT COUNT(*) as count FROM reports WHERE status = 'resolved'").get().count;
      const today = db.prepare("SELECT COUNT(*) as count FROM reports WHERE date(created_at) = date('now')").get().count;

      const resolvedDiffs = db.prepare(`
        SELECT (julianday(resolved_at) - julianday(created_at)) * 24.0 as hours
        FROM reports
        WHERE status = 'resolved' AND resolved_at IS NOT NULL
      `).all();

      let avgHours = 0;
      if (resolvedDiffs.length > 0) {
        const sumHours = resolvedDiffs.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
        avgHours = Number((sumHours / resolvedDiffs.length).toFixed(1));
      }

      return sendJson(res, 200, {
        total_reports: total,
        pending_reports: pending,
        assigned_reports: assigned,
        in_progress_reports: inProgress,
        resolved_reports: resolved,
        open_reports: pending + assigned + inProgress,
        avg_resolution_hours: avgHours,
        has_resolved_tickets: resolved > 0,
        reports_today: today,
        reports_this_week: total
      });
    }

    // 10. Staff: Analytics Heatmap
    if (pathname === "/api/staff/analytics/heatmap" && method === "GET") {
      const rows = db.prepare(`
        SELECT l.id, l.block, l.room, l.latitude, l.longitude,
               COUNT(r.id) as total,
               SUM(CASE WHEN r.status != 'resolved' THEN 1 ELSE 0 END) as open,
               SUM(CASE WHEN r.status = 'resolved' THEN 1 ELSE 0 END) as resolved
        FROM locations l
        LEFT JOIN reports r ON l.id = r.location_id
        GROUP BY l.id
      `).all();

      const locations = rows.map(r => ({
        id: r.id,
        block: r.block,
        room: r.room,
        latitude: r.latitude,
        longitude: r.longitude,
        total: Number(r.total) || 0,
        open: Number(r.open) || 0,
        resolved: Number(r.resolved) || 0
      }));

      return sendJson(res, 200, { locations });
    }

    // 11. Staff: Analytics Categories
    if (pathname === "/api/staff/analytics/categories" && method === "GET") {
      const rows = db.prepare(`
        SELECT category, COUNT(*) as count
        FROM reports
        GROUP BY category
        ORDER BY count DESC
      `).all();

      const total = rows.reduce((acc, r) => acc + r.count, 0) || 1;
      const data = rows.map(r => ({
        category: r.category,
        count: r.count,
        percentage: Number(((r.count / total) * 100).toFixed(1))
      }));

      return sendJson(res, 200, { data });
    }

    // 12. Staff: Staff Directory
    if (pathname === "/api/staff/staff" && method === "GET") {
      const staff = db.prepare(`
        SELECT u.id, u.name, u.email, u.department,
               COUNT(r.id) as assigned_count
        FROM users u
        LEFT JOIN reports r ON u.id = r.assigned_to AND r.status != 'resolved'
        WHERE u.role = 'maintenance'
        GROUP BY u.id
        ORDER BY u.id
      `).all();
      return sendJson(res, 200, { staff });
    }

    // 13. Staff: Users (Admin only)
    if (pathname === "/api/staff/users" && method === "GET") {
      if (user.role !== "admin" && user.role !== "super_admin") {
        return sendJson(res, 403, { detail: "Forbidden: Admin access required" });
      }
      const users = db.prepare("SELECT id, name, email, role, department, created_at FROM users ORDER BY id").all();
      return sendJson(res, 200, { users });
    }

    // 14. Staff: QR Codes
    if (pathname === "/api/staff/qr-codes" && method === "GET") {
      const locations = db.prepare("SELECT id, block, room, floor, location_type, qr_token FROM locations ORDER BY block, room").all();
      const qrList = locations.map(l => ({
        ...l,
        qr_url: `/r/${l.qr_token}`,
        full_url: `http://localhost:${PORT}/r/${l.qr_token}`
      }));
      return sendJson(res, 200, { qr_codes: qrList });
    }

    return sendJson(res, 404, { detail: "Staff endpoint not found" });
  }

  // -------------------------------------------------------------
  // STATIC FILE SERVER & SEPARATE ROUTING
  // -------------------------------------------------------------

  const staticMimes = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon"
  };

  // Nested asset resolution: handles relative asset paths like /r/qr_.../styles.css, /staff/styles.css, etc.
  const reqExt = path.extname(pathname).toLowerCase();
  if (reqExt && staticMimes[reqExt]) {
    let candidate = path.join(PUBLIC_DIR, pathname);
    if (!fs.existsSync(candidate)) {
      candidate = path.join(PUBLIC_DIR, path.basename(pathname));
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      res.writeHead(200, { "Content-Type": staticMimes[reqExt] });
      return fs.createReadStream(candidate).pipe(res);
    }
  }

  // Staff Portal Route: /staff/* serves public/staff.html
  if (pathname.startsWith("/staff")) {
    const staffHtml = path.join(PUBLIC_DIR, "staff.html");
    if (fs.existsSync(staffHtml)) {
      res.writeHead(200, { "Content-Type": "text/html" });
      return fs.createReadStream(staffHtml).pipe(res);
    }
  }

  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
  if (!path.extname(filePath)) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallback = path.join(PUBLIC_DIR, "index.html");
      if (fs.existsSync(fallback)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        return fs.createReadStream(fallback).pipe(res);
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found");
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": staticMimes[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(handleRequest);

const HOST = process.env.HOST || "0.0.0.0";

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Campus Black Box Server running on port ${PORT}!`);
    console.log(`🔗 Access URL: http://${HOST === "0.0.0.0" ? "localhost" : HOST}:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = {
  server,
  handleRequest,
  db,
  seedData,
  validateReturnUrl,
  evaluateSafetyRules,
  computePriority,
  classifyCategory,
  detectDuplicates,
  DUPLICATE_THRESHOLD
};
