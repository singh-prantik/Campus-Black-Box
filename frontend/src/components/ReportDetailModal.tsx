"use client";

import React, { useState, useEffect } from "react";
import { Report, StaffMember } from "@/types";
import { apiUpdateReport, apiResolveReport, apiGetStaff } from "@/lib/api";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import { useAuth } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  X,
  MapPin,
  User,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";

const statusSteps = ["pending", "assigned", "in_progress", "resolved"];
const statusStepLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

interface ReportDetailModalProps {
  report: Report;
  onClose: () => void;
  onUpdate?: (report: Report) => void;
}

export default function ReportDetailModal({
  report,
  onClose,
  onUpdate,
}: ReportDetailModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isAssignedTechnician =
    user?.role === "maintenance" && user?.id === report.assigned_to;
  const canManage = isAdmin || isAssignedTechnician;

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignTo, setAssignTo] = useState<string>(
    report.assigned_to ? String(report.assigned_to) : ""
  );
  const [newStatus, setNewStatus] = useState<"pending" | "assigned" | "in_progress" | "resolved">(
    report.status
  );
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "critical">(
    report.priority
  );
  const [resolveAction, setResolveAction] = useState("");
  const [resolveRemarks, setResolveRemarks] = useState("");
  const [showResolve, setShowResolve] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      apiGetStaff()
        .then((res) => setStaff(res.staff))
        .catch(() => {});
    }
  }, [isAdmin]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Partial<Report> = {};

      if (isAdmin && assignTo && Number(assignTo) !== report.assigned_to) {
        updates.assigned_to = Number(assignTo);
        if (newStatus === "pending") {
          updates.status = "assigned";
        }
      }

      if (newStatus !== report.status) {
        // Enforce state transitions
        if (report.status === "pending" && newStatus === "resolved") {
          toast.error("Pending tickets cannot be directly resolved. Must transition through Assigned -> In Progress.");
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
  const locationString = report.location
    ? `${report.location.block} · ${report.location.room}`
    : "Campus location";
  const reporterRole = report.reporter_role || report.reporter?.role || "Student";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-bg/80 backdrop-blur-none"
    >
      <div className="relative w-full max-w-xl bg-surface border border-border rounded-card p-6 max-h-[90vh] overflow-y-auto text-text">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-sm font-semibold text-accent">#{report.id}</span>
              <StatusBadge status={report.status} />
              <PriorityBadge priority={report.priority} />
            </div>
            <h2 className="text-base font-bold text-text">
              {report.title || report.description}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded text-muted hover:text-text hover:bg-bg border border-transparent hover:border-border"
          >
            <X className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>

        {/* Status Timeline */}
        <div className="py-4 border-b border-border">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Status Lifecycle
          </div>
          <div className="flex items-center justify-between">
            {statusSteps.map((step, idx) => {
              const isPastOrCurrent = idx <= currentStepIdx;
              const isCurrent = idx === currentStepIdx;
              return (
                <div key={step} className="flex-1 flex flex-col items-center relative">
                  {idx > 0 && (
                    <div
                      className={`absolute top-2.5 right-1/2 left-[-50%] h-0.5 ${
                        idx <= currentStepIdx ? "bg-accent" : "bg-border"
                      }`}
                    />
                  )}
                  <div
                    className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                      isCurrent
                        ? "bg-accent text-white border-accent"
                        : isPastOrCurrent
                        ? "bg-text text-bg border-text"
                        : "bg-surface border-border text-muted"
                    }`}
                  >
                    {isPastOrCurrent ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`mt-1.5 text-[11px] font-medium ${
                      isCurrent ? "text-accent font-semibold" : "text-muted"
                    }`}
                  >
                    {statusStepLabels[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Details */}
        <div className="py-4 space-y-4 text-xs">
          <div>
            <div className="text-muted font-medium mb-1">Description</div>
            <p className="text-sm text-text leading-relaxed bg-bg border border-border rounded-input p-3">
              {report.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-bg border border-border rounded-input">
              <div className="text-muted font-medium flex items-center gap-1 mb-1">
                <MapPin className="w-3.5 h-3.5 stroke-[1.5]" />
                Location
              </div>
              <div className="font-semibold text-text">{locationString}</div>
            </div>

            <div className="p-3 bg-bg border border-border rounded-input">
              <div className="text-muted font-medium flex items-center gap-1 mb-1">
                <User className="w-3.5 h-3.5 stroke-[1.5]" />
                Reported by
              </div>
              <div className="font-semibold text-text">{reporterRole}</div>
            </div>
          </div>

          {/* Honest AI Categorization Details (FR-16, FR-21) */}
          <div className="p-3 bg-bg border border-border rounded-input">
            <div className="flex items-center justify-between mb-1">
              <span className="text-muted font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-accent stroke-[1.5]" />
                Triage Classification
              </span>
              <span className="text-[11px] text-muted">Rule-based suggestion (prototype)</span>
            </div>
            <div className="text-text font-medium flex items-center gap-2">
              <span>Category:</span>
              <span className="px-2 py-0.5 rounded-chip bg-surface border border-border font-semibold">
                {report.category}
              </span>
            </div>
          </div>

          {/* Resolved Ticket Notice */}
          {report.status === "resolved" && (
            <div className="p-3 bg-surface border border-border rounded-input space-y-1">
              <div className="text-emerald-500 font-semibold flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 stroke-[1.5]" />
                Resolved & Closed
              </div>
              <div className="text-[11px] text-muted">
                {report.resolved_at
                  ? `Resolved at: ${new Date(report.resolved_at).toLocaleString()}`
                  : "Resolution action recorded in audit log."}
              </div>
            </div>
          )}

          {/* Image Thumbnail Preview */}
          {report.photo_url && (
            <div>
              <div className="text-muted font-medium mb-1.5">Attached photo evidence</div>
              <div className="w-full aspect-[16/10] max-h-48 rounded-input overflow-hidden border border-border bg-bg">
                <img
                  src={report.photo_url}
                  alt={report.alt_text || "Incident photo"}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Incident Management Controls (Admin or Assigned Technician) */}
          {canManage && report.status !== "resolved" && (
            <div className="pt-4 border-t border-border space-y-3">
              <div className="font-semibold text-text text-sm">Incident Management</div>

              {isAdmin && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-muted font-medium mb-1">Status</label>
                    <select
                      value={newStatus}
                      onChange={(e) =>
                        setNewStatus(
                          e.target.value as "pending" | "assigned" | "in_progress" | "resolved"
                        )
                      }
                      className="w-full h-9 px-2 bg-bg border border-border rounded-input text-text text-xs focus:border-accent"
                    >
                      {report.status === "pending" && (
                        <>
                          <option value="pending">Pending (Unassigned)</option>
                          <option value="assigned">Assigned</option>
                        </>
                      )}
                      {report.status === "assigned" && (
                        <>
                          <option value="assigned">Assigned</option>
                          <option value="in_progress">In progress</option>
                        </>
                      )}
                      {report.status === "in_progress" && (
                        <>
                          <option value="in_progress">In progress</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-muted font-medium mb-1">Priority</label>
                    <select
                      value={newPriority}
                      onChange={(e) =>
                        setNewPriority(
                          e.target.value as "low" | "medium" | "high" | "critical"
                        )
                      }
                      className="w-full h-9 px-2 bg-bg border border-border rounded-input text-text text-xs focus:border-accent"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div>
                  <label className="block text-muted font-medium mb-1">Assign Technician</label>
                  <select
                    value={assignTo}
                    onChange={(e) => {
                      setAssignTo(e.target.value);
                      if (e.target.value && newStatus === "pending") {
                        setNewStatus("assigned");
                      }
                    }}
                    className="w-full h-9 px-2 bg-bg border border-border rounded-input text-text text-xs focus:border-accent"
                  >
                    <option value="">Unassigned</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.assigned_count} active tickets)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Technician Actions for Assigned ticket */}
              {!isAdmin && isAssignedTechnician && report.status === "assigned" && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setNewStatus("in_progress");
                      handleSave();
                    }}
                    disabled={saving}
                    className="w-full py-2 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
                  >
                    Start Work (Mark In Progress)
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                {/* Resolve only available if In Progress (or Assigned if technician starts work) */}
                {report.status !== "pending" && (
                  <button
                    type="button"
                    onClick={() => setShowResolve(!showResolve)}
                    className="px-3 py-1.5 rounded-input border border-border bg-bg text-text hover:bg-border/30 text-xs font-medium"
                  >
                    {showResolve ? "Cancel resolve" : "Log resolution"}
                  </button>
                )}

                {report.status === "pending" && (
                  <span className="text-[11px] text-muted self-center italic">
                    Assign a technician before resolving.
                  </span>
                )}

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-1.5 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save updates"}
                  </button>
                )}
              </div>

              {/* Resolution Form Drawer (Requires Action Text AC2.2) */}
              {showResolve && (
                <form
                  onSubmit={handleResolve}
                  className="p-3 bg-bg border border-border rounded-input space-y-2 mt-2"
                >
                  <div className="font-semibold text-text text-xs">Resolution Details</div>
                  <div>
                    <label className="block text-muted text-[11px] mb-1">
                      Action taken * (Required)
                    </label>
                    <input
                      type="text"
                      value={resolveAction}
                      onChange={(e) => setResolveAction(e.target.value)}
                      placeholder="e.g. Replaced burnt capacitor on ceiling fan"
                      className="w-full h-8 px-2 bg-surface border border-border rounded-input text-text text-xs focus:border-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-muted text-[11px] mb-1">Remarks</label>
                    <input
                      type="text"
                      value={resolveRemarks}
                      onChange={(e) => setResolveRemarks(e.target.value)}
                      placeholder="e.g. Tested at full speed for 10 minutes"
                      className="w-full h-8 px-2 bg-surface border border-border rounded-input text-text text-xs focus:border-accent"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={saving || !resolveAction.trim()}
                      className="px-3 py-1.5 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover disabled:opacity-50"
                    >
                      Confirm resolution
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
