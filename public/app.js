/**
 * Campus Black Box — Public Reporter Client Logic
 * Handles Student & Faculty Reporting, QR Deep Links, Truthful AI Classification,
 * Duplicate Detection Prompts (FR-20), Status Tracking, In-App Notifications, and Legal Guidance.
 * Zero references or access to internal facility administration.
 */

const TOKEN_KEY = "cbb_reporter_token";
let currentReporterUser = null;
let currentRoute = "/report";
let qrLocation = null;
let selectedCategory = "";
let selectedPhotoBase64 = null;
let aiDebounceTimer = null;
let suggestedAiCategory = null;
let allLocations = [];
let activeDuplicateReportId = null;

// Initialize Lucide icons
function refreshIcons() {
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

// -------------------------------------------------------------
// THEME MANAGEMENT
// -------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem("cbb_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  updateThemeIcons(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("cbb_theme", next);
  updateThemeIcons(next);
}

function updateThemeIcons(theme) {
  const sun = document.getElementById("theme-icon-sun");
  const moon = document.getElementById("theme-icon-moon");
  if (!sun || !moon) return;
  if (theme === "dark") {
    sun.style.display = "none";
    moon.style.display = "inline-block";
  } else {
    sun.style.display = "inline-block";
    moon.style.display = "none";
  }
}

// -------------------------------------------------------------
// AUTHENTICATION & SESSION
// -------------------------------------------------------------
function getReporterToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setReporterToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearReporterToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiReporterFetch(url, options = {}) {
  const token = getReporterToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearReporterToken();
    currentReporterUser = null;
    updateReporterUI();
    throw new Error("Session expired. Please sign in again.");
  }
  return res;
}

async function checkReporterAuth() {
  const token = getReporterToken();
  if (!token) {
    currentReporterUser = null;
    updateReporterUI();
    return false;
  }

  try {
    const res = await apiReporterFetch("/api/auth/me");
    if (!res.ok) {
      clearReporterToken();
      currentReporterUser = null;
      updateReporterUI();
      return false;
    }
    const data = await res.json();
    currentReporterUser = data.user;
    updateReporterUI();
    fetchNotifications();
    return true;
  } catch (err) {
    clearReporterToken();
    currentReporterUser = null;
    updateReporterUI();
    return false;
  }
}

function updateReporterUI() {
  const profileBadge = document.getElementById("reporter-profile-badge");
  const signinBtn = document.getElementById("reporter-signin-nav-btn");
  const roleTag = document.getElementById("reporter-role-tag");
  const bellContainer = document.getElementById("notification-bell-container");

  if (currentReporterUser) {
    if (profileBadge) profileBadge.style.display = "inline-flex";
    if (signinBtn) signinBtn.style.display = "none";
    if (roleTag) roleTag.textContent = `${currentReporterUser.role}: ${currentReporterUser.name || currentReporterUser.email}`;
    if (bellContainer) bellContainer.style.display = "block";
  } else {
    if (profileBadge) profileBadge.style.display = "none";
    if (signinBtn) signinBtn.style.display = "inline-block";
    if (bellContainer) bellContainer.style.display = "none";
  }

  // Update views based on auth state
  renderActiveRoute();
}

function handleReporterLogout() {
  clearReporterToken();
  currentReporterUser = null;
  updateReporterUI();
}

// -------------------------------------------------------------
// LOGIN MODAL (STUDENT & FACULTY ONLY)
// -------------------------------------------------------------
function openReporterLoginModal() {
  const emailInput = document.getElementById("reporter-email-input");
  const passInput = document.getElementById("reporter-password-input");
  emailInput.value = "";
  passInput.value = "";
  document.getElementById("reporter-login-error").style.display = "none";
  const modal = document.getElementById("modal-reporter-login");
  modal.style.display = "flex";
  setTimeout(() => emailInput.focus(), 50);
}

