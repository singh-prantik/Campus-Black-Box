"use client";

import React from "react";

interface StatusBadgeProps {
  status: "pending" | "assigned" | "in_progress" | "resolved" | string;
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In progress",
  resolved: "Resolved",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status?.toLowerCase() || "pending";
  const label = statusLabels[normalized] || status;

  const styleMap: Record<string, { bg: string; text: string; border: string }> = {
    pending: {
      bg: "var(--status-pending-bg)",
      text: "var(--status-pending-text)",
      border: "var(--status-pending-border)",
    },
    assigned: {
      bg: "var(--status-assigned-bg)",
      text: "var(--status-assigned-text)",
      border: "var(--status-assigned-border)",
    },
    in_progress: {
      bg: "var(--status-in_progress-bg)",
      text: "var(--status-in_progress-text)",
      border: "var(--status-in_progress-border)",
    },
    resolved: {
      bg: "var(--status-resolved-bg)",
      text: "var(--status-resolved-text)",
      border: "var(--status-resolved-border)",
    },
  };

  const style = styleMap[normalized] || {
    bg: "var(--surface)",
    text: "var(--muted)",
    border: "var(--border)",
  };

  return (
    <span
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-chip text-xs font-medium border"
    >
      <span
        style={{ backgroundColor: style.text }}
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}

interface PriorityBadgeProps {
  priority: "low" | "medium" | "high" | "critical" | string;
}

const priorityLabels: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const normalized = priority?.toLowerCase() || "medium";
  const label = priorityLabels[normalized] || priority;

  const styleMap: Record<string, { bg: string; text: string; border: string }> = {
    critical: {
      bg: "var(--prio-critical-bg)",
      text: "var(--prio-critical-text)",
      border: "var(--prio-critical-border)",
    },
    high: {
      bg: "var(--prio-high-bg)",
      text: "var(--prio-high-text)",
      border: "var(--prio-high-border)",
    },
    medium: {
      bg: "var(--prio-medium-bg)",
      text: "var(--prio-medium-text)",
      border: "var(--prio-medium-border)",
    },
    low: {
      bg: "var(--prio-low-bg)",
      text: "var(--prio-low-text)",
      border: "var(--prio-low-border)",
    },
  };

  const style = styleMap[normalized] || {
    bg: "var(--surface)",
    text: "var(--muted)",
    border: "var(--border)",
  };

  return (
    <span
      style={{
        backgroundColor: style.bg,
        color: style.text,
        borderColor: style.border,
      }}
      className="inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium border"
    >
      {label}
    </span>
  );
}
