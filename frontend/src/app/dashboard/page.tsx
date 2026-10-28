"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ReportCard from "@/components/ReportCard";
import ReportDetailModal from "@/components/ReportDetailModal";
import { Report } from "@/types";
import { apiGetReports } from "@/lib/api";
import { Plus, Inbox } from "lucide-react";

export default function ReporterDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    apiGetReports()
      .then((res) => setReports(res.reports))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
          <div>
            <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
              Reporter Portal
            </span>
            <h1 className="text-xl font-bold text-text mt-0.5">My Reported Incidents</h1>
          </div>
          <Link
            href="/report/1"
            className="flex items-center gap-1.5 h-9 px-3 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
            Report incident
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="animate-skeleton bg-surface border border-border rounded-card aspect-[16/10]"
              />
            ))}
          </div>
        ) : reports.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report, idx) => (
              <ReportCard
                key={report.id}
                report={report}
                index={idx}
                onClick={() => setSelectedReport(report)}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center bg-surface border border-border rounded-card">
            <Inbox className="w-10 h-10 text-muted mx-auto stroke-[1.5] mb-2" />
            <p className="text-sm font-semibold text-text">No incidents reported yet</p>
          </div>
        )}
      </main>

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
    </div>
  );
}
