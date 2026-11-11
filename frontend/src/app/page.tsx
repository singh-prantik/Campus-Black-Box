"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/Navbar";
import ReportCard from "@/components/ReportCard";
import ReportDetailModal from "@/components/ReportDetailModal";
import { Location, Report } from "@/types";
import { apiGetMyReports, apiGetLocations } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  AlertCircle,
  Plus,
  Inbox,
  X,
  CheckCircle2,
  Clock,
  Shield,
  MapPin,
  ArrowRight,
  Lock,
} from "lucide-react";

function HomeFeedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isReporter, loading: authLoading } = useAuth();

  const searchParam = searchParams.get("search") || "";
  const statusParam = searchParams.get("status") || "";
  const blockParam = searchParams.get("block") || "";
  const categoryParam = searchParams.get("category") || "";

  const [reports, setReports] = useState<Report[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const loadLocations = () => {
    apiGetLocations()
      .then((res) => setLocations(res.locations || []))
      .catch(() => setLocations([]));
  };

  const loadReporterFeed = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetMyReports();
      setReports(res.reports || []);
    } catch (err: any) {
      setReports([]);
      setError(err?.message || "Unable to load your submitted incidents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated && isReporter) {
      void loadReporterFeed();
    } else {
      setReports([]);
      setError(null);
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, isReporter]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  };

  const clearAllFilters = () => {
    router.push("/");
  };

  const statusCounts = useMemo(() => {
    return {
      all: reports.length,
      submitted: reports.filter((r) => r.status === "submitted").length,
      pending: reports.filter((r) => r.status === "pending").length,
      assigned: reports.filter((r) => r.status === "assigned").length,
      in_progress: reports.filter((r) => r.status === "in_progress").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const q = searchParam.trim().toLowerCase();
      if (q) {
        const block = (r.block || r.location?.block || "").toLowerCase();
        const room = (r.room || r.location?.room || "").toLowerCase();
        const matchesText =
          r.description?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q) ||
          block.includes(q) ||
          room.includes(q) ||
          `#${r.id}`.includes(q);
        if (!matchesText) return false;
      }

      if (statusParam && r.status !== statusParam) return false;

      if (blockParam) {
        const block = r.block || r.location?.block || "";
        if (block !== blockParam) return false;
      }

      if (categoryParam && r.category !== categoryParam) return false;
      return true;
    });
  }, [reports, searchParam, statusParam, blockParam, categoryParam]);

  const hasActiveFilters = Boolean(searchParam || statusParam || blockParam || categoryParam);

  const uniqueBlocks = useMemo(() => {
    const blocks = new Set<string>();
    locations.forEach((loc) => {
      if (loc.block) blocks.add(loc.block);
    });
    return Array.from(blocks);
  }, [locations]);

  const openCount =
    statusCounts.submitted + statusCounts.pending + statusCounts.assigned + statusCounts.in_progress;

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <Navbar
        searchValue={searchParam}
        onSearchChange={(val) => updateFilter("search", val)}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Reporter Hero */}
        <section className="rounded-card border border-border bg-surface p-6 sm:p-7 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider">
              <Shield className="w-3.5 h-3.5" />
              Campus Maintenance Reporter Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-text tracking-tight">
              Report campus maintenance &amp; safety issues in seconds
            </h1>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              Submit location-tagged incident reports with real photo evidence and track live status updates from submission through resolution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/report"
              className="h-10 px-4 rounded-input bg-accent hover:bg-accent-hover text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
              Report an Issue
            </Link>
            {isAuthenticated && isReporter ? (
              <Link
                href="/my-reports"
                className="h-10 px-4 rounded-input border border-border bg-bg hover:bg-border/30 text-text text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                My Reports
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="h-10 px-4 rounded-input border border-border bg-bg hover:bg-border/30 text-text text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
              >
                Reporter Sign In
              </Link>
            )}
          </div>
        </section>

        {/* Signed-in Reporter Personal Overview vs Signed-out Public Campus Locations */}
        {authLoading ? (
          <div className="p-10 text-center text-xs text-muted bg-surface border border-border rounded-card">
            Checking session...
          </div>
        ) : !isAuthenticated || !isReporter ? (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-text">Report by Campus Location</h2>
                <p className="text-xs text-muted">
                  Choose a room or scan a door placard QR code, then sign in with your student or faculty account.
                </p>
              </div>
              <Link
                href="/login?returnUrl=/my-reports"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                <Lock className="w-3.5 h-3.5" />
                Sign in to view your submitted reports
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {locations.map((loc) => (
                <Link
                  key={loc.id}
                  href={`/report/${loc.id}`}
                  className="p-4 rounded-card border border-border bg-surface hover:border-accent transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-input bg-bg border border-border flex items-center justify-center text-accent shrink-0">
                      <MapPin className="w-4 h-4 stroke-[1.75]" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text truncate group-hover:text-accent transition-colors">
                        {loc.block} · {loc.room}
                      </div>
                      <div className="text-[11px] text-muted truncate">
                        {loc.location_type || "Campus Facility"} · Floor {loc.floor}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted group-hover:text-accent shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="space-y-5">
            {/* Reporter Filter Chips (Status & Block only — NO priority or staff filters) */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { key: "", label: "All", count: statusCounts.all },
                  { key: "pending", label: "Pending", count: statusCounts.pending },
                  { key: "assigned", label: "Assigned", count: statusCounts.assigned },
                  { key: "in_progress", label: "In progress", count: statusCounts.in_progress },
                  { key: "resolved", label: "Resolved", count: statusCounts.resolved },
                ].map((tab) => {
                  const active = statusParam === tab.key;
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => updateFilter("status", tab.key)}
                      className={`h-8 px-3 rounded-chip text-xs font-medium inline-flex items-center gap-1.5 border transition-colors shrink-0 ${
                        active
                          ? "bg-text text-bg border-text"
                          : "bg-surface text-text border-border hover:bg-bg"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span className="text-[10px] opacity-75">{tab.count}</span>
                    </button>
                  );
                })}

                <div className="h-4 w-[1px] bg-border mx-1 shrink-0" />

                {uniqueBlocks.map((b) => {
                  const active = blockParam === b;
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => updateFilter("block", active ? "" : b)}
                      className={`h-8 px-3 rounded-chip text-xs font-medium border transition-colors shrink-0 ${
                        active
                          ? "bg-accent text-white border-accent"
                          : "bg-surface text-text border-border hover:bg-bg"
                      }`}
                    >
                      {b}
                    </button>
                  );
                })}

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="h-8 px-2.5 rounded-chip text-xs font-medium text-muted hover:text-text inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Reporter KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-card border border-border bg-surface flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Your Active Issues
                  </div>
                  <div className="text-2xl font-bold text-text mt-1">{openCount}</div>
                </div>
                <Clock className="w-5 h-5 text-accent" />
              </div>
              <div className="p-4 rounded-card border border-border bg-surface flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Resolved
                  </div>
                  <div className="text-2xl font-bold text-text mt-1">{statusCounts.resolved}</div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div className="p-4 rounded-card border border-border bg-surface flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                    Total Submitted
                  </div>
                  <div className="text-2xl font-bold text-text mt-1">{statusCounts.all}</div>
                </div>
                <Shield className="w-5 h-5 text-muted" />
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-card border border-red-500/30 bg-red-500/10 flex items-center justify-between text-xs text-red-500">
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </span>
                <button
                  type="button"
                  onClick={() => void loadReporterFeed()}
                  className="font-semibold underline"
                >
                  Retry
                </button>
              </div>
            )}

            {loading ? (
              <div className="p-12 text-center text-xs text-muted bg-surface border border-border rounded-card">
                Loading your submitted incidents...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-12 text-center bg-surface border border-border rounded-card space-y-3">
                <Inbox className="w-8 h-8 text-muted mx-auto stroke-[1.5]" />
                <h3 className="text-sm font-semibold text-text">
                  {hasActiveFilters ? "No submitted incidents match your filters" : "You have not submitted any incidents yet"}
                </h3>
                <p className="text-xs text-muted">
                  {hasActiveFilters
                    ? "Try clearing search terms or switching block and status filters."
                    : "Click Report an Issue to submit a campus maintenance ticket."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredReports.map((report, index) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    index={index}
                    showPriority={false}
                    onClick={() => setSelectedReport(report)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="border-t border-border bg-surface py-6 mt-12">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div className="font-medium text-text">Campus Black Box · Reporter Portal</div>
          <nav className="flex flex-wrap items-center gap-4">
            <Link href="/terms" className="hover:text-text transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-text transition-colors">Privacy Policy</Link>
            <Link href="/acceptable-use" className="hover:text-text transition-colors">Acceptable Use</Link>
            <Link href="/help" className="hover:text-text transition-colors">Help &amp; FAQ</Link>
            <Link href="/contact" className="hover:text-text transition-colors">Contact Facilities Office</Link>
          </nav>
        </div>
      </footer>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg text-text flex items-center justify-center text-xs text-muted">Loading...</div>}>
      <HomeFeedContent />
    </Suspense>
  );
}