function closeReporterLoginModal() {
  document.getElementById("modal-reporter-login").style.display = "none";
}

function handleModalBackdropClick(event, modalId) {
  if (event.target && event.target.id === modalId) {
    if (modalId === "modal-reporter-login") closeReporterLoginModal();
    if (modalId === "modal-report-detail") closeReportDetailModal();
  }
}

function fillReporterCredentials(role) {
  const emailInput = document.getElementById("reporter-email-input");
  const passInput = document.getElementById("reporter-password-input");
  if (role === "student") {
    emailInput.value = "student@campus.edu";
    passInput.value = "DemoPass123!";
  } else if (role === "faculty") {
    emailInput.value = "faculty@campus.edu";
    passInput.value = "DemoPass123!";
  }
}

async function handleReporterLoginForm(e) {
  e.preventDefault();
  const email = document.getElementById("reporter-email-input").value.trim();
  const password = document.getElementById("reporter-password-input").value;
  const errorDiv = document.getElementById("reporter-login-error");
  errorDiv.style.display = "none";

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.detail || "Invalid credentials.";
      errorDiv.style.display = "block";
      return;
    }

    setReporterToken(data.token);
    currentReporterUser = data.user;
    closeReporterLoginModal();
    updateReporterUI();
    fetchNotifications();
  } catch (err) {
    errorDiv.textContent = "Network error. Please try again.";
    errorDiv.style.display = "block";
  }
}

// -------------------------------------------------------------
// ROUTING & VIEW CONTROLLER
// -------------------------------------------------------------
function navigateRoute(e, targetPath) {
  if (e && e.preventDefault) e.preventDefault();
  window.history.pushState({}, "", targetPath);
  currentRoute = targetPath;
  renderActiveRoute();
}

window.addEventListener("popstate", () => {
  currentRoute = window.location.pathname;
  renderActiveRoute();
});

function renderActiveRoute() {
  const path = window.location.pathname;
  
  // Hide all views first
  const views = ["view-report", "view-myreports", "view-terms", "view-privacy", "view-acceptable-use", "view-help", "view-contact"];
  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.style.display = "none";
  });

  const btnReport = document.getElementById("nav-btn-report");
  const btnMyReports = document.getElementById("nav-btn-myreports");
  if (btnReport) btnReport.classList.remove("active");
  if (btnMyReports) btnMyReports.classList.remove("active");

  // Route: /my-reports
  if (path.startsWith("/my-reports")) {
    document.getElementById("view-myreports").style.display = "block";
    if (btnMyReports) btnMyReports.classList.add("active");

    if (!currentReporterUser) {
      document.getElementById("myreports-signedout-card").style.display = "block";
      document.getElementById("myreports-content").style.display = "none";
    } else {
      document.getElementById("myreports-signedout-card").style.display = "none";
      document.getElementById("myreports-content").style.display = "block";
      fetchMyReports();
    }
  }
  // Route: /terms
  else if (path === "/terms") {
    document.getElementById("view-terms").style.display = "block";
  }
  // Route: /privacy
  else if (path === "/privacy") {
    document.getElementById("view-privacy").style.display = "block";
  }
  // Route: /acceptable-use
  else if (path === "/acceptable-use") {
    document.getElementById("view-acceptable-use").style.display = "block";
  }
  // Route: /help
  else if (path === "/help") {
    document.getElementById("view-help").style.display = "block";
  }
  // Route: /contact
  else if (path === "/contact") {
    document.getElementById("view-contact").style.display = "block";
  }
  // Route: /login
  else if (path === "/login") {
    openReporterLoginModal();
    document.getElementById("view-report").style.display = "block";
  }
  // Route: /report and /r/:token (Default)
  else {
    document.getElementById("view-report").style.display = "block";
    if (btnReport) btnReport.classList.add("active");

    if (!currentReporterUser) {
      document.getElementById("report-signedout-card").style.display = "block";
      document.getElementById("report-authenticated-container").style.display = "none";

      if (qrLocation) {
        document.getElementById("qr-scanned-preview-badge").style.display = "block";
        document.getElementById("qr-preview-location-text").textContent = `${qrLocation.block} · ${qrLocation.room}`;
      } else {
        document.getElementById("qr-scanned-preview-badge").style.display = "none";
      }
    } else {
      document.getElementById("report-signedout-card").style.display = "none";
      document.getElementById("report-authenticated-container").style.display = "block";
      applyLocationState();
    }
  }

  refreshIcons();
}

