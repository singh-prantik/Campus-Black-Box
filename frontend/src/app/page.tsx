"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import ReportCard from "@/components/ReportCard";
import ReportDetailModal from "@/components/ReportDetailModal";
import { Report } from "@/types";
import { apiGetReports, apiGetAnalyticsSummary } from "@/lib/api";
import {
  Plus,
  X,
  AlertCircle,
  Inbox,
  RefreshCw,
} from "lucide-react";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Active filters from URL
  const statusParam = searchParams.get("status") || "all";
  const priorityParam = searchParams.get("priority") || "";
  const scopeParam = searchParams.get("scope") || "";
  const blockParam = searchParams.get("block") || "";
  const categoryParam = searchParams.get("category") || "";
  const searchParam = searchParams.get("q") || "";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Summary counts
  const [summary, setSummary] = useState({
    open: 0,
    inProgress: 0,
    resolved: 0,
  });

  // Mobile floating button visibility
  const [showFloatingBtn, setShowFloatingBtn] = useState(true);
  const lastScrollY = useRef(0);

  // Scroll listener for mobile report button (hide on scroll down, show on scroll up)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        setShowFloatingBtn(false);
      } else {
        setShowFloatingBtn(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Update URL Query Parameters
  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router, searchParams]
  );

  const clearAllFilters = () => {
    router.replace("/", { scroll: false });
  };

  const isFilterActive =
    statusParam !== "all" ||
    !!priorityParam ||
    !!scopeParam ||
    !!blockParam ||
    !!categoryParam ||
    !!searchParam;

  // Load Reports
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, sumRes] = await Promise.all([
        apiGetReports(),
        apiGetAnalyticsSummary(),
      ]);
      setReports(res.reports);
      setSummary({
        open: sumRes.open_reports,
        inProgress: sumRes.in_progress_reports || 2,
        resolved: sumRes.resolved_reports,
      });
    } catch (err: any) {
      setError(err?.message || "Failed to load incidents. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute Live Filter Counts
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: reports.length,
      pending: 0,
      assigned: 0,
      in_progress: 0,
      resolved: 0,
      critical: 0,
      high: 0,
      "Block 1": 0,
      "Block 2": 0,
      "Block 3": 0,
      "Block 4": 0,
      my_incidents: 0,
      assigned_to_me: 0,
    };

    reports.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status]++;
      if (counts[r.priority] !== undefined) counts[r.priority]++;
      if (r.location?.block && counts[r.location.block] !== undefined) {
        counts[r.location.block]++;
      }
      if (r.reporter_role === "Student" || r.reporter_role === "Faculty") {
        counts.my_incidents++;
      }
      if (r.assigned_to || r.reporter_role === "Technician") {
        counts.assigned_to_me++;
      }
    });

    return counts;
  }, [reports]);

  // Filtered Incident List
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      // Search
      if (searchParam) {
        const q = searchParam.toLowerCase();
        const matches =
          r.title?.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.location?.room.toLowerCase().includes(q) ||
          r.location?.block.toLowerCase().includes(q) ||
          `#${r.id}`.includes(q) ||
          r.category.toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Status
      if (statusParam && statusParam !== "all") {
        if (r.status !== statusParam) return false;
      }

      // Priority
      if (priorityParam) {
        if (r.priority !== priorityParam) return false;
      }

      // Block
      if (blockParam) {
        if (r.location?.block !== blockParam) return false;
      }

      // Category
      if (categoryParam) {
        if (r.category !== categoryParam) return false;
      }

      // Scope
      if (scopeParam === "my_incidents") {
        if (r.reporter_role !== "Student" && r.reporter_role !== "Faculty") return false;
      }
      if (scopeParam === "assigned_to_me") {
        if (!r.assigned_to && r.reporter_role !== "Technician") return false;
      }

      return true;
    });
  }, [reports, searchParam, statusParam, priorityParam, blockParam, categoryParam, scopeParam]);

  return (
    <div className="min-h-screen bg-bg text-text pb-20">
      {/* 1) Sticky Header with Navbar & Autocomplete Search */}
      <Navbar
        searchValue={searchParam}
        onSearchChange={(val) => updateFilter("q", val)}
      />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-3 sm:pt-4">
        {/* Error / Offline Retry Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-card bg-surface border border-border flex items-center justify-between text-xs text-text">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-accent stroke-[1.5]" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1 font-semibold text-accent hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5 stroke-[1.5]" />
              Retry
            </button>
          </div>
        )}

        {/* 2) Horizontally Scrolling Filter Chips Row */}
        <section aria-label="Incident filter chips" className="mb-3 sm:mb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* Status (Single Select) */}
            <button
              type="button"
              onClick={() => updateFilter("status", "all")}
              aria-pressed={statusParam === "all"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                statusParam === "all"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>All</span>
              <span className="text-[11px] opacity-75">{filterCounts.all}</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", statusParam === "pending" ? "all" : "pending")}
              aria-pressed={statusParam === "pending"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                statusParam === "pending"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>Pending</span>
              <span className="text-[11px] opacity-75">{filterCounts.pending}</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", statusParam === "assigned" ? "all" : "assigned")}
              aria-pressed={statusParam === "assigned"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                statusParam === "assigned"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>Assigned</span>
              <span className="text-[11px] opacity-75">{filterCounts.assigned}</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", statusParam === "in_progress" ? "all" : "in_progress")}
              aria-pressed={statusParam === "in_progress"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                statusParam === "in_progress"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>In progress</span>
              <span className="text-[11px] opacity-75">{filterCounts.in_progress}</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", statusParam === "resolved" ? "all" : "resolved")}
              aria-pressed={statusParam === "resolved"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                statusParam === "resolved"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>Resolved</span>
              <span className="text-[11px] opacity-75">{filterCounts.resolved}</span>
            </button>

            <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />

            {/* Priority Chips */}
            <button
              type="button"
              onClick={() => updateFilter("priority", priorityParam === "critical" ? "" : "critical")}
              aria-pressed={priorityParam === "critical"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                priorityParam === "critical"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>Critical</span>
              <span className="text-[11px] opacity-75">{filterCounts.critical}</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("priority", priorityParam === "high" ? "" : "high")}
              aria-pressed={priorityParam === "high"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                priorityParam === "high"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>High</span>
              <span className="text-[11px] opacity-75">{filterCounts.high}</span>
            </button>

            <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />

            {/* Scope Chips */}
            <button
              type="button"
              onClick={() => updateFilter("scope", scopeParam === "my_incidents" ? "" : "my_incidents")}
              aria-pressed={scopeParam === "my_incidents"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                scopeParam === "my_incidents"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>My incidents</span>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("scope", scopeParam === "assigned_to_me" ? "" : "assigned_to_me")}
              aria-pressed={scopeParam === "assigned_to_me"}
              className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                scopeParam === "assigned_to_me"
                  ? "bg-text text-bg border-text font-semibold"
                  : "bg-surface border-border text-muted hover:text-text"
              }`}
            >
              <span>Assigned to me</span>
            </button>

            <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />

            {/* Block Chips (Block 1, Block 2, Block 3, Block 4) */}
            {["Block 1", "Block 2", "Block 3", "Block 4"].map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => updateFilter("block", blockParam === b ? "" : b)}
                aria-pressed={blockParam === b}
                className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                  blockParam === b
                    ? "bg-text text-bg border-text font-semibold"
                    : "bg-surface border-border text-muted hover:text-text"
                }`}
              >
                <span>{b}</span>
                <span className="text-[11px] opacity-75">{filterCounts[b] || 0}</span>
              </button>
            ))}

            <div className="h-4 w-px bg-border mx-1 flex-shrink-0" />

            {/* Category Chips */}
            {[
              "Electrical",
              "IT/Wi-Fi",
              "Equipment",
              "Water",
              "Cleanliness",
              "Furniture",
              "Safety",
              "Accessibility",
            ].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => updateFilter("category", categoryParam === cat ? "" : cat)}
                aria-pressed={categoryParam === cat}
                className={`chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border flex items-center gap-1.5 ${
                  categoryParam === cat
                    ? "bg-text text-bg border-text font-semibold"
                    : "bg-surface border-border text-muted hover:text-text"
                }`}
              >
                <span>{cat}</span>
              </button>
            ))}

            {/* Clear Filters Button (When active) */}
            {isFilterActive && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="chip-press flex-shrink-0 h-8 px-3 rounded-chip text-xs font-medium border border-border bg-bg text-accent hover:bg-border/30 flex items-center gap-1"
              >
                <X className="w-3 h-3 stroke-[1.5]" />
                <span>Clear filters</span>
              </button>
            )}
          </div>
        </section>

        {/* 3) Summary Strip (Open, In progress, Resolved this week) */}
        <section aria-label="Incident summary strip" className="mb-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-4 p-3 bg-surface border border-border rounded-card">
            <button
              type="button"
              onClick={() => updateFilter("status", "pending")}
              className="text-left p-2 rounded hover:bg-bg transition-colors"
            >
              <div className="text-[11px] font-medium text-muted uppercase tracking-wider">
                Open
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text mt-0.5">
                {summary.open}
              </div>
              <div className="text-[11px] text-muted hidden sm:block">Awaiting dispatch</div>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", "in_progress")}
              className="text-left p-2 rounded hover:bg-bg transition-colors border-l border-border pl-3 sm:pl-4"
            >
              <div className="text-[11px] font-medium text-muted uppercase tracking-wider">
                In progress
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text mt-0.5">
                {summary.inProgress}
              </div>
              <div className="text-[11px] text-muted hidden sm:block">Technicians active</div>
            </button>

            <button
              type="button"
              onClick={() => updateFilter("status", "resolved")}
              className="text-left p-2 rounded hover:bg-bg transition-colors border-l border-border pl-3 sm:pl-4"
            >
              <div className="text-[11px] font-medium text-muted uppercase tracking-wider">
                Resolved this week
              </div>
              <div className="text-xl sm:text-2xl font-bold text-text mt-0.5">
                {summary.resolved}
              </div>
              <div className="text-[11px] text-muted hidden sm:block">Avg 3.4 hrs</div>
            </button>
          </div>
        </section>

        {/* 4) Incident Grid (Responsive: 1-col <640px, 2-col 640-1023px, 3-col >=1024px) */}
        <section aria-label="Incident cards feed">
          {loading ? (
            /* Loading Skeletons with Opacity Pulse */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="animate-skeleton bg-surface border border-border rounded-card aspect-[16/10] p-4 flex flex-col justify-between"
                >
                  <div className="w-1/3 h-4 bg-border rounded" />
                  <div className="space-y-2">
                    <div className="w-3/4 h-4 bg-border rounded" />
                    <div className="w-1/2 h-3 bg-border rounded" />
                  </div>
                  <div className="w-full h-8 bg-border rounded" />
                </div>
              ))}
            </div>
          ) : filteredReports.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map((report, idx) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  index={idx}
                  onClick={() => setSelectedReport(report)}
                />
              ))}
            </div>
          ) : (
            /* Friendly Empty / No-Results State */
            <div className="py-16 px-4 text-center bg-surface border border-border rounded-card">
              <Inbox className="w-10 h-10 text-muted mx-auto stroke-[1.5] mb-3" />
              <h3 className="text-base font-semibold text-text mb-1">
                No incidents match your filters
              </h3>
              <p className="text-xs text-muted max-w-sm mx-auto mb-4">
                Try clearing search terms or selecting different block, priority, or category filters.
              </p>
              {isFilterActive && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </section>
      </main>

      {/* 5) Mobile Floating "Report Incident" Button (<640px) */}
      <div
        className={`lg:hidden fixed bottom-6 right-4 z-40 transition-transform duration-200 ${
          showFloatingBtn ? "translate-y-0" : "translate-y-20"
        }`}
      >
        <Link
          href="/report/1"
          aria-label="Report incident"
          className="flex items-center gap-2 h-12 px-5 rounded-chip bg-accent text-white font-semibold text-xs shadow-none border border-accent hover:bg-accent-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Plus className="w-4 h-4 stroke-[1.5]" />
          <span>Report incident</span>
        </Link>
      </div>

      {/* Incident Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpdate={(updated) => {
            setReports((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            setSelectedReport(updated);
          }}
        />
      )}

      {/* Footer on reporter site (Goal 3: zero links to staff) */}
      <footer className="border-t border-border bg-surface mt-16 py-8 text-xs text-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-bold text-text">Campus Black Box</span>
              <span>·</span>
              <span>Campus Infrastructure Intelligence</span>
            </div>
            <div className="flex flex-wrap gap-4 text-xs">
              <Link href="/terms" className="hover:text-text transition-colors">Terms &amp; Conditions</Link>
              <Link href="/privacy" className="hover:text-text transition-colors">Privacy Policy</Link>
              <Link href="/acceptable-use" className="hover:text-text transition-colors">Acceptable Use</Link>
              <Link href="/help" className="hover:text-text transition-colors">How to Report</Link>
              <Link href="/contact" className="hover:text-text transition-colors">Contact Admin Office</Link>
            </div>
          </div>
          <div className="border-t border-border pt-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-[11px]">
            <div>© 2026 Campus Black Box - PBL Project</div>
            <div>Accessibility Statement: Compliant with WCAG 2.1 AA Standards</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg text-text p-6 flex items-center justify-center">
          <div className="animate-skeleton w-32 h-6 bg-border rounded" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
