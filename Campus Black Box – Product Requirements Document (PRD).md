# Campus Black Box – Product Requirements Document (PRD)

*AI-Powered Campus Problem Intelligence and Resolution System*

**Team:** Mayank Chaudhary, Prantik Singh  |  **Course:** B.Tech CSE (AI-ML), PBL Mini Hackathon  |  **Supervisor:** Dr. Suman Devi **Version:** 1.0 (derived from the project report)  |  **Status:** Design stage, pre-development

## 1. Overview

### 1.1 Product summary

Campus Black Box is a web platform that turns everyday campus complaints (broken projector, dead Wi-Fi, water leak, dark corridor) into structured data. A QR code in each room opens a report form with the location pre-filled. ML models suggest a category, estimate priority and flag duplicates. Administrators get a dashboard, a campus heat map and analytics showing where problems repeat, how long fixes take and when problems spike.

### 1.2 Vision

Move colleges from *reacting* to individual complaints to *understanding* their campus through data.

### 1.3 What this is not

It is not just another complaint portal. The differentiator is the intelligence layer (categorization, priority, duplicates) and pattern/hotspot analytics built on every resolved ticket.

## 2. Problem and Opportunity

Complaints today are scattered across verbal reports, WhatsApp, email and word of mouth. Consequences:

- No single place to report problems
- The same problem is reported many times
- Urgency is decided informally and inconsistently
- No map of where problems occur; little history or performance tracking
- No visibility of patterns, so management only reacts after something goes wrong

**Opportunity:** the data already exists in the form of daily complaints. Capturing it in one structured place makes it analysable.

## 3. Goals, Non-Goals and Success Metrics

### 3.1 Goals

1. Let anyone report a problem in under 60 seconds with location pre-filled.
2. Auto-suggest category, estimate priority and flag likely duplicates.
3. Give admins one dashboard to assign, track and close issues.
4. Visualise problem concentration through a heat map.
5. Surface repeating and time-based patterns as things to investigate.

### 3.2 Non-goals (v1)

- Predictive maintenance, IoT sensor integration, digital campus twin
- Computer vision damage detection (optional, only if the MVP is done early)
- Claims about causes of patterns (patterns are leads, not proof)
- Native mobile apps (web app opened via QR is sufficient)

### 3.3 Success metrics (prototype targets)

| Metric | Target | How measured |
| --- | --- | --- |
| Reporting time | Under 60 seconds | Usability test with timed tasks |
| Categorization accuracy | At least 85% | Held-out labelled test set |
| Duplicate detection | Report precision, recall, F1 | Labelled duplicate pairs |
| Resolution time | Tracked per block and category | Analytics from resolved\_at minus created\_at |
| System performance | API response time under concurrent load | Load test |
| User satisfaction | Survey score (threshold to be set by team) | Post-pilot survey |

Note: targets are goals still to be validated. Any example numbers in demos must be labelled as sample data.

## 4. Users and Roles

| Role | Description | Key permissions |
| --- | --- | --- |
| Student | Reports issues, tracks own reports | Create report, view own reports, add details to a duplicate, receive notifications |
| Faculty | Same as student; often reports classroom equipment | Same as student |
| Maintenance staff | Fixes issues | View only tickets assigned to them, update status, add remarks |
| Administrator | Manages operations | View all reports, assign technicians, close tickets, access dashboard, map and analytics |
| Super Admin | System owner | Manage users and roles, locations, QR codes, audit logs |

All permissions are enforced on the backend, not just hidden in the UI.

## 5. User Stories

**Reporter (student / faculty)**

- As a reporter, I scan the QR in a room so the location is filled automatically.
- As a reporter, I describe the problem and optionally attach a photo so maintenance understands it.
- As a reporter, if a similar open report exists, I am asked to add details to it instead of creating a duplicate.
- As a reporter, I get notified when my report changes status.

**Administrator**

- As an admin, I see new reports with suggested category, priority and similar reports, so I can triage quickly.
- As an admin, I assign a technician and track the report through to resolution.
- As an admin, I open a heat map and click a block to see totals, open/resolved counts, top categories and average resolution time.
- As an admin, I see trends by time of day, location and category to spot recurring problems.

**Maintenance staff**

- As a technician, I see only my assigned tickets and update their status with remarks.

**Super Admin**

- As a super admin, I manage users, roles and locations, and review audit logs.

## 6. Functional Requirements

Priority key: **P0** = MVP, **P1** = advanced phase after MVP, **P2** = optional / future.

### 6.1 Authentication and access

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-1 | Users log in with role-based accounts (Student, Faculty, Maintenance, Admin, Super Admin) using JWT | P0 |
| FR-2 | Backend enforces role checks on every endpoint; a student cannot reach admin pages by editing the URL | P0 |
| FR-3 | Maintenance staff can access only tickets assigned to them | P0 |