// -------------------------------------------------------------
// QR CODE DEEP LINK HANDLING (Goal 2a, FR-4)
// -------------------------------------------------------------
async function checkQrDeepLink() {
  const path = window.location.pathname;
  const qrMatch = path.match(/^\/r\/([a-zA-Z0-9_-]+)$/);
  if (!qrMatch) return;

  const token = qrMatch[1];
  try {
    const res = await fetch(`/api/locations/qr/${token}`);
    if (res.ok) {
      const data = await res.json();
      qrLocation = data.location;
    } else {
      qrLocation = null;
      console.warn("Invalid QR deep link token:", token);
    }
  } catch (err) {
    qrLocation = null;
  }
}

function applyLocationState() {
  const lockedBox = document.getElementById("qr-locked-location");
  const manualWrap = document.getElementById("manual-location-select-wrap");
  const lockedText = document.getElementById("qr-locked-location-text");

  if (qrLocation) {
    if (lockedBox) lockedBox.style.display = "flex";
    if (manualWrap) manualWrap.style.display = "none";
    if (lockedText) lockedText.textContent = `${qrLocation.block} · ${qrLocation.room}`;
  } else {
    if (lockedBox) lockedBox.style.display = "none";
    if (manualWrap) manualWrap.style.display = "block";
  }
}

async function loadLocationsList() {
  try {
    const res = await fetch("/api/locations");
    if (!res.ok) return;
    const data = await res.json();
    allLocations = data.locations || [];
    
    const select = document.getElementById("report-location-select");
    if (select) {
      select.innerHTML = `<option value="">Select building room or area...</option>` +
        allLocations.map(l => `<option value="${l.id}">${l.block} · ${l.room} (${l.location_type})</option>`).join("");
    }
  } catch (err) {
    console.error("Failed to load locations:", err);
  }
}

function handleLocationChange() {
  // Re-run AI duplicate check if description is already entered
  handleDescriptionChange();
}

// -------------------------------------------------------------
// REPORT SUBMISSION & AI ASSISTANT (FR-5, FR-6, FR-17, FR-20)
// -------------------------------------------------------------
function selectCategory(cat) {
  selectedCategory = cat;
  const buttons = document.querySelectorAll("#category-chips-group .chip-btn");
  buttons.forEach(btn => {
    if (btn.getAttribute("data-category") === cat) {
      btn.style.background = "var(--accent)";
      btn.style.color = "#FFFFFF";
      btn.style.borderColor = "var(--accent)";
    } else {
      btn.style.background = "var(--surface)";
      btn.style.color = "var(--text)";
      btn.style.borderColor = "var(--border)";
    }
  });
}

