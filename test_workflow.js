/**
 * Campus Black Box — Comprehensive Verification Test Suite
 * Iteration 3: Strict Staff/Reporter Portal Separation, State Machine Lifecycle,
 * Truthful AI Intelligence, QR Deep Links, Audit Trail, and Real Photo Validation.
 * Tests AC1.1 to AC5.10 (31 Automated Acceptance Criteria).
 */

const { handleRequest, db, seedData, validateReturnUrl, validateStartupConfig, migrateLegacyTimestampsToIsoUtc } = require("./server.js");
const { Readable } = require("node:stream");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { spawnSync } = require("node:child_process");

// In-process mock request helper
function request(method, reqPath, body = null, token = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const req = new Readable({
      read() {
        if (body) {
          this.push(typeof body === "string" ? body : JSON.stringify(body));
        }
        this.push(null);
      }
    });

    req.method = method;
    req.url = reqPath;
    req.headers = {
      host: "localhost:3000",
      "content-type": "application/json",
      ...extraHeaders
    };
    if (token) {
      req.headers["authorization"] = `Bearer ${token}`;
    }

    class MockResponse extends EventEmitter {
      constructor() {
        super();
        this.statusCode = 200;
        this.headers = {};
        this._chunks = [];
      }
      writeHead(code, headers = {}) {
        this.statusCode = code;
        for (const [k, v] of Object.entries(headers)) {
          this.headers[k.toLowerCase()] = v;
        }
        return this;
      }
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      }
      getHeader(name) {
        return this.headers[name.toLowerCase()];
      }
      write(chunk) {
        if (chunk) this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return true;
      }
      end(chunk) {
        if (chunk) this._chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        const rawBuffer = Buffer.concat(this._chunks);
        const data = rawBuffer.toString("utf8");
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: this.statusCode, headers: this.headers, body: parsed, raw: data, rawBuffer });
        } catch {
          resolve({ status: this.statusCode, headers: this.headers, body: data, raw: data, rawBuffer });
        }
      }
    }

    const res = new MockResponse();
    handleRequest(req, res).catch(reject);
  });
}

// Assert helper
let totalPassed = 0;
let totalFailed = 0;
const results = [];

