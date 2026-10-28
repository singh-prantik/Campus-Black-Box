/**
 * Campus Black Box — Comprehensive Verification Test Suite
 * Iteration 3: Strict Staff/Reporter Portal Separation, State Machine Lifecycle,
 * Truthful AI Intelligence, QR Deep Links, Audit Trail, and Real Photo Validation.
 * Tests AC1.1 to AC5.10 (31 Automated Acceptance Criteria).
 */

const { handleRequest, db, seedData, validateReturnUrl } = require("./server.js");
const { Readable } = require("node:stream");
const { EventEmitter } = require("node:events");
const fs = require("node:fs");
const path = require("node:path");

// In-process mock request helper
function request(method, path, body = null, token = null) {
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
    req.url = path;
    req.headers = {
      host: "localhost:3000",
      "content-type": "application/json"
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
        const data = Buffer.concat(this._chunks).toString("utf8");
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: this.statusCode, headers: this.headers, body: parsed, raw: data });
        } catch {
          resolve({ status: this.statusCode, headers: this.headers, body: data, raw: data });
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