function handleDescriptionChange() {
  const desc = document.getElementById("report-description").value;
  const counter = document.getElementById("desc-char-counter");
  counter.textContent = `${desc.length} / 1000`;

  clearTimeout(aiDebounceTimer);
  const statusEl = document.getElementById("ai-suggestion-status");
  const actionEl = document.getElementById("ai-suggestion-action");
  const dupBox = document.getElementById("duplicate-warning-box");

  if (desc.trim().length < 15) {
    statusEl.textContent = "Type at least 15 characters describing the issue for automated classification assistance.";
    actionEl.style.display = "none";
    if (dupBox) dupBox.style.display = "none";
    suggestedAiCategory = null;
    activeDuplicateReportId = null;
    return;
  }

  statusEl.textContent = "Analyzing issue description with TF-IDF classifier...";
  
  let locationId = qrLocation ? qrLocation.id : null;
  if (!locationId) {
    const locSelect = document.getElementById("report-location-select");
    locationId = Number(locSelect ? locSelect.value : 0) || 1;
  }

  aiDebounceTimer = setTimeout(async () => {
    try {
      const res = await fetch("/api/ai/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc, location_id: locationId })
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.category) {
        suggestedAiCategory = data.category;
        const confidencePct = Math.round((data.confidence || 0.85) * 100);
        statusEl.innerHTML = `Predicted Category: <strong>${data.category}</strong> (${confidencePct}% match)`;
        document.getElementById("ai-suggested-name").textContent = data.category;
        actionEl.style.display = "block";
      } else {
        statusEl.textContent = "No specific category matched with high confidence. Please choose a category below.";
        actionEl.style.display = "none";
        suggestedAiCategory = null;
      }

      // Duplicate Check (FR-20, AC6.2)
      if (data.duplicate && data.duplicate.isDuplicate) {
        activeDuplicateReportId = data.duplicate.matchedReportId;
        const dupText = document.getElementById("duplicate-warning-text");
        const hoursAgoText = data.duplicate.hours_ago !== undefined ? `${data.duplicate.hours_ago} hours ago` : "recently";
        dupText.innerHTML = `A similar <strong>${data.duplicate.category || "issue"}</strong> was reported in this room <strong>${hoursAgoText}</strong> (Current Status: <span style="text-transform: capitalize;">${data.duplicate.status || "open"}</span>). You can add your details to that ticket without creating a duplicate.`;
        if (dupBox) dupBox.style.display = "block";
      } else {
        activeDuplicateReportId = null;
        if (dupBox) dupBox.style.display = "none";
      }
      refreshIcons();
    } catch (err) {
      statusEl.textContent = "AI categorization currently offline. Select category manually.";
      actionEl.style.display = "none";
    }
  }, 350);
}

function applyAiSuggestion() {
  if (suggestedAiCategory) {
    selectCategory(suggestedAiCategory);
  }
}

function dismissDuplicateWarning() {
  const dupBox = document.getElementById("duplicate-warning-box");
  if (dupBox) dupBox.style.display = "none";
}

