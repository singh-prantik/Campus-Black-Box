"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ReportCard from "@/components/ReportCard";
import ReportDetailModal from "@/components/ReportDetailModal";
import { apiGetMyReports } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Report } from "@/types";
import { Plus, Lock, Inbox } from "lucide-react";

export default function MyReportsPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setReports([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setErrorMsg(null);
    apiGetMyReports()
      .then((data) => {
        if (!active) return;
        setReports(data.reports || []);
      })
      .catch((err: any) => {
        if (!active) return;
        setReports([]);
        setErrorMsg(err?.message || "Failed to load your reports");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, user?.id]);

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">My Incident Reports</h1>
            <p className="text-xs text-muted mt-1">
              Track the live status, timeline, and resolution updates for issues you submitted.
            </p>
          </div>
          {isAuthenticated && (
            <Link
              href="/report"
              className="px-4 py-2 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2]" />
              New Report
            </Link>
          )}
        </div>

        {authLoading ? (
          <div className="p-12 text-center text-xs text-muted bg-surface border border-border rounded-card">
            Validating reporter session...
          </div>
        ) : !isAuthenticated ? (
          <div className="max-w-md mx-auto p-8 bg-surface border border-border rounded-card text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-bg border border-border text-accent mx-auto flex items-center justify-center">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text">Sign in to view your reports</h2>
              <p className="text-xs text-muted mt-1">
                Sign in with your student or faculty account to view your submitted incidents and timelines.
              </p>
            </div>
            <Link
              href="/login?returnUrl=/my-reports"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
            >
              Sign In to Reporter Portal
            </Link>
          </div>
        ) : errorMsg ? (
          <div className="p-6 bg-surface border border-border rounded-card text-xs text-red-500">
            {errorMsg}
          </div>
        ) : loading ? (
          <div className="p-12 text-center text-xs text-muted bg-surface border border-border rounded-card">
            Loading your reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center bg-surface border border-border rounded-card space-y-3">
            <Inbox className="w-8 h-8 text-muted mx-auto stroke-[1.5]" />
            <h2 className="text-base font-semibold text-text">No reports submitted yet</h2>
            <p className="text-xs text-muted">
              Issues you report will appear here with live resolution progress.
            </p>
            <div className="pt-2">
              <Link
                href="/report"
                className="inline-flex px-4 py-2 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
              >
                Report an Incident
              </Link>
            </div>
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
