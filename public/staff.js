/**
 * Campus Black Box — Staff Portal Client Logic
 * Handles Authentication, Incident Triage, Ticket Assignment, Priority Overrides,
 * Category Corrections Export, Lifecycle Transitions, Resolution Audits, and Geo Heatmap Drilldown.
 */

const TOKEN_KEY = "cbb_staff_token";
let currentStaffUser = null;
let currentTab = "admin";
let searchDebounceTimeout = null;
let activeTicketIdForModal = null;
let isDemoMode = false;

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
function getStaffToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setStaffToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearStaffToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function apiStaffFetch(url, options = {}) {
  const token = getStaffToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearStaffToken();
    currentStaffUser = null;
    showStaffLoginView();
    throw new Error("Staff session invalid or expired. Please sign in again.");
  }
  if (res.status === 403) {
    const errBody = await res.clone().json().catch(() => ({}));
    const msg = String(errBody.detail || "");
    if (/staff portal/i.test(msg)) {
      clearStaffToken();
      currentStaffUser = null;
      showStaffLoginView();
      throw new Error("Staff session invalid or expired. Please sign in again.");
    }
  }
  return res;
}

async function checkStaffAuth() {
  const token = getStaffToken();
  if (!token) {
    showStaffLoginView();
    return false;
  }

  try {
    const res = await apiStaffFetch("/api/staff/auth/me");
    if (!res.ok) {
      clearStaffToken();
      showStaffLoginView();
      return false;
    }
    const data = await res.json();
    if (!data.user || data.user.aud !== "staff") {
      clearStaffToken();
      currentStaffUser = null;
      showStaffLoginView();
      return false;
    }
    currentStaffUser = data.user;
    updateStaffHeaderUI();
    return true;
  } catch (err) {
    clearStaffToken();
    showStaffLoginView();
    return false;
  }
}

function updateStaffHeaderUI() {
  const navTabs = document.getElementById("staff-nav-tabs");
  const btnAdmin = document.getElementById("tab-btn-admin");
  const btnHeatmap = document.getElementById("tab-btn-heatmap");
  const btnWorkorders = document.getElementById("tab-btn-workorders");
  const userBadge = document.getElementById("staff-user-badge");
  const signinBtn = document.getElementById("staff-signin-btn");
  const rolePill = document.getElementById("staff-role-pill");

  if (currentStaffUser) {
    const isAdminUser = currentStaffUser.role === "admin" || currentStaffUser.role === "super_admin";
    if (navTabs) navTabs.style.display = "flex";
    if (btnAdmin) btnAdmin.style.display = isAdminUser ? "inline-flex" : "none";
    if (btnHeatmap) btnHeatmap.style.display = isAdminUser ? "inline-flex" : "none";
    if (btnWorkorders) btnWorkorders.style.display = "inline-flex";
    if (userBadge) userBadge.style.display = "inline-flex";
    if (signinBtn) signinBtn.style.display = "none";
    if (rolePill) {
      rolePill.textContent = currentStaffUser.name || currentStaffUser.email;
    }
  } else {
    if (navTabs) navTabs.style.display = "none";
    if (userBadge) userBadge.style.display = "none";
    if (signinBtn) signinBtn.style.display = "inline-block";
  }
}

function showStaffLoginView() {
  document.getElementById("view-staff-login").style.display = "block";
  document.getElementById("view-staff-admin").style.display = "none";
  document.getElementById("view-staff-heatmap").style.display = "none";
  document.getElementById("view-staff-workorders").style.display = "none";
  updateStaffHeaderUI();
  refreshIcons();
}

function handleStaffLogout() {
  clearStaffToken();
  currentStaffUser = null;
  window.history.pushState({}, "", "/staff/login");
  showStaffLoginView();
}

