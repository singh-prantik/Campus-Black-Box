/**
 * Centralized UTC timestamp parser and local-timezone formatter.
 * All DB timestamps are normalized as UTC before conversion to the user's local timezone.
 */

const EN_IN_DATETIME = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function parseUtcTimestamp(raw: string | null | undefined): Date | null {
  if (!raw || typeof raw !== "string") return null;
  let normalized = raw.trim();
  if (!normalized) return null;

  // Legacy SQLite datetime('now') values omit 'T' and 'Z' despite being UTC.
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
    normalized = `${normalized.replace(" ", "T")}Z`;
  } else if (!/[zZ]$/.test(normalized) && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatFullTimestamp(raw: string | null | undefined): string {
  const d = parseUtcTimestamp(raw);
  if (!d) return "Unknown time";
  return EN_IN_DATETIME.format(d).replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
}

export function formatRelativeTime(
  raw: string | null | undefined,
  nowMs: number = Date.now()
): string {
  const d = parseUtcTimestamp(raw);
  if (!d) return "Unknown time";

  const diffMs = Math.max(0, nowMs - d.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}

export function formatTimestampParts(
  raw: string | null | undefined,
  nowMs: number = Date.now()
): { full: string; relative: string } {
  return {
    full: formatFullTimestamp(raw),
    relative: formatRelativeTime(raw, nowMs),
  };
}

