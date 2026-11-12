"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import StaffNavbar from "@/components/StaffNavbar";
import StaffReportModal from "@/components/StaffReportModal";
import PhotoLightboxModal from "@/components/PhotoLightboxModal";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import {
  apiGetReports,
  apiGetAnalyticsSummary,
  apiUpdateReport,
  apiResolveReport,
  apiGetStaff,
  useStaffSession,
} from "@/lib/staffApi";
import { formatFullTimestamp, formatRelativeTime } from "@/lib/time";
import { Report, AnalyticsSummary, StaffMember } from "@/types";
import { Camera, FileText, Search, X } from "lucide-react";

function formatRoleLabel(role: string | null | undefined): string {
  const lower = String(role || "student").toLowerCase();
  if (lower === "faculty") return "Faculty";
  if (lower === "maintenance" || lower === "technician") return "Technician";
  return "Student";
}

function formatReportLocation(r: Report): string {
  const block = r.location?.block || r.block;
  const room = r.location?.room || r.room;
  if (block && room) return `${block} · ${room}`;
  return block || room || "Location unavailable";
}

export default function StaffAdminPage() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useStaffSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBlock, setFilterBlock] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignModalReport, setAssignModalReport] = useState<Report | null>(null);
  const [resolveModalReport, setResolveModalReport] = useState<Report | null>(null);
  const [detailModalReport, setDetailModalReport] = useState<Report | null>(null);
  const [detailFocusResolution, setDetailFocusResolution] = useState(false);
  const [photoLightboxReport, setPhotoLightboxReport] = useState<Report | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | "">("");
  const [assignLoadingStaff, setAssignLoadingStaff] = useState(false);
  const [actionText, setActionText] = useState("");
  const [remarksText, setRemarksText] = useState("");

  useEffect(() => {
    if (authLoading || !isAdmin) return;
    loadData();
  }, [authLoading, isAdmin, filterStatus, filterCategory, filterBlock, filterPriority]);

  async function loadData() {
    try {
      const [repData, sumData, staffData] = await Promise.all([
        apiGetReports({
          status: filterStatus !== "all" ? filterStatus : undefined,
          category: filterCategory || undefined,
          block: filterBlock || undefined,
          priority: filterPriority || undefined,
        }),
        apiGetAnalyticsSummary(),
        apiGetStaff(),
      ]);
      setReports(repData.reports || []);
      setSummary(sumData);
      setStaff(staffData.staff || []);
    } catch (err) {
      console.error(err);
    }
  }

  const visibleReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((r) => {
      const loc = formatReportLocation(r).toLowerCase();
      return (
        r.description?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        loc.includes(q) ||
        (r.reporter_name || "").toLowerCase().includes(q) ||
        `#${r.id}`.includes(q)
      );
    });
  }, [reports, searchQuery]);

  const hasActiveFilters =
    filterStatus !== "all" ||
    Boolean(filterCategory) ||
    Boolean(filterBlock) ||
    Boolean(filterPriority) ||
    Boolean(searchQuery.trim());

  function sortStaffActiveFirst(list: StaffMember[]): StaffMember[] {
    return [...list].sort((a, b) => {
      const aInact = a.availability === "inactive" ? 1 : 0;
      const bInact = b.availability === "inactive" ? 1 : 0;
      if (aInact !== bInact) return aInact - bInact;
      return a.id - b.id;
    });
  }

  async function openAssignDialog(report: Report) {
    setAssignModalReport(report);
    const cachedActive = sortStaffActiveFirst(staff).filter((s) => s.availability !== "inactive");
    const currentIsActive = cachedActive.some((s) => s.id === report.assigned_to);
    setSelectedStaffId(currentIsActive && report.assigned_to ? report.assigned_to : cachedActive[0]?.id || "");
    setAssignLoadingStaff(true);
    try {
      const fresh = await apiGetStaff();
      const sorted = sortStaffActiveFirst(fresh.staff || []);
      setStaff(sorted);
      const activeOnly = sorted.filter((s) => s.availability !== "inactive");
      const freshCurrentIsActive = activeOnly.some((s) => s.id === report.assigned_to);
      setSelectedStaffId(
        freshCurrentIsActive && report.assigned_to ? report.assigned_to : activeOnly[0]?.id || ""
      );
    } catch {
      // Keep cached list if refetch fails
    } finally {
      setAssignLoadingStaff(false);
    }
  }

  async function handleAssign() {
    if (!assignModalReport || !selectedStaffId) return;
    try {
      const payload =
        assignModalReport.status === "pending"
          ? { assigned_to: Number(selectedStaffId), status: "assigned" }
          : { assigned_to: Number(selectedStaffId) };
      await apiUpdateReport(assignModalReport.id, payload);
      setAssignModalReport(null);
      setSelectedStaffId("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to assign technician");
    }
  }

  async function handleResolve() {
    if (!resolveModalReport || !actionText.trim()) return;
    try {
      await apiResolveReport(resolveModalReport.id, actionText, remarksText);
      setResolveModalReport(null);
      setActionText("");
      setRemarksText("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to resolve report");
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <StaffNavbar />
        <div className="p-12 text-center text-xs text-muted">Validating staff session...</div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <StaffNavbar />
        <div className="max-w-md mx-auto my-16 p-8 bg-surface border border-border rounded-card text-center space-y-3">
          <h1 className="text-lg font-bold">Admin Session Required</h1>
          <p className="text-muted text-xs">
            Sign in on the tab-scoped Staff Portal to manage campus incidents.
          </p>
          <Link
            href="/staff/login"
            className="inline-block px-4 py-2 bg-accent text-white rounded-input text-xs font-semibold hover:bg-accent-hover"
          >
            Staff Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <StaffNavbar />
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-text">Incident Triage &amp; Dispatch Console</h1>
            <p className="text-muted text-xs mt-0.5">
              Review campus infrastructure tickets and allocate qualified technicians.
            </p>
          </div>
          <Link
            href="/heatmap"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input border border-border bg-surface text-xs font-medium text-text hover:border-accent"
          >
            View Campus Heat Map
          </Link>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-surface border border-border rounded-card p-3.5">
              <div className="text-xs text-muted">Pending Triage</div>
              <div className="text-2xl font-bold mt-1">{summary.pending_reports}</div>
            </div>
            <div className="bg-surface border border-border rounded-card p-3.5">
              <div className="text-xs text-muted">Assigned</div>
              <div className="text-2xl font-bold mt-1">{summary.assigned_reports}</div>
            </div>
            <div className="bg-surface border border-border rounded-card p-3.5">
              <div className="text-xs text-muted">In Progress</div>
              <div className="text-2xl font-bold mt-1">{summary.in_progress_reports}</div>
            </div>
            <div className="bg-surface border border-border rounded-card p-3.5">
              <div className="text-xs text-muted">Resolved</div>
              <div className="text-2xl font-bold mt-1">{summary.resolved_reports}</div>
            </div>
            <div className="bg-surface border border-border rounded-card p-3.5">
              <div className="text-xs text-muted">Avg Resolution</div>
              <div className="text-xl font-bold mt-1.5 text-accent">
                {summary.has_resolved_tickets
                  ? `${Number(summary.avg_resolution_hours || 0).toFixed(1)}h`
                  : "No resolved tickets yet"}
              </div>
            </div>
          </div>
        )}

        {/* Combinable Filter Toolbar */}
        <div className="bg-surface border border-border rounded-card p-3 flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search #id, description, room, reporter..."
              aria-label="Search tickets"
              className="w-full h-9 pl-8 pr-3 rounded-input border border-border bg-bg text-xs text-text placeholder:text-muted focus:border-accent"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
            className="h-9 px-2.5 rounded-input border border-border bg-bg text-xs text-text"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label="Filter by category"
            className="h-9 px-2.5 rounded-input border border-border bg-bg text-xs text-text"
          >
            <option value="">All Categories</option>
            <option value="Electrical">Electrical</option>
            <option value="IT/Wi-Fi">IT/Wi-Fi</option>
            <option value="Equipment">Equipment</option>
            <option value="Water">Water</option>
            <option value="Cleanliness">Cleanliness</option>
            <option value="Furniture">Furniture</option>
            <option value="Safety">Safety</option>
            <option value="Accessibility">Accessibility</option>
          </select>

          <select
            value={filterBlock}
            onChange={(e) => setFilterBlock(e.target.value)}
            aria-label="Filter by block"
            className="h-9 px-2.5 rounded-input border border-border bg-bg text-xs text-text"
          >
            <option value="">All Blocks</option>
            <option value="Block 1">Block 1</option>
            <option value="Block 2">Block 2</option>
            <option value="Block 3">Block 3</option>
            <option value="Block 4">Block 4</option>
            <option value="Library">Library</option>
          </select>

          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter by priority"
            className="h-9 px-2.5 rounded-input border border-border bg-bg text-xs text-text"
          >
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setFilterStatus("all");
                setFilterCategory("");
                setFilterBlock("");
                setFilterPriority("");
                setSearchQuery("");
              }}
              className="h-9 px-2.5 rounded-input border border-border text-xs text-accent hover:bg-bg inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>

        {/* Triage Table */}
        <div className="bg-surface border border-border rounded-card overflow-x-auto">
          <table className="w-full border-collapse text-xs text-left">
            <thead>
              <tr className="border-b border-border bg-bg/50 text-muted text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3.5">ID</th>
                <th className="py-3 px-3.5">Reported</th>
                <th className="py-3 px-3.5">Location</th>
                <th className="py-3 px-3.5">Description</th>
                <th className="py-3 px-3.5">Category</th>
                <th className="py-3 px-3.5">Priority</th>
                <th className="py-3 px-3.5">Status</th>
                <th className="py-3 px-3.5">Assignee</th>
                <th className="py-3 px-3.5">Reporter</th>
                <th className="py-3 px-3.5 text-center">Photo</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleReports.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-muted">
                    No incidents match the active filters.
                  </td>
                </tr>
              ) : (
                visibleReports.map((r) => {
                  const fullTs = formatFullTimestamp(r.created_at);
                  const relTs = formatRelativeTime(r.created_at);
                  const roleLabel = formatRoleLabel(r.reporter_role);
                  const reporterText = r.reporter_name
                    ? `${r.reporter_name} (${roleLabel})`
                    : roleLabel;
                  const assigneeStaff = staff.find((s) => s.id === r.assigned_to);
                  const assigneeDisplay =
                    r.assignee_name ||
                    assigneeStaff?.name ||
                    (r.assigned_to ? `Technician #${r.assigned_to}` : "Unassigned");
                  const hasPhoto = Boolean(r.has_photo);

                  const isAssigneeInactive =
                    Boolean(r.assigned_to) &&
                    (r.assignee_availability === "inactive" ||
                      assigneeStaff?.availability === "inactive");

                  return (
                    <tr
                      key={r.id}
                      onClick={() => {
                        setDetailFocusResolution(false);
                        setDetailModalReport(r);
                      }}
                      className="hover:bg-bg/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3.5 font-bold text-accent whitespace-nowrap">
                        #{r.id}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap" title={fullTs}>
                        <div className="font-medium text-text">{relTs}</div>
                        <div className="text-[11px] text-muted">{fullTs}</div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {formatReportLocation(r)}
                      </td>
                      <td className="py-3 px-3.5 max-w-[240px] truncate font-medium text-text">
                        {r.description}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">{r.category}</td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <PriorityBadge priority={r.priority || "medium"} />
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-chip text-[11px] font-medium border ${
                              r.assigned_to
                                ? "bg-bg text-text border-border"
                                : "bg-surface text-muted border-border"
                            }`}
                          >
                            {assigneeDisplay}
                          </span>
                          {isAssigneeInactive && (
                            <span className="px-1.5 py-0.5 rounded-chip text-[10px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                              Not active
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap text-muted">
                        Reported by <span className="text-text font-medium">{reporterText}</span>
                      </td>
                      <td
                        className="py-3 px-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {hasPhoto ? (
                          <button
                            type="button"
                            aria-label="View photo proof"
                            onClick={() => setPhotoLightboxReport(r)}
                            className="p-1.5 rounded-input border border-border bg-bg text-muted hover:text-accent hover:border-accent inline-flex items-center justify-center"
                          >
                            <Camera className="w-3.5 h-3.5 stroke-[1.5]" />
                          </button>
                        ) : (
                          <span className="text-muted text-[11px]">—</span>
                        )}
                      </td>
                      <td
                        className="py-3 px-3.5 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {r.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => openAssignDialog(r)}
                              className="px-2.5 py-1 bg-accent text-white rounded-input text-[11px] font-semibold hover:bg-accent-hover"
                            >
                              Assign
                            </button>
                          )}
                          {r.status === "assigned" && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  apiUpdateReport(r.id, { status: "in_progress" }).then(loadData)
                                }
                                className="px-2.5 py-1 bg-bg border border-border text-text rounded-input text-[11px] font-semibold hover:border-accent"
                              >
                                Start Work
                              </button>
                              <button
                                type="button"
                                onClick={() => openAssignDialog(r)}
                                className="px-2.5 py-1 bg-bg border border-border text-text rounded-input text-[11px] font-semibold hover:border-accent"
                              >
                                Reassign
                              </button>
                            </>
                          )}
                          {r.status === "in_progress" && (
                            <>
                              <button
                                type="button"
                                onClick={() => setResolveModalReport(r)}
                                className="px-2.5 py-1 bg-emerald-600 text-white rounded-input text-[11px] font-semibold hover:bg-emerald-700"
                              >
                                Resolve
                              </button>
                              <button
                                type="button"
                                onClick={() => openAssignDialog(r)}
                                className="px-2.5 py-1 bg-bg border border-border text-text rounded-input text-[11px] font-semibold hover:border-accent"
                              >
                                Reassign
                              </button>
                            </>
                          )}
                          {r.status === "resolved" && (
                            <>
                              <button
                                type="button"
                                aria-label="View resolution notes"
                                title="View resolution notes"
                                onClick={() => {
                                  setDetailFocusResolution(true);
                                  setDetailModalReport(r);
                                }}
                                className="p-1.5 rounded-input border border-border bg-bg text-muted hover:text-accent hover:border-accent inline-flex items-center justify-center"
                              >
                                <FileText className="w-3.5 h-3.5 stroke-[1.5]" />
                              </button>
                              <span className="text-muted text-[11px]">Closed</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {assignModalReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-card p-6 max-w-sm w-full space-y-4">
              <h3 className="text-base font-bold">
                {assignModalReport.assigned_to ? "Reassign" : "Assign"} Ticket #{assignModalReport.id}
              </h3>
              <div>
                <select
                  aria-label="Select Technician"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value ? Number(e.target.value) : "")}
                  className="w-full h-9 px-3 rounded-input border border-border bg-bg text-xs text-text"
                >
                  <option value="">
                    {assignLoadingStaff ? "Refreshing availability..." : "Select Technician..."}
                  </option>
                  {sortStaffActiveFirst(staff).map((s) => {
                    const isInactive = s.availability === "inactive";
                    return (
                      <option
                        key={s.id}
                        value={s.id}
                        disabled={isInactive}
                        style={isInactive ? { color: "#9CA3AF" } : undefined}
                      >
                        {s.name} - {isInactive ? "Not active" : "Active"}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-muted mt-1.5">
                  Not active technicians cannot receive new tickets
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalReport(null)}
                  className="px-3 py-1.5 rounded-input border border-border bg-bg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={!selectedStaffId}
                  className="px-3 py-1.5 rounded-input bg-accent text-white text-xs font-semibold disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {resolveModalReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-card p-6 max-w-md w-full space-y-3">
              <h3 className="text-base font-bold">Resolve Ticket #{resolveModalReport.id}</h3>
              <div>
                <label className="block text-xs font-semibold mb-1">Action Taken *</label>
                <textarea
                  required
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  placeholder="Physical corrective action taken..."
                  rows={3}
                  className="w-full p-2.5 rounded-input border border-border bg-bg text-xs text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Remarks (Optional)</label>
                <textarea
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value)}
                  placeholder="Verification notes..."
                  rows={2}
                  className="w-full p-2.5 rounded-input border border-border bg-bg text-xs text-text"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setResolveModalReport(null)}
                  className="px-3 py-1.5 rounded-input border border-border bg-bg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResolve}
                  className="px-3 py-1.5 rounded-input bg-emerald-600 text-white text-xs font-semibold"
                >
                  Submit Resolution
                </button>
              </div>
            </div>
          </div>
        )}

        {detailModalReport && (
          <StaffReportModal
            report={detailModalReport}
            focusResolution={detailFocusResolution}
            onClose={() => {
              setDetailModalReport(null);
              setDetailFocusResolution(false);
            }}
            onUpdate={() => {
              loadData();
            }}
          />
        )}

        {photoLightboxReport && (
          <PhotoLightboxModal
            reportId={photoLightboxReport.id}
            title={photoLightboxReport.description?.slice(0, 48)}
            onClose={() => setPhotoLightboxReport(null)}
          />
        )}
      </div>
    </div>
  );
}