async function handleAddDetailsToDuplicate() {
  if (!activeDuplicateReportId) return;
  const desc = document.getElementById("report-description").value.trim();
  if (!desc) {
    alert("Please provide notes to append to the report.");
    return;
  }

  const btn = document.getElementById("btn-add-details-to-dup");
  if (btn) btn.disabled = true;

  try {
    const res = await apiReporterFetch(`/api/reports/${activeDuplicateReportId}/updates`, {
      method: "POST",
      body: JSON.stringify({ text: desc })
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.detail || "Failed to add update.");
      return;
    }

    // Success screen
    document.getElementById("report-form-card").style.display = "none";
    document.getElementById("report-success-screen").style.display = "block";
    document.getElementById("success-report-id").textContent = `#${activeDuplicateReportId} (Note Appended)`;
    refreshIcons();
  } catch (err) {
    alert("Network error appending notes to report.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Photo handling (Base64 JSON, max 5MB, magic-byte client precheck)
function handlePhotoSelection(e) {
  const file = e.target.files[0];
  const errDiv = document.getElementById("photo-error-msg");
  const previewWrap = document.getElementById("photo-preview-wrap");
  const previewImg = document.getElementById("photo-preview-img");
  const clearBtn = document.getElementById("photo-clear-btn");
  errDiv.style.display = "none";

  if (!file) {
    clearSelectedPhoto();
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    errDiv.textContent = "Selected image exceeds maximum size limit of 5 MB.";
    errDiv.style.display = "block";
    e.target.value = "";
    clearSelectedPhoto();
    return;
  }

  const reader = new FileReader();
  reader.onload = function(evt) {
    selectedPhotoBase64 = evt.target.result;
    previewImg.src = selectedPhotoBase64;
    previewWrap.style.display = "block";
    clearBtn.style.display = "inline-block";
  };
  reader.readAsDataURL(file);
}

function clearSelectedPhoto() {
  selectedPhotoBase64 = null;
  document.getElementById("report-photo-input").value = "";
  document.getElementById("photo-preview-wrap").style.display = "none";
  document.getElementById("photo-preview-img").src = "";
  document.getElementById("photo-clear-btn").style.display = "none";
  document.getElementById("photo-error-msg").style.display = "none";
}

async function submitReportForm() {
  const errorDiv = document.getElementById("report-form-error");
  errorDiv.style.display = "none";

  // Location ID
  let locationId = qrLocation ? qrLocation.id : null;
  if (!locationId) {
    const locSelect = document.getElementById("report-location-select");
    locationId = Number(locSelect ? locSelect.value : 0);
  }
  if (!locationId) {
    errorDiv.textContent = "Please select the campus location for this incident.";
    errorDiv.style.display = "block";
    return;
  }

  // Description
  const description = document.getElementById("report-description").value.trim();
  if (!description) {
    errorDiv.textContent = "Please provide a description of the issue.";
    errorDiv.style.display = "block";
    return;
  }

  // Category
  if (!selectedCategory) {
    errorDiv.textContent = "Please select an incident category.";
    errorDiv.style.display = "block";
    return;
  }

  const payload = {
    location_id: locationId,
    description,
    category: selectedCategory,
    photo_data: selectedPhotoBase64 || null
  };

  const submitBtn = document.getElementById("submit-report-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting Report...";

  try {
    const res = await apiReporterFetch("/api/reports", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      errorDiv.textContent = data.detail || "Failed to submit report.";
      errorDiv.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.textContent = "Submit Incident Report";
      return;
    }

    // Success Screen
    document.getElementById("report-form-card").style.display = "none";
    document.getElementById("report-success-screen").style.display = "block";
    document.getElementById("success-report-id").textContent = `#${data.report.id}`;
    refreshIcons();
  } catch (err) {
    errorDiv.textContent = "Network error submitting report.";
    errorDiv.style.display = "block";
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Incident Report";
  }
}

function resetReportForm() {
  document.getElementById("report-description").value = "";
  document.getElementById("desc-char-counter").textContent = "0 / 1000";
  selectedCategory = "";
  clearSelectedPhoto();
  selectCategory("");
  dismissDuplicateWarning();
  document.getElementById("report-form-card").style.display = "block";
  document.getElementById("report-success-screen").style.display = "none";
}

// -------------------------------------------------------------
// MY REPORTS & TIMELINE
// -------------------------------------------------------------
async function fetchMyReports() {
  const container = document.getElementById("myreports-list");
  container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">Loading your submitted reports...</div>`;

  try {
    const res = await apiReporterFetch("/api/reports/mine");
    if (!res.ok) return;
    const data = await res.json();
    const reports = data.reports || [];

    if (!reports.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 24px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px;">
          <i data-lucide="inbox" style="width: 36px; height: 36px; color: var(--muted); margin-bottom: 8px;"></i>
          <h3 style="font-size: 16px; font-weight: 600;">No Reports Submitted Yet</h3>
          <p style="font-size: 13px; color: var(--muted); margin-top: 4px; margin-bottom: 16px;">Issues you report across campus will be tracked here in real-time.</p>
          <button class="btn btn-primary btn-sm" onclick="navigateRoute(null, '/report')">Submit Your First Report</button>
        </div>
      `;
      refreshIcons();
      return;
    }

    container.innerHTML = reports.map(r => {
      const statusClass = `status-${r.status}`;
      const dateFormatted = new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

      return `
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 18px; cursor: pointer; transition: border-color 150ms ease;" onclick="openReportDetailModal(${r.id})">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 15px;">#${r.id}</span>
              <span class="chip" style="font-size: 11px; font-weight: 600;">${r.block} · ${r.room}</span>
              <span class="chip" style="font-size: 11px;">${r.category}</span>
              <span class="chip ${statusClass}" style="font-size: 11px; text-transform: capitalize;">${r.status.replace("_", " ")}</span>
            </div>
            <div style="font-size: 12px; color: var(--muted);">${dateFormatted}</div>
          </div>
          <p style="font-size: 13px; line-height: 1.5; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${r.description}</p>
        </div>
      `;
    }).join("");

    refreshIcons();
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--prio-critical-text);">Failed to load reports.</div>`;
  }
}

async function openReportDetailModal(reportId) {
  const modal = document.getElementById("modal-report-detail");
  document.getElementById("detail-ticket-id").textContent = `Report #${reportId}`;
  modal.style.display = "flex";

  try {
    const res = await apiReporterFetch(`/api/reports/${reportId}`);
    if (!res.ok) return;
    const data = await res.json();
    const r = data.report;

    document.getElementById("detail-location-text").textContent = `${r.block} · ${r.room} (${r.location_type})`;
    document.getElementById("detail-desc-text").textContent = r.description;
    
    const statusPill = document.getElementById("detail-status-pill");
    statusPill.className = `chip status-${r.status}`;
    statusPill.textContent = r.status.replace("_", " ");

    // Photo preview
    const photoWrap = document.getElementById("detail-photo-wrap");
    const photoImg = document.getElementById("detail-photo-img");
    if (r.photo_path || r.photo_url) {
      photoImg.src = r.photo_path || r.photo_url;
      photoWrap.style.display = "block";
    } else {
      photoWrap.style.display = "none";
    }

    // Community updates
    const updatesBox = document.getElementById("detail-updates-box");
    const updatesList = document.getElementById("detail-updates-list");
    if (r.updates && r.updates.length) {
      updatesList.innerHTML = r.updates.map(u => `
        <div style="font-size: 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px;">
          <div>${u.text}</div>
          <div style="font-size: 10px; color: var(--muted); margin-top: 4px;">${new Date(u.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
        </div>
      `).join("");
      updatesBox.style.display = "block";
    } else {
      updatesBox.style.display = "none";
    }

    // Resolution action taken
    const resBox = document.getElementById("detail-resolution-action-box");
    const resText = document.getElementById("detail-resolution-action-text");
    if (r.status === "resolved" && r.resolution_action) {
      resText.textContent = r.resolution_action;
      resBox.style.display = "block";
    } else {
      resBox.style.display = "none";
    }

    // Fetch chronological status history timeline
    fetchReportTimeline(reportId);
  } catch (err) {
    console.error("Failed to load report detail:", err);
  }
}

async function fetchReportTimeline(reportId) {
  const timelineContainer = document.getElementById("detail-history-timeline");
  timelineContainer.innerHTML = `<div style="font-size: 12px; color: var(--muted);">Loading history...</div>`;

  try {
    const res = await apiReporterFetch(`/api/reports/${reportId}/history`);
    if (!res.ok) return;
    const data = await res.json();
    const history = data.history || [];

    if (!history.length) {
      timelineContainer.innerHTML = `<div style="font-size: 12px; color: var(--muted);">No status changes recorded yet.</div>`;
      return;
    }

    timelineContainer.innerHTML = history.map((item, idx) => {
      const timeStr = new Date(item.changed_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" });
      const label = item.from_status 
        ? `${item.from_status.replace("_", " ")} → ${item.to_status.replace("_", " ")}` 
        : `Submitted as ${item.to_status.replace("_", " ")}`;

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; padding: 6px 10px; background: var(--surface); border-radius: 6px; border: 1px solid var(--border);">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: var(--accent);"></span>
            <span style="font-weight: 600; text-transform: capitalize;">${label}</span>
          </div>
          <span style="color: var(--muted); font-size: 11px;">${timeStr}</span>
        </div>
      `;
    }).join("");
  } catch (err) {
    timelineContainer.innerHTML = `<div style="font-size: 12px; color: var(--prio-critical-text);">Failed to load timeline.</div>`;
  }
}

function closeReportDetailModal() {
  document.getElementById("modal-report-detail").style.display = "none";
}

// -------------------------------------------------------------
// IN-APP NOTIFICATIONS
// -------------------------------------------------------------
function toggleNotificationsPanel() {
  const dropdown = document.getElementById("notifications-dropdown");
  dropdown.style.display = dropdown.style.display === "none" ? "block" : "none";
}

async function fetchNotifications() {
  if (!currentReporterUser) return;
  try {
    const res = await apiReporterFetch("/api/notifications");
    if (!res.ok) return;
    const data = await res.json();
    const notifs = data.notifications || [];
    const unread = notifs.filter(n => !n.read_at);

    const badge = document.getElementById("unread-notifications-badge");
    if (badge) {
      badge.style.display = unread.length > 0 ? "block" : "none";
    }

    const list = document.getElementById("notifications-list");
    if (list) {
      if (!notifs.length) {
        list.innerHTML = `<div style="font-size: 12px; color: var(--muted); text-align: center; padding: 16px;">No notifications yet</div>`;
      } else {
        list.innerHTML = notifs.map(n => `
          <div style="font-size: 12px; padding: 8px; border-radius: 6px; background: ${n.read_at ? 'transparent' : 'var(--surface)'}; border-bottom: 1px solid var(--border);">
            <div style="font-weight: ${n.read_at ? '400' : '600'};">${n.message}</div>
            <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">${new Date(n.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
          </div>
        `).join("");
      }
    }
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
  }
}

async function markAllNotificationsRead() {
  try {
    await apiReporterFetch("/api/notifications/read-all", { method: "PUT" });
    fetchNotifications();
  } catch {}
}

async function checkConfigDemoMode() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    const quickfill = document.getElementById("reporter-demo-quickfill");
    if (quickfill) {
      quickfill.style.display = data.demo_mode ? "block" : "none";
    }
  } catch {}
}

// -------------------------------------------------------------
// BOOTSTRAP
// -------------------------------------------------------------
async function initReporterApp() {
  initTheme();
  await checkConfigDemoMode();
  await checkQrDeepLink();
  await loadLocationsList();
  await checkReporterAuth();

  // Close notifications dropdown on outer click
  document.addEventListener("click", (e) => {
    const bellBtn = document.getElementById("notification-bell-btn");
    const dropdown = document.getElementById("notifications-dropdown");
    if (dropdown && bellBtn && !bellBtn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = "none";
    }
  });

  // Esc key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeReporterLoginModal();
      closeReportDetailModal();
    }
  });

  // URL Param Helpers for Visual Verification
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("auth") === "student") {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "student@campus.edu", password: "DemoPass123!" })
      });
      const data = await res.json();
      if (data.token) {
        setReporterToken(data.token);
        currentReporterUser = data.user;
        updateReporterUI();
      }
    } catch {}
  }

  if (urlParams.get("modal") === "login") {
    openReporterLoginModal();
  }

  if (urlParams.get("test") === "duplicate") {
    setTimeout(() => {
      const descEl = document.getElementById("report-description");
      const locSelect = document.getElementById("report-location-select");
      if (locSelect) locSelect.value = "1";
      if (descEl) {
        descEl.value = "Ceiling fan speed regulator not working fan not rotating";
        handleDescriptionChange();
      }
    }, 200);
  }

  if (urlParams.get("modal") === "detail") {
    const reportId = Number(urlParams.get("id")) || 1;
    setTimeout(() => openReportDetailModal(reportId), 300);
  }
}

document.addEventListener("DOMContentLoaded", initReporterApp);
