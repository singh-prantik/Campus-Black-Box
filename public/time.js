(function (global) {
  "use strict";

  const enInFormatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  function parseUtcTimestamp(raw) {
    if (!raw || typeof raw !== "string") return null;
    let normalized = raw.trim();
    if (!normalized) return null;

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
      normalized = normalized.replace(" ", "T") + "Z";
    } else if (!/[zZ]$/.test(normalized) && !/[+-]\d{2}:?\d{2}$/.test(normalized)) {
      normalized = normalized + "Z";
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function formatFullTimestamp(raw) {
    const d = parseUtcTimestamp(raw);
    if (!d) return "Unknown time";
    return enInFormatter.format(d).replace(/\b(am|pm)\b/gi, function (m) {
      return m.toUpperCase();
    });
  }

  function formatRelativeTime(raw, nowMs) {
    const d = parseUtcTimestamp(raw);
    if (!d) return "Unknown time";
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    const diffMs = Math.max(0, now - d.getTime());
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "just now";

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return diffMin + " min ago";

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + " hr ago";

    const diffDays = Math.floor(diffHr / 24);
    return diffDays + " " + (diffDays === 1 ? "day" : "days") + " ago";
  }

  function formatTimestampParts(raw, nowMs) {
    return {
      full: formatFullTimestamp(raw),
      relative: formatRelativeTime(raw, nowMs),
    };
  }

  global.CBBTime = {
    parseUtcTimestamp: parseUtcTimestamp,
    formatFullTimestamp: formatFullTimestamp,
    formatRelativeTime: formatRelativeTime,
    formatTimestampParts: formatTimestampParts,
  };
})(typeof window !== "undefined" ? window : globalThis);

