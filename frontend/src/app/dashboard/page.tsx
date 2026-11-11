"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ReportCard from "@/components/ReportCard";
import ReportDetailModal from "@/components/ReportDetailModal";
import { Report } from "@/types";
import { apiGetMyReports } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Plus, Inbox, Lock } from "lucide-react";

export default function ReporterDashboardPage() {
  const { user, isAuthenticated, isReporter, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !isReporter) {
      setReports([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    apiGetMyReports()
      .then((res) => {
        if (active) setReports(res.reports || []);
      })
      .catch(() => {
        if (active) setReports([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, isReporter, user?.id]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-text">Reporter Dashboard</h1>
            <p className="text-xs text-muted mt-1">
              Your submitted campus incident reports and live repair status.
            </p>
          </div>
          {isAuthenticated && (
            <Link
              href="/report"
              className="px-4 py-2 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[2]" />
              New Report
            </Link>
          )}
        </div>

        {authLoading ? (
          <div className="p-10 text-center text-xs text-muted bg-surface border border-border rounded-card">
            Validating reporter session...
          </div>
        ) : !isAuthenticated ? (
          <div className="max-w-md mx-auto p-8 bg-surface border border-border rounded-card text-center space-y-4">
            <Lock className="w-8 h-8 text-accent mx-auto" />
            <h2 className="text-base font-bold text-text">Sign in Required</h2>
            <p className="text-xs text-muted">
              Sign in with your Student or Faculty account to access your reports.
            </p>
            <Link
              href="/login?returnUrl=/dashboard"
              className="inline-flex px-5 py-2.5 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
            >
              Sign In
            </Link>
          </div>
        ) : loading ? (
          <div className="p-10 text-center text-xs text-muted bg-surface border border-border rounded-card">
            Loading reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-border rounded-card space-y-3">
            <Inbox className="w-8 h-8 text-muted mx-auto" />
            <h2 className="text-sm font-semibold text-text">No reports submitted yet</h2>
            <Link
              href="/report"
              className="inline-flex px-4 py-2 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
            >
              Report an Incident
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report, i) => (
              <ReportCard
                key={report.id}
                report={report}
                index={i}
                showPriority={false}
                onClick={() => setSelectedReport(report)}
              />
            ))}
          </div>
        )}
      </main>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
