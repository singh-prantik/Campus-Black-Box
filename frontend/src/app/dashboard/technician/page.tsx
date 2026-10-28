"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import ReportCard from "@/components/ReportCard";
import ReportDetailModal from "@/components/ReportDetailModal";
import { Report } from "@/types";
import { apiGetReports } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Wrench, ShieldAlert, ArrowRight } from "lucide-react";

export default function TechnicianDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const isTechnicianOrAdmin =
    user?.role === "maintenance" || user?.role === "admin" || user?.role === "super_admin";

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!authLoading && isTechnicianOrAdmin) {
      apiGetReports()
        .then((res) => {
          if (!isMounted) return;
          setReports(res.reports);
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else if (!authLoading && !isTechnicianOrAdmin) {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [authLoading, isTechnicianOrAdmin]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center">
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="w-2.5 h-2.5 rounded-full bg-accent animate-ping" />
          Verifying technician credentials...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isTechnicianOrAdmin) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-6 bg-surface border border-border rounded-card text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-border text-accent mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 stroke-[1.5]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-text">Technician Access Required</h1>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                The Assigned Work Orders portal is restricted to Maintenance Technicians and Administrators.
                {isAuthenticated
                  ? ` You are signed in as ${user?.role || "user"}.`
                  : " You are currently not signed in."}
              </p>
            </div>
            <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
              <Link
                href="/login?returnUrl=/dashboard/technician"
                className="px-4 py-2 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90 inline-flex items-center justify-center gap-1.5"
              >
                Sign In as Technician
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.5]" />
              </Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-input border border-border bg-bg text-text text-xs font-semibold hover:bg-border/30 text-center"
              >
                Return to Public Feed
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
                Technician Field Portal
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-chip bg-border text-muted font-medium">
                Sample data
              </span>
            </div>
            <h1 className="text-xl font-bold text-text mt-0.5">Assigned Work Orders</h1>
            <p className="text-xs text-muted mt-0.5">
              Viewing tickets assigned to {user?.name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="px-3 py-1.5 rounded-input bg-text text-bg text-xs font-semibold hover:opacity-90"
            >
              Public Feed
            </Link>
          </div>
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
            <Wrench className="w-10 h-10 text-muted mx-auto stroke-[1.5] mb-2" />
            <p className="text-sm font-semibold text-text">No pending work orders assigned</p>
            <p className="text-xs text-muted mt-1">Check back later or view the public incident feed.</p>
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
