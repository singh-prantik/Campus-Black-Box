"use client";

import React, { useState, useEffect } from "react";
import { Report } from "@/types";
import { apiFetchProtectedPhoto } from "@/lib/api";
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

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffSec = Math.max(1, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function ReportCard({ report, onClick, index = 0, showPriority = false }: ReportCardProps) {
  const [imgError, setImgError] = useState(false);
  const [resolvedImgUrl, setResolvedImgUrl] = useState<string | null>(null);
  const rawPhoto = report.photo_path || report.photo_url || "";

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImgError(false);

    if (!rawPhoto) {
      setResolvedImgUrl(null);
      return;
    }

    if (rawPhoto.includes("/api/photos/")) {
      apiFetchProtectedPhoto(rawPhoto)
        .then((url) => {
          if (!active) {
            if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
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
  }, [rawPhoto]);

  const catKey = report.category?.toLowerCase() || "";
  const CategoryIcon = categoryIcons[catKey] || HelpCircle;

  // Format Location: "Block 3 · Room 302"
  const blockName = report.location?.block || report.block;
  const roomName = report.location?.room || report.room;
  const locationString =
    blockName && roomName
      ? `${blockName} · ${roomName}`
      : blockName || roomName || "Campus location";

  // Reporter Role
  const reporterRole = report.reporter_role || report.reporter?.role || "Student";
  const formattedRole =
    reporterRole.charAt(0).toUpperCase() + reporterRole.slice(1).toLowerCase();

  const title = report.title || report.description?.slice(0, 48) || "Incident";
  const timeSince = formatRelativeTime(report.created_at);

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
        {resolvedImgUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedImgUrl}
            alt={report.alt_text || report.title || "Incident thumbnail"}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain bg-white transition-transform duration-200 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-muted">
            <CategoryIcon className="w-8 h-8 stroke-[1.5]" />
            <span className="text-xs uppercase font-medium tracking-wide">
              {report.category}
            </span>
          </div>
        )}

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
        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>{timeSince}</span>
          </div>
          <div>
            <span>Reported by: </span>
            <span className="font-medium text-text">{formattedRole}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
