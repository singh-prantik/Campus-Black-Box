"use client";

import React, { useState, useEffect } from "react";
import { Report, StaffMember } from "@/types";
import {
  apiUpdateReport,
  apiResolveReport,
  apiGetStaff,
  apiFetchStaffProtectedPhoto,
  useStaffSession,
} from "@/lib/staffApi";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import toast from "react-hot-toast";
import { X, MapPin, User, Sparkles, CheckCircle2, Clock } from "lucide-react";

const statusSteps = ["pending", "assigned", "in_progress", "resolved"];
const statusStepLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

interface StaffReportModalProps {
  report: Report;
  onClose: () => void;
  onUpdate?: (report: Report) => void;
}

export default function StaffReportModal({
  report,
  onClose,
  onUpdate,
}: StaffReportModalProps) {
  const { user } = useStaffSession();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isAssignedTechnician =
    user?.role === "maintenance" && user?.id === report.assigned_to;
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

  useEffect(() => {
    if (isAdmin) {
      apiGetStaff()
        .then((res) => setStaff(res.staff))
        .catch(() => {});
    }
  }, [isAdmin]);

  const rawPhoto = report.photo_path || report.photo_url || "";
  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;
    if (!rawPhoto) {
      setPhotoSrc(null);
      return;
    }
    if (rawPhoto.includes("/api/photos/")) {
      apiFetchStaffProtectedPhoto(rawPhoto)
        .then((url) => {
          if (!active) {
            if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
            return;
          }
          blobUrl = url;
          setPhotoSrc(url);
        })
        .catch(() => {});
    } else {
      setPhotoSrc(rawPhoto);
    }
    return () => {
      active = false;
      if (blobUrl && blobUrl.startsWith("blob:")) URL.revokeObjectURL(blobUrl);
    };
  }, [rawPhoto]);

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

  const currentStepIdx = statusSteps.indexOf(report.status);
  const blockName = report.location?.block || report.block;
  const roomName = report.location?.room || report.room;
  const locationString =
    blockName && roomName ? `${blockName} · ${roomName}` : blockName || roomName || "Campus location";
  const reporterRole = report.reporter_role || report.reporter?.role || "Student";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Staff Incident #${report.id} Details`}
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
              <span className="text-xs font-mono text-muted font-medium">#{report.id}</span>
              <StatusBadge status={report.status} />
              {report.priority && <PriorityBadge priority={report.priority} />}
              <span className="text-xs font-medium text-accent">{report.category}</span>
            </div>
            <h2 className="text-lg font-bold text-text leading-snug">
              {report.title || report.description?.slice(0, 72)}
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
              return (
                <div key={step} className="flex items-center gap-2 flex-1 min-w-[80px]">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      completed ? "bg-accent text-white" : "bg-surface border border-border text-muted"
                    }`}
                  >
                    {idx < currentStepIdx ? "✓" : idx + 1}
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
              <div className="text-[11px] text-muted">Reporter Role</div>
              <div className="font-semibold text-text capitalize">{reporterRole}</div>
            </div>
          </div>
          <div className="p-3 rounded-input bg-bg border border-border flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted shrink-0" />
            <div>
              <div className="text-[11px] text-muted">Logged</div>
              <div className="font-semibold text-text">
                {new Date(report.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>

        {photoSrc && (
          <div className="rounded-input overflow-hidden border border-border bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc} alt="Evidence photo" className="max-h-60 w-full object-contain rounded" />
          </div>
        )}

        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
            Incident Description
          </div>
          <p className="text-sm text-text bg-bg p-3.5 rounded-input border border-border">
            {report.description}
          </p>
        </div>

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
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email})
                      </option>
                    ))}
                  </select>
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
    </div>
  );
}

