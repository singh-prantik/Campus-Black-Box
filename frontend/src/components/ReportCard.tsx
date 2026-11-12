"use client";

import React, { useState, useEffect } from "react";
import { Report } from "@/types";
import { apiFetchProtectedPhoto } from "@/lib/api";
import { formatFullTimestamp, formatRelativeTime } from "@/lib/time";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import {
  MapPin,
  Clock,
  Copy,
  Zap,
  Droplets,
  Wrench,
  Wifi,
  ShieldAlert,
  Armchair,
  Sparkles,
  HelpCircle,
  Accessibility,
} from "lucide-react";

interface ReportCardProps {
  report: Report;
  onClick?: () => void;
  index?: number;
  showPriority?: boolean;
  showReporterIdentity?: boolean;
  fetchPhoto?: (report: Report) => Promise<string | null>;
}

const categoryIcons: Record<string, React.ElementType> = {
  electrical: Zap,
  water: Droplets,
  equipment: Wrench,
  "it/wi-fi": Wifi,
  wifi: Wifi,
  safety: ShieldAlert,
  cleanliness: Sparkles,
  furniture: Armchair,
  accessibility: Accessibility,
};

function formatRoleLabel(role: string | null | undefined): string {
  const lower = String(role || "student").toLowerCase();
  if (lower === "faculty") return "Faculty";
  if (lower === "maintenance" || lower === "technician") return "Technician";
  if (lower === "admin" || lower === "super_admin") return "Admin";
  return "Student";
}

export default function ReportCard({
  report,
  onClick,
  index = 0,
  showPriority = false,
  showReporterIdentity = false,
  fetchPhoto,
}: ReportCardProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [resolvedImgUrl, setResolvedImgUrl] = useState<string | null>(null);
  const rawPhoto = report.photo_path || report.photo_url || "";
  const shouldFetchPhoto = Boolean(fetchPhoto ? report.has_photo || rawPhoto : rawPhoto);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImgError(false);
    setImgLoaded(false);

    if (!shouldFetchPhoto) {
      setResolvedImgUrl(null);
      return;
    }

    if (fetchPhoto) {
      fetchPhoto(report)
        .then((url) => {
          if (!active) {
            if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
            return;
          }
          if (!url) {
            setImgError(true);
            return;
          }
          objectUrl = url;
          setResolvedImgUrl(url);
        })
        .catch(() => {
          if (active) setImgError(true);
        });
    } else if (rawPhoto.includes("/api/photos/")) {
      apiFetchProtectedPhoto(rawPhoto)
        .then((url) => {
          if (!active) {
            if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
            return;
          }
          if (!url) {
            setImgError(true);
            return;
          }
          objectUrl = url;
          setResolvedImgUrl(url);
        })
        .catch(() => {
          if (active) setImgError(true);
        });
    } else {
      setResolvedImgUrl(rawPhoto);
    }

    return () => {
      active = false;
      if (objectUrl && objectUrl.startsWith("blob:")) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [rawPhoto, shouldFetchPhoto, fetchPhoto, report]);

  const catKey = report.category?.toLowerCase() || "";
  const CategoryIcon = categoryIcons[catKey] || HelpCircle;

  // Format Location: "Block 3 · Room 302"
  const blockName = report.location?.block || report.block;
  const roomName = report.location?.room || report.room;
  const locationString =
    blockName && roomName
      ? `${blockName} · ${roomName}`
      : blockName || roomName || "Location unavailable";

  const roleLabel = formatRoleLabel(report.reporter_role || report.reporter?.role);
  const reporterDisplay = showReporterIdentity
    ? report.reporter_name
      ? `${report.reporter_name} (${roleLabel})`
      : roleLabel
    : "You";

  const title = report.title || report.description?.slice(0, 48) || "Incident";
  const timeSince = formatRelativeTime(report.created_at);
  const fullTimestamp = formatFullTimestamp(report.created_at);

  return (
    <article
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      style={{
        animationDelay: `${index * 40}ms`,
      }}
      className="animate-card-enter group flex flex-col bg-surface border border-border rounded-card overflow-hidden cursor-pointer transition-colors duration-150 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* 16:10 Thumbnail */}
      <div className="relative w-full aspect-[16/10] bg-bg border-b border-border overflow-hidden flex items-center justify-center">
        {(!resolvedImgUrl || imgError || !imgLoaded) && (
          <div className="flex flex-col items-center justify-center gap-2 text-muted">
            <CategoryIcon className="w-8 h-8 stroke-[1.5]" />
            <span className="text-xs uppercase font-medium tracking-wide">
              {report.category}
            </span>
          </div>
        )}
        {resolvedImgUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImgUrl}
            alt={report.alt_text || report.title || "Incident thumbnail"}
            onLoad={(e) => {
              if (e.currentTarget.naturalWidth <= 1 && e.currentTarget.naturalHeight <= 1) {
                setImgError(true);
              } else {
                setImgLoaded(true);
              }
            }}
            onError={() => setImgError(true)}
            className={`w-full h-full object-contain bg-surface transition-transform duration-200 group-hover:scale-[1.02] ${
              imgLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
            }`}
            loading="lazy"
          />
        ) : null}

        {/* Similar Count Tag (if any) */}
        {report.similar_count && report.similar_count > 0 ? (
          <div
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-chip text-[11px] font-medium bg-surface border border-border text-text"
            title={`${report.similar_count} similar incidents reported`}
          >
            <Copy className="w-3 h-3 stroke-[1.5]" />
            <span>{report.similar_count}</span>
          </div>
        ) : null}
      </div>

      {/* Card Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Status Row (Priority shown only on staff triage views) */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <StatusBadge status={report.status} />
            {showPriority && report.priority ? <PriorityBadge priority={report.priority} /> : null}
            <span className="text-xs text-muted ml-auto">{report.category}</span>
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-text line-clamp-2 mb-1.5 group-hover:text-accent transition-colors">
            {title}
          </h3>

          {/* Location */}
          <div className="flex items-center gap-1.5 text-xs text-muted mb-3">
            <MapPin className="w-3.5 h-3.5 stroke-[1.5] flex-shrink-0" />
            <span className="truncate">{locationString}</span>
          </div>
        </div>

        {/* Footer Meta */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted gap-2">
          <div className="flex items-center gap-1 shrink-0" title={fullTimestamp}>
            <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>{timeSince}</span>
          </div>
          <div className="truncate">
            <span>Reported by </span>
            <span className="font-medium text-text">{reporterDisplay}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
