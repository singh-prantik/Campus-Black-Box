# Campus Black Box (CBB)

> **AI-Powered Campus Problem Intelligence and Resolution System**  
> *B.Tech CSE (AI-ML) PBL Project | Mini Hackathon Edition*  
> Note: public/ is the canonical prototype UI; frontend/ is a frozen reference and may lag.

---

## ⚡ Quick Start (Ready in 3 Seconds)

The entire full-stack application and AI pipeline are self-contained with zero external dependencies required:

```bash
# 1. Start the server
node server.js

# 2. Open in your browser:
# http://localhost:3000
```

The database (`campus_blackbox.db`) is automatically initialized and seeded with 25 campus rooms, 10 users, and active tickets.

---

## 🌟 Key Features Implemented

### 1. 📱 Instant QR Code Reporting (Under 60 Seconds)
- **Pre-filled Location:** Simulates scanning QR codes mounted in any campus room (e.g., *Block C • Room 302*).
- **Photo Evidence:** Supports image attachment with preview.
- **Fast Turnaround:** Submit complaint in under 60 seconds with instant ticket creation.

### 2. 🤖 AI / Machine Learning Engine
- **Text Categorization:** Evaluates report description in real-time using TF-IDF tokenization and Cosine Similarity across **9 campus problem classes**:
  - `Electrical`, `IT/Wi-Fi`, `Equipment`, `Water`, `Cleanliness`, `Furniture`, `Safety`, `Accessibility`, `Other`.
- **Confidence Scoring:** Displays classification confidence (e.g. `98% Confidence`).
- **Deterministic Safety Overrides:** Model predictions are immediately superseded by safety rules (e.g., *exposed wires, fire, sparks, gas leaks, ceiling collapse* are auto-escalated to **Critical** priority).
- **Duplicate Detection:** Computes cosine similarity against active tickets. If similarity $> 0.45$, flags candidate ticket and prompts user to prevent duplicate work orders.

### 3. 🗺️ Interactive Campus Heat Map
- **Geo-Spatial Blueprint:** Interactive layout covering all campus wings:
  - *Block C (Engineering)*, *Block B (Science & Labs)*, *Block A (Admin Complex)*, *Block D (Central Library)*, *Block E (Hostels)*.
- **Dynamic Hotspot Intensity:** Color-coded pulsing nodes:
  - 🟢 **Normal** (0–1 open issues)
  - 🟡 **Elevated** (2–4 open issues)
  - 🔴 **Critical Hotspot** (5+ open issues)
- **Room Inspection Drawer:** Click any node to inspect room telemetry, past tickets, room QR code, or trigger a direct report.

### 4. 📋 Admin Triage & Live Incident Stream
- **Live KPI Counters:** Total incidents, pending triage, in-progress repairs, resolved issues, and average resolution time.
- **Filtering & Search:** Real-time multi-filter by status, category, priority, and free-text search.
- **Technician Dispatch:** One-click modal to assign work orders to maintenance staff.
- **Human-in-the-Loop Feedback:** Admins can adjust priority or correct suggested categories for model retraining.

### 5. 🛠️ Maintenance Technician Field Portal
- Filtered work order view for assigned technician (*Rajesh Kumar* or *Sunil Sharma*).
- One-click **Start Work** (transitions status to *In Progress*).
- **Log Resolution:** Records physical actions taken and preventative remarks into permanent resolution audit logs.

### 6. 📊 Smart Campus Analytics & Pattern Leads
- **Category Distribution:** Visual breakdown of most frequent problem types.
- **Resolution Benchmarking:** Average turnaround time across campus blocks.
- **AI Investigation Leads:** Surfaces actionable patterns (e.g. *Block C equipment overheating between 1 PM – 3 PM*).

### 7. 👥 Role-Based Personas (RBAC)
Quick-switch between personas directly in the navigation bar to test all user perspectives:
- **Dr. Suman Devi** (`admin`): Full triage dashboard, technician dispatch, analytics.
- **Mayank Chaudhary** (`student`): QR reporting flow, real-time AI feedback.
- **Rajesh Kumar** (`maintenance`): Technician work queue and resolution logger.
- **Dr. Anil Verma** (`faculty`): Classroom issue reporting.
- **System Admin** (`super_admin`): User role manager and room QR code directory.

