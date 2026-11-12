"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StaffNavbar from "@/components/StaffNavbar";
import StaffReportModal from "@/components/StaffReportModal";
import PhotoLightboxModal from "@/components/PhotoLightboxModal";
import { StatusBadge, PriorityBadge } from "@/components/StatusBadge";
import { apiGetReports, apiUpdateReport, apiResolveReport, useStaffSession } from "@/lib/staffApi";
import { formatFullTimestamp, formatRelativeTime } from "@/lib/time";
import { Report } from "@/types";
import { Camera, Clock } from "lucide-react";

function formatRoleLabel(role: string | null | undefined): string {
  const lower = String(role || "student").toLowerCase();
  if (lower === "faculty") return "Faculty";
  if (lower === "maintenance" || lower === "technician") return "Technician";
  return "Student";
}

function formatLocation(r: Report): string {
  const block = r.location?.block || r.block;
  const room = r.location?.room || r.room;
  if (block && room) return `${block} · ${room}`;
  return block || room || "Location unavailable";
}

export default function TechnicianWorkOrdersPage() {
  const { isAuthenticated, loading: authLoading } = useStaffSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveModalReport, setResolveModalReport] = useState<Report | null>(null);
  const [detailModalReport, setDetailModalReport] = useState<Report | null>(null);
  const [photoLightboxReport, setPhotoLightboxReport] = useState<Report | null>(null);
  const [actionText, setActionText] = useState("");
  const [remarksText, setRemarksText] = useState("");

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setLoading(false);
      return;
    }
    loadWorkOrders();
  }, [authLoading, isAuthenticated]);

  async function loadWorkOrders() {
    setLoading(true);
    try {
      const data = await apiGetReports();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  async function startWork(id: number) {
    try {
      await apiUpdateReport(id, { status: "in_progress" });
      loadWorkOrders();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  }

  async function handleResolve() {
    if (!resolveModalReport || !actionText.trim()) return;
    try {
      await apiResolveReport(resolveModalReport.id, actionText, remarksText);
      setResolveModalReport(null);
      setActionText("");
      setRemarksText("");
      loadWorkOrders();
    } catch (err: any) {
      alert(err.message || "Failed to resolve work order");
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <StaffNavbar />
        <div className="max-w-md mx-auto my-16 p-8 bg-surface border border-border rounded-card text-center space-y-3">
          <h1 className="text-lg font-bold">Staff Sign-In Required</h1>
          <p className="text-muted text-xs">
            Sign in with your technician or admin credentials to manage work orders.
          </p>
          <Link
            href="/staff/login"
            className="inline-block px-4 py-2 bg-accent text-white rounded-input text-xs font-semibold"
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
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">My Assigned Work Orders</h1>
            <p className="text-muted text-xs mt-0.5">
              Work orders assigned to your maintenance technician profile.
            </p>
          </div>
          <button
            type="button"
            onClick={loadWorkOrders}
            className="px-3.5 py-2 rounded-input border border-border bg-surface text-xs font-medium hover:border-accent"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-muted text-xs">Loading work orders...</div>
        ) : reports.length === 0 ? (
          <div className="py-12 text-center bg-surface border border-border rounded-card">
            <h3 className="text-base font-semibold">All Caught Up!</h3>
            <p className="text-muted text-xs mt-1">
              You have no open work orders allocated to you.
            </p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-card overflow-x-auto">
            <table className="w-full border-collapse text-xs text-left">
              <thead>
                <tr className="border-b border-border bg-bg/50 text-muted text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">ID</th>
                  <th className="py-3 px-3.5">Reported</th>
                  <th className="py-3 px-3.5">Location</th>
                  <th className="py-3 px-3.5">Description</th>
                  <th className="py-3 px-3.5">Priority</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">Reporter</th>
                  <th className="py-3 px-3.5 text-center">Photo</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((r) => {
                  const fullTs = formatFullTimestamp(r.created_at);
                  const relTs = formatRelativeTime(r.created_at);
                  const roleLabel = formatRoleLabel(r.reporter_role);
                  const reporterText = r.reporter_name
                    ? `${r.reporter_name} (${roleLabel})`
                    : roleLabel;

                  return (
                    <tr
                      key={r.id}
                      onClick={() => setDetailModalReport(r)}
                      className="hover:bg-bg/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3.5 font-bold text-accent whitespace-nowrap">
                        #{r.id}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap" title={fullTs}>
                        <div className="font-medium text-text flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted" />
                          {relTs}
                        </div>
                        <div className="text-[11px] text-muted">{fullTs}</div>
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">{formatLocation(r)}</td>
                      <td className="py-3 px-3.5 max-w-[240px] truncate font-medium text-text">
                        {r.description}
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <PriorityBadge priority={r.priority || "medium"} />
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-3 px-3.5 whitespace-nowrap text-muted">
                        Reported by <span className="text-text font-medium">{reporterText}</span>
                      </td>
                      <td
                        className="py-3 px-3.5 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {Boolean(r.has_photo) ? (
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
                        {r.status === "assigned" && (
                          <button
                            type="button"
                            onClick={() => startWork(r.id)}
                            className="px-2.5 py-1 bg-accent text-white rounded-input text-[11px] font-semibold"
                          >
                            Start Work
                          </button>
                        )}
                        {r.status === "in_progress" && (
                          <button
                            type="button"
                            onClick={() => setResolveModalReport(r)}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded-input text-[11px] font-semibold"
                          >
                            Complete &amp; Resolve
                          </button>
                        )}
                        {r.status === "resolved" && (
                          <span className="text-muted text-[11px]">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {resolveModalReport && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border rounded-card p-6 max-w-md w-full space-y-3">
              <h3 className="text-base font-bold">
                Complete Work Order #{resolveModalReport.id}
              </h3>
              <div>
                <label className="block text-xs font-semibold mb-1">Action Taken *</label>
                <textarea
                  required
                  value={actionText}
                  onChange={(e) => setActionText(e.target.value)}
                  placeholder="Describe corrective maintenance performed..."
                  rows={3}
                  className="w-full p-2.5 rounded-input border border-border bg-bg text-xs text-text"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Internal Remarks (Optional)
                </label>
                <textarea
                  value={remarksText}
                  onChange={(e) => setRemarksText(e.target.value)}
                  placeholder="Parts replaced, safety tests verified..."
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
                  Confirm &amp; Close
                </button>
              </div>
            </div>
          </div>
        )}

        {detailModalReport && (
          <StaffReportModal
            report={detailModalReport}
            onClose={() => setDetailModalReport(null)}
            onUpdate={() => loadWorkOrders()}
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
