"use client";

import React, { useState, useEffect, useRef } from "react";
import { Report, StaffMember } from "@/types";
import {
  apiUpdateReport,
  apiResolveReport,
  apiGetStaff,
  apiGetStaffReportDetail,
  apiFetchStaffReportPhoto,
  useStaffSession,
} from "@/lib/staffApi";
import { formatFullTimestamp, formatRelativeTime } from "@/lib/time";
import PhotoLightboxModal from "./PhotoLightboxModal";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import toast from "react-hot-toast";
import { X, MapPin, User, Sparkles, CheckCircle2, Clock, Camera } from "lucide-react";

const statusSteps = ["pending", "assigned", "in_progress", "resolved"];
const statusStepLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

interface StaffReportModalProps {
  report: Report;
  focusResolution?: boolean;
  onClose: () => void;
  onUpdate?: (report: Report) => void;
}

export default function StaffReportModal({
  report,
  focusResolution = false,
  onClose,
  onUpdate,
}: StaffReportModalProps) {
  const { user } = useStaffSession();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [detailReport, setDetailReport] = useState<Report>(report);
  const [detailResolution, setDetailResolution] = useState<Report["resolution"]>(
    report.resolution || null
  );
  const [detailLoading, setDetailLoading] = useState<boolean>(true);
  const resolutionSectionRef = useRef<HTMLDivElement | null>(null);

  const isAssignedTechnician =
    user?.role === "maintenance" && user?.id === detailReport.assigned_to;
  const canManage = isAdmin || isAssignedTechnician;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignTo, setAssignTo] = useState<string>(
    report.assigned_to ? String(report.assigned_to) : ""
  );
  const [newStatus, setNewStatus] = useState<"pending" | "assigned" | "in_progress" | "resolved">(
    report.status === "submitted" ? "pending" : report.status
  );
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "critical">(
    report.priority || "medium"
  );
  const [resolveAction, setResolveAction] = useState("");
  const [resolveRemarks, setResolveRemarks] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoUnavailable, setPhotoUnavailable] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setDetailReport(report);
    setDetailResolution(report.resolution || null);
    setDetailLoading(true);
    apiGetStaffReportDetail(report.id)
      .then((res) => {
        if (!active) return;
        const fullRep = res.report || report;
        setDetailReport(fullRep);
        const latestRes =
          res.resolution ||
          fullRep.resolution ||
          (res.resolutions && res.resolutions.length > 0
            ? {
                action: res.resolutions[res.resolutions.length - 1].action,
                remarks: res.resolutions[res.resolutions.length - 1].remarks ?? null,
                resolved_by:
                  res.resolutions[res.resolutions.length - 1].staff_name ||
                  fullRep.resolved_by ||
                  null,
                resolved_at:
                  fullRep.resolved_at ||
                  res.resolutions[res.resolutions.length - 1].created_at,
              }
            : null);
        setDetailResolution(latestRes);
        if (fullRep.assigned_to) setAssignTo(String(fullRep.assigned_to));
        setNewStatus(fullRep.status === "submitted" ? "pending" : fullRep.status);
        setNewPriority(fullRep.priority || "medium");
      })
      .catch(() => {})
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [report]);

  useEffect(() => {
    if (!detailLoading && focusResolution && resolutionSectionRef.current) {
      resolutionSectionRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [detailLoading, focusResolution]);

  useEffect(() => {
    if (isAdmin) {
      apiGetStaff()
        .then((res) => {
          const list = [...(res.staff || [])].sort((a, b) => {
            const aInact = a.availability === "inactive" ? 1 : 0;
            const bInact = b.availability === "inactive" ? 1 : 0;
            if (aInact !== bInact) return aInact - bInact;
            return a.id - b.id;
          });
          setStaff(list);
        })
        .catch(() => {});
    }
  }, [isAdmin, report.id]);

  const hasPhoto = Boolean(report.has_photo || report.photo_path || report.photo_url);
  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;
    setPhotoUnavailable(false);
    if (!hasPhoto) {
      setPhotoSrc(null);
      return;
    }
    apiFetchStaffReportPhoto(report.id)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url);
          return;
        }
        blobUrl = url;
        setPhotoSrc(url);
      })
      .catch(() => {
        if (active) setPhotoUnavailable(true);
      });
    return () => {
      active = false;
      if (blobUrl && blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
    };
  }, [hasPhoto, report.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: { assigned_to?: number; status?: string; priority?: string } = {};

      if (isAdmin && assignTo && Number(assignTo) !== report.assigned_to) {
        updates.assigned_to = Number(assignTo);
        if (newStatus === "pending") {
          updates.status = "assigned";
        }
      }

      if (newStatus !== report.status) {
        if (report.status === "pending" && newStatus === "resolved") {
          toast.error("Pending tickets cannot be directly resolved. Transition through Assigned -> In Progress first.");
          setSaving(false);
          return;
        }
        updates.status = newStatus;
      }

      if (isAdmin && newPriority !== report.priority) {
        updates.priority = newPriority;
      }

      const updated = await apiUpdateReport(report.id, updates);
      toast.success("Incident updated successfully");
      onUpdate?.(updated);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to update incident");
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveAction.trim()) {
      toast.error("Please describe the resolution action taken");
      return;
    }
    setSaving(true);
    try {
      await apiResolveReport(report.id, resolveAction.trim(), resolveRemarks.trim());
      toast.success("Incident marked resolved");
      onUpdate?.({
        ...report,
        status: "resolved",
        resolved_at: new Date().toISOString(),
      });
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve incident");
    } finally {
      setSaving(false);
    }
  };

  const currentStepIdx = statusSteps.indexOf(detailReport.status);
  const blockName = detailReport.location?.block || detailReport.block;
  const roomName = detailReport.location?.room || detailReport.room;
  const locationString =
    blockName && roomName ? `${blockName} · ${roomName}` : blockName || roomName || "Location unavailable";
  const rawRole = String(detailReport.reporter_role || detailReport.reporter?.role || "student").toLowerCase();
  const roleLabel = rawRole === "faculty" ? "Faculty" : rawRole === "maintenance" ? "Technician" : "Student";
  const reporterDisplay = detailReport.reporter_name
    ? `${detailReport.reporter_name} (${roleLabel})`
    : roleLabel;
  const fullTimestamp = formatFullTimestamp(detailReport.created_at);
  const relativeTimestamp = formatRelativeTime(detailReport.created_at);
  const assignedAtTimestamp = detailReport.assigned_at ? formatFullTimestamp(detailReport.assigned_at) : null;
  const resolvedAtIso = detailResolution?.resolved_at || detailReport.resolved_at || null;
  const resolvedFullTimestamp = resolvedAtIso ? formatFullTimestamp(resolvedAtIso) : null;
  const resolvedRelTimestamp = resolvedAtIso ? formatRelativeTime(resolvedAtIso) : null;
  const resolvedActionText = detailResolution?.action || detailReport.resolution_action || null;
  const resolvedRemarksRaw =
    detailResolution?.remarks !== undefined
      ? detailResolution.remarks
      : detailReport.resolution_remarks;
  const hasRemarks = Boolean(resolvedRemarksRaw && String(resolvedRemarksRaw).trim());
  const resolvedByName =
    detailResolution?.resolved_by || detailReport.resolved_by || detailReport.assignee_name || null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Staff Incident #${detailReport.id} Details`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-modal p-6 space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted font-medium">#{detailReport.id}</span>
              <StatusBadge status={detailReport.status} />
              {detailReport.priority && <PriorityBadge priority={detailReport.priority} />}
              <span className="text-xs font-medium text-accent">{detailReport.category}</span>
            </div>
            <h2 className="text-lg font-bold text-text leading-snug">
              {detailReport.title || detailReport.description?.slice(0, 72)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close staff modal"
            className="p-1.5 rounded-input text-muted hover:text-text hover:bg-bg border border-transparent hover:border-border transition-colors"
          >
            <X className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>

        <div className="p-4 rounded-card bg-bg border border-border">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Lifecycle Progress
          </div>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {statusSteps.map((step, idx) => {
              const completed = idx <= currentStepIdx;
              const isChecked = idx < currentStepIdx || detailReport.status === "resolved";
              return (
                <div key={step} className="flex items-center gap-2 flex-1 min-w-[80px]">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      completed ? "bg-accent text-white" : "bg-surface border border-border text-muted"
                    }`}
                  >
                    {isChecked ? "✓" : idx + 1}
                  </div>
                  <span className={`text-xs font-medium truncate ${completed ? "text-text" : "text-muted"}`}>
                    {statusStepLabels[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-input bg-bg border border-border flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent shrink-0" />
            <div>
              <div className="text-[11px] text-muted">Location</div>
              <div className="font-semibold text-text">{locationString}</div>
            </div>
          </div>
          <div className="p-3 rounded-input bg-bg border border-border flex items-center gap-2">
            <User className="w-4 h-4 text-muted shrink-0" />
            <div>
              <div className="text-[11px] text-muted">Reported By</div>
              <div className="font-semibold text-text">{reporterDisplay}</div>
            </div>
          </div>
          <div className="p-3 rounded-input bg-bg border border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted shrink-0" />
            <div>
              <div className="text-[11px] text-muted">Reported Time</div>
              <div className="font-semibold text-text" title={fullTimestamp}>
                {fullTimestamp}
                <span className="text-muted font-normal ml-1">({relativeTimestamp})</span>
              </div>
            </div>
          </div>
        </div>

        {hasPhoto && (
          <div className="rounded-input border border-border bg-bg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">
                Photo Evidence
              </span>
              <button
                type="button"
                aria-label="View photo proof"
                onClick={() => setLightboxOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-input border border-border bg-surface text-xs font-medium text-text hover:border-accent hover:text-accent transition-colors"
              >
                <Camera className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>View photo proof</span>
              </button>
            </div>
            {photoSrc && !photoUnavailable ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc}
                alt={`Evidence photo for incident #${report.id}`}
                onClick={() => setLightboxOpen(true)}
                onError={() => setPhotoUnavailable(true)}
                className="max-h-56 w-full object-contain rounded cursor-pointer bg-surface"
              />
            ) : photoUnavailable ? (
              <div className="py-4 text-center text-xs text-muted">Photo unavailable</div>
            ) : (
              <div className="py-4 text-center text-xs text-muted">Loading photo preview...</div>
            )}
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
            Incident Description
          </div>
          <p className="text-sm text-text bg-bg p-3.5 rounded-input border border-border">
            {detailReport.description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-input bg-bg border border-border">
            <div className="text-[11px] text-muted">Assigned to</div>
            <div className="font-semibold text-text flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span>{detailReport.assignee_name || "Unassigned"}</span>
              {detailReport.assigned_to && detailReport.assignee_availability === "inactive" && (
                <span className="px-1.5 py-0.5 rounded-chip text-[10px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                  Not active
                </span>
              )}
            </div>
          </div>
          <div className="p-3 rounded-input bg-bg border border-border">
            <div className="text-[11px] text-muted">Assigned at</div>
            <div className="font-semibold text-text mt-0.5" title={assignedAtTimestamp || undefined}>
              {assignedAtTimestamp || "—"}
            </div>
          </div>
        </div>

        {(detailReport.status === "resolved" || detailResolution) && (
          <div
            id="staff-modal-resolution-section"
            ref={resolutionSectionRef}
            className="p-4 rounded-card bg-bg border border-border space-y-3"
          >
            <div className="text-xs font-semibold text-muted uppercase tracking-wider">
              Resolution
            </div>
            {detailLoading && !resolvedActionText ? (
              <div className="text-xs text-muted">Loading resolution details...</div>
            ) : (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="text-[11px] text-muted mb-0.5">Action taken</div>
                  <div className="font-semibold text-text">
                    {resolvedActionText || "Completed"}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] text-muted">Internal remarks</span>
                    <span className="px-1.5 py-0.5 rounded-chip text-[10px] font-semibold bg-amber-500/15 text-amber-600 border border-amber-500/30">
                      Internal - staff only
                    </span>
                  </div>
                  <div
                    className={`p-2.5 rounded-input border border-border bg-surface ${
                      hasRemarks ? "text-text" : "text-muted italic"
                    }`}
                  >
                    {hasRemarks ? resolvedRemarksRaw : "No remarks added"}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="text-[11px] text-muted">Resolved by</div>
                    <div className="font-semibold text-text mt-0.5">
                      {resolvedByName || "Staff"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted">Resolved at</div>
                    <div
                      className="font-semibold text-text mt-0.5"
                      title={resolvedFullTimestamp || undefined}
                    >
                      {resolvedFullTimestamp ? (
                        <>
                          {resolvedFullTimestamp}
                          {resolvedRelTimestamp && (
                            <span className="text-muted font-normal ml-1">
                              ({resolvedRelTimestamp})
                            </span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted">Assigned to</div>
                    <div className="font-semibold text-text mt-0.5">
                      {detailReport.assignee_name || "Unassigned"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted">Assigned at</div>
                    <div className="font-semibold text-text mt-0.5" title={assignedAtTimestamp || undefined}>
                      {assignedAtTimestamp || "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {report.predictions && report.predictions.length > 0 && (
          <div className="p-3 rounded-input bg-bg border border-border flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              AI Suggested Category:
              <strong className="text-text">{report.predictions[0].predicted_category}</strong>
            </span>
            <span className="text-muted">
              Confidence: {Math.round((report.predictions[0].category_confidence || 0) * 100)}%
            </span>
          </div>
        )}

        {canManage && report.status !== "resolved" && (
          <div className="border-t border-border pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-muted font-medium mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full h-9 px-2.5 rounded-input border border-border bg-bg text-text"
                >
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                </select>
              </div>
              {isAdmin && (
                <div>
                  <label className="block text-muted font-medium mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full h-9 px-2.5 rounded-input border border-border bg-bg text-text"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              )}
              {isAdmin && (
                <div className="sm:col-span-2">
                  <label className="block text-muted font-medium mb-1">Assign Technician</label>
                  <select
                    value={assignTo}
                    onChange={(e) => setAssignTo(e.target.value)}
                    className="w-full h-9 px-2.5 rounded-input border border-border bg-bg text-text"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => {
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
                  <p className="text-[11px] text-muted mt-1">
                    Not active technicians cannot receive new tickets
                  </p>
                </div>
              )}
            </div>

            {showResolve ? (
              <form onSubmit={handleResolve} className="space-y-3 bg-bg p-3.5 rounded-input border border-border">
                <div className="text-xs font-semibold text-text flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Audit Resolution
                </div>
                <input
                  type="text"
                  required
                  value={resolveAction}
                  onChange={(e) => setResolveAction(e.target.value)}
                  placeholder="Action taken (visible to reporter)"
                  className="w-full h-9 px-2.5 rounded-input border border-border bg-surface text-xs text-text"
                />
                <input
                  type="text"
                  value={resolveRemarks}
                  onChange={(e) => setResolveRemarks(e.target.value)}
                  placeholder="Internal staff remarks (optional)"
                  className="w-full h-9 px-2.5 rounded-input border border-border bg-surface text-xs text-text"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-3.5 py-1.5 rounded-input bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                  >
                    {saving ? "Resolving..." : "Confirm Resolution"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResolve(false)}
                    className="px-3 py-1.5 rounded-input border border-border text-xs text-text"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                {(report.status === "assigned" || report.status === "in_progress") && (
                  <button
                    type="button"
                    onClick={() => setShowResolve(true)}
                    className="px-4 py-2 rounded-input bg-green-600 text-white text-xs font-semibold hover:bg-green-700"
                  >
                    Resolve Incident
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {lightboxOpen && (
        <PhotoLightboxModal
          reportId={report.id}
          title={report.title || report.description?.slice(0, 48)}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