### 6.2 QR and reporting

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-4 | Each room or key location has a unique QR code that opens the report page with location pre-filled | P0 |
| FR-5 | Report form captures description, optional photo, location, timestamp and reporter | P0 |
| FR-6 | Photo upload validates file type and size | P0 |
| FR-7 | Report can be completed in under 60 seconds | P0 |
| FR-8 | Reporter can view the status and history of their own reports | P0 |
| FR-9 | Reporter receives a notification on each status change (channel to be decided, see Open Questions) | P0 |

### 6.3 Ticket lifecycle and admin dashboard

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-10 | Status flow: Pending, Assigned, In Progress, Resolved | P0 |
| FR-11 | Admin can assign a technician, change status and close a ticket | P0 |
| FR-12 | Technician can update status and add remarks and action taken (stored in RESOLUTIONS) | P0 |
| FR-13 | Admin dashboard lists reports with filters by status, category, location and priority | P0 |
| FR-14 | Campus heat map shows problem concentration by location | P0 |
| FR-15 | Clicking a block shows total, open and resolved counts, top categories and average resolution time | P1 |

### 6.4 AI/ML intelligence layer

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-16 | **Categorization:** from report text, predict one of Electrical, IT/Wi-Fi, Equipment, Water, Cleanliness, Furniture, Safety, Accessibility, Other; return a confidence score. Method: TF-IDF + Logistic Regression | P0 |
| FR-17 | Admin or reporter can correct a wrong suggested category; corrections are stored for retraining | P1 |
| FR-18 | **Priority prediction:** score priority (Low, Medium, High, Critical) from problem type, number of similar reports, safety impact, location and time open | P1 |
| FR-19 | **Safety override rules:** fixed rules take precedence over the model (e.g. exposed electrical wire is always Critical) | P1 |
| FR-20 | **Duplicate detection:** compare a new report to open reports using TF-IDF or sentence embeddings with cosine similarity; above a tuned threshold, prompt the user to add to the existing report | P1 |
| FR-21 | Every prediction is stored with category\_confidence, priority\_score, duplicate\_score and model\_version | P0 |

### 6.5 Pattern and analytics

| ID | Requirement | Priority |
| --- | --- | --- |
| FR-22 | Group reports by location, category and time to detect hotspots (e.g. equipment complaints in one block between 1 PM and 4 PM) | P1 |
| FR-23 | Show resolution-time analytics per block and category | P1 |
| FR-24 | Show block-to-block comparison and trend charts | P1 |
| FR-25 | Present patterns as leads to investigate, never as proven causes | P1 |

### 6.6 Future (out of scope for v1)

Predictive maintenance for frequently failing equipment, IoT sensor integration, computer vision on uploaded photos (YOLO/CNN), digital campus twin. (P2)

## 7. Non-Functional Requirements

| Area | Requirement |
| --- | --- |
| Performance | Acceptable API response time under concurrent reporting; target values to be defined before load testing (e.g. p95 latency, concurrent users) |
| Usability | Mobile-first report page that works in a phone browser with no install; report in under 60 seconds |
| Security | Follow OWASP API Security Top 10; server-side authorization; input validation; safe file uploads; rate limiting on public endpoints; database access control; audit logs |
| Privacy | Reports are linked to reporter identity; restrict visibility by role; protect students' personal information |
| Reliability | Model version recorded per prediction; ability to compare models over time |
| Maintainability | Modular services (frontend, API, AI engine); tests with Pytest and Postman collections; Git and GitHub workflow |
| Accessibility | Report form usable with screen readers and on low-end phones (recommended addition) |

## 8. Data Model

Five core tables (PK = primary key, FK = foreign key):

| Table | Key fields |
| --- | --- |
| USERS | user\_id (PK), name, role, department |
| LOCATIONS | location\_id (PK), block, room, latitude, longitude |
| REPORTS | report\_id (PK), user\_id (FK), location\_id (FK), category, description, priority, status, created\_at, resolved\_at |
| RESOLUTIONS | resolution\_id (PK), report\_id (FK), staff\_id (FK), action, remarks, timestamp |
| AI\_PREDICTIONS | prediction\_id (PK), report\_id (FK), category\_confidence, priority\_score, duplicate\_score, model\_version |

Relationships: one user has many reports; each report has one location; a report can have many resolution records and predictions.

**Gaps to resolve:** photo reference field on REPORTS (or a separate attachments table), assigned technician field, notifications table, QR code to location mapping, and a field for the user-corrected category. Rooms that belong to a block should use PostGIS geometry for map queries.

## 9. System Architecture and Tech Stack

| Layer | Choice |
| --- | --- |
| Frontend | React / Next.js (report page, admin dashboard) |
| Maps and charts | Leaflet with OpenStreetMap; Recharts or Plotly |
| Backend | Python FastAPI, JWT auth, role-based access control |
| Database | PostgreSQL with PostGIS; file storage for photos |
| AI engine | Python, Pandas, NumPy, scikit-learn; Sentence Transformers (optional) |
| Design and testing | Figma; Postman, Pytest, Git and GitHub |
| Deployment | Vercel (frontend); Render, Railway or AWS (backend) |

FastAPI was chosen so the API and the Python ML code live in one ecosystem.

## 10. AI/ML Specification