function assert(condition, testId, description) {
  if (condition) {
    totalPassed++;
    results.push({ testId, description, status: "PASS" });
    console.log(`  ✅ [PASS] ${testId}: ${description}`);
  } else {
    totalFailed++;
    results.push({ testId, description, status: "FAIL" });
    console.error(`  ❌ [FAIL] ${testId}: ${description}`);
  }
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   CAMPUS BLACK BOX — AUTOMATED ACCEPTANCE TESTS");
  console.log("   Iteration 3: Reporter Site & Staff Portal Separation");
  console.log("=======================================================\n");

  // Reset database to pristine seeded state
  seedData(true);

  // Authenticate test accounts with separate portals
  console.log("--- Authenticating Test Accounts ---");
  const studentLogin = await request("POST", "/api/auth/login", {
    email: "student@campus.edu",
    password: "DemoPass123!"
  });
  const studentToken = studentLogin.body.token || studentLogin.body.access_token;

  const facultyLogin = await request("POST", "/api/auth/login", {
    email: "faculty@campus.edu",
    password: "DemoPass123!"
  });
  const facultyToken = facultyLogin.body.token || facultyLogin.body.access_token;

  const tech1Login = await request("POST", "/api/staff/auth/login", {
    email: "tech1@campus.edu",
    password: "DemoPass123!"
  });
  const tech1Token = tech1Login.body.token || tech1Login.body.access_token;

  const tech2Login = await request("POST", "/api/staff/auth/login", {
    email: "tech2@campus.edu",
    password: "DemoPass123!"
  });
  const tech2Token = tech2Login.body.token || tech2Login.body.access_token;

  const adminLogin = await request("POST", "/api/staff/auth/login", {
    email: "admin@campus.edu",
    password: "DemoPass123!"
  });
  const adminToken = adminLogin.body.token || adminLogin.body.access_token;

  // -------------------------------------------------------------
  // GOAL 1: AUTHENTICATION & AUTHORIZATION (AC1.1 - AC1.6)
  // -------------------------------------------------------------
  console.log("\n--- Goal 1: Authentication & Authorization ---");

  // AC1.1: Request without Bearer token returns 401
  const unauthRes = await request("GET", "/api/reports");
  assert(unauthRes.status === 401, "AC1.1", "GET /api/reports without token returns 401 Unauthorized");

  // AC1.2: Student calling staff admin endpoints returns 403
  const studentAdminRes = await request("GET", "/api/staff/users", null, studentToken);
  assert(studentAdminRes.status === 403, "AC1.2", "Student calling /api/staff/users returns 403 Forbidden");

  // AC1.3: Maintenance technician sees only their own assigned tickets
  const tech1Reports = await request("GET", "/api/staff/reports", null, tech1Token);
  const tech1Tickets = tech1Reports.body.reports || [];
  const onlyTech1Assigned = tech1Tickets.every(t => t.assigned_to === 3);
  assert(
    tech1Reports.status === 200 && onlyTech1Assigned && tech1Tickets.length > 0,
    "AC1.3",
    "Maintenance technician sees only their own assigned tickets on /api/staff/reports"
  );

  // AC1.4: Staff list endpoint returns 403 for Student and 200 for Admin
  const studentStaffRes = await request("GET", "/api/staff/staff", null, studentToken);
  const adminStaffRes = await request("GET", "/api/staff/staff", null, adminToken);
  assert(
    studentStaffRes.status === 403 && adminStaffRes.status === 200 && Array.isArray(adminStaffRes.body.staff),
    "AC1.4",
    "Admin staff endpoint returns 403 for Student and 200 for Admin"
  );

  // AC1.5: Tampered token returns 401
  const tamperedToken = studentToken.slice(0, -6) + "xxxxxx";
  const tamperedRes = await request("GET", "/api/auth/me", null, tamperedToken);
  assert(tamperedRes.status === 401, "AC1.5", "Tampered or invalid JWT signature returns 401 Unauthorized");

  // AC1.6: Password storage verification in database
  const users = db.prepare("SELECT email, password_hash FROM users").all();
  const allHashedWithScrypt = users.every(u => {
    const parts = u.password_hash.split(":");
    return parts.length === 2 && parts[0].length === 32 && parts[1].length === 128;
  });
  assert(allHashedWithScrypt, "AC1.6", "All user passwords in SQLite are salted and hashed with scrypt");

  // -------------------------------------------------------------
  // GOAL 2: TICKET LIFECYCLE & RESOLUTION AUDITING (AC2.1 - AC2.6)
  // -------------------------------------------------------------
  console.log("\n--- Goal 2: Ticket Lifecycle & Resolution Auditing ---");

  // AC2.1: Transition Pending -> Resolved directly is rejected with 400
  // Incident #2 is pending in fresh seed
  const invalidTransitionRes = await request("PUT", "/api/staff/reports/2", { status: "resolved" }, adminToken);
  const invalidDirectResolveRes = await request("POST", "/api/staff/reports/2/resolve", { action: "Quick fixed" }, adminToken);
  assert(
    invalidTransitionRes.status === 400 && invalidDirectResolveRes.status === 400,
    "AC2.1",
    "Direct transition from Pending -> Resolved is rejected with 400 Bad Request"
  );

  // AC2.2: Resolving In-Progress ticket requires non-empty action text
  // Incident #1 is in_progress, assigned to Tech 1 (id: 3)
  const emptyActionRes = await request("POST", "/api/staff/reports/1/resolve", { action: "   " }, tech1Token);
  assert(emptyActionRes.status === 400, "AC2.2a", "Resolving without action text is rejected with 400");

  const validActionRes = await request("POST", "/api/staff/reports/1/resolve", {
    action: "Replaced blown projector bulb and cleaned dust filters",
    remarks: "Tested HDMI input for 30 minutes at 1080p 60Hz"
  }, tech1Token);
  assert(
    validActionRes.status === 200 && validActionRes.body.report.status === "resolved",
    "AC2.2b",
    "Resolving with action text sets status to resolved and populates resolved_at"
  );

  // AC2.3: Technician not assigned cannot resolve ticket
  // Ticket #4 is assigned to Tech 2 (id: 4). Transition to in_progress first by admin
  await request("PUT", "/api/staff/reports/4", { status: "in_progress" }, adminToken);
  const unassignedTechResolve = await request("POST", "/api/staff/reports/4/resolve", {
    action: "Attempt unauthorized fix"
  }, tech1Token);
  assert(
    unassignedTechResolve.status === 403,
    "AC2.3",
    "Technician not assigned to ticket is rejected with 403 Forbidden on resolve"
  );

  // AC2.4: Admin triage assigns technician and transitions ticket correctly
  // Assign ticket #2 (Pending) to Tech 1
  const assignRes = await request("PUT", "/api/staff/reports/2", {
    assigned_to: 3,
    status: "assigned"
  }, adminToken);
  assert(
    assignRes.status === 200 && assignRes.body.status === "assigned" && assignRes.body.assigned_to === 3,
    "AC2.4",
    "Admin correctly assigns technician and advances Pending ticket to Assigned"
  );

  // AC2.5: Analytics KPI counts sum to Total and compute turnaround
  const summaryRes = await request("GET", "/api/staff/analytics/summary", null, adminToken);
  const sum = summaryRes.body;
  const countsSumCorrectly =
    sum.pending_reports + sum.assigned_reports + sum.in_progress_reports + sum.resolved_reports === sum.total_reports;
  assert(
    summaryRes.status === 200 && countsSumCorrectly && typeof sum.avg_resolution_hours === "number",
    "AC2.5",
    `KPI counts strictly sum to Total (${sum.pending_reports}+${sum.assigned_reports}+${sum.in_progress_reports}+${sum.resolved_reports} = ${sum.total_reports})`
  );

  // AC2.6: Resolution creates audit record in resolutions table
  const resolutionRecords = db.prepare("SELECT * FROM resolutions WHERE report_id = 1").all();
  assert(
    resolutionRecords.length > 0 && resolutionRecords.some(r => r.action && r.action.includes("projector bulb")),
    "AC2.6",
    "Resolving creates permanent audit record in resolutions table"
  );

  // -------------------------------------------------------------
  // GOAL 3: TRUTHFUL AI PREDICTION (AC3.1 - AC3.4)
  // -------------------------------------------------------------
  console.log("\n--- Goal 3: Truthful AI Categorization ---");

  // AC3.1: Empty or short input (<15 chars) returns neutral state (no hallucinated confidence)
  const shortAiRes = await request("POST", "/api/ai/predict", { description: "fan slow" });
  assert(
    shortAiRes.status === 200 && shortAiRes.body.category === null && shortAiRes.body.confidence === null,
    "AC3.1",
    "Inputs < 15 characters return neutral state (null category & confidence)"
  );

  // AC3.2: Distinct textual descriptions return distinct relevant categories
  const electricalAi = await request("POST", "/api/ai/predict", {
    description: "ceiling fan capacitor dead regulator burnt speed not rotating screeching noise"
  });
  const waterAi = await request("POST", "/api/ai/predict", {
    description: "water leaking from bathroom pipe joint continuous flooding floor"
  });
  assert(
    electricalAi.body.category === "Electrical" && waterAi.body.category === "Water",
    "AC3.2",
    `TF-IDF model correctly distinguishes Electrical (${electricalAi.body.category}) from Water (${waterAi.body.category})`
  );

  // AC3.3: Report creation succeeds with manual category when AI is not invoked
  const newReportRes = await request("POST", "/api/reports", {
    location_id: 1,
    description: "Emergency desk leg detached and collapsed during lecture examination",
    category: "Furniture"
  }, studentToken);
  assert(
    newReportRes.status === 201 && newReportRes.body.report.category === "Furniture",
    "AC3.3",
    "Incident report creation succeeds with manual category fallback"
  );

  // AC3.4: Predictions are stored with model_version
  const predRecords = db.prepare("SELECT * FROM ai_predictions ORDER BY id DESC LIMIT 1").all();
  assert(
    predRecords.length > 0 && predRecords[0].model_version.includes("tfidf"),
    "AC3.4",
    `AI predictions logged with version tracking (${predRecords[0]?.model_version})`
  );

  // -------------------------------------------------------------
  // GOAL 4: QR DEEP LINK & LOCATION HANDLING (AC4.1 - AC4.4)
  // -------------------------------------------------------------
  console.log("\n--- Goal 4: QR Deep Link & Location Handling ---");

  // AC4.1: Valid token resolves to verified read-only location
  const validQr = await request("GET", "/api/locations/qr/qr_b3_302_x2m1");
  assert(
    validQr.status === 200 && validQr.body.location.block === "Block 3" && validQr.body.location.room === "Room 302",
    "AC4.1",
    `Valid QR token resolves correctly to ${validQr.body.location?.block} · ${validQr.body.location?.room}`
  );

  // AC4.2: Invalid QR token returns 404 (no form rendered)
  const invalidQr = await request("GET", "/api/locations/qr/invalid_token_99999");
  assert(
    invalidQr.status === 404 && invalidQr.body.detail.includes("Invalid"),
    "AC4.2",
    "Invalid QR token returns 404 Not Found"
  );

  // AC4.3: Unauthenticated user reporting gets blocked; authenticated user succeeds
  const unauthReport = await request("POST", "/api/reports", {
    location_id: 6,
    description: "Valid report attempt but without authentication credentials",
    category: "Equipment"
  });
  assert(
    unauthReport.status === 401,
    "AC4.3",
    "Submitting incident via QR deep link strictly requires reporter authentication"
  );

  // AC4.4: QR tokens are distinct and non-guessable across rooms
  const loc1 = await request("GET", "/api/locations/qr/qr_b1_114_k8a9");
  const loc2 = await request("GET", "/api/locations/qr/qr_b2_gf_c4v8");
  assert(
    loc1.status === 200 && loc2.status === 200 && loc1.body.location.id !== loc2.body.location.id,
    "AC4.4",
    "Different rooms have distinct non-guessable QR tokens with separate location bindings"
  );

  // -------------------------------------------------------------
  // GOAL 5: ITERATION 3 STAFF/REPORTER SEPARATION & SECURITY (AC5.1 - AC5.10)
  // -------------------------------------------------------------
  console.log("\n--- Goal 5: Iteration 3 Architecture & Security (AC5.1 - AC5.10) ---");

  // AC5.1: Audience Token Enforcement
  // Reporter token on /api/staff/* returns 403; staff token on reporter-only endpoints returns 403
  const repOnStaff = await request("GET", "/api/staff/reports", null, studentToken);
  const staffOnRepMine = await request("GET", "/api/reports/mine", null, adminToken);
  assert(
    repOnStaff.status === 403 && staffOnRepMine.status === 403,
    "AC5.1",
    "Audience check: Reporter token on /api/staff/* returns 403; Staff token on /api/reports/mine returns 403"
  );

  // AC5.2: Cross-Portal Login Boundaries & Generic 401s
  // Student credentials on staff login returns 401; Staff credentials on reporter login returns 401
  const studentOnStaffLogin = await request("POST", "/api/staff/auth/login", {
    email: "student@campus.edu",
    password: "DemoPass123!"
  });
  const adminOnReporterLogin = await request("POST", "/api/auth/login", {
    email: "admin@campus.edu",
    password: "DemoPass123!"
  });
  assert(
    studentOnStaffLogin.status === 401 &&
    studentOnStaffLogin.body.detail === "Invalid credentials" &&
    adminOnReporterLogin.status === 401 &&
    adminOnReporterLogin.body.detail === "Invalid credentials",
    "AC5.2",
    "Cross-portal logins return generic 401 'Invalid credentials' with zero role enumeration"
  );

  // AC5.3: Technician Sees ONLY Assigned Tickets (No 'OR user_id')
  // Create an unassigned report where user_id is tech1 (id: 3)
  const techCreatedReport = db.prepare(`
    INSERT INTO reports (user_id, location_id, description, category, suggested_category, priority, status, assigned_to)
    VALUES (3, 2, 'Unassigned ticket created by technician profile', 'Equipment', 'Equipment', 'Low', 'pending', NULL)
    RETURNING id
  `).get();
  const tech1View = await request("GET", "/api/staff/reports", null, tech1Token);
  const tech1VisibleIds = (tech1View.body.reports || []).map(r => r.id);
  const unassignedExcluded = !tech1VisibleIds.includes(techCreatedReport.id);
  assert(
    unassignedExcluded,
    "AC5.3",
    "Technicians see ONLY tickets where assigned_to = their id (unassigned ticket created by tech is excluded)"
  );

  // AC5.4: Report Ownership Check (Ownership Enforced)
  // Reporter A (student id: 1) attempts to fetch report owned by faculty (id: 2)
  // In seedData, report #1 is owned by Student (id: 1), report #3 is owned by Faculty (id: 2)
  const studentViewingFacultyRep = await request("GET", "/api/reports/3", null, studentToken);
  assert(
    studentViewingFacultyRep.status === 403,
    "AC5.4",
    "Reporter viewing another reporter's report returns 403 Forbidden"
  );

  // AC5.5: Full Status History Audit & Notifications
  // Check that report #1 has status_history records from pending -> assigned -> in_progress -> resolved
  const rep1 = db.prepare("SELECT user_id FROM reports WHERE id = 1").get();
  const historyRows = db.prepare("SELECT * FROM status_history WHERE report_id = 1 ORDER BY changed_at ASC").all();
  const notifRows = db.prepare("SELECT * FROM notifications WHERE report_id = 1").all();
  const hasResolvedTransition = historyRows.some(h => h.to_status === "resolved");
  const hasReporterNotification = notifRows.length > 0 && notifRows.some(n => n.user_id === rep1.user_id);
  assert(
    historyRows.length >= 2 && hasResolvedTransition && hasReporterNotification,
    "AC5.5",
    "Ticket lifecycle records status_history transitions and inserts in-app notification for reporter on resolution"
  );

  // AC5.6: Login Throttling (5 attempts / 15 min -> 429 on 6th)
  const throttleEmail = `throttle_test_${Date.now()}@campus.edu`;
  let got429 = false;
  for (let i = 1; i <= 6; i++) {
    const res = await request("POST", "/api/auth/login", {
      email: throttleEmail,
      password: "WrongPassword999!"
    });
    if (i === 6 && res.status === 429) {
      got429 = true;
    }
  }
  assert(
    got429,
    "AC5.6",
    "Login throttling enforces rate limit: 6th failed attempt returns 429 Too Many Requests"
  );

  // AC5.7: Public Reporter Files Contain Zero Staff Portal Strings or Admin Quick-Fills
  const publicHtml = fs.readFileSync(path.join(__dirname, "public", "index.html"), "utf8");
  const publicJs = fs.readFileSync(path.join(__dirname, "public", "app.js"), "utf8");
  const combinedPublic = publicHtml + "\n" + publicJs;
  const forbiddenPatterns = ["/staff", "Admin Triage", "Heat Map", "Work Orders", "admin@campus.edu", "Sign in as Admin", "Sign In as Admin"];
  const foundForbidden = forbiddenPatterns.filter(p => combinedPublic.includes(p));
  assert(
    foundForbidden.length === 0,
    "AC5.7",
    `Reporter index.html and app.js contain zero occurrences of staff links or admin strings (found: ${foundForbidden.join(", ") || "none"})`
  );

  // AC5.8: Legal Pages Return 200 and Contain Draft Notice
  const termsRes = await request("GET", "/terms");
  const privacyRes = await request("GET", "/privacy");
  const acceptableRes = await request("GET", "/acceptable-use");
  const helpRes = await request("GET", "/help");
  const contactRes = await request("GET", "/contact");

  const allLegal200 = [termsRes, privacyRes, acceptableRes, helpRes, contactRes].every(r => r.status === 200);
  const draftNoticePresent = [termsRes, privacyRes, acceptableRes, helpRes, contactRes].every(r =>
    (r.raw || "").includes("Draft — pending college review")
  );
  assert(
    allLegal200 && draftNoticePresent,
    "AC5.8",
    "Legal and help pages (/terms, /privacy, /acceptable-use, /help, /contact) return 200 and display 'Draft — pending college review'"
  );

  // AC5.9: Photo Upload Magic Byte Validation & Max Size Limit
  // 1. Invalid magic bytes (.exe file renamed to .png) -> 400
  const fakePngPayload = {
    location_id: 1,
    description: "Testing non-image binary magic bytes rejection",
    category: "Equipment",
    photo_data: Buffer.from("MZThisIsAWindowsExecutableHeaderNotAnImage!").toString("base64")
  };
  const fakePngRes = await request("POST", "/api/reports", fakePngPayload, studentToken);

  // 2. Large file (> 5MB) -> 413
  const largeBuf = Buffer.alloc(5.2 * 1024 * 1024, 0x41);
  const largePayload = {
    location_id: 1,
    description: "Testing oversized file payload rejection",
    category: "Equipment",
    photo_data: largeBuf.toString("base64")
  };
  const largeRes = await request("POST", "/api/reports", largePayload, studentToken);

  // 3. Valid PNG magic bytes -> 201 Created
  const validPngHeader = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
  ]);
  const validPngPayload = {
    location_id: 1,
    description: "Real photo upload with authentic PNG magic bytes verification",
    category: "Equipment",
    photo_data: validPngHeader.toString("base64")
  };
  const validPhotoRes = await request("POST", "/api/reports", validPngPayload, studentToken);

  assert(
    fakePngRes.status === 400 &&
    largeRes.status === 413 &&
    validPhotoRes.status === 201 &&
    validPhotoRes.body.report.photo_path &&
    validPhotoRes.body.report.photo_path.startsWith("/api/photos/"),
    "AC5.9",
    "Photo upload: rejects fake magic bytes (400), rejects >5MB (413), and accepts authentic image saving to /api/photos/ (201)"
  );

  // AC5.10: Safe returnUrl Sanitization
  const test1 = validateReturnUrl("https://malicious-external-site.com/steal", false);
  const test2 = validateReturnUrl("javascript:alert(1)", false);
  const test3 = validateReturnUrl("/staff/admin", false); // reporter attempting to redirect to staff
  const test4 = validateReturnUrl("/report", true);       // staff attempting to redirect to reporter
  const test5 = validateReturnUrl("/my-reports", false);   // valid reporter route
  const test6 = validateReturnUrl("/staff/work-orders", true); // valid staff route

  const returnUrlSecure =
    test1 === "/report" &&
    test2 === "/report" &&
    test3 === "/report" &&
    test4 === "/staff/admin" &&
    test5 === "/my-reports" &&
    test6 === "/staff/work-orders";

  assert(
    returnUrlSecure,
    "AC5.10",
    "returnUrl sanitization rejects external URLs, javascript:, and cross-portal redirect targets"
  );

  // -------------------------------------------------------------
  // GOAL 6: ITERATION 4 INTELLIGENCE, SAFETY & TRIAGE (AC6.1 - AC6.9)
  // -------------------------------------------------------------
  console.log("\n--- Goal 6: Iteration 4 Intelligence, Safety & Triage (AC6.1 - AC6.9) ---");

  // AC6.1: Automated Asset 200 & Content-Type Check
  const rootCss = await request("GET", "/styles.css");
  const rootJs = await request("GET", "/app.js");
  const nestedQrCss = await request("GET", "/r/qr_b3_302_x2m1/styles.css");
  const nestedMyRepCss = await request("GET", "/my-reports/styles.css");
  const staffCss = await request("GET", "/staff/styles.css");
  const staffJs = await request("GET", "/staff/staff.js");

  const assetsAll200 =
    rootCss.status === 200 && rootCss.headers["content-type"] === "text/css" &&
    rootJs.status === 200 && rootJs.headers["content-type"] === "application/javascript" &&
    nestedQrCss.status === 200 && nestedQrCss.headers["content-type"] === "text/css" &&
    nestedMyRepCss.status === 200 && nestedMyRepCss.headers["content-type"] === "text/css" &&
    staffCss.status === 200 && staffCss.headers["content-type"] === "text/css" &&
    staffJs.status === 200 && staffJs.headers["content-type"] === "application/javascript";

  assert(
    assetsAll200,
    "AC6.1",
    "Every asset referenced returns 200 with matching Content-Type from /, /r/:token, and /my-reports"
  );

  // AC6.2: Duplicate Detection Threshold (0.55) & Privacy Boundary
  // Location 1 has Report 2: 'Ceiling fan not rotating'
  const dupPredict = await request("POST", "/api/ai/predict", {
    description: "Ceiling fan speed regulator not working fan not rotating",
    location_id: 1
  });

  const dupIsDetected = dupPredict.body.duplicate && dupPredict.body.duplicate.isDuplicate === true;
  const dupScoreAboveThreshold = dupPredict.body.duplicate.matchScore >= 0.55;
  // PRIVACY BOUNDARY: strictly omit description and reporter identity
  const dupPrivacyShield =
    dupPredict.body.duplicate.description === undefined &&
    dupPredict.body.duplicate.reporter === undefined &&
    dupPredict.body.duplicate.user_id === undefined &&
    dupPredict.body.duplicate.category !== undefined &&
    dupPredict.body.duplicate.status !== undefined &&
    dupPredict.body.duplicate.hours_ago !== undefined;

  assert(
    dupIsDetected && dupScoreAboveThreshold && dupPrivacyShield,
    "AC6.2",
    `Duplicate detection fires at >= 0.55 (score: ${dupPredict.body.duplicate?.matchScore}) and shields reporter privacy`
  );

  // AC6.3: Report Updates Submission (POST /api/reports/:id/updates)
  // Report #2 is open (pending)
  const addUpdateRes = await request("POST", "/api/reports/2/updates", {
    text: "Observed intermittent audio buzz in addition to fan not rotating"
  }, studentToken);

  const updateInDb = db.prepare("SELECT * FROM report_updates WHERE report_id = 2 AND user_id = 1").all();
  const notifCreated = db.prepare("SELECT * FROM notifications WHERE report_id = 2 AND user_id = 1").all();

  // Rejection on resolved report (Report #6 is resolved)
  const resolvedUpdateRes = await request("POST", "/api/reports/6/updates", {
    text: "Attempting update on resolved ticket"
  }, studentToken);

  assert(
    addUpdateRes.status === 201 &&
    updateInDb.length > 0 &&
    notifCreated.length > 0 &&
    resolvedUpdateRes.status === 400 &&
    resolvedUpdateRes.body.detail.includes("resolved"),
    "AC6.3",
    "report_updates row recorded, in-app notification generated, and resolved reports reject updates with 400"
  );

  // AC6.4: Safety Rules Automatic Priority Escalation & Rule Name Tracking
  // Rule match 1: exposed sparking wire
  const safetyReport = await request("POST", "/api/reports", {
    location_id: 3,
    description: "Dangerous exposed sparking wire hanging near chemistry sink socket",
    category: "Electrical"
  }, studentToken);

  // Non-safety report: furniture issue
  const standardReport = await request("POST", "/api/reports", {
    location_id: 3,
    description: "Classroom table wobbling slightly on uneven floor tiles",
    category: "Furniture"
  }, studentToken);

  const safetyDbRecord = db.prepare("SELECT * FROM reports WHERE id = ?").get(safetyReport.body.report.id);
  const standardDbRecord = db.prepare("SELECT * FROM reports WHERE id = ?").get(standardReport.body.report.id);

  assert(
    safetyDbRecord.priority === "critical" &&
    safetyDbRecord.safety_rule_matched === "exposed_sparking_wire" &&
    standardDbRecord.priority === "low" &&
    standardDbRecord.safety_rule_matched === null,
    "AC6.4",
    `Safety rule overrides priority to Critical (${safetyDbRecord.safety_rule_matched}) while standard reports follow category weights`
  );

  // AC6.5: Priority Field Isolation (Staff-Only)
  const reporterMine = await request("GET", "/api/reports/mine", null, studentToken);
  const reporterDetail = await request("GET", `/api/reports/${safetyReport.body.report.id}`, null, studentToken);
  const reporterPredict = await request("POST", "/api/ai/predict", {
    description: "Dangerous sparking wire hanging near door"
  });
  const staffReportsView = await request("GET", "/api/staff/reports", null, adminToken);

  const absentInCreate = safetyReport.body.report.priority === undefined;
  const absentInMine = reporterMine.body.reports.every(r => r.priority === undefined);
  const absentInDetail = reporterDetail.body.report.priority === undefined;
  const absentInPredict = reporterPredict.body.priority === undefined;
  const presentInStaff = staffReportsView.body.reports.every(r => r.priority !== undefined);

  assert(
    absentInCreate && absentInMine && absentInDetail && absentInPredict && presentInStaff,
    "AC6.5",
    "Priority field is strictly omitted from reporter endpoints and visible only to staff"
  );

  // AC6.6: Category Correction Loop & CSV Export
  // Reporter divergence: AI suggests Water, reporter chooses Furniture
  const divergentReport = await request("POST", "/api/reports", {
    location_id: 4,
    description: "Continuous water tap leakage flooding washroom floor basin pipe clogged",
    category: "Furniture"
  }, studentToken);

  const userCorrectionRow = db.prepare(`
    SELECT * FROM category_corrections WHERE report_id = ? AND role = 'student'
  `).get(divergentReport.body.report.id);

  // Admin patch correction
  const adminCatPatch = await request("PATCH", `/api/staff/reports/${divergentReport.body.report.id}/category`, {
    category: "Water"
  }, adminToken);

  const adminCorrectionRow = db.prepare(`
    SELECT * FROM category_corrections WHERE report_id = ? AND role = 'admin'
  `).get(divergentReport.body.report.id);

  // Staff CSV export
  const staffCsvExport = await request("GET", "/api/staff/corrections/export", null, adminToken);
  const reporterCsvExport = await request("GET", "/api/staff/corrections/export", null, studentToken);

  assert(
    userCorrectionRow &&
    userCorrectionRow.final_category === "Furniture" &&
    adminCatPatch.status === 200 &&
    adminCorrectionRow &&
    adminCorrectionRow.final_category === "Water" &&
    staffCsvExport.status === 200 &&
    staffCsvExport.headers["content-type"].includes("text/csv") &&
    staffCsvExport.raw.includes("suggested_category,final_category") &&
    reporterCsvExport.status === 403,
    "AC6.6",
    "category_corrections logs user divergence and admin patches; staff can export CSV while reporters receive 403"
  );

  // AC6.7: AI Predictions Telemetry Tracking (v1.1-rules-tfidf)
  const telemetry = db.prepare(`
    SELECT * FROM ai_predictions WHERE report_id = ?
  `).get(safetyReport.body.report.id);

  assert(
    telemetry &&
    telemetry.model_version === "v1.1-rules-tfidf" &&
    telemetry.category_confidence > 0 &&
    telemetry.priority_score === "critical" &&
    telemetry.safety_rule_matched === "exposed_sparking_wire",
    "AC6.7",
    "ai_predictions stores confidence, priority_score, model_version 'v1.1-rules-tfidf', and safety_rule_matched"
  );

  // AC6.8: Staff Triage Multi-filter & Whitelist Validation
  const validFilteredReports = await request("GET", "/api/staff/reports?status=pending&category=Electrical&block=Block%201&priority=low", null, adminToken);
  const invalidStatusFilter = await request("GET", "/api/staff/reports?status=NON_EXISTENT_STATUS", null, adminToken);
  const invalidPriorityFilter = await request("GET", "/api/staff/reports?priority=ULTRA_HIGH", null, adminToken);

  assert(
    validFilteredReports.status === 200 &&
    Array.isArray(validFilteredReports.body.reports) &&
    invalidStatusFilter.status === 400 &&
    invalidStatusFilter.body.detail.includes("Invalid filter parameter") &&
    invalidPriorityFilter.status === 400 &&
    invalidPriorityFilter.body.detail.includes("Invalid filter parameter"),
    "AC6.8",
    "Staff triage supports combined filters and strictly validates parameters, rejecting unknown values with 400"
  );

  // AC6.9: Block Geo Heat Map Drill-down Summary & Privacy (FR-15, FR-25)
  const blockSummaryStaff = await request("GET", "/api/staff/blocks/Block%201/summary", null, adminToken);
  const blockSummaryReporter = await request("GET", "/api/staff/blocks/Block%201/summary", null, studentToken);

  const block1TotalReports = db.prepare("SELECT COUNT(*) as c FROM reports r JOIN locations l ON r.location_id = l.id WHERE l.block = 'Block 1'").get().c;
  const block1OpenReports = db.prepare("SELECT COUNT(*) as c FROM reports r JOIN locations l ON r.location_id = l.id WHERE l.block = 'Block 1' AND r.status != 'resolved'").get().c;

  assert(
    blockSummaryStaff.status === 200 &&
    blockSummaryStaff.body.block === "Block 1" &&
    blockSummaryStaff.body.total_reports === block1TotalReports &&
    blockSummaryStaff.body.open_reports === block1OpenReports &&
    Array.isArray(blockSummaryStaff.body.top_categories) &&
    blockSummaryStaff.body.notice === "Patterns are leads to investigate, not proven causes" &&
    blockSummaryReporter.status === 403,
    "AC6.9",
    "Block summary matches SQLite counts, displays FR-25 analytical disclaimer, and blocks reporter access with 403"
  );

  // -------------------------------------------------------------
  // GOAL 8: Production Bug Regression Suite (AC8.1 - AC8.5)
  // -------------------------------------------------------------
  console.log("\n--- Goal 8: Production Isolation, Allowlist, Photo & Health Tests (AC8.1 - AC8.5) ---");

  // AC8.1: Reporter UI code never reads cbb_staff_token, generic "token", or fabricates sample photos
  const reporterUiFiles = [
    "frontend/src/lib/api.ts",
    "frontend/src/lib/auth.tsx",
    "frontend/src/components/Navbar.tsx",
    "frontend/src/components/PhotoUploadField.tsx",
    "frontend/src/components/ReportCard.tsx",
    "frontend/src/components/ReportDetailModal.tsx",
    "frontend/src/app/page.tsx",
    "frontend/src/app/dashboard/page.tsx",
    "frontend/src/app/my-reports/page.tsx",
    "frontend/src/app/login/page.tsx",
    "frontend/src/app/register/page.tsx",
    "frontend/src/app/report/[locationId]/page.tsx",
    "frontend/src/app/r/[token]/page.tsx",
    "public/app.js"
  ];
  const badReporterRefs = [];
  for (const relPath of reporterUiFiles) {
    const content = fs.readFileSync(path.join(__dirname, relPath), "utf8");
    if (content.includes("cbb_staff_token")) badReporterRefs.push(`${relPath}:cbb_staff_token`);
    if (/getItem\(["']token["']\)|setItem\(["']token["']/.test(content)) badReporterRefs.push(`${relPath}:generic-token`);
    if (content.includes("handleSimulatePhoto") || content.includes("projector.webp")) badReporterRefs.push(`${relPath}:fake-photo`);
    if (content.includes("/api/staff/")) badReporterRefs.push(`${relPath}:staff-endpoint`);
  }
  const staffApiSrc = fs.readFileSync(path.join(__dirname, "frontend/src/lib/staffApi.ts"), "utf8");
  const publicStaffSrc = fs.readFileSync(path.join(__dirname, "public/staff.js"), "utf8");
  assert(
    badReporterRefs.length === 0 &&
    staffApiSrc.includes("sessionStorage.getItem(STAFF_TOKEN_KEY)") &&
    !staffApiSrc.includes("localStorage.getItem") &&
    !staffApiSrc.includes("localStorage.setItem") &&
    publicStaffSrc.includes("sessionStorage.getItem(TOKEN_KEY)") &&
    !publicStaffSrc.includes("localStorage.getItem(TOKEN_KEY)") &&
    !publicStaffSrc.includes("localStorage.setItem(TOKEN_KEY)"),
    "AC8.1",
    `Reporter UI never reads cbb_staff_token/generic token or fabricates photos (violations: ${badReporterRefs.join(",") || "none"}); staff tokens stay in sessionStorage`
  );

  // AC8.2: Staff tokens on reporter POST /api/reports & /api/auth/me strictly return 403
  const adminCreateReport = await request("POST", "/api/reports", {
    description: "Staff attempt to submit reporter form",
    location_id: 1,
    category: "Other"
  }, adminToken);
  const techCreateReport = await request("POST", "/api/reports", {
    description: "Technician attempt to submit reporter form",
    location_id: 1,
    category: "Other"
  }, tech1Token);
  const adminReporterMe = await request("GET", "/api/auth/me", null, adminToken);

  assert(
    adminCreateReport.status === 403 &&
    techCreateReport.status === 403 &&
    adminReporterMe.status === 403,
    "AC8.2",
    "Staff tokens on POST /api/reports and GET /api/auth/me strictly return 403 Forbidden"
  );

  // AC8.3: Reporter endpoints build responses strictly from allowlist and never leak staff/other-user fields
  const allowedReportKeys = new Set([
    "id", "description", "category", "status", "location", "block", "room",
    "location_type", "photo_url", "photo_path", "created_at", "updated_at",
    "resolved_at", "resolution_action", "timeline", "updates"
  ]);
  const allowedLocationKeys = new Set(["block", "room", "location_type"]);
  const allowedTimelineKeys = new Set(["from_status", "to_status", "changed_at"]);
  const allowedUpdateKeys = new Set(["text", "created_at"]);
  const allowedNotifKeys = new Set(["id", "report_id", "message", "read_at", "created_at"]);
  const forbiddenKeys = new Set([
    "priority", "priority_overridden_by", "priority_override_reason",
    "assigned_to", "assignee", "assigned_technician", "remarks", "internal_remarks",
    "user_id", "changed_by", "staff_id", "reporter_name", "reporter_role",
    "suggested_category", "safety_rule_matched", "users", "password_hash"
  ]);

  function findNonAllowlistedKeys(obj, allowSet, prefix = "") {
    const violations = [];
    if (!obj || typeof obj !== "object") return violations;
    for (const key of Object.keys(obj)) {
      if (forbiddenKeys.has(key) || !allowSet.has(key)) {
        violations.push(`${prefix}${key}`);
      }
    }
    return violations;
  }

  const resolvedRepRes = await request("POST", "/api/reports", {
    description: "AC8.3 water faucet leak in Block 2 Lab for allowlist verification",
    location_id: 2,
    category: "Water"
  }, studentToken);
  const r83Id = resolvedRepRes.body.report.id;
  await request("PUT", `/api/staff/reports/${r83Id}`, { status: "assigned", assigned_to: 3, priority: "high" }, adminToken);
  await request("PUT", `/api/staff/reports/${r83Id}`, { status: "in_progress" }, tech1Token);
  await request("POST", `/api/staff/reports/${r83Id}/resolve`, { action: "Replaced defective valve", remarks: "SECRET_INTERNAL_STAFF_REMARK" }, tech1Token);

  const mineAllowRes = await request("GET", "/api/reports/mine", null, studentToken);
  const detailAllowRes = await request("GET", `/api/reports/${r83Id}`, null, studentToken);
  const histAllowRes = await request("GET", `/api/reports/${r83Id}/history`, null, studentToken);
  const notifAllowRes = await request("GET", "/api/notifications", null, studentToken);

  const allowViolations = [];
  for (const item of [resolvedRepRes.body.report, detailAllowRes.body.report, ...(mineAllowRes.body.reports || [])]) {
    allowViolations.push(...findNonAllowlistedKeys(item, allowedReportKeys, "report."));
    if (item.location) allowViolations.push(...findNonAllowlistedKeys(item.location, allowedLocationKeys, "report.location."));
    for (const t of item.timeline || []) allowViolations.push(...findNonAllowlistedKeys(t, allowedTimelineKeys, "report.timeline."));
    for (const u of item.updates || []) allowViolations.push(...findNonAllowlistedKeys(u, allowedUpdateKeys, "report.updates."));
  }
  for (const h of histAllowRes.body.history || []) allowViolations.push(...findNonAllowlistedKeys(h, allowedTimelineKeys, "history."));
  for (const n of notifAllowRes.body.notifications || []) allowViolations.push(...findNonAllowlistedKeys(n, allowedNotifKeys, "notif."));

  const detailJsonStr = JSON.stringify(detailAllowRes.body);
  assert(
    allowViolations.length === 0 &&
    detailAllowRes.status === 200 &&
    detailAllowRes.body.report.resolution_action === "Replaced defective valve" &&
    Array.isArray(detailAllowRes.body.report.timeline) &&
    detailAllowRes.body.report.timeline.length >= 2 &&
    !detailJsonStr.includes("SECRET_INTERNAL_STAFF_REMARK") &&
    !detailJsonStr.includes("admin@campus.edu"),
    "AC8.3",
    `Reporter endpoints emit strictly allowlisted keys only (violations: ${allowViolations.join(", ") || "none"})`
  );

  // AC8.4: Health endpoint, production JWT_SECRET startup check, CORS preflight & reporter token isolation
  const healthRes = await request("GET", "/api/health");
  const prevAllowedOrigin = process.env.ALLOWED_ORIGIN;
  process.env.ALLOWED_ORIGIN = "https://campus-black-box-delta.vercel.app";
  const corsRes = await request("OPTIONS", "/api/reports", null, null, {
    origin: "https://campus-black-box-delta.vercel.app",
    "access-control-request-method": "POST",
    "access-control-request-headers": "authorization, content-type"
  });
  if (prevAllowedOrigin === undefined) delete process.env.ALLOWED_ORIGIN;
  else process.env.ALLOWED_ORIGIN = prevAllowedOrigin;

  const startupCheckResult = validateStartupConfig({ NODE_ENV: "production", JWT_SECRET: "" });
  const prodStartRes = spawnSync(process.execPath, ["server.js"], {
    cwd: __dirname,
    env: { ...process.env, NODE_ENV: "production", JWT_SECRET: "" },
    encoding: "utf8"
  });
  const apiSrc = fs.readFileSync(path.join(__dirname, "frontend/src/lib/api.ts"), "utf8");
  const authSrc = fs.readFileSync(path.join(__dirname, "frontend/src/lib/auth.tsx"), "utf8");

  assert(
    healthRes.status === 200 &&
    typeof healthRes.body.version === "string" &&
    typeof healthRes.body.demo_mode === "boolean" &&
    "commit" in healthRes.body &&
    corsRes.status === 204 &&
    corsRes.headers["access-control-allow-origin"] === "https://campus-black-box-delta.vercel.app" &&
    corsRes.headers["access-control-allow-headers"].includes("Authorization") &&
    startupCheckResult.ok === false &&
    prodStartRes.status !== 0 &&
    apiSrc.includes('REPORTER_TOKEN_KEY = "cbb_reporter_token"') &&
    authSrc.includes('aud !== "reporter"'),
    "AC8.4",
    "GET /api/health, ALLOWED_ORIGIN OPTIONS preflight, production JWT_SECRET startup guard, and portal token checks pass"
  );

  // AC8.5: PNG-with-alpha, JPEG, and WebP photo uploads preserve exact original bytes & type
  function buildPngWithAlpha() {
    function crc32(buf) {
      let c = 0xffffffff;
      for (const b of buf) {
        c ^= b;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      return (c ^ 0xffffffff) >>> 0;
    }
    function chunk(type, data) {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const t = Buffer.from(type, "ascii");
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
      return Buffer.concat([len, t, data, crc]);
    }
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 6, 0, 0, 0]); // 2x2 RGBA (colorType 6)
    const raw = Buffer.from([
      0, 220, 40, 40, 255, 40, 180, 90, 128,
      0, 30, 120, 230, 200, 0, 0, 0, 0
    ]);
    const idat = zlib.deflateSync(raw);
    return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
  }
  const pngAlphaBuf = buildPngWithAlpha();
  const jpegBuf = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1"), Buffer.from([0xff, 0xd9])]);
  const webpBuf = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.from([0x1a, 0x00, 0x00, 0x00]), Buffer.from("WEBPVP8L", "ascii"), Buffer.alloc(18, 0x2f)]);

  const photoCases = [
    { name: "png-alpha", mime: "image/png", ext: ".png", buf: pngAlphaBuf },
    { name: "jpeg", mime: "image/jpeg", ext: ".jpg", buf: jpegBuf },
    { name: "webp", mime: "image/webp", ext: ".webp", buf: webpBuf }
  ];
  let allPhotosExact = true;
  const photoErrors = [];
  for (const tc of photoCases) {
    const dataUrl = `data:${tc.mime};base64,${tc.buf.toString("base64")}`;
    const upRes = await request("POST", "/api/reports", {
      description: `AC8.5 ${tc.name} upload verification in Block 1 Room 101`,
      location_id: 1,
      category: "Other",
      photo_data: dataUrl
    }, facultyToken);
    const savedPath = upRes.body?.report?.photo_path || "";
    const diskFilename = savedPath.replace("/api/photos/", "");
    const diskBuf = diskFilename ? fs.readFileSync(path.join(__dirname, "uploads", diskFilename)) : null;
    const dlRes = savedPath ? await request("GET", savedPath, null, facultyToken) : null;
    if (
      upRes.status !== 201 ||
      !savedPath.endsWith(tc.ext) ||
      !diskBuf ||
      !diskBuf.equals(tc.buf) ||
      !dlRes ||
      dlRes.status !== 200 ||
      dlRes.headers["content-type"] !== tc.mime ||
      !Buffer.isBuffer(dlRes.rawBuffer) ||
      !dlRes.rawBuffer.equals(tc.buf)
    ) {
      allPhotosExact = false;
      photoErrors.push(`${tc.name}(up:${upRes.status},path:${savedPath},diskEq:${diskBuf?.equals(tc.buf)},dl:${dlRes?.status},ct:${dlRes?.headers["content-type"]},dlLen:${dlRes?.rawBuffer?.length}/${tc.buf.length})`);
    }
  }
  assert(
    allPhotosExact,
    "AC8.5",
    `Photo uploads for PNG-with-alpha, JPEG, and WebP preserve exact original bytes, extensions, and Content-Type (${photoErrors.join("; ") || "ok"})`
  );

  // -------------------------------------------------------------
  // GOAL 9: Production Issue Fixes (AC9.1 - AC9.6)
  // -------------------------------------------------------------
  console.log("\n--- Goal 9: Production Fixes (AC9.1 - AC9.6) ---");

  // AC9.1: ISO-8601 UTC 'Z' timestamps across API & legacy migration
  const isoZRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
  const staffListForTime = await request("GET", "/api/staff/reports", null, adminToken);
  const mineForTime = await request("GET", "/api/reports/mine", null, studentToken);
  const allTimesValid =
    staffListForTime.status === 200 &&
    mineForTime.status === 200 &&
    staffListForTime.body.reports.every(r => isoZRegex.test(r.created_at) && (!r.resolved_at || isoZRegex.test(r.resolved_at))) &&
    mineForTime.body.reports.every(r => isoZRegex.test(r.created_at) && (r.timeline || []).every(t => isoZRegex.test(t.changed_at)));

  const insLegacy = db.prepare("INSERT INTO notifications (user_id, report_id, message, created_at) VALUES (1, 1, 'Legacy ts test', '2026-11-12 06:00:00')").run();
  migrateLegacyTimestampsToIsoUtc();
  const migratedNotif = db.prepare("SELECT created_at FROM notifications WHERE id = ?").get(Number(insLegacy.lastInsertRowid));
  db.prepare("DELETE FROM notifications WHERE id = ?").run(Number(insLegacy.lastInsertRowid));

  assert(
    allTimesValid && migratedNotif?.created_at === "2026-11-12T06:00:00Z",
    "AC9.1",
    "All timestamps emit ISO-8601 UTC with 'Z' and legacy SQLite timestamps migrate idempotently"
  );

  // AC9.2: GET /api/staff/reports/:id/photo authorization + sanitized has_photo
  const adminPhotoRes = await request("GET", "/api/staff/reports/1/photo", null, adminToken);
  const assignedTechPhotoRes = await request("GET", "/api/staff/reports/1/photo", null, tech1Token);
  const unassignedTechPhotoRes = await request("GET", "/api/staff/reports/1/photo", null, tech2Token);
  const reporterStaffPhotoRes = await request("GET", "/api/staff/reports/1/photo", null, facultyToken);
  const missingPhotoRes = await request("GET", "/api/staff/reports/2/photo", null, adminToken);
  const staffPayloadClean = (staffListForTime.body.reports || []).every(
    r => typeof r.has_photo === "boolean" && !("photo_path" in r) && !("photo_url" in r) && !("reporter_email" in r)
  );

  assert(
    adminPhotoRes.status === 200 &&
    adminPhotoRes.headers["content-type"] === "image/png" &&
    Buffer.isBuffer(adminPhotoRes.rawBuffer) && adminPhotoRes.rawBuffer.length > 100 &&
    assignedTechPhotoRes.status === 200 &&
    unassignedTechPhotoRes.status === 403 &&
    reporterStaffPhotoRes.status === 403 &&
    missingPhotoRes.status === 404 &&
    staffPayloadClean,
    "AC9.2",
    "Staff photo endpoint enforces admin/assigned-tech RBAC (200/403/404) and list exposes has_photo without raw paths or email"
  );

  // AC9.3: Faculty reporter role attribution on staff views + strict reporter isolation
  const facReportRes = await request("POST", "/api/reports", {
    description: "AC9.3 Faculty projector HDMI port damaged in Lecture Hall",
    location_id: 6,
    category: "Equipment"
  }, facultyToken);
  const facReportId = facReportRes.body?.report?.id;
  const staffAfterFac = await request("GET", "/api/staff/reports", null, adminToken);
  const staffFacEntry = (staffAfterFac.body.reports || []).find(r => r.id === facReportId);
  const studentMineAfterFac = await request("GET", "/api/reports/mine", null, studentToken);
  const studentLegacyAfterFac = await request("GET", "/api/reports", null, studentToken);
  const studentCannotSeeFac =
    !(studentMineAfterFac.body.reports || []).some(r => r.id === facReportId) &&
    !(studentLegacyAfterFac.body.reports || []).some(r => r.id === facReportId);

  assert(
    facReportRes.status === 201 &&
    staffFacEntry &&
    staffFacEntry.reporter_role === "faculty" &&
    staffFacEntry.reporter_name === "Prof. Roy" &&
    studentCannotSeeFac,
    "AC9.3",
    "Faculty reports preserve reporter_role='faculty' and reporter_name for staff while isolated from other reporters"
  );

  // AC9.4: Distinct Blocks 1/2/3 end-to-end location binding & invalid location 400
  const ac94Hdrs = { "x-forwarded-for": "10.0.0.94" };
  const b1Res = await request("POST", "/api/reports", { description: "AC9.4 Block 1 test electrical fault", location_id: 1, category: "Electrical" }, studentToken, ac94Hdrs);
  const b2Res = await request("POST", "/api/reports", { description: "AC9.4 Block 2 test staircase plumbing fault", location_id: 4, category: "Water" }, studentToken, ac94Hdrs);
  const b3Res = await request("POST", "/api/reports", { description: "AC9.4 Block 3 test laboratory projector fault", location_id: 7, category: "Equipment" }, studentToken, ac94Hdrs);
  const invalidLocZero = await request("POST", "/api/reports", { description: "AC9.4 Invalid location 0 test", location_id: 0, category: "Other" }, studentToken, ac94Hdrs);
  const invalidLocMissing = await request("POST", "/api/reports", { description: "AC9.4 Missing location test", category: "Other" }, studentToken, ac94Hdrs);
  const invalidLocUnknown = await request("POST", "/api/reports", { description: "AC9.4 Unknown location 99999 test", location_id: 99999, category: "Other" }, studentToken, ac94Hdrs);

  const staffLocCheck = await request("GET", "/api/staff/reports", null, adminToken);
  const sB1 = (staffLocCheck.body.reports || []).find(r => r.id === b1Res.body?.report?.id);
  const sB2 = (staffLocCheck.body.reports || []).find(r => r.id === b2Res.body?.report?.id);
  const sB3 = (staffLocCheck.body.reports || []).find(r => r.id === b3Res.body?.report?.id);

  assert(
    b1Res.status === 201 && b2Res.status === 201 && b3Res.status === 201 &&
    sB1?.block === "Block 1" && sB1?.location?.room === "Room 114" &&
    sB2?.block === "Block 2" && sB2?.location?.room === "Ground floor" &&
    sB3?.block === "Block 3" && sB3?.location?.room === "Room 105" &&
    invalidLocZero.status === 400 && invalidLocMissing.status === 400 && invalidLocUnknown.status === 400,
    "AC9.4",
    "Blocks 1/2/3 preserve exact block & room on submit + staff JOIN and reject invalid location_id with 400"
  );

  // AC9.5: Real /api/staff/blocks/summary matching SQLite & KPI totals + window validation
  const allBlocksSum = await request("GET", "/api/staff/blocks/summary?window=all", null, adminToken);
  const triageKpis = await request("GET", "/api/staff/analytics/summary", null, adminToken);
  const invalidWindowSum = await request("GET", "/api/staff/blocks/summary?window=invalid", null, adminToken);
  const reporterBlocksForbidden = await request("GET", "/api/staff/blocks/summary", null, studentToken);
  const distinctDbBlocks = db.prepare("SELECT DISTINCT block FROM locations").all().map(x => x.block);
  const returnedBlockNames = (allBlocksSum.body.blocks || []).map(b => b.block);
  const blocksMatchAllDb = distinctDbBlocks.every(name => returnedBlockNames.includes(name));
  const sumMatchesTotals =
    allBlocksSum.body.totals?.total_reports === triageKpis.body.total_reports &&
    allBlocksSum.body.totals?.resolved_reports === triageKpis.body.resolved_reports &&
    allBlocksSum.body.totals?.open_reports === triageKpis.body.open_reports &&
    (allBlocksSum.body.blocks || []).reduce((acc, b) => acc + b.total, 0) === triageKpis.body.total_reports;

  assert(
    allBlocksSum.status === 200 &&
    blocksMatchAllDb &&
    sumMatchesTotals &&
    allBlocksSum.body.notice === "Patterns are leads to investigate, not proven causes." &&
    invalidWindowSum.status === 400 &&
    reporterBlocksForbidden.status === 403,
    "AC9.5",
    "All-blocks heatmap summary uses live SQLite data, matches triage KPIs, enforces window 400 and reporter 403"
  );

  // AC9.6: Single-hue CSS scale + removal of hardcoded heatmap & Block 1 UI fallbacks
  const globalsCss = fs.readFileSync(path.join(__dirname, "frontend/src/app/globals.css"), "utf8");
  const stylesCss = fs.readFileSync(path.join(__dirname, "public/styles.css"), "utf8");
  const campusMapTsx = fs.readFileSync(path.join(__dirname, "frontend/src/components/CampusMap.tsx"), "utf8");
  const staffAdminTsx = fs.readFileSync(path.join(__dirname, "frontend/src/app/staff/admin/page.tsx"), "utf8");
  const staffWoTsx = fs.readFileSync(path.join(__dirname, "frontend/src/app/staff/work-orders/page.tsx"), "utf8");

  const hasFiveHueSteps = [0, 1, 2, 3, 4].every(
    step => globalsCss.includes(`--heat-${step}-bg: hsl(227`) && stylesCss.includes(`--heat-${step}-bg: hsl(227`)
  );
  const uiClean =
    !campusMapTsx.includes("BLOCK_STATS") &&
    !campusMapTsx.includes("Sample data telemetry") &&
    !staffAdminTsx.includes('|| "Block 1"') &&
    !staffWoTsx.includes('|| "Block 1"');

  assert(
    hasFiveHueSteps && uiClean,
    "AC9.6",
    "CSS exposes 5-step single-hue light/dark tokens and UI removes hardcoded heatmap stats & Block 1 fallbacks"
  );

  // -------------------------------------------------------------
  // GOAL 10: Resolution Remarks, Tech 2 & Strict Isolation (AC10.1 - AC10.6)
  // -------------------------------------------------------------
  console.log("\n--- Goal 10: Resolution Remarks, Tech 2 & Strict Isolation (AC10.1 - AC10.6) ---");

  const ac10Hdrs = { "x-forwarded-for": "10.0.0.101" };
  const validPng10 = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x02
  ]).toString("base64");

  // AC10.1: Resolve with remarks -> stored in resolutions + returned on admin detail; NEVER in reporter responses
  const r10_1Create = await request("POST", "/api/reports", {
    description: "AC10.1 Main breaker tripping repeatedly in Seminar Room",
    location_id: 2,
    category: "Electrical",
    photo_data: validPng10
  }, facultyToken, ac10Hdrs);
  const id10_1 = r10_1Create.body?.report?.id;
  await request("PUT", `/api/staff/reports/${id10_1}`, { status: "assigned", assigned_to: 3 }, adminToken);
  await request("POST", `/api/staff/reports/${id10_1}/start`, {}, tech1Token);
  const res10_1 = await request("POST", `/api/staff/reports/${id10_1}/resolve`, {
    action: "Replaced blown main MCB and balanced circuit load",
    remarks: "Fuse changed - AC10_SECRET_INTERNAL_REMARK"
  }, tech1Token);

  const dbRes10_1 = db.prepare("SELECT * FROM resolutions WHERE report_id = ? ORDER BY id DESC LIMIT 1").get(id10_1);
  const adminDet10_1 = await request("GET", `/api/staff/reports/${id10_1}`, null, adminToken);
  const repDet10_1 = await request("GET", `/api/reports/${id10_1}`, null, facultyToken);
  const repMine10_1 = await request("GET", "/api/reports/mine", null, facultyToken);
  const repLegacy10_1 = await request("GET", "/api/reports", null, facultyToken);
  const repHist10_1 = await request("GET", `/api/reports/${id10_1}/history`, null, facultyToken);
  const repNotifs10_1 = await request("GET", "/api/notifications", null, facultyToken);

  function containsRemarksKeyOrText(val) {
    if (!val || typeof val !== "object") return false;
    if (Array.isArray(val)) return val.some(containsRemarksKeyOrText);
    for (const [k, v] of Object.entries(val)) {
      if (k.toLowerCase().includes("remark")) return true;
      if (typeof v === "string" && v.includes("AC10_SECRET_INTERNAL_REMARK")) return true;
      if (v && typeof v === "object" && containsRemarksKeyOrText(v)) return true;
    }
    return false;
  }

  const reporterLeakedRemarks = [
    r10_1Create.body,
    repDet10_1.body,
    repMine10_1.body,
    repLegacy10_1.body,
    repHist10_1.body,
    repNotifs10_1.body
  ].some(containsRemarksKeyOrText);

  assert(
    res10_1.status === 200 &&
    dbRes10_1?.remarks === "Fuse changed - AC10_SECRET_INTERNAL_REMARK" &&
    adminDet10_1.status === 200 &&
    adminDet10_1.body.resolution?.action === "Replaced blown main MCB and balanced circuit load" &&
    adminDet10_1.body.resolution?.remarks === "Fuse changed - AC10_SECRET_INTERNAL_REMARK" &&
    adminDet10_1.body.resolution?.resolved_by === "Technician 1" &&
    Boolean(adminDet10_1.body.resolution?.resolved_at) &&
    Boolean(adminDet10_1.body.report?.assigned_at) &&
    !reporterLeakedRemarks,
    "AC10.1",
    "Resolve with remarks stores in resolutions; admin detail returns action/remarks/resolved_by/resolved_at; reporter endpoints never expose remarks"
  );

  // AC10.2: Ticket A (tech1) vs Ticket B (tech2) list isolation + exact counts
  const ticketARes = await request("POST", "/api/reports", {
    description: "AC10.2 Ticket A HVAC thermostat sensor disconnected",
    location_id: 3,
    category: "Equipment",
    photo_data: validPng10
  }, facultyToken, ac10Hdrs);
  const ticketBRes = await request("POST", "/api/reports", {
    description: "AC10.2 Ticket B Projector network switch unreachable",
    location_id: 7,
    category: "IT/Wi-Fi",
    photo_data: validPng10
  }, facultyToken, ac10Hdrs);
  const idA = ticketARes.body?.report?.id;
  const idB = ticketBRes.body?.report?.id;

  await request("PUT", `/api/staff/reports/${idA}`, { status: "assigned", assigned_to: 3 }, adminToken);
  await request("PUT", `/api/staff/reports/${idB}`, { status: "assigned", assigned_to: 4 }, adminToken);

  const t1ListRes = await request("GET", "/api/staff/reports", null, tech1Token);
  const t2ListRes = await request("GET", "/api/staff/reports", null, tech2Token);
  const t1Ids = (t1ListRes.body.reports || []).map(r => r.id);
  const t2Ids = (t2ListRes.body.reports || []).map(r => r.id);

  assert(
    t1ListRes.status === 200 &&
    t2ListRes.status === 200 &&
    t1Ids.includes(idA) && !t1Ids.includes(idB) &&
    t2Ids.includes(idB) && !t2Ids.includes(idA) &&
    (t1ListRes.body.reports || []).every(r => r.assigned_to === 3) &&
    (t2ListRes.body.reports || []).every(r => r.assigned_to === 4) &&
    t1ListRes.body.total === t1Ids.length &&
    t2ListRes.body.total === t2Ids.length,
    "AC10.2",
    "Ticket A assigned to tech1 and Ticket B assigned to tech2 remain strictly isolated with matching counts"
  );

  // AC10.3: Cross-technician 403 on detail, history, photo, start, resolve (both directions)
  const t1OnB_detail = await request("GET", `/api/staff/reports/${idB}`, null, tech1Token);
  const t1OnB_history = await request("GET", `/api/staff/reports/${idB}/history`, null, tech1Token);
  const t1OnB_photo = await request("GET", `/api/staff/reports/${idB}/photo`, null, tech1Token);
  const t1OnB_start = await request("POST", `/api/staff/reports/${idB}/start`, {}, tech1Token);
  const t1OnB_resolve = await request("POST", `/api/staff/reports/${idB}/resolve`, { action: "Unauthorized" }, tech1Token);

  const t2OnA_detail = await request("GET", `/api/staff/reports/${idA}`, null, tech2Token);
  const t2OnA_history = await request("GET", `/api/staff/reports/${idA}/history`, null, tech2Token);
  const t2OnA_photo = await request("GET", `/api/staff/reports/${idA}/photo`, null, tech2Token);
  const t2OnA_start = await request("POST", `/api/staff/reports/${idA}/start`, {}, tech2Token);
  const t2OnA_resolve = await request("POST", `/api/staff/reports/${idA}/resolve`, { action: "Unauthorized" }, tech2Token);

  assert(
    [t1OnB_detail, t1OnB_history, t1OnB_photo, t1OnB_start, t1OnB_resolve].every(r => r.status === 403) &&
    [t2OnA_detail, t2OnA_history, t2OnA_photo, t2OnA_start, t2OnA_resolve].every(r => r.status === 403),
    "AC10.3",
    "Cross-technician requests return 403 on detail, history, photo, start, and resolve in both directions"
  );

  // AC10.4: Reassigning Ticket A from tech1 to tech2 updates lists, notifications, and status_history
  const histBeforeReassign = db.prepare("SELECT COUNT(*) as c FROM status_history WHERE report_id = ?").get(idA).c;
  const reassignRes = await request("PUT", `/api/staff/reports/${idA}`, { assigned_to: 4 }, adminToken);
  const histAfterReassign = db.prepare("SELECT COUNT(*) as c FROM status_history WHERE report_id = ?").get(idA).c;
  const notifTech2Reassign = db.prepare("SELECT * FROM notifications WHERE report_id = ? AND user_id = 4").all(idA);

  const t1AfterReassign = await request("GET", "/api/staff/reports", null, tech1Token);
  const t2AfterReassign = await request("GET", "/api/staff/reports", null, tech2Token);
  const t1NotifsAfter = await request("GET", "/api/staff/notifications", null, tech1Token);
  const t2NotifsAfter = await request("GET", "/api/staff/notifications", null, tech2Token);

  assert(
    reassignRes.status === 200 &&
    reassignRes.body.assigned_to === 4 &&
    !(t1AfterReassign.body.reports || []).some(r => r.id === idA) &&
    (t2AfterReassign.body.reports || []).some(r => r.id === idA) &&
    histAfterReassign > histBeforeReassign &&
    notifTech2Reassign.length > 0 &&
    !(t1NotifsAfter.body.notifications || []).some(n => n.report_id === idA) &&
    (t2NotifsAfter.body.notifications || []).some(n => n.report_id === idA),
    "AC10.4",
    "Reassigning A from tech1 to tech2 moves ticket & notifications and logs status_history + notification"
  );

  // AC10.5: Technician receives 403 on campus-wide & admin endpoints; Admin receives 200
  const techAdminEndpoints = [
    ["GET", "/api/staff/blocks/summary"],
    ["GET", "/api/staff/blocks/Block%201/summary"],
    ["GET", "/api/staff/analytics/summary"],
    ["GET", "/api/staff/users"],
    ["GET", "/api/staff/staff"],
    ["GET", "/api/staff/corrections/export"]
  ];
  const t1AdminResults = [];
  const t2AdminResults = [];
  const admResults = [];
  for (const [m, ep] of techAdminEndpoints) {
    t1AdminResults.push(await request(m, ep, null, tech1Token));
    t2AdminResults.push(await request(m, ep, null, tech2Token));
    admResults.push(await request(m, ep, null, adminToken));
  }
  const t1Prio403 = await request("PATCH", `/api/staff/reports/${idB}/priority`, { priority: "low" }, tech1Token);
  const t2Prio403 = await request("PATCH", `/api/staff/reports/${idB}/priority`, { priority: "low" }, tech2Token);

  assert(
    t1AdminResults.every(r => r.status === 403) &&
    t2AdminResults.every(r => r.status === 403) &&
    t1Prio403.status === 403 && t2Prio403.status === 403 &&
    admResults.every(r => r.status === 200),
    "AC10.5",
    "Technicians get 403 on blocks/summary, analytics/summary, users/staff, corrections CSV, and priority override; Admin gets 200"
  );

  // AC10.6: Unassigned tickets never appear in any technician list or search
  const unassignedRes = await request("POST", "/api/reports", {
    description: "AC10_6_UNASSIGNED_UNIQUE_TOKEN loose ceiling tile",
    location_id: 1,
    category: "Safety"
  }, facultyToken, ac10Hdrs);
  const unassignedId = unassignedRes.body?.report?.id;
  const t1UnassignedList = await request("GET", "/api/staff/reports?search=AC10_6_UNASSIGNED_UNIQUE_TOKEN", null, tech1Token);
  const t2UnassignedList = await request("GET", "/api/staff/reports?search=AC10_6_UNASSIGNED_UNIQUE_TOKEN", null, tech2Token);
  const adminUnassignedList = await request("GET", "/api/staff/reports?search=AC10_6_UNASSIGNED_UNIQUE_TOKEN", null, adminToken);

  assert(
    unassignedRes.status === 201 &&
    (t1UnassignedList.body.reports || []).length === 0 &&
    (t2UnassignedList.body.reports || []).length === 0 &&
    (adminUnassignedList.body.reports || []).some(r => r.id === unassignedId),
    "AC10.6",
    "Unassigned tickets never appear in tech1 or tech2 lists or search results"
  );

  // -------------------------------------------------------------
  // AC11: TECHNICIAN AVAILABILITY, INTERNAL REMARKS & SAFETY RULE
  // -------------------------------------------------------------

  // AC11.1: Technician can PATCH own availability; admin/reporter get 403; client user_id cannot alter tech2
  const adminPatchAvail = await request("PATCH", "/api/staff/me/availability", { availability: "inactive" }, adminToken);
  const stuPatchAvail = await request("PATCH", "/api/staff/me/availability", { availability: "inactive" }, studentToken);
  const t1PatchSpoof = await request("PATCH", "/api/staff/me/availability", { availability: "inactive", user_id: 4, id: 4 }, tech1Token);
  const t1MeAfter = await request("GET", "/api/staff/me", null, tech1Token);
  const t2MeUnchanged = await request("GET", "/api/staff/me", null, tech2Token);

  assert(
    adminPatchAvail.status === 403 &&
    stuPatchAvail.status === 403 &&
    t1PatchSpoof.status === 200 &&
    t1MeAfter.status === 200 &&
    t1MeAfter.body.user?.availability === "inactive" &&
    t2MeUnchanged.status === 200 &&
    t2MeUnchanged.body.user?.availability === "active",
    "AC11.1",
    "Technician can PATCH own availability; admin/reporter get 403; client user_id cannot change another technician"
  );

  // Restore tech1 back to active for subsequent assignment checks
  await request("PATCH", "/api/staff/me/availability", { availability: "active" }, tech1Token);

  // AC11.2: Invalid availability value returns 400
  const invalidAvail1 = await request("PATCH", "/api/staff/me/availability", { availability: "busy" }, tech1Token);
  const invalidAvail2 = await request("PATCH", "/api/staff/me/availability", { availability: "" }, tech1Token);
  const invalidAvail3 = await request("PATCH", "/api/staff/me/availability", {}, tech1Token);
  assert(
    invalidAvail1.status === 400 && invalidAvail2.status === 400 && invalidAvail3.status === 400,
    "AC11.2",
    "Invalid availability values return 400 Bad Request"
  );

  // AC11.3: GET /api/staff/staff returns availability; assign/reassign to inactive returns 400; active succeeds
  const t2SetInactive = await request("PATCH", "/api/staff/me/availability", { availability: "inactive" }, tech2Token);
  const staffDirRes = await request("GET", "/api/staff/staff", null, adminToken);
  const tech2Entry = (staffDirRes.body.staff || []).find(s => s.id === 4);
  const tech1Entry = (staffDirRes.body.staff || []).find(s => s.id === 3);

  const assignToInactiveRes = await request("PUT", `/api/staff/reports/${unassignedId}`, {
    status: "assigned",
    assigned_to: 4
  }, adminToken);
  const assignToActiveRes = await request("PUT", `/api/staff/reports/${unassignedId}`, {
    status: "assigned",
    assigned_to: 3
  }, adminToken);
  const reassignToInactiveRes = await request("PUT", `/api/staff/reports/${unassignedId}`, {
    assigned_to: 4
  }, adminToken);

  assert(
    t2SetInactive.status === 200 &&
    staffDirRes.status === 200 &&
    tech2Entry?.availability === "inactive" &&
    Boolean(tech2Entry?.availability_updated_at) &&
    tech1Entry?.availability === "active" &&
    assignToInactiveRes.status === 400 &&
    /not active/i.test(String(assignToInactiveRes.body?.detail || "")) &&
    assignToActiveRes.status === 200 &&
    assignToActiveRes.body.assigned_to === 3 &&
    reassignToInactiveRes.status === 400 &&
    /not active/i.test(String(reassignToInactiveRes.body?.detail || "")),
    "AC11.3",
    "GET /api/staff/staff returns availability; assigning or reassigning to inactive technician returns 400 while active succeeds"
  );

  // AC11.4: Existing ticket stays in an inactive technician's list
  const t2ListWhileInactive = await request("GET", "/api/staff/reports", null, tech2Token);
  const t2HasAssignedWhileInactive = (t2ListWhileInactive.body.reports || []).some(r => r.id === idA && r.assigned_to === 4);
  assert(
    t2ListWhileInactive.status === 200 && t2HasAssignedWhileInactive,
    "AC11.4",
    "Existing assigned tickets stay in an inactive technician's work order list"
  );

  // Restore tech2 to active so both technicians end AC11 in clean active state
  await request("PATCH", "/api/staff/me/availability", { availability: "active" }, tech2Token);

  // AC11.5: Availability change writes a technician_availability_log row
  const availLogsTech2 = db.prepare(`
    SELECT user_id, from_value, to_value, changed_at
    FROM technician_availability_log
    WHERE user_id = 4
    ORDER BY id ASC
  `).all();
  assert(
    availLogsTech2.length >= 2 &&
    availLogsTech2[0].from_value === "active" &&
    availLogsTech2[0].to_value === "inactive" &&
    availLogsTech2[1].from_value === "inactive" &&
    availLogsTech2[1].to_value === "active" &&
    availLogsTech2.every(l => typeof l.changed_at === "string" && l.changed_at.endsWith("Z")),
    "AC11.5",
    "Availability changes write audit rows in technician_availability_log with UTC ISO timestamps"
  );

  // AC11.6: Resolved ticket admin detail returns action, remarks, resolved_by, resolved_at; reporter responses never contain remarks
  const adminRes9 = await request("GET", "/api/staff/reports/9", null, adminToken);
  const facultyMineRes = await request("GET", "/api/reports/mine", null, facultyToken);
  const facultyDet9 = await request("GET", "/api/reports/9", null, facultyToken);
  assert(
    adminRes9.status === 200 &&
    Boolean(adminRes9.body.resolution?.action) &&
    adminRes9.body.resolution?.remarks === "Fuse changed and load-tested at 15A; safe for lab sessions" &&
    adminRes9.body.resolution?.resolved_by === "Technician 2" &&
    Boolean(adminRes9.body.resolution?.resolved_at) &&
    !containsRemarksKeyOrText(facultyDet9.body) &&
    !containsRemarksKeyOrText(facultyMineRes.body),
    "AC11.6",
    "Resolved ticket admin detail returns action, remarks, resolved_by, resolved_at; reporter endpoints never contain remarks"
  );

  // AC11.7: "Fire broke out" is Critical via the safety rule
  const fireCreateRes = await request("POST", "/api/reports", {
    description: "Fire broke out",
    location_id: 6,
    category: "Safety"
  }, studentToken, ac10Hdrs);
  const fireId = fireCreateRes.body?.report?.id;
  const fireStaffDet = await request("GET", `/api/staff/reports/${fireId}`, null, adminToken);
  assert(
    fireCreateRes.status === 201 &&
    fireStaffDet.status === 200 &&
    fireStaffDet.body.report?.priority === "critical" &&
    fireStaffDet.body.report?.safety_rule_matched === "smoke_fire_flame",
    "AC11.7",
    `Report "Fire broke out" (ID #${fireId}) is classified Critical via safety rule '${fireStaffDet.body.report?.safety_rule_matched}'`
  );

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED (Total: ${totalPassed + totalFailed})`);
  console.log("=======================================================\n");

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
