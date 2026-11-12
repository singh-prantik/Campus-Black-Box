"use client";

import React, { useEffect, useMemo, useState } from "react";
import { BlocksSummaryResponse, BlockSummaryItem, Report } from "@/types";
import { formatFullTimestamp, formatRelativeTime } from "@/lib/time";
import { StatusBadge, PriorityBadge } from "./StatusBadge";
import StaffReportModal from "./StaffReportModal";
import PhotoLightboxModal from "./PhotoLightboxModal";
import { MapPin, Camera, Clock, Info, RefreshCw } from "lucide-react";

interface CampusMapProps {
  summary: BlocksSummaryResponse | null;
  windowRange: "7d" | "30d" | "all";
  onWindowChange: (win: "7d" | "30d" | "all") => void;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

type StatusFilter = "all" | "pending" | "assigned" | "in_progress" | "resolved";

function getHeatLevel(openCount: number, maxOpen: number): 0 | 1 | 2 | 3 | 4 {
  if (openCount <= 0 || maxOpen <= 0) return 0;
  const ratio = openCount / maxOpen;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function formatRoleLabel(role: string | null | undefined): string {
  const lower = String(role || "student").toLowerCase();
  if (lower === "faculty") return "Faculty";
  if (lower === "maintenance" || lower === "technician") return "Technician";
  return "Student";
}

export default function CampusMap({
  summary,
  windowRange,
  onWindowChange,
  loading = false,
  error = null,
  onRefresh,
}: CampusMapProps) {
  const blocks = useMemo(() => summary?.blocks || [], [summary]);
  const [selectedBlockName, setSelectedBlockName] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [modalReport, setModalReport] = useState<Report | null>(null);
  const [photoReport, setPhotoReport] = useState<Report | null>(null);

  useEffect(() => {
    if (blocks.length === 0) return;
    if (!selectedBlockName || !blocks.some((b) => b.block === selectedBlockName)) {
      const busiest = [...blocks].sort((a, b) => b.open - a.open || b.total - a.total)[0];
      setSelectedBlockName(busiest?.block || blocks[0].block);
    }
  }, [blocks, selectedBlockName]);

  const activeBlock: BlockSummaryItem | null = useMemo(() => {
    return blocks.find((b) => b.block === selectedBlockName) || blocks[0] || null;
  }, [blocks, selectedBlockName]);

  const maxOpen = summary?.totals?.busiest_open_count || 0;

  const filteredIncidents = useMemo(() => {
    if (!activeBlock) return [];
    if (statusFilter === "all") return activeBlock.incidents;
    return activeBlock.incidents.filter((r) => r.status === statusFilter);
  }, [activeBlock, statusFilter]);

  return (
    <div className="w-full bg-surface border border-border rounded-card p-6 text-text space-y-6">
      {/* Header & Window Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border pb-4">
        <div>
          <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
            Campus Telemetry Grid
          </span>
          <h2 className="text-lg font-bold text-text">Campus Heat Map</h2>
          <p className="text-xs text-muted mt-0.5">
            Live incident counts from the database across every campus block.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Time window filter"
            className="inline-flex rounded-input border border-border bg-bg p-0.5"
          >
            {(
              [
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
                { value: "all", label: "All time" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onWindowChange(opt.value)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  windowRange === opt.value
                    ? "bg-accent text-white"
                    : "text-muted hover:text-text"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-input border border-border bg-bg text-xs font-medium text-text hover:border-accent"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Campus-wide KPI Parity Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-3 bg-bg border border-border rounded-input">
            <div className="text-[11px] text-muted">Total Incidents</div>
            <div className="text-lg font-bold text-text mt-0.5">
              {summary.totals.total_reports}
            </div>
          </div>
          <div className="p-3 bg-bg border border-border rounded-input">
            <div className="text-[11px] text-muted">Pending</div>
            <div className="text-lg font-bold text-text mt-0.5">
              {summary.totals.pending_reports}
            </div>
          </div>
          <div className="p-3 bg-bg border border-border rounded-input">
            <div className="text-[11px] text-muted">Assigned</div>
            <div className="text-lg font-bold text-text mt-0.5">
              {summary.totals.assigned_reports}
            </div>
          </div>
          <div className="p-3 bg-bg border border-border rounded-input">
            <div className="text-[11px] text-muted">In Progress</div>
            <div className="text-lg font-bold text-text mt-0.5">
              {summary.totals.in_progress_reports}
            </div>
          </div>
          <div className="p-3 bg-bg border border-border rounded-input">
            <div className="text-[11px] text-muted">Resolved</div>
            <div className="text-lg font-bold text-text mt-0.5">
              {summary.totals.resolved_reports}
            </div>
          </div>
          <div className="p-3 bg-bg border border-border rounded-input">
            <div className="text-[11px] text-muted">Avg Resolution</div>
            <div className="text-sm font-bold text-text mt-1">
              {summary.totals.has_resolved_tickets
                ? `${summary.totals.avg_resolution_hours}h`
                : "No resolved tickets yet"}
            </div>
          </div>
        </div>
      )}

      {/* Single-Hue Discrete Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="flex items-center gap-2">
          <span>Fewer open incidents</span>
          <div className="flex items-center gap-1" aria-label="5-step single-hue intensity scale">
            {([0, 1, 2, 3, 4] as const).map((step) => (
              <span
                key={step}
                style={{
                  backgroundColor: `var(--heat-${step}-bg)`,
                  color: `var(--heat-${step}-fg)`,
                  borderColor: `var(--heat-${step}-border)`,
                }}
                className="w-6 h-5 rounded border text-[10px] font-semibold inline-flex items-center justify-center"
                title={`Density step ${step}`}
              >
                {step}
              </span>
            ))}
          </div>
          <span>More</span>
        </div>
        <span className="text-[11px] text-muted">
          Scale normalized to busiest block ({maxOpen} open)
        </span>
      </div>

      {error && (
        <div className="p-4 rounded-input border border-border bg-bg text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Blocks Grid */}
      {loading && !summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, idx) => (
            <div
              key={idx}
              className="h-36 rounded-card bg-bg border border-border animate-pulse"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {blocks.map((b) => {
            const level = getHeatLevel(b.open, maxOpen);
            const isSelected = activeBlock?.block === b.block;
            const totalSafe = Math.max(1, b.total);
            return (
              <button
                key={b.block}
                type="button"
                onClick={() => {
                  setSelectedBlockName(b.block);
                  setStatusFilter("all");
                }}
                style={{
                  backgroundColor: `var(--heat-${level}-bg)`,
                  color: `var(--heat-${level}-fg)`,
                  borderColor: isSelected ? "var(--accent)" : `var(--heat-${level}-border)`,
                }}
                className={`text-left p-4 rounded-card border transition-colors ${
                  isSelected ? "ring-2 ring-accent" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-sm">{b.block}</span>
                  <span
                    style={{
                      borderColor: `var(--heat-${level}-border)`,
                      color: `var(--heat-${level}-fg)`,
                    }}
                    className="px-2 py-0.5 rounded-chip text-[11px] font-semibold border"
                  >
                    {b.open} open
                  </span>
                </div>

                <div
                  style={{ color: `var(--heat-${level}-muted)` }}
                  className="text-[11px] mb-3"
                >
                  {b.total} total · {b.location_count} rooms/areas
                </div>

                {/* Single-hue segmented status bar */}
                <div
                  className="w-full h-2 rounded overflow-hidden flex border mb-2.5"
                  style={{ borderColor: `var(--heat-${level}-border)` }}
                  aria-label={`${b.block} status distribution`}
                >
                  {b.total === 0 ? (
                    <div
                      className="w-full h-full"
                      style={{ backgroundColor: "var(--heat-0-bg)" }}
                    />
                  ) : (
                    <>
                      {b.pending > 0 && (
                        <div
                          style={{
                            width: `${(b.pending / totalSafe) * 100}%`,
                            backgroundColor: "var(--heat-4-bg)",
                          }}
                          title={`Pending: ${b.pending}`}
                        />
                      )}
                      {b.assigned > 0 && (
                        <div
                          style={{
                            width: `${(b.assigned / totalSafe) * 100}%`,
                            backgroundColor: "var(--heat-3-bg)",
                          }}
                          title={`Assigned: ${b.assigned}`}
                        />
                      )}
                      {b.in_progress > 0 && (
                        <div
                          style={{
                            width: `${(b.in_progress / totalSafe) * 100}%`,
                            backgroundColor: "var(--heat-2-bg)",
                          }}
                          title={`In progress: ${b.in_progress}`}
                        />
                      )}
                      {b.resolved > 0 && (
                        <div
                          style={{
                            width: `${(b.resolved / totalSafe) * 100}%`,
                            backgroundColor: "var(--heat-1-bg)",
                          }}
                          title={`Resolved: ${b.resolved}`}
                        />
                      )}
                    </>
                  )}
                </div>

                <div
                  style={{ color: `var(--heat-${level}-muted)` }}
                  className="text-[11px] flex items-center justify-between"
                >
                  <span>Avg fix:</span>
                  <span style={{ color: `var(--heat-${level}-fg)` }} className="font-semibold">
                    {b.has_resolved ? `${b.avg_resolution_hours}h` : "None yet"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Selected Block Drill-Down Inspection Panel */}
      {activeBlock && (
        <div className="p-5 bg-bg border border-border rounded-card text-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent stroke-[1.5]" />
              <span className="text-sm font-bold text-text">
                {activeBlock.block} ({activeBlock.total} total incidents)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted">
              <Info className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>{summary?.notice || "Patterns are leads to investigate, not proven causes."}</span>
            </div>
          </div>

          {/* 4 Separate Status Counts (clickable filters) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            {(
              [
                { key: "pending", label: "Pending", count: activeBlock.pending },
                { key: "assigned", label: "Assigned", count: activeBlock.assigned },
                { key: "in_progress", label: "In progress", count: activeBlock.in_progress },
                { key: "resolved", label: "Resolved", count: activeBlock.resolved },
              ] as const
            ).map((s) => {
              const active = statusFilter === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStatusFilter(active ? "all" : s.key)}
                  className={`p-3 rounded-input border text-center transition-colors ${
                    active
                      ? "bg-accent/10 border-accent text-text"
                      : "bg-surface border-border hover:border-accent/50"
                  }`}
                >
                  <div className="text-muted text-[11px]">{s.label}</div>
                  <div className="text-base font-bold text-text mt-0.5">{s.count}</div>
                </button>
              );
            })}

            <div className="p-3 bg-surface border border-border rounded-input text-center">
              <div className="text-muted text-[11px]">Avg Fix Duration</div>
              <div className="text-sm font-bold text-text mt-1">
                {activeBlock.has_resolved
                  ? `${activeBlock.avg_resolution_hours} hrs`
                  : "No resolved tickets yet"}
              </div>
            </div>
          </div>

          {/* Top Categories */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Top categories:
            </span>
            {activeBlock.top_categories.length === 0 ? (
              <span className="text-[11px] text-muted">No incidents in this window</span>
            ) : (
              activeBlock.top_categories.map((tc) => (
                <span
                  key={tc.category}
                  className="px-2.5 py-0.5 rounded-chip bg-surface border border-border text-[11px] font-medium text-text"
                >
                  {tc.category} ({tc.count})
                </span>
              ))
            )}
          </div>

          {/* Incidents List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">
                Incidents in {activeBlock.block}{" "}
                {statusFilter !== "all" ? `(${statusFilter.replace("_", " ")})` : ""}
              </h3>
              {statusFilter !== "all" && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="text-[11px] text-accent hover:underline"
                >
                  Show all statuses ({activeBlock.incidents.length})
                </button>
              )}
            </div>

            {filteredIncidents.length === 0 ? (
              <div className="p-6 text-center bg-surface border border-border rounded-input text-muted">
                No matching incidents in {activeBlock.block}.
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-input bg-surface overflow-hidden">
                {filteredIncidents.map((inc) => {
                  const fullTs = formatFullTimestamp(inc.created_at);
                  const relTs = formatRelativeTime(inc.created_at);
                  const roleLabel = formatRoleLabel(inc.reporter_role);
                  const reporterStr = inc.reporter_name
                    ? `${inc.reporter_name} (${roleLabel})`
                    : roleLabel;
                  return (
                    <div
                      key={inc.id}
                      onClick={() => setModalReport(inc)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setModalReport(inc);
                        }
                      }}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-bg cursor-pointer transition-colors"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[11px] text-muted">#{inc.id}</span>
                          <StatusBadge status={inc.status} />
                          {inc.priority && <PriorityBadge priority={inc.priority} />}
                          <span className="text-[11px] font-medium text-accent">
                            {inc.category}
                          </span>
                          <span className="text-[11px] text-muted">
                            {inc.room || inc.location?.room || ""}
                          </span>
                        </div>
                        <div className="text-xs font-medium text-text truncate">
                          {inc.description}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted flex-wrap">
                          <span>Reported by {reporterStr}</span>
                          <span className="inline-flex items-center gap-1" title={fullTs}>
                            <Clock className="w-3 h-3" />
                            {fullTs} ({relTs})
                          </span>
                          {inc.assignee_name && <span>Assignee: {inc.assignee_name}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {Boolean(inc.has_photo) && (
                          <button
                            type="button"
                            aria-label="View photo proof"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPhotoReport(inc);
                            }}
                            className="p-1.5 rounded-input border border-border bg-bg text-muted hover:text-accent hover:border-accent"
                          >
                            <Camera className="w-4 h-4 stroke-[1.5]" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {modalReport && (
        <StaffReportModal
          report={modalReport}
          onClose={() => setModalReport(null)}
          onUpdate={() => {
            onRefresh?.();
          }}
        />
      )}

      {photoReport && (
        <PhotoLightboxModal
          reportId={photoReport.id}
          title={photoReport.description?.slice(0, 48)}
          onClose={() => setPhotoReport(null)}
        />
      )}
    </div>
  );
}