---

## 🗄️ Database Schema (`campus_blackbox.db`)

1. **`users`**: `id`, `name`, `email`, `role`, `department`, `created_at`
2. **`locations`**: `id`, `block`, `room`, `floor`, `latitude`, `longitude`, `location_type`
3. **`reports`**: `id`, `user_id`, `location_id`, `description`, `category`, `suggested_category`, `priority`, `status`, `photo_url`, `assigned_to`, `created_at`, `resolved_at`
4. **`resolutions`**: `id`, `report_id`, `staff_id`, `action`, `remarks`, `created_at`
5. **`ai_predictions`**: `id`, `report_id`, `predicted_category`, `category_confidence`, `priority_score`, `duplicate_score`, `duplicate_of`, `model_version`

---

## 🌐 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/auth/me` | Current authenticated user profile |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT |
| `POST` | `/api/ai/predict` | Real-time ML text classification & duplicate check |
| `GET` | `/api/locations` | All campus monitored rooms with incident counts |
| `GET` | `/api/locations/:id/qr` | SVG QR code for specific room |
| `GET` | `/api/reports` | List & filter reports (`?status=`, `?category=`, `?search=`) |
| `POST` | `/api/reports` | Create new report & run AI pipeline |
| `PATCH` | `/api/reports/:id` | Update report (assign staff, change status/priority) |
| `POST` | `/api/reports/:id/resolve` | Close ticket with action taken & remarks |
| `GET` | `/api/analytics/summary` | Campus KPI summary metrics |
| `GET` | `/api/analytics/heatmap` | Location coordinates and heat intensities |
| `GET` | `/api/analytics/categories` | Percentage breakdown by category |
| `GET` | `/api/analytics/resolution-times`| Average resolution hours by block |
| `GET` | `/api/admin/users` | All system users & roles |

---

## 🚀 Cloud Deployment Guide

### Option 1: Deploy on Render (Recommended for Canonical Server & SQLite)

Render natively runs continuous Node.js processes, making it the ideal host for `server.js` with zero configuration needed.

1. **Push this repository to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Campus Black Box release"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/campus-black-box.git
   git push -u origin main
   ```

2. **Deploy on Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** → **Web Service**.
   - Connect your GitHub repository.
   - Configure the following settings:
     - **Runtime**: `Node`
     - **Build Command**: Leave blank (zero npm dependencies required)
     - **Start Command**: `node server.js`
     - **Instance Type**: `Free`
   - In **Environment Variables**, add:
     - `NODE_VERSION`: `22.5.0` *(Required for native `node:sqlite`)*
     - `DEMO_MODE`: `true`
     - `JWT_SECRET`: Any 32-character secret string
   - Click **Create Web Service**. Your service will be live on Render's HTTPS URL within 2 minutes.

---

### Option 2: Deploy with Docker

A production-ready [`Dockerfile`](file:///c:/Users/arvpr/OneDrive/Desktop/Campus%20Black%20Box/Dockerfile) based on `node:22-alpine` is included.

```bash
# Build the Docker image
docker build -t campus-black-box .

# Run the container
docker run -p 3000:3000 -e DEMO_MODE=true campus-black-box
```

---

### Option 3: Deploy Frontend on Vercel

Vercel is built for serverless Next.js frontends. Because serverless functions have an ephemeral, read-only filesystem, SQLite file writes will reset between invocations.

To deploy the Next.js client (`frontend/`):
1. Import your GitHub repository into [Vercel](https://vercel.com/).
2. In project settings, set **Root Directory** to `frontend`.
3. Add the environment variable:
   - `NEXT_PUBLIC_API_URL`: Your Render backend URL (e.g. `https://campus-black-box.onrender.com`).
4. Click **Deploy**.

---

## 🧪 Verification & Acceptance Testing

The test suite runs 40 automated criteria covering authentication, audience separation, state machines, duplicate detection (0.55 threshold), safety overrides, priority privacy, and triage analytics.

```bash
# Run all 40 automated acceptance tests
node test_workflow.js
```


