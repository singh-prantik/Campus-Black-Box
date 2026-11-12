"use client";

import React, { useState, useEffect, useCallback } from "react";
import StaffNavbar from "@/components/StaffNavbar";
import CampusMap from "@/components/CampusMap";
import { BlocksSummaryResponse } from "@/types";
import { apiGetBlocksSummary, useStaffSession } from "@/lib/staffApi";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

export default function HeatmapPage() {
  const { isAuthenticated, isAdmin, loading: authLoading } = useStaffSession();
  const [windowRange, setWindowRange] = useState<"7d" | "30d" | "all">("all");
  const [summary, setSummary] = useState<BlocksSummaryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async (win: "7d" | "30d" | "all") => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGetBlocksSummary(win);
      setSummary(res);
    } catch (err: any) {
      setError(err?.message || "Failed to load campus heat map summary");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !isAdmin) return;
    void loadSummary(windowRange);
  }, [authLoading, isAuthenticated, isAdmin, windowRange, loadSummary]);

  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <StaffNavbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6">
        <Link
          href={isAdmin ? "/staff/admin" : "/staff/work-orders"}
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
          {isAdmin ? "Back to triage console" : "Back to work orders"}
        </Link>

        {!authLoading && (!isAuthenticated || !isAdmin) ? (
          <div className="max-w-md mx-auto p-8 bg-surface border border-border rounded-card text-center space-y-4">
            <Lock className="w-8 h-8 text-accent mx-auto" />
            <h1 className="text-base font-bold text-text">
              {isAuthenticated ? "Administrator Access Required" : "Staff Portal Sign-In Required"}
            </h1>
            <p className="text-xs text-muted">
              Campus-wide heat maps and analytics are restricted to administrators.
            </p>
            <Link
              href={isAuthenticated ? "/staff/work-orders" : "/staff/login"}
              className="inline-flex px-4 py-2 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
            >
              {isAuthenticated ? "Go to My Work Orders" : "Sign In to Staff Portal"}
            </Link>
          </div>
        ) : (
          <CampusMap
            summary={summary}
            windowRange={windowRange}
            onWindowChange={setWindowRange}
            loading={loading}
            error={error}
            onRefresh={() => void loadSummary(windowRange)}
          />
        )}
      </main>
    </div>
  );
}
