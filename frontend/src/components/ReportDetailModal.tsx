"use client";

import React, { useState, useEffect } from "react";
import { Report } from "@/types";
import { apiGetReport, apiFetchProtectedPhoto } from "@/lib/api";
import { StatusBadge } from "./StatusBadge";
import { X, MapPin, Clock, CheckCircle2, Image as ImageIcon } from "lucide-react";

const statusSteps = ["submitted", "pending", "assigned", "in_progress", "resolved"];
const statusStepLabels: Record<string, string> = {
  submitted: "Submitted",
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
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
}: ReportDetailModalProps) {
  const [detailedReport, setDetailedReport] = useState<Report>(report);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    let active = true;
    apiGetReport(report.id)
      .then((res) => {
        if (active && res?.report) {
          setDetailedReport(res.report);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [report.id]);

  const rawPhoto = detailedReport.photo_path || detailedReport.photo_url || "";

  useEffect(() => {
    let active = true;
    let blobUrl: string | null = null;
    setPhotoError(false);

    if (!rawPhoto) {
      setPhotoSrc(null);
      return;
    }

    if (rawPhoto.includes("/api/photos/")) {
      apiFetchProtectedPhoto(rawPhoto)
        .then((url) => {
          if (!active) {
            if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
            return;
          }
          blobUrl = url;
          setPhotoSrc(url);
        })
        .catch(() => {
          if (active) setPhotoError(true);
        });
    } else {
      setPhotoSrc(rawPhoto);
    }

    return () => {
      active = false;
      if (blobUrl && blobUrl.startsWith("blob:")) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [rawPhoto]);

  const currentStepIdx = statusSteps.indexOf(detailedReport.status);
  const blockName = detailedReport.location?.block || detailedReport.block;
  const roomName = detailedReport.location?.room || detailedReport.room;
  const locationString =
    blockName && roomName
      ? `${blockName} · ${roomName}`
      : blockName || roomName || "Campus location";

  const resolutionAction =
    detailedReport.resolution_action ||
    detailedReport.resolutions?.[0]?.action ||
    null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Incident #${detailedReport.id} Details`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface border border-border rounded-modal p-6 space-y-5 animate-dropdown shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted font-medium">
                Incident #{detailedReport.id}
              </span>
              <StatusBadge status={detailedReport.status} />
              <span className="text-xs font-medium text-accent">{detailedReport.category}</span>
            </div>
            <h2 className="text-lg font-bold text-text leading-snug">
              {detailedReport.title || detailedReport.description?.slice(0, 72)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close detail dialog"
            className="p-1.5 rounded-input text-muted hover:text-text hover:bg-bg border border-transparent hover:border-border transition-colors"
          >
            <X className="w-5 h-5 stroke-[1.5]" />
          </button>
        </div>

        {/* Status Timeline */}
        <div className="p-4 rounded-card bg-bg border border-border">
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Resolution Progress
          </div>
          <div className="flex items-center justify-between gap-2 overflow-x-auto">
            {statusSteps.map((step, idx) => {
              const completed = idx <= currentStepIdx;
              return (
                <div key={step} className="flex items-center gap-2 flex-1 min-w-[80px]">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      completed
                        ? "bg-accent text-white"
                        : "bg-surface border border-border text-muted"
                    }`}
                  >
                    {idx < currentStepIdx ? "✓" : idx + 1}
                  </div>
                  <span
                    className={`text-xs font-medium truncate ${
                      completed ? "text-text" : "text-muted"
                    }`}
                  >
                    {statusStepLabels[step]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Location & Timestamp */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-input bg-bg border border-border flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-accent shrink-0" />
            <div>
              <div className="text-[11px] text-muted">Location</div>
              <div className="font-semibold text-text">{locationString}</div>
            </div>
          </div>
          <div className="p-3 rounded-input bg-bg border border-border flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-muted shrink-0" />
            <div>
              <div className="text-[11px] text-muted">Submitted</div>
              <div className="font-semibold text-text">
                {new Date(detailedReport.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* Photo */}
        {photoSrc && !photoError && (
          <div className="rounded-input overflow-hidden border border-border bg-white p-2 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoSrc}
              alt={`Attached evidence for incident #${detailedReport.id}`}
              onError={() => setPhotoError(true)}
              className="max-h-64 w-full object-contain rounded"
            />
          </div>
        )}
        {!photoSrc && rawPhoto && (
          <div className="p-4 rounded-input border border-border bg-bg text-xs text-muted flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            <span>Loading attached photo...</span>
          </div>
        )}

        {/* Description */}
        <div>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">
            Description
          </div>
          <p className="text-sm text-text leading-relaxed bg-bg p-3.5 rounded-input border border-border">
            {detailedReport.description}
          </p>
        </div>

        {/* Resolution Action Text (reporter-visible summary, never internal remarks) */}
        {resolutionAction && (
          <div className="p-3.5 rounded-input border border-green-500/30 bg-green-500/10 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              Resolution Summary
            </div>
            <p className="text-xs text-text leading-relaxed">{resolutionAction}</p>
          </div>
        )}

        {/* Status Timeline Log */}
        {detailedReport.timeline && detailedReport.timeline.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Status Timeline
            </div>
            <div className="space-y-1.5">
              {detailedReport.timeline.map((step, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-input bg-bg border border-border text-xs"
                >
                  <span className="text-text font-medium capitalize">
                    {step.from_status ? `${step.from_status.replace("_", " ")} → ` : ""}
                    {step.to_status.replace("_", " ")}
                  </span>
                  <span className="text-muted text-[11px]">
                    {new Date(step.changed_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
