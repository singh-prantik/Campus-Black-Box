"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import ReportDetailModal from "@/components/ReportDetailModal";
import { Report, StaffMember, AnalyticsSummary } from "@/types";
import {
  apiGetReports,
  apiGetStaff,
  apiGetAnalyticsSummary,
  apiUpdateReport,
  apiResolveReport,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  Search,
  X,
  ShieldAlert,
  ArrowRight,
  UserCheck,
  Play,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";

export default function AdminDashboardPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [reports, setReports] = useState<Report[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [blockFilter, setBlockFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Quick Action States
  const [assigningReport, setAssigningReport] = useState<Report | null>(null);
  const [resolvingReport, setResolvingReport] = useState<Report | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [resolveAction, setResolveAction] = useState("");
  const [resolveRemarks, setResolveRemarks] = useState("");
  const [submittingAction, setSubmittingAction] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [repRes, staffRes, sumRes] = await Promise.all([
        apiGetReports(),
        apiGetStaff().catch(() => ({ staff: [] })),
        apiGetAnalyticsSummary().catch(() => null),
      ]);
      setReports(repRes.reports);
      setStaff(staffRes.staff);
      if (sumRes) setSummary(sumRes);
    } catch (err: any) {
      toast.error(err.message || "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadData();
    }
  }, [authLoading, isAdmin]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (blockFilter && r.location?.block !== blockFilter) return false;
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          r.title?.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.location?.room.toLowerCase().includes(q) ||
          `#${r.id}`.includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reports, search, statusFilter, blockFilter, categoryFilter, priorityFilter]);

  // Handle Quick Assign
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningReport || !selectedStaffId) return;

    setSubmittingAction(true);
    try {
      const staffIdNum = Number(selectedStaffId);
      const updated = await apiUpdateReport(assigningReport.id, {
        assigned_to: staffIdNum,
        status: "assigned",
      });
      toast.success(`Incident #${assigningReport.id} assigned to Technician #${staffIdNum}`);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setAssigningReport(null);
      setSelectedStaffId("");
      // Refresh summary
      apiGetAnalyticsSummary().then((s) => setSummary(s)).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || "Failed to assign technician");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Quick "Start Work"
  const handleStartWork = async (report: Report) => {
    setSubmittingAction(true);
    try {
      const updated = await apiUpdateReport(report.id, {
        status: "in_progress",
      });
      toast.success(`Incident #${report.id} marked In Progress`);
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      apiGetAnalyticsSummary().then((s) => setSummary(s)).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || "Failed to transition to In Progress");
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Quick Resolve
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingReport) return;
    if (!resolveAction.trim()) {
      toast.error("Resolution action description is required");
      return;
    }

    setSubmittingAction(true);
    try {
      await apiResolveReport(resolvingReport.id, resolveAction.trim(), resolveRemarks.trim());
      toast.success(`Incident #${resolvingReport.id} marked Resolved`);
      setReports((prev) =>
        prev.map((r) =>
          r.id === resolvingReport.id
            ? { ...r, status: "resolved", resolved_at: new Date().toISOString() }
            : r
        )
      );
      setResolvingReport(null);
      setResolveAction("");
      setResolveRemarks("");
      apiGetAnalyticsSummary().then((s) => setSummary(s)).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve incident");
    } finally {
      setSubmittingAction(false);
    }
  };

  // 1. Role-based Access Control Check (AC1.4)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
          Verifying authorization...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-surface border border-border rounded-card text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-border text-accent mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">Administrator Access Required</h1>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                The Incident Triage and Control Console is restricted to authenticated Administrators.
                {isAuthenticated
                  ? ` You are signed in as ${user?.role || "user"}.`
                  : " You are currently not signed in."}
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/login?returnUrl=/dashboard/admin"
                className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90 inline-flex items-center justify-center gap-1.5"
              >
                Sign In as Admin
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.5]" />
              </Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30 text-center"
              >
                Return to Public Feed
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                Control Console
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-chip bg-border text-muted font-medium">
                Sample data
              </span>
            </div>
            <h1 className="text-xl font-bold text-text mt-0.5">Admin Incident Triage</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/heatmap"
              className="px-3 py-1.5 rounded-input border border-border bg-surface text-text hover:bg-border/30 text-xs font-semibold"
            >
              Campus Heat Map
            </Link>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
            >
              Public Feed
            </Link>
          </div>
        </div>

        {/* KPI Strip with Valid Sum and Turnaround (AC2.5) */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 bg-surface border border-border rounded-card">
              <div className="text-[11px] text-muted font-medium flex items-center justify-between">
                <span>Total</span>
                <Layers className="w-3.5 h-3.5 stroke-[1.5] text-muted" />
              </div>
              <div className="text-xl font-bold text-text mt-1">{summary.total_reports}</div>
              <div className="text-[10px] text-muted mt-0.5">Sum of all tickets</div>
            </div>

            <div className="p-3 bg-surface border border-border rounded-card">
              <div className="text-[11px] text-muted font-medium flex items-center justify-between">
                <span>Pending</span>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div className="text-xl font-bold text-text mt-1">{summary.pending_reports}</div>
              <div className="text-[10px] text-muted mt-0.5">Awaiting assignment</div>
            </div>

            <div className="p-3 bg-surface border border-border rounded-card">
              <div className="text-[11px] text-muted font-medium flex items-center justify-between">
                <span>Assigned</span>
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <div className="text-xl font-bold text-text mt-1">{summary.assigned_reports}</div>
              <div className="text-[10px] text-muted mt-0.5">Technician dispatched</div>
            </div>

            <div className="p-3 bg-surface border border-border rounded-card">
              <div className="text-[11px] text-muted font-medium flex items-center justify-between">
                <span>In Progress</span>
                <span className="w-2 h-2 rounded-full bg-indigo-500" />
              </div>
              <div className="text-xl font-bold text-text mt-1">{summary.in_progress_reports}</div>
              <div className="text-[10px] text-muted mt-0.5">Active field work</div>
            </div>

            <div className="p-3 bg-surface border border-border rounded-card">
              <div className="text-[11px] text-muted font-medium flex items-center justify-between">
                <span>Resolved</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <div className="text-xl font-bold text-text mt-1">{summary.resolved_reports}</div>
              <div className="text-[10px] text-muted mt-0.5">Closed incidents</div>
            </div>

            <div className="p-3 bg-surface border border-border rounded-card">
              <div className="text-[11px] text-muted font-medium flex items-center justify-between">
                <span>Turnaround</span>
                <Clock className="w-3.5 h-3.5 stroke-[1.5] text-accent" />
              </div>
              <div className="text-xl font-bold text-text mt-1">
                {summary.avg_resolution_hours ? `${summary.avg_resolution_hours} hrs` : "N/A"}
              </div>
              <div className="text-[10px] text-muted mt-0.5">Mean time to resolve</div>
            </div>
          </div>
        )}

        {/* Filters Toolbar (Includes Category Filter FR-13) */}
        <div className="p-3 bg-surface border border-border rounded-card flex flex-wrap gap-2 items-center justify-between text-xs">
          <div className="flex flex-wrap gap-2 items-center flex-1">
            <div className="relative min-w-[180px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted stroke-[1.5]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by issue or room..."
                className="w-full h-8 pl-8 pr-3 bg-bg border border-border rounded-input text-xs text-text placeholder:text-muted focus:border-accent"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </select>

            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="h-8 px-2 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
            >
              <option value="">All Blocks</option>
              <option value="Block 1">Block 1</option>
              <option value="Block 2">Block 2</option>
              <option value="Block 3">Block 3</option>
              <option value="Block 4">Block 4</option>
              <option value="Library">Library</option>
            </select>

            {/* FR-13 Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-8 px-2 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
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
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-8 px-2 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
            >
              <option value="">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {(statusFilter || blockFilter || categoryFilter || priorityFilter || search) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setBlockFilter("");
                setCategoryFilter("");
                setPriorityFilter("");
                setSearch("");
              }}
              className="h-8 px-2.5 rounded-input border border-border text-xs text-accent hover:bg-border/30 flex items-center gap-1"
            >
              <X className="w-3 h-3 stroke-[1.5]" />
              Reset filters
            </button>
          )}
        </div>

        {/* Incidents Table with Assignee Column and Status-Guarded Actions (AC2.4) */}
        <div className="bg-surface border border-border rounded-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-bg/50 text-muted font-semibold uppercase text-[11px] tracking-wider">
                  <th className="p-3">ID</th>
                  <th className="p-3">Incident</th>
                  <th className="p-3">Location</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Priority</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assignee</th>
                  <th className="p-3">Reporter</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted">
                      <div className="flex justify-center items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                        Loading incidents...
                      </div>
                    </td>
                  </tr>
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted">
                      No incidents match the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => {
                    const assigneeStaff = staff.find((s) => s.id === report.assigned_to);
                    const assigneeDisplay = assigneeStaff
                      ? assigneeStaff.name
                      : report.assigned_to
                      ? `Technician #${report.assigned_to}`
                      : "Unassigned";

                    return (
                      <tr
                        key={report.id}
                        onClick={() => setSelectedReport(report)}
                        className="hover:bg-bg/40 cursor-pointer transition-colors"
                      >
                        <td className="p-3 font-semibold text-accent">#{report.id}</td>
                        <td className="p-3 font-medium text-text max-w-xs truncate">
                          {report.title || report.description}
                        </td>
                        <td className="p-3 text-muted">
                          {report.location ? `${report.location.block} · ${report.location.room}` : "Campus"}
                        </td>
                        <td className="p-3 font-medium">{report.category}</td>
                        <td className="p-3">
                          <PriorityBadge priority={report.priority} />
                        </td>
                        <td className="p-3">
                          <StatusBadge status={report.status} />
                        </td>
                        {/* Assignee Column */}
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-chip text-[11px] font-medium border ${
                              report.assigned_to
                                ? "bg-bg text-text border-border"
                                : "bg-surface text-muted border-border"
                            }`}
                          >
                            {assigneeDisplay}
                          </span>
                        </td>
                        <td className="p-3 text-muted">
                          {report.reporter_role || report.reporter?.role || "Student"}
                        </td>
                        {/* Lifecycle-Guarded Actions (AC2.4) */}
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Pending State: Can ONLY Assign. NO Resolve button! */}
                            {report.status === "pending" && (
                              <button
                                onClick={() => {
                                  setAssigningReport(report);
                                  setSelectedStaffId(staff[0]?.id ? String(staff[0].id) : "");
                                }}
                                className="px-2.5 py-1 rounded-input border border-border bg-bg text-text hover:bg-border/30 text-[11px] font-semibold flex items-center gap-1"
                              >
                                <UserCheck className="w-3 h-3 stroke-[1.5] text-accent" />
                                Assign
                              </button>
                            )}

                            {/* Assigned State: Start Work or Reassign */}
                            {report.status === "assigned" && (
                              <>
                                <button
                                  onClick={() => handleStartWork(report)}
                                  disabled={submittingAction}
                                  className="px-2.5 py-1 rounded-input bg-accent text-white text-[11px] font-semibold hover:bg-accent-hover flex items-center gap-1"
                                >
                                  <Play className="w-3 h-3 stroke-[1.5]" />
                                  Start work
                                </button>
                                <button
                                  onClick={() => {
                                    setAssigningReport(report);
                                    setSelectedStaffId(report.assigned_to ? String(report.assigned_to) : "");
                                  }}
                                  className="px-2 py-1 rounded-input border border-border bg-bg text-muted hover:text-text text-[11px] font-medium"
                                >
                                  Reassign
                                </button>
                              </>
                            )}

                            {/* In Progress State: Resolve (requires action text) or Reassign */}
                            {report.status === "in_progress" && (
                              <>
                                <button
                                  onClick={() => setResolvingReport(report)}
                                  className="px-2.5 py-1 rounded-input bg-text text-bg text-[11px] font-semibold hover:opacity-90 flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-3 h-3 stroke-[1.5]" />
                                  Resolve
                                </button>
                                <button
                                  onClick={() => {
                                    setAssigningReport(report);
                                    setSelectedStaffId(report.assigned_to ? String(report.assigned_to) : "");
                                  }}
                                  className="px-2 py-1 rounded-input border border-border bg-bg text-muted hover:text-text text-[11px] font-medium"
                                >
                                  Reassign
                                </button>
                              </>
                            )}

                            {/* Resolved State: Closed pill, no lifecycle action buttons */}
                            {report.status === "resolved" && (
                              <span className="text-[11px] text-muted font-medium px-2 py-0.5 rounded-chip bg-border/50">
                                Closed
                              </span>
                            )}

                            {/* Inspect Details Button */}
                            <button
                              onClick={() => setSelectedReport(report)}
                              className="px-2 py-1 rounded-input border border-border bg-bg text-muted hover:text-text text-[11px] font-medium"
                            >
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Quick Assign Technician Modal */}
      {assigningReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-none"
        >
          <div className="w-full max-w-sm bg-surface border border-border rounded-card p-5 space-y-4 text-text">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-text">
                Assign Incident #{assigningReport.id}
              </h2>
              <button
                onClick={() => setAssigningReport(null)}
                className="text-muted hover:text-text"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>
            <p className="text-xs text-muted">
              Select an available maintenance technician to work on:{" "}
              <span className="font-semibold text-text">
                {assigningReport.title || assigningReport.description}
              </span>
            </p>
            <form onSubmit={handleAssignSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Technician
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full h-9 px-2 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
                >
                  <option value="">Select Technician...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.assigned_count} active tickets)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssigningReport(null)}
                  className="px-3 py-1.5 rounded-input border border-border text-xs text-text hover:bg-border/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedStaffId || submittingAction}
                  className="px-4 py-1.5 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
                >
                  {submittingAction ? "Assigning..." : "Confirm Assignment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Resolve Modal (Enforces Required Action Text AC2.2) */}
      {resolvingReport && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-none"
        >
          <div className="w-full max-w-md bg-surface border border-border rounded-card p-5 space-y-4 text-text">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-text">
                Resolve Incident #{resolvingReport.id}
              </h2>
              <button
                onClick={() => setResolvingReport(null)}
                className="text-muted hover:text-text"
              >
                <X className="w-4 h-4 stroke-[1.5]" />
              </button>
            </div>
            <p className="text-xs text-muted">
              Record the corrective action taken to close:{" "}
              <span className="font-semibold text-text">
                {resolvingReport.title || resolvingReport.description}
              </span>
            </p>
            <form onSubmit={handleResolveSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Action taken * (Required)
                </label>
                <input
                  type="text"
                  value={resolveAction}
                  onChange={(e) => setResolveAction(e.target.value)}
                  placeholder="e.g. Replaced burnt capacitor on ceiling fan"
                  className="w-full h-8 px-2.5 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1">
                  Additional remarks
                </label>
                <input
                  type="text"
                  value={resolveRemarks}
                  onChange={(e) => setResolveRemarks(e.target.value)}
                  placeholder="e.g. Tested at full speed for 10 minutes"
                  className="w-full h-8 px-2.5 bg-bg border border-border rounded-input text-xs text-text focus:border-accent"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingReport(null)}
                  className="px-3 py-1.5 rounded-input border border-border text-xs text-text hover:bg-border/30"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!resolveAction.trim() || submittingAction}
                  className="px-4 py-1.5 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
                >
                  {submittingAction ? "Resolving..." : "Log Resolution & Close"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdate={(updated) => {
            setReports((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setSelectedReport(updated);
            apiGetAnalyticsSummary().then((s) => setSummary(s)).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
