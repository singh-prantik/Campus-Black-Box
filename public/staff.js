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
  return localStorage.getItem(TOKEN_KEY);
}

function setStaffToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearStaffToken() {
  localStorage.removeItem(TOKEN_KEY);
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
    throw new Error("Session expired. Please sign in again.");
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
      showStaffLoginView();
      return false;
    }
    const data = await res.json();
    currentStaffUser = data.user;
    updateStaffHeaderUI();
    return true;
  } catch (err) {
    showStaffLoginView();
    return false;
  }
}

function updateStaffHeaderUI() {
  const navTabs = document.getElementById("staff-nav-tabs");
  const userBadge = document.getElementById("staff-user-badge");
  const signinBtn = document.getElementById("staff-signin-btn");
  const rolePill = document.getElementById("staff-role-pill");

  if (currentStaffUser) {
    if (navTabs) navTabs.style.display = "flex";
    if (userBadge) userBadge.style.display = "inline-flex";
    if (signinBtn) signinBtn.style.display = "none";
    if (rolePill) {
      rolePill.textContent = `${currentStaffUser.role}: ${currentStaffUser.name || currentStaffUser.email}`;
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

function renderStaffTable(reports) {
  const tbody = document.getElementById("staff-admin-table-body");
  if (!reports.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 36px; color: var(--muted);">No matching incidents found.</td></tr>`;
    return;
  }

  const isAdmin = currentStaffUser && (currentStaffUser.role === "admin" || currentStaffUser.role === "super_admin");

  tbody.innerHTML = reports.map(r => {
    const statusClass = `status-${r.status}`;
    const prioClass = `prio-${(r.priority || "medium").toLowerCase()}`;
    const dateFormatted = new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

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

    // Action button logic per PRD State Machine
    let actionButtons = "";
    if (r.status === "pending") {
      actionButtons = `
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="openPriorityModal(${r.id}, '${r.priority}')" title="Override priority">Prio</button>` : ""}
        <button class="btn btn-primary btn-sm" onclick="openAssignModal(${r.id})">Assign</button>
      `;
    } else if (r.status === "assigned") {
      actionButtons = `
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="openPriorityModal(${r.id}, '${r.priority}')" title="Override priority">Prio</button>` : ""}
        <button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="startWorkOnTicket(${r.id})">Start Work</button>
        <button class="btn btn-secondary btn-sm" onclick="openAssignModal(${r.id})">Reassign</button>
      `;
    } else if (r.status === "in_progress") {
      actionButtons = `
        ${isAdmin ? `<button class="btn btn-secondary btn-sm" style="margin-right: 4px;" onclick="openPriorityModal(${r.id}, '${r.priority}')" title="Override priority">Prio</button>` : ""}
        <button class="btn btn-primary btn-sm" style="background: #10B981; border-color: #10B981;" onclick="openResolveModal(${r.id})">Resolve</button>
      `;
    } else if (r.status === "resolved") {
      actionButtons = `<span style="font-size: 11px; color: var(--muted); font-weight: 500;">Closed</span>`;
    }

    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 12px 16px; font-weight: 600;">#${r.id}</td>
        <td style="padding: 12px 16px;"><strong>${r.block}</strong> · ${r.room}</td>
        <td style="padding: 12px 16px; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.description}">
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
        <td style="padding: 12px 16px; color: var(--muted);">${r.assignee_name || "—"}</td>
        <td style="padding: 12px 16px; color: var(--muted); font-size: 11px;">${dateFormatted}</td>
        <td style="padding: 12px 16px; text-align: right;">${actionButtons}</td>
      </tr>
    `;
  }).join("");
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
async function openAssignModal(ticketId) {
  activeTicketIdForModal = ticketId;
  document.getElementById("assign-modal-ticket-id").textContent = `#${ticketId}`;
  const select = document.getElementById("assign-technician-select");
  select.innerHTML = `<option value="">Loading maintenance staff...</option>`;
  document.getElementById("modal-assign").style.display = "flex";

  try {
    const res = await apiStaffFetch("/api/staff/staff");
    if (!res.ok) throw new Error();
    const data = await res.json();
    select.innerHTML = (data.staff || []).map(s => `
      <option value="${s.id}">${s.name} (${s.email})</option>
    `).join("");
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
    const res = await apiStaffFetch(`/api/staff/reports/${activeTicketIdForModal}`, {
      method: "PUT",
      body: JSON.stringify({
        assigned_to: techId,
        status: "assigned"
      })
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
async function fetchHeatmapData() {
  const grid = document.getElementById("heatmap-grid");
  grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--muted); padding: 24px;">Loading campus heat map...</div>`;

  try {
    const res = await apiStaffFetch("/api/staff/analytics/heatmap");
    if (!res.ok) return;
    const data = await res.json();
    const locations = data.locations || [];

    const blocks = ["Block 1", "Block 2", "Block 3", "Block 4"];

    grid.innerHTML = blocks.map(b => {
      const locsInBlock = locations.filter(l => l.block === b);
      const totalIncidents = locsInBlock.reduce((acc, l) => acc + (l.total || 0), 0);
      const openIncidents = locsInBlock.reduce((acc, l) => acc + (l.open || 0), 0);
      const resolvedIncidents = locsInBlock.reduce((acc, l) => acc + (l.resolved || 0), 0);

      // Hotspot rooms
      const activeRooms = locsInBlock
        .filter(l => (l.total || 0) > 0)
        .sort((a, b) => (b.open || 0) - (a.open || 0))
        .slice(0, 3);

      return `
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 18px; cursor: pointer; transition: all 150ms ease;" onclick="openBlockDrilldownModal('${b}')" title="Click to view analytics drilldown for ${b}">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <h3 style="font-size: 15px; font-weight: 700;">${b}</h3>
              <i data-lucide="chevron-right" style="width: 14px; height: 14px; color: var(--muted);"></i>
            </div>
            <span class="chip" style="font-size: 11px; background: ${openIncidents > 0 ? '#FEF3C7' : '#ECFDF5'}; color: ${openIncidents > 0 ? '#92400E' : '#065F46'}; border-color: ${openIncidents > 0 ? '#FCD34D' : '#A7F3D0'};">
              ${openIncidents} Active
            </span>
          </div>
          <div style="display: flex; gap: 8px; font-size: 12px; color: var(--muted); margin-bottom: 14px;">
            <span>Total: <strong>${totalIncidents}</strong></span>
            <span>·</span>
            <span>Resolved: <strong>${resolvedIncidents}</strong></span>
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 6px;">Hotspot Rooms</div>
            ${activeRooms.length ? `
              <div style="display: flex; flex-direction: column; gap: 4px;">
                ${activeRooms.map(r => `
                  <div style="display: flex; justify-content: space-between; font-size: 12px; padding: 4px 6px; background: var(--surface); border-radius: 6px;">
                    <span>${r.room}</span>
                    <strong style="color: var(--accent);">${r.total} ${r.total === 1 ? 'incident' : 'incidents'}</strong>
                  </div>
                `).join("")}
              </div>
            ` : `<div style="font-size: 12px; color: var(--muted); font-style: italic;">No incidents reported</div>`}
          </div>
        </div>
      `;
    }).join("");

    refreshIcons();
  } catch (err) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--prio-critical-text); padding: 24px;">Failed to load heat map.</div>`;
  }
}

// Block Drilldown Modal
async function openBlockDrilldownModal(blockName) {
  document.getElementById("drilldown-block-title").textContent = `${blockName} Analytics Drilldown`;
  document.getElementById("modal-block-drilldown").style.display = "flex";

  try {
    const res = await apiStaffFetch(`/api/staff/blocks/${encodeURIComponent(blockName)}/summary`);
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById("drilldown-total").textContent = data.total_reports || 0;
    document.getElementById("drilldown-open").textContent = data.open_reports || 0;
    document.getElementById("drilldown-avg-hours").textContent = `${Number(data.avg_resolution_hours || 0).toFixed(1)}h`;

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

function handleStaffModalBackdropClick(event, modalId) {
  if (event.target && event.target.id === modalId) {
    if (modalId === "modal-assign") closeAssignModal();
    if (modalId === "modal-resolve") closeResolveModal();
    if (modalId === "modal-priority") closePriorityModal();
    if (modalId === "modal-block-drilldown") closeBlockDrilldownModal();
  }
}

// -------------------------------------------------------------
// TECHNICIAN WORK ORDERS
// -------------------------------------------------------------
async function fetchTechnicianWorkOrders() {
  const container = document.getElementById("technician-workorders-list");
  container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">Loading your work orders...</div>`;

  try {
    const res = await apiStaffFetch("/api/staff/reports");
    if (!res.ok) return;
    const data = await res.json();
    const reports = data.reports || [];

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
      const dateFormatted = new Date(r.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

      let actionHtml = "";
      if (r.status === "assigned") {
        actionHtml = `<button class="btn btn-primary btn-sm" onclick="startWorkOnTicket(${r.id})">Start Work</button>`;
      } else if (r.status === "in_progress") {
        actionHtml = `<button class="btn btn-primary btn-sm" style="background: #10B981; border-color: #10B981;" onclick="openResolveModal(${r.id})">Complete &amp; Resolve</button>`;
      } else if (r.status === "resolved") {
        actionHtml = `<span class="chip status-resolved" style="font-size: 11px;">Completed</span>`;
      }

      return `
        <div style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                <span style="font-weight: 700; font-size: 15px;">#${r.id}</span>
                <span class="chip" style="font-size: 11px; font-weight: 600;">${r.block} · ${r.room}</span>
                <span class="chip ${prioClass}" style="font-size: 11px;">${r.priority}</span>
                <span class="chip ${statusClass}" style="font-size: 11px; text-transform: capitalize;">${r.status.replace("_", " ")}</span>
              </div>
              <div style="font-size: 12px; color: var(--muted);">Reported on ${dateFormatted}</div>
            </div>
            <div>${actionHtml}</div>
          </div>

          <p style="font-size: 13px; line-height: 1.5; margin-bottom: 12px;">${r.description}</p>

          ${r.photo_path || r.photo_url ? `
            <div style="margin-top: 12px; margin-bottom: 12px;">
              <a href="${r.photo_path || r.photo_url}" target="_blank" style="font-size: 12px; color: var(--accent); display: inline-flex; align-items: center; gap: 4px; text-decoration: none;">
                <i data-lucide="image" style="width: 14px; height: 14px;"></i> View Attached Incident Photo
              </a>
            </div>
          ` : ""}

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border); padding-top: 12px; margin-top: 12px; font-size: 12px; color: var(--muted);">
            <span>Category: <strong>${r.category}</strong></span>
            <span>Reporter: <strong>${r.reporter_role || 'Reporter'}</strong></span>
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