| Module | Input | Method | Output | Evaluation |
| --- | --- | --- | --- | --- |
| Categorization | Report text | TF-IDF + Logistic Regression (DistilBERT as later upgrade) | Category + confidence | Accuracy at least 85% on held-out set; per-class precision and recall |
| Priority | Category, similar-report count, safety impact, location, time open | Supervised model on labelled data + rule overrides | Low / Medium / High / Critical | Agreement with hand labels; rule coverage tests |
| Duplicate detection | New report vs open reports | TF-IDF or embeddings + cosine similarity with threshold | Match score + candidate report | Precision, recall, F1 |

**Data plan:** begin with a synthetic or hand-labelled prototype dataset of about 1,000 to 2,000 reports, then replace progressively with real pilot data. Keep a train/validation/test split and never evaluate on training data.

**Guardrails:** low-confidence predictions are shown as suggestions that humans can override; the example priority table in the report is illustrative, not measured.

## 11. Core User Flow

1. **Scan:** user scans the room QR (e.g. Block C, Room 302); the form opens with location filled.
2. **Report:** user writes the problem, optionally adds a photo, submits.
3. **Auto-process:** system stores location, time and reporter; AI suggests category, priority and any similar open report.
4. **Admin action:** dashboard shows priority, similar reports and typical fix time; admin assigns a technician.
5. **Resolution:** status moves Pending, Assigned, In Progress, Resolved; the reporter is notified; the closed ticket feeds analytics.

## 12. Release Plan

### MVP (P0)

Student login, QR scan, report with photo, automatic location, database, admin dashboard, status updates, basic AI categorization, campus heat map.

### Phase 2 (P1)

Priority prediction with safety rules, duplicate detection, pattern analytics, block drill-down, category correction loop.

### Later (P2)

Predictive maintenance, IoT, computer vision, digital twin.

### Timeline (from the report)

| Phase | Weeks | Output |
| --- | --- | --- |
| 1. Requirements | 1 | Requirements document |
| 2. UI/UX | 2 | Figma designs |
| 3. Database and backend | 3-4 | Working API |
| 4. Frontend | 4-5 | Connected web app |
| 5. AI/ML | 5-6 | Trained models |
| 6. Analytics and map | 6-7 | Analytics module |
| 7. Testing | 7-8 | Test report |
| 8. Pilot | 8+ | Pilot evaluation in 1-2 buildings (e.g. Block C, about 10 classrooms) |

Team split: one member on frontend and design, the other on backend, database and AI/ML; testing, documentation and deployment shared.

## 13. Testing and Acceptance Criteria

| Test | Acceptance criterion |
| --- | --- |
| Functional | A report can go from scan to resolved, with correct status and notification at each step |
| AI accuracy | Categorization at least 85% on the labelled test set; duplicate F1 reported |
| Performance | API stays within agreed response-time limits under simulated concurrent users |
| Security | A student cannot access admin functions or another user's data; uploads reject invalid files; rate limits trigger |
| Usability | Test users complete a report in under 60 seconds |

## 14. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Limited real data; models weaker on real complaints | Retrain on pilot data; track accuracy continuously |
| Low adoption | QR in every room, under-60-second flow, status notifications |
| Correlation mistaken for cause | Label patterns as things to investigate |
| Privacy of reporter identity | Role-based access, audit logs, limited visibility |
| Scope creep (CV, IoT) | Finish MVP first; keep extras optional |
| Misuse of public QR endpoints (spam, fake reports) | Rate limiting, login requirement, admin moderation |
| Small team of two | Strict MVP scope, phased delivery |

## 15. Open Questions and Recommendations

These are gaps found while analysing the report that the team should decide before building.

1. **Anonymous vs logged-in reporting:** the report says anyone can scan and report, but the MVP lists student login. Decide whether anonymous reports are allowed, and how spam is handled if they are.
2. **Notification channel:** email, in-app, or push? Not specified.
3. **Non-room issues:** canteen queues, dark corridors and Wi-Fi dead zones are not tied to a single room. Plan location types such as outdoor areas, corridors and canteen.
4. **Priority labels:** who creates labelled priority data, and how is ground truth defined?
5. **Photo handling:** storage location, size limit and retention period.
6. **Duplicate threshold:** how will it be tuned and who confirms a merge?
7. **Roadmap vs MVP mismatch:** the 8-week plan includes AI priority and duplicates, while the report calls them advanced and post-MVP. Clarify which are in the timeline.
8. **Data privacy policy:** retention of reporter identity and who can see it, in line with applicable Indian data protection rules.
9. **Metrics thresholds:** define the satisfaction survey target and load-test numbers.
10. **Pilot success criteria:** what result at the end of the pilot counts as success?

## 16. Glossary

**QR code:** scannable code that opens the room's report form. **MVP:** smallest first working version. **TF-IDF:** converts text to numeric features. **Cosine similarity:** measure of how alike two texts are. **Heat map:** map where more problems mean stronger colour. **PostGIS:** location extension for PostgreSQL. **RBAC:** role-based access control.