async function handleStaffLoginForm(e) {
  e.preventDefault();
  const email = document.getElementById("staff-email-input").value.trim();
  const password = document.getElementById("staff-password-input").value;
  const errorDiv = document.getElementById("staff-login-error");
  errorDiv.style.display = "none";

  try {
    const res = await fetch("/api/staff/auth/login", {
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

    setStaffToken(data.token);
    currentStaffUser = data.user;
    updateStaffHeaderUI();

    // Route technician to work-orders, admin to triage
    if (currentStaffUser.role === "maintenance") {
      switchStaffTab("workorders");
    } else {
      switchStaffTab("admin");
    }
  } catch (err) {
    errorDiv.textContent = "Network error. Please try again.";
    errorDiv.style.display = "block";
  }
}

function fillStaffCredentials(role) {
  const emailInput = document.getElementById("staff-email-input");
  const passInput = document.getElementById("staff-password-input");
  if (role === "tech1") {
    emailInput.value = "tech1@campus.edu";
    passInput.value = "DemoPass123!";
  } else if (role === "tech2") {
    emailInput.value = "tech2@campus.edu";
    passInput.value = "DemoPass123!";
  } else if (role === "admin") {
    emailInput.value = "admin@campus.edu";
    passInput.value = "DemoPass123!";
  }
}

// -------------------------------------------------------------
// TAB NAVIGATION
// -------------------------------------------------------------
function switchStaffTab(tabName) {
  if (currentStaffUser && currentStaffUser.role === "maintenance" && tabName !== "workorders") {
    tabName = "workorders";
  }
  currentTab = tabName;
  document.getElementById("view-staff-login").style.display = "none";
  document.getElementById("view-staff-admin").style.display = tabName === "admin" ? "block" : "none";
  document.getElementById("view-staff-heatmap").style.display = tabName === "heatmap" ? "block" : "none";
  document.getElementById("view-staff-workorders").style.display = tabName === "workorders" ? "block" : "none";

  const btnAdmin = document.getElementById("tab-btn-admin");
  const btnHeatmap = document.getElementById("tab-btn-heatmap");
  const btnWorkorders = document.getElementById("tab-btn-workorders");

  if (btnAdmin) btnAdmin.classList.toggle("active", tabName === "admin");
  if (btnHeatmap) btnHeatmap.classList.toggle("active", tabName === "heatmap");
  if (btnWorkorders) btnWorkorders.classList.toggle("active", tabName === "workorders");

  let targetPath = "/staff/admin";
  if (tabName === "heatmap") targetPath = "/staff/admin/heatmap";
  if (tabName === "workorders") targetPath = "/staff/work-orders";
  window.history.pushState({}, "", targetPath);

  if (tabName === "admin") {
    fetchStaffAnalytics();
    fetchStaffReports();
  } else if (tabName === "heatmap") {
    fetchHeatmapData();
  } else if (tabName === "workorders") {
    fetchTechnicianWorkOrders();
  }
  refreshIcons();
}

function staffNavigate(e, path) {
  e.preventDefault();
  if (!currentStaffUser) {
    showStaffLoginView();
    return;
  }
  if (path === "/staff/admin/heatmap") switchStaffTab("heatmap");
  else if (path === "/staff/work-orders") switchStaffTab("workorders");
  else switchStaffTab("admin");
}

// -------------------------------------------------------------
// INCIDENT TRIAGE (ADMIN)
// -------------------------------------------------------------
async function fetchStaffAnalytics() {
  try {
    const res = await apiStaffFetch("/api/staff/analytics/summary");
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById("kpi-pending").textContent = data.pending_reports || 0;
    document.getElementById("kpi-assigned").textContent = data.assigned_reports || 0;
    document.getElementById("kpi-in-progress").textContent = data.in_progress_reports || 0;
    document.getElementById("kpi-resolved").textContent = data.resolved_reports || 0;
    document.getElementById("kpi-avg-time").textContent = `${Number(data.avg_resolution_hours || 0).toFixed(1)}h`;
  } catch (err) {
    console.error("Failed to fetch staff analytics:", err);
  }
}

async function fetchStaffReports() {
  const tbody = document.getElementById("staff-admin-table-body");
  const status = document.getElementById("admin-status-filter").value;
  const category = document.getElementById("admin-category-filter").value;
  const block = document.getElementById("admin-block-filter").value;
  const priority = document.getElementById("admin-priority-filter").value;
  const search = document.getElementById("admin-search-input").value.trim();

  let url = `/api/staff/reports?status=${encodeURIComponent(status)}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;
  if (block) url += `&block=${encodeURIComponent(block)}`;
  if (priority) url += `&priority=${encodeURIComponent(priority)}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  try {
    const res = await apiStaffFetch(url);
    if (!res.ok) return;
    const data = await res.json();
    renderStaffTable(data.reports || []);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: var(--prio-critical-text);">Failed to load incidents.</td></tr>`;
  }
}

function debounceStaffSearch() {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(fetchStaffReports, 300);
}

function resetStaffFilters() {
  document.getElementById("admin-search-input").value = "";
  document.getElementById("admin-status-filter").value = "all";
  document.getElementById("admin-category-filter").value = "";
  document.getElementById("admin-block-filter").value = "";
  document.getElementById("admin-priority-filter").value = "";
  fetchStaffReports();
}

function formatStaffRoleLabel(role) {
  const lower = String(role || "student").toLowerCase();
  if (lower === "faculty") return "Faculty";
  if (lower === "maintenance" || lower === "technician") return "Technician";
  return "Student";
}

function formatStaffLocation(r) {
  const blk = (r.location && r.location.block) || r.block;
  const rm = (r.location && r.location.room) || r.room;
  if (blk && rm) return `<strong>${blk}</strong> · ${rm}`;
  return blk || rm || "Location unavailable";
}

function getHeatStepForBlock(openCount, maxOpen) {
  if (!openCount || openCount <= 0 || !maxOpen || maxOpen <= 0) return 0;
  const ratio = openCount / maxOpen;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function renderStaffTable(reports) {
  const tbody = document.getElementById("staff-admin-table-body");
  if (!tbody) return;
  if (!reports || !reports.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 36px; color: var(--muted);">No matching incidents found.</td></tr>`;
    return;
  }

  const isAdmin = currentStaffUser && (currentStaffUser.role === "admin" || currentStaffUser.role === "super_admin");

  tbody.innerHTML = reports.map(r => {
    const statusClass = `status-${r.status}`;
    const prioClass = `prio-${(r.priority || "medium").toLowerCase()}`;
    const fullTs = window.CBBTime ? window.CBBTime.formatFullTimestamp(r.created_at) : r.created_at;
    const relTs = window.CBBTime ? window.CBBTime.formatRelativeTime(r.created_at) : "";
    const roleLabel = formatStaffRoleLabel(r.reporter_role);
    const reporterDisplay = r.reporter_name ? `${r.reporter_name} (${roleLabel})` : roleLabel;

    // Priority Reason Tooltip (Goal 3b, FR-18, FR-19)
    let prioTooltip = `Rule-based (prototype): default for ${r.category}`;
    if (r.priority_overridden_by) {
      prioTooltip = `Manual override: ${r.priority_override_reason || "Admin override"}`;
    } else if (r.safety_rule_matched) {
      prioTooltip = `Safety rule override: ${r.safety_rule_matched}`;
    }

    // Similar Updates Pill
    const updatesHtml = (r.similar_updates_count && r.similar_updates_count > 0)
      ? `<span class="chip" style="font-size: 10px; background: #FEF3C7; color: #92400E; border-color: #FCD34D; margin-left: 4px;" title="${r.similar_updates_count} community updates logged">+${r.similar_updates_count} updates</span>`
      : "";

    const photoBtnHtml = r.has_photo
      ? `<button type="button" class="btn btn-secondary btn-sm" aria-label="View photo proof" onclick="openStaffPhotoLightbox(${r.id})" title="View photo proof"><i data-lucide="camera" style="width: 14px; height: 14px;"></i></button>`
      : `<span style="color: var(--muted); font-size: 11px;">—</span>`;

    // Action button logic per PRD State Machine
    let actionButtons = "";
    if (r.status === "pending") {
      actionButtons = `
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="openPriorityModal(${r.id}, '${r.priority}')" title="Override priority">Prio</button>` : ""}
        <button class="btn btn-primary btn-sm" onclick="openAssignModal(${r.id}, ${r.assigned_to || "null"}, '${r.status}')">Assign</button>
      `;
    } else if (r.status === "assigned") {
      actionButtons = `
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="openPriorityModal(${r.id}, '${r.priority}')" title="Override priority">Prio</button>` : ""}
        <button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="startWorkOnTicket(${r.id})">Start Work</button>
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="openAssignModal(${r.id}, ${r.assigned_to || "null"}, '${r.status}')">Reassign</button>` : ""}
      `;
    } else if (r.status === "in_progress") {
      actionButtons = `
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="openPriorityModal(${r.id}, '${r.priority}')" title="Override priority">Prio</button>` : ""}
        <button class="btn btn-primary btn-sm" style="background: #10B981; border-color: #10B981; margin-right: 4px;" onclick="openResolveModal(${r.id})">Resolve</button>
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" onclick="openAssignModal(${r.id}, ${r.assigned_to || "null"}, '${r.status}')">Reassign</button>` : ""}
      `;
    } else if (r.status === "resolved") {
      actionButtons = `
        <button type="button" class="btn btn-secondary btn-sm" aria-label="View resolution notes" title="View resolution notes" onclick="openStaffDetailModal(${r.id}, true)" style="margin-right: 4px;">
          <i data-lucide="file-text" style="width: 14px; height: 14px;"></i>
        </button>
        <span style="font-size: 11px; color: var(--muted); font-weight: 500;">Closed</span>
      `;
    }

    return `
      <tr style="border-bottom: 1px solid var(--border); cursor: pointer;" onclick="openStaffDetailModal(${r.id})">
        <td style="padding: 12px 16px; font-weight: 600;">#${r.id}</td>
        <td style="padding: 12px 16px; color: var(--muted); font-size: 11px;" title="${fullTs}">
          <div style="color: var(--text); font-weight: 600;">${relTs || fullTs}</div>
          <div>${fullTs}</div>
        </td>
        <td style="padding: 12px 16px;">${formatStaffLocation(r)}</td>
        <td style="padding: 12px 16px; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.description}">
          ${r.description}
          ${updatesHtml}
        </td>
        <td style="padding: 12px 16px;"><span class="chip" style="font-size: 11px;">${r.category}</span></td>
        <td style="padding: 12px 16px;">
          <span class="chip ${prioClass}" style="font-size: 11px; cursor: help;" title="${prioTooltip}">
            ${r.priority}
            ${r.safety_rule_matched ? ' <span style="font-size: 9px; opacity: 0.8;">(Rule)</span>' : ''}
          </span>
        </td>
        <td style="padding: 12px 16px;"><span class="chip ${statusClass}" style="font-size: 11px; text-transform: capitalize;">${r.status.replace("_", " ")}</span></td>
        <td style="padding: 12px 16px; color: var(--muted);">${r.assignee_name ? `${escapeHtmlStaff(r.assignee_name)}${r.assignee_availability === "inactive" ? ' <span class="chip" style="font-size: 10px; background: #FEF3C7; color: #92400E; border-color: #FCD34D; margin-left: 4px;">Not active</span>' : ""}` : "Unassigned"}</td>
        <td style="padding: 12px 16px; color: var(--muted); font-size: 12px;">Reported by <strong>${reporterDisplay}</strong></td>
        <td style="padding: 12px 16px; text-align: center;" onclick="event.stopPropagation()">${photoBtnHtml}</td>
        <td style="padding: 12px 16px; text-align: right; white-space: nowrap;" onclick="event.stopPropagation()">${actionButtons}</td>
      </tr>
    `;
  }).join("");
  refreshIcons();
}

// -------------------------------------------------------------
// PRIORITY OVERRIDE MODAL (FR-18, FR-19)
// -------------------------------------------------------------
function openPriorityModal(ticketId, currentPrio) {
  activeTicketIdForModal = ticketId;
  document.getElementById("priority-modal-ticket-id").textContent = `#${ticketId}`;
  const select = document.getElementById("priority-override-select");
  if (select) select.value = (currentPrio || "medium").toLowerCase();
  document.getElementById("priority-override-reason").value = "";
  document.getElementById("modal-priority").style.display = "flex";
}

function closePriorityModal() {
  document.getElementById("modal-priority").style.display = "none";
  activeTicketIdForModal = null;
}

async function submitPriorityOverride() {
  if (!activeTicketIdForModal) return;
  const newPrio = document.getElementById("priority-override-select").value;
  const reason = document.getElementById("priority-override-reason").value.trim();

  try {
    const res = await apiStaffFetch(`/api/staff/reports/${activeTicketIdForModal}/priority`, {
      method: "PATCH",
      body: JSON.stringify({ priority: newPrio, reason: reason || undefined })
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.detail || "Failed to override priority.");
      return;
    }

    closePriorityModal();
    fetchStaffReports();
  } catch (err) {
    alert("Network error updating priority.");
  }
}

// -------------------------------------------------------------
// CATEGORY CORRECTIONS CSV EXPORT (FR-17, AC6.6)
// -------------------------------------------------------------
async function exportCategoryCorrectionsCsv() {
  try {
    const res = await apiStaffFetch("/api/staff/corrections/export");
    if (!res.ok) {
      alert("Failed to export category corrections.");
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "category_corrections.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } catch (err) {
    alert("Network error exporting corrections CSV.");
  }
}

// -------------------------------------------------------------
// ASSIGN TECHNICIAN MODAL (AC2.4)
// -------------------------------------------------------------
let activeAssignTicketStatus = "pending";
async function openAssignModal(ticketId, currentAssigneeId = null, currentStatus = "pending") {
  activeTicketIdForModal = ticketId;
  activeAssignTicketStatus = currentStatus || "pending";
  document.getElementById("assign-modal-ticket-id").textContent = `#${ticketId}`;
  const select = document.getElementById("assign-technician-select");
  select.innerHTML = `<option value="">Loading maintenance staff...</option>`;
  document.getElementById("modal-assign").style.display = "flex";

  try {
    const res = await apiStaffFetch("/api/staff/staff");
    if (!res.ok) throw new Error();
    const data = await res.json();
    const sorted = [...(data.staff || [])].sort((a, b) => {
      const aInact = a.availability === "inactive" ? 1 : 0;
      const bInact = b.availability === "inactive" ? 1 : 0;
      if (aInact !== bInact) return aInact - bInact;
      return a.id - b.id;
    });
    select.innerHTML = sorted.map(s => {
      const isInactive = s.availability === "inactive";
      return `<option value="${s.id}" ${isInactive ? 'disabled style="color: #9CA3AF;"' : ""} ${!isInactive && Number(currentAssigneeId) === Number(s.id) ? "selected" : ""}>${escapeHtmlStaff(s.name)} - ${isInactive ? "Not active" : "Active"}</option>`;
    }).join("");
  } catch (err) {
    select.innerHTML = `<option value="">Failed to load staff list</option>`;
  }
}

function closeAssignModal() {
  document.getElementById("modal-assign").style.display = "none";
  activeTicketIdForModal = null;
}

async function submitTechnicianAssignment() {
  const select = document.getElementById("assign-technician-select");
  const techId = Number(select.value);
  if (!techId) {
    alert("Please select a technician to assign.");
    return;
  }

  try {
    const payload = activeAssignTicketStatus === "pending"
      ? { assigned_to: techId, status: "assigned" }
      : { assigned_to: techId };
    const res = await apiStaffFetch(`/api/staff/reports/${activeTicketIdForModal}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.detail || "Failed to assign technician.");
      return;
    }

    closeAssignModal();
    fetchStaffAnalytics();
    fetchStaffReports();
  } catch (err) {
    alert("Network error assigning ticket.");
  }
}

async function startWorkOnTicket(ticketId) {
  try {
    const res = await apiStaffFetch(`/api/staff/reports/${ticketId}`, {
      method: "PUT",
      body: JSON.stringify({ status: "in_progress" })
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.detail || "Failed to start work.");
      return;
    }

    fetchStaffAnalytics();
    fetchStaffReports();
    if (currentTab === "workorders") fetchTechnicianWorkOrders();
  } catch (err) {
    alert("Network error starting work.");
  }
}

// -------------------------------------------------------------
// RESOLVE MODAL
// -------------------------------------------------------------
function openResolveModal(ticketId) {
  activeTicketIdForModal = ticketId;
  document.getElementById("resolve-modal-ticket-id").textContent = `#${ticketId}`;
  document.getElementById("resolve-action-input").value = "";
  document.getElementById("resolve-remarks-input").value = "";
  document.getElementById("resolve-modal-error").style.display = "none";
  document.getElementById("modal-resolve").style.display = "flex";
}

function closeResolveModal() {
  document.getElementById("modal-resolve").style.display = "none";
  activeTicketIdForModal = null;
}

async function submitIncidentResolution() {
  const action = document.getElementById("resolve-action-input").value.trim();
  const remarks = document.getElementById("resolve-remarks-input").value.trim();
  const errDiv = document.getElementById("resolve-modal-error");
  errDiv.style.display = "none";

  if (!action) {
    errDiv.textContent = "Corrective action text is required.";
    errDiv.style.display = "block";
    return;
  }

  try {
    const res = await apiStaffFetch(`/api/staff/reports/${activeTicketIdForModal}/resolve`, {
      method: "POST",
      body: JSON.stringify({ action, remarks })
    });

    const data = await res.json();
    if (!res.ok) {
      errDiv.textContent = data.detail || "Failed to resolve ticket.";
      errDiv.style.display = "block";
      return;
    }

    closeResolveModal();
    fetchStaffAnalytics();
    fetchStaffReports();
    if (currentTab === "workorders") fetchTechnicianWorkOrders();
  } catch (err) {
    errDiv.textContent = "Network error closing ticket.";
    errDiv.style.display = "block";
  }
}

// -------------------------------------------------------------
// CAMPUS HEAT MAP & DRILL-DOWN (FR-15, FR-25)
// -------------------------------------------------------------
async function fetchHeatmapData(windowRange) {
  const grid = document.getElementById("heatmap-grid");
  const selectEl = document.getElementById("heatmap-window-select");
  const win = windowRange || (selectEl ? selectEl.value : "all") || "all";
  grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 24px;">Loading campus heat map...</div>`;

  try {
    const res = await apiStaffFetch(`/api/staff/blocks/summary?window=${encodeURIComponent(win)}`);
    if (!res.ok) return;
    const data = await res.json();
    const blocks = data.blocks || [];
    const maxOpen = (data.totals && data.totals.busiest_open_count) || 0;

    grid.innerHTML = blocks.map(b => {
      const step = getHeatStepForBlock(b.open, maxOpen);
      const topCatHtml = (b.top_categories && b.top_categories.length)
        ? b.top_categories.map(tc => `<span class="chip" style="font-size: 10px; background: var(--bg); color: var(--text); border-color: var(--border);">${tc.category} (${tc.count})</span>`).join(" ")
        : `<span style="font-size: 11px; opacity: 0.85;">No incidents</span>`;

      return `
        <div style="background: var(--heat-${step}-bg); color: var(--heat-${step}-fg); border: 1px solid var(--heat-${step}-border); border-radius: 12px; padding: 18px; cursor: pointer;" onclick="openBlockDrilldownModal('${b.block}', '${win}')" title="Click to view analytics drilldown for ${b.block}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="font-size: 15px; font-weight: 700;">${b.block}</h3>
            <span class="chip" style="font-size: 11px; background: transparent; color: var(--heat-${step}-fg); border-color: var(--heat-${step}-border);">
              ${b.open} open
            </span>
          </div>
          <div style="font-size: 12px; color: var(--heat-${step}-muted); margin-bottom: 10px;">
            Total: <strong>${b.total}</strong> · Pending: ${b.pending} · Assigned: ${b.assigned} · In progress: ${b.in_progress} · Resolved: ${b.resolved}
          </div>
          <div style="font-size: 11px; color: var(--heat-${step}-muted); margin-bottom: 8px;">
            Avg resolution: <strong>${b.has_resolved ? `${b.avg_resolution_hours}h` : "No resolved tickets yet"}</strong>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">${topCatHtml}</div>
        </div>
      `;
    }).join("");

    refreshIcons();
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--prio-critical-text); padding: 24px;">Failed to load heat map.</div>`;
  }
}

// Block Drilldown Modal
async function openBlockDrilldownModal(blockName, windowRange) {
  const selectEl = document.getElementById("heatmap-window-select");
  const win = windowRange || (selectEl ? selectEl.value : "all") || "all";
  document.getElementById("drilldown-block-title").textContent = `${blockName} Analytics Drilldown`;
  document.getElementById("modal-block-drilldown").style.display = "flex";

  try {
    const res = await apiStaffFetch(`/api/staff/blocks/${encodeURIComponent(blockName)}/summary?window=${encodeURIComponent(win)}`);
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById("drilldown-total").textContent = data.total_reports || 0;
    document.getElementById("drilldown-open").textContent = data.open_reports || 0;
    document.getElementById("drilldown-avg-hours").textContent = data.has_resolved
      ? `${Number(data.avg_resolution_hours || 0).toFixed(1)}h`
      : "No resolved tickets yet";

    const catList = document.getElementById("drilldown-categories-list");
    if (data.top_categories && data.top_categories.length) {
      catList.innerHTML = data.top_categories.map(c => `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; padding: 6px 10px; background: var(--surface); border-radius: 6px; border: 1px solid var(--border);">
          <span style="font-weight: 600;">${c.category}</span>
          <span class="chip" style="font-size: 11px;">${c.count} ${c.count === 1 ? 'report' : 'reports'}</span>
        </div>
      `).join("");
    } else {
      catList.innerHTML = `<div style="font-size: 12px; color: var(--muted); font-style: italic;">No incidents categorized in this block.</div>`;
    }

    refreshIcons();
  } catch (err) {
    console.error("Failed to load block drilldown summary:", err);
  }
}

function closeBlockDrilldownModal() {
  document.getElementById("modal-block-drilldown").style.display = "none";
}

let activeStaffLightboxBlobUrl = null;
async function openStaffPhotoLightbox(reportId) {
  const modal = document.getElementById("modal-photo-lightbox");
  const titleEl = document.getElementById("lightbox-photo-title");
  const bodyEl = document.getElementById("lightbox-photo-body");
  if (!modal || !bodyEl) return;

  if (activeStaffLightboxBlobUrl) {
    URL.revokeObjectURL(activeStaffLightboxBlobUrl);
    activeStaffLightboxBlobUrl = null;
  }

  titleEl.textContent = `Photo Proof — Incident #${reportId}`;
  bodyEl.innerHTML = `<span style="font-size: 12px; color: var(--muted);">Loading photo proof...</span>`;
  modal.style.display = "flex";
  const closeBtn = document.getElementById("lightbox-close-btn");
  if (closeBtn) closeBtn.focus();

  try {
    const res = await apiStaffFetch(`/api/staff/reports/${reportId}/photo`);
    if (!res.ok) {
      bodyEl.innerHTML = `<span style="font-size: 12px; color: var(--muted);">Photo unavailable</span>`;
      return;
    }
    const blob = await res.blob();
    if (!blob || blob.size === 0) {
      bodyEl.innerHTML = `<span style="font-size: 12px; color: var(--muted);">Photo unavailable</span>`;
      return;
    }
    activeStaffLightboxBlobUrl = URL.createObjectURL(blob);
    bodyEl.innerHTML = `<img src="${activeStaffLightboxBlobUrl}" alt="Photo proof for incident #${reportId}" style="max-height: 64vh; max-width: 100%; object-fit: contain; border-radius: 6px;" onerror="this.parentElement.innerHTML='<span style=&quot;font-size:12px;color:var(--muted);&quot;>Photo unavailable</span>'" />`;
  } catch {
    bodyEl.innerHTML = `<span style="font-size: 12px; color: var(--muted);">Photo unavailable</span>`;
  }
}

function closeStaffPhotoLightbox() {
  const modal = document.getElementById("modal-photo-lightbox");
  if (modal) modal.style.display = "none";
  if (activeStaffLightboxBlobUrl) {
    URL.revokeObjectURL(activeStaffLightboxBlobUrl);
    activeStaffLightboxBlobUrl = null;
  }
}

function escapeHtmlStaff(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function closeStaffDetailModal() {
  const modal = document.getElementById("modal-staff-detail");
  if (modal) modal.style.display = "none";
}

async function openStaffDetailModal(reportId, focusResolution = false) {
  const modal = document.getElementById("modal-staff-detail");
  const badgesEl = document.getElementById("detail-modal-badges");
  const titleEl = document.getElementById("detail-modal-title");
  const bodyEl = document.getElementById("detail-modal-body");
  if (!modal || !bodyEl) return;

  titleEl.textContent = `Incident #${reportId}`;
  badgesEl.innerHTML = "";
  bodyEl.innerHTML = `<span style="font-size: 12px; color: var(--muted);">Loading ticket details...</span>`;
  modal.style.display = "flex";

  try {
    const res = await apiStaffFetch(`/api/staff/reports/${reportId}`);
    if (!res.ok) {
      bodyEl.innerHTML = `<span style="font-size: 12px; color: var(--prio-critical-text);">Failed to load ticket details.</span>`;
      return;
    }
    const data = await res.json();
    const r = data.report;
    const resolution = data.resolution || r.resolution || null;
    const steps = ["pending", "assigned", "in_progress", "resolved"];
    const stepLabels = { pending: "Pending", assigned: "Assigned", in_progress: "In progress", resolved: "Resolved" };
    const currentIdx = steps.indexOf(r.status);

    badgesEl.innerHTML = `
      <span class="chip" style="font-size: 11px;">#${r.id}</span>
      <span class="chip status-${r.status}" style="font-size: 11px; text-transform: capitalize;">${r.status.replace("_", " ")}</span>
      <span class="chip prio-${(r.priority || "medium").toLowerCase()}" style="font-size: 11px;">${r.priority}</span>
      <span class="chip" style="font-size: 11px;">${escapeHtmlStaff(r.category)}</span>
    `;
    titleEl.textContent = escapeHtmlStaff(r.description);

    const roleLabel = formatStaffRoleLabel(r.reporter_role);
    const reporterText = r.reporter_name ? `${escapeHtmlStaff(r.reporter_name)} (${roleLabel})` : roleLabel;
    const reportedFull = window.CBBTime ? window.CBBTime.formatFullTimestamp(r.created_at) : r.created_at;
    const assignedAtFull = r.assigned_at && window.CBBTime ? window.CBBTime.formatFullTimestamp(r.assigned_at) : (r.assigned_at || "—");

    const stepperHtml = steps.map((s, idx) => {
      const done = idx <= currentIdx;
      const isChecked = idx < currentIdx || r.status === "resolved";
      return `
        <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 90px;">
          <div style="width: 22px; height: 22px; border-radius: 9999px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; ${done ? "background: var(--accent); color: #fff;" : "background: var(--surface); border: 1px solid var(--border); color: var(--muted);"}">
            ${isChecked ? "✓" : idx + 1}
          </div>
          <span style="font-size: 12px; font-weight: 500; color: ${done ? "var(--text)" : "var(--muted)"};">${stepLabels[s]}</span>
        </div>
      `;
    }).join("");

    let resolutionSectionHtml = "";
    if (r.status === "resolved" || resolution) {
      const resolvedAtFull = (resolution && resolution.resolved_at) || r.resolved_at
        ? (window.CBBTime ? window.CBBTime.formatFullTimestamp((resolution && resolution.resolved_at) || r.resolved_at) : ((resolution && resolution.resolved_at) || r.resolved_at))
        : "—";
      const remarksVal = resolution && resolution.remarks && String(resolution.remarks).trim()
        ? escapeHtmlStaff(resolution.remarks)
        : "No remarks added";
      resolutionSectionHtml = `
        <div id="staff-detail-resolution-section" style="background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 14px;">
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 10px;">Resolution</div>
          <div style="display: grid; gap: 10px; font-size: 12px;">
            <div>
              <div style="font-size: 11px; color: var(--muted); margin-bottom: 2px;">Action taken</div>
              <div style="font-weight: 600;">${escapeHtmlStaff((resolution && resolution.action) || r.resolution_action || "Completed")}</div>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
                <span style="font-size: 11px; color: var(--muted);">Internal remarks</span>
                <span class="chip" style="font-size: 10px; background: #FEF3C7; color: #92400E; border-color: #FCD34D;">Internal - staff only</span>
              </div>
              <div style="padding: 8px 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; ${resolution && resolution.remarks ? "" : "color: var(--muted); font-style: italic;"}">${remarksVal}</div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px;">
              <div>
                <div style="font-size: 11px; color: var(--muted);">Resolved by</div>
                <div style="font-weight: 600;">${escapeHtmlStaff((resolution && resolution.resolved_by) || r.resolved_by || r.assignee_name || "Staff")}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--muted);">Resolved at</div>
                <div style="font-weight: 600;" title="${resolvedAtFull}">${resolvedAtFull}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--muted);">Assigned to</div>
                <div style="font-weight: 600;">${escapeHtmlStaff(r.assignee_name || "Unassigned")}</div>
              </div>
              <div>
                <div style="font-size: 11px; color: var(--muted);">Assigned at</div>
                <div style="font-weight: 600;" title="${assignedAtFull}">${assignedAtFull}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 10px; padding: 12px;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 8px;">Lifecycle Progress</div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">${stepperHtml}</div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; font-size: 12px;">
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
          <div style="font-size: 11px; color: var(--muted);">Location</div>
          <div style="font-weight: 600;">${formatStaffLocation(r)}</div>
        </div>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
          <div style="font-size: 11px; color: var(--muted);">Reported By</div>
          <div style="font-weight: 600;">${reporterText}</div>
        </div>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
          <div style="font-size: 11px; color: var(--muted);">Reported Time</div>
          <div style="font-weight: 600;">${reportedFull}</div>
        </div>
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
          <div style="font-size: 11px; color: var(--muted);">Assigned To</div>
          <div style="font-weight: 600;">${escapeHtmlStaff(r.assignee_name || "Unassigned")}</div>
          <div style="font-size: 11px; color: var(--muted);">Assigned: ${assignedAtFull}</div>
        </div>
      </div>
      ${r.has_photo ? `<div><button type="button" class="btn btn-secondary btn-sm" aria-label="View photo proof" onclick="openStaffPhotoLightbox(${r.id})"><i data-lucide="camera" style="width: 14px; height: 14px;"></i> View photo proof</button></div>` : ""}
      ${resolutionSectionHtml}
    `;
    refreshIcons();
    if (focusResolution) {
      const sec = document.getElementById("staff-detail-resolution-section");
      if (sec) sec.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } catch {
    bodyEl.innerHTML = `<span style="font-size: 12px; color: var(--prio-critical-text);">Failed to load ticket details.</span>`;
  }
}

function handleStaffModalBackdropClick(event, modalId) {
  if (event.target && event.target.id === modalId) {
    if (modalId === "modal-assign") closeAssignModal();
    if (modalId === "modal-resolve") closeResolveModal();
    if (modalId === "modal-priority") closePriorityModal();
    if (modalId === "modal-block-drilldown") closeBlockDrilldownModal();
    if (modalId === "modal-photo-lightbox") closeStaffPhotoLightbox();
    if (modalId === "modal-staff-detail") closeStaffDetailModal();
  }
}

// -------------------------------------------------------------
// TECHNICIAN WORK ORDERS & AVAILABILITY
// -------------------------------------------------------------
let techAvailabilityValue = "active";
let techAvailabilityUpdating = false;
let techOpenTicketsCount = 0;

function renderTechAvailabilityUI() {
  const wrap = document.getElementById("tech-availability-control");
  const statusEl = document.getElementById("tech-availability-status-text");
  const switchBtn = document.getElementById("tech-availability-switch");
  const knob = document.getElementById("tech-availability-knob");
  const noticeEl = document.getElementById("tech-availability-open-notice");

  if (!wrap) return;
  const isMaint = currentStaffUser && currentStaffUser.role === "maintenance";
  wrap.style.display = isMaint ? "inline-flex" : "none";
  if (!isMaint) {
    if (noticeEl) noticeEl.style.display = "none";
    return;
  }

  const isActive = techAvailabilityValue !== "inactive";
  if (statusEl) {
    statusEl.textContent = isActive ? "Active" : "Not active";
    statusEl.style.color = isActive ? "#059669" : "#D97706";
  }
  if (switchBtn) {
    switchBtn.setAttribute("aria-checked", isActive ? "true" : "false");
    switchBtn.setAttribute("aria-label", `My availability: ${isActive ? "Active" : "Not active"}`);
    switchBtn.style.background = isActive ? "#059669" : "#9CA3AF";
    switchBtn.style.borderColor = isActive ? "#059669" : "#9CA3AF";
  }
  if (knob) {
    knob.style.left = isActive ? "18px" : "2px";
  }
  if (noticeEl) {
    if (!isActive && techOpenTicketsCount > 0) {
      noticeEl.textContent = `You still have ${techOpenTicketsCount} open tickets. Admins will not assign you new ones while you are Not active.`;
      noticeEl.style.display = "block";
    } else {
      noticeEl.style.display = "none";
    }
  }
}

async function toggleTechnicianAvailability() {
  if (techAvailabilityUpdating || !currentStaffUser || currentStaffUser.role !== "maintenance") return;
  const prev = techAvailabilityValue;
  const next = prev === "active" ? "inactive" : "active";
  techAvailabilityValue = next;
  techAvailabilityUpdating = true;
  renderTechAvailabilityUI();
  try {
    const res = await apiStaffFetch("/api/staff/me/availability", {
      method: "PATCH",
      body: JSON.stringify({ availability: next })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Failed to update availability");
    }
    const data = await res.json();
    techAvailabilityValue = (data.user && data.user.availability) || next;
    renderTechAvailabilityUI();
  } catch (err) {
    techAvailabilityValue = prev;
    renderTechAvailabilityUI();
    alert((err && err.message) || "Failed to update availability");
  } finally {
    techAvailabilityUpdating = false;
  }
}

async function fetchTechnicianWorkOrders() {
  const titleEl = document.getElementById("workorders-header-title");
  const subEl = document.getElementById("workorders-header-subtitle");
  if (titleEl && currentStaffUser && currentStaffUser.name) {
    titleEl.textContent = `${currentStaffUser.name} — Work Orders`;
  }
  if (subEl && currentStaffUser && currentStaffUser.name) {
    subEl.textContent = `Work orders assigned to ${currentStaffUser.name}`;
  }
  if (currentStaffUser && currentStaffUser.role === "maintenance") {
    apiStaffFetch("/api/staff/me")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && d.user && d.user.availability) {
          techAvailabilityValue = d.user.availability;
          renderTechAvailabilityUI();
        }
      })
      .catch(() => {});
  } else {
    renderTechAvailabilityUI();
  }
  const container = document.getElementById("technician-workorders-list");
  container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">Loading your work orders...</div>`;

  try {
    const res = await apiStaffFetch("/api/staff/reports");
    if (!res.ok) return;
    const data = await res.json();
    const reports = data.reports || [];
    techOpenTicketsCount = reports.filter(r => r.status !== "resolved").length;
    renderTechAvailabilityUI();

    if (!reports.length) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; background: var(--bg); border: 1px solid var(--border); border-radius: 12px;">
          <i data-lucide="check-circle" style="width: 32px; height: 32px; color: #10B981; margin-bottom: 8px;"></i>
          <h3 style="font-size: 15px; font-weight: 600;">All Clear!</h3>
          <p style="font-size: 13px; color: var(--muted); margin-top: 4px;">You currently have no open work orders assigned to you.</p>
        </div>
      `;
      refreshIcons();
      return;
    }

    container.innerHTML = reports.map(r => {
      const statusClass = `status-${r.status}`;
      const prioClass = `prio-${(r.priority || "medium").toLowerCase()}`;
      const fullTs = window.CBBTime ? window.CBBTime.formatFullTimestamp(r.created_at) : r.created_at;
      const relTs = window.CBBTime ? window.CBBTime.formatRelativeTime(r.created_at) : "";
      const roleLabel = formatStaffRoleLabel(r.reporter_role);
      const reporterDisplay = r.reporter_name ? `${r.reporter_name} (${roleLabel})` : roleLabel;

      let actionHtml = "";
      if (r.status === "assigned") {
        actionHtml = `<button class="btn btn-primary btn-sm" onclick="startWorkOnTicket(${r.id})">Start Work</button>`;
      } else if (r.status === "in_progress") {
        actionHtml = `<button class="btn btn-primary btn-sm" style="background: #10B981; border-color: #10B981;" onclick="openResolveModal(${r.id})">Complete &amp; Resolve</button>`;
      } else if (r.status === "resolved") {
        actionHtml = `<button type="button" class="btn btn-secondary btn-sm" aria-label="View resolution notes" onclick="openStaffDetailModal(${r.id}, true)">View Resolution</button> <span class="chip status-resolved" style="font-size: 11px;">Completed</span>`;
      }

      return `
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                <span style="font-weight: 700; font-size: 15px;">#${r.id}</span>
                <span class="chip" style="font-size: 11px; font-weight: 600;">${formatStaffLocation(r)}</span>
                <span class="chip ${prioClass}" style="font-size: 11px;">${r.priority}</span>
                <span class="chip ${statusClass}" style="font-size: 11px; text-transform: capitalize;">${r.status.replace("_", " ")}</span>
              </div>
              <div style="font-size: 12px; color: var(--muted);" title="${fullTs}">Reported ${relTs ? `${relTs} · ` : ""}${fullTs}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${r.has_photo ? `<button type="button" class="btn btn-secondary btn-sm" aria-label="View photo proof" onclick="openStaffPhotoLightbox(${r.id})"><i data-lucide="camera" style="width: 14px; height: 14px;"></i> View photo proof</button>` : ""}
              ${actionHtml}
            </div>
          </div>

          <p style="font-size: 13px; line-height: 1.5; margin-bottom: 12px;">${r.description}</p>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px; font-size: 12px; color: var(--muted);">
            <span>Category: <strong>${r.category}</strong></span>
            <span>Reported by <strong>${reporterDisplay}</strong></span>
          </div>
        </div>
      `;
    }).join("");

    refreshIcons();
  } catch (err) {
    container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--prio-critical-text);">Failed to load work orders.</div>`;
  }
}

// -------------------------------------------------------------
// BOOTSTRAP
// -------------------------------------------------------------
async function checkStaffDemoMode() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    isDemoMode = data.demo_mode;
    const qf = document.getElementById("staff-demo-quickfill");
    if (qf) qf.style.display = isDemoMode ? "block" : "none";
    const banner = document.getElementById("demo-mode-banner");
    if (banner) banner.style.display = isDemoMode ? "flex" : "none";
    const footerBadge = document.getElementById("staff-footer-demo-badge");
    if (footerBadge) footerBadge.style.display = isDemoMode ? "block" : "none";
  } catch {}
}

async function initStaffApp() {
  initTheme();
  await checkStaffDemoMode();
  const authenticated = await checkStaffAuth();

  if (authenticated) {
    const path = window.location.pathname;
    if (path.includes("heatmap")) switchStaffTab("heatmap");
    else if (path.includes("work-orders")) switchStaffTab("workorders");
    else switchStaffTab("admin");
  } else {
    showStaffLoginView();
  }

  // Esc key closes modals
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAssignModal();
      closeResolveModal();
      closePriorityModal();
      closeBlockDrilldownModal();
      closeStaffPhotoLightbox();
      closeStaffDetailModal();
    }
  });

  // URL Param Helpers for Visual Verification
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("auth") === "admin") {
    try {
      const res = await fetch("/api/staff/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@campus.edu", password: "DemoPass123!" })
      });
      const data = await res.json();
      if (data.token) {
        setStaffToken(data.token);
        currentStaffUser = data.user;
        updateStaffHeaderUI();
        const path = window.location.pathname;
        if (path.includes("heatmap")) switchStaffTab("heatmap");
        else switchStaffTab("admin");
      }
    } catch {}
  }

  if (urlParams.get("drilldown")) {
    const block = urlParams.get("drilldown");
    setTimeout(() => openBlockDrilldownModal(block), 300);
  }
}

document.addEventListener("DOMContentLoaded", initStaffApp);
