"use client";

import React, { useState, useEffect } from "react";
import StaffNavbar from "@/components/StaffNavbar";
import CampusMap from "@/components/CampusMap";
import { HeatmapLocation } from "@/types";
import { apiGetHeatmap, useStaffSession } from "@/lib/staffApi";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";

export default function HeatmapPage() {
  const { isAuthenticated, loading: authLoading } = useStaffSession();
  const [locations, setLocations] = useState<HeatmapLocation[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<HeatmapLocation | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    apiGetHeatmap()
      .then((res) => {
        setLocations(res.locations);
        if (res.locations.length > 0) setSelectedLoc(res.locations[0]);
      })
      .catch(() => {});
  }, [authLoading, isAuthenticated]);

  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <StaffNavbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6">
        <Link
          href="/staff/admin"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
          Back to triage console
        </Link>

        {!authLoading && !isAuthenticated ? (
          <div className="max-w-md mx-auto p-8 bg-surface border border-border rounded-card text-center space-y-4">
            <Lock className="w-8 h-8 text-accent mx-auto" />
            <h1 className="text-base font-bold text-text">Staff Portal Sign-In Required</h1>
            <p className="text-xs text-muted">
              Campus heat maps are restricted to authenticated maintenance staff and administrators.
            </p>
            <Link
              href="/staff/login"
              className="inline-flex px-4 py-2 rounded-input bg-accent text-white text-xs font-semibold hover:bg-accent-hover"
            >
              Sign In to Staff Portal
            </Link>
          </div>
        ) : (
          <CampusMap
            locations={locations}
            selectedLocation={selectedLoc}
            onSelectLocation={(loc) => setSelectedLoc(loc)}
          />
        )}
      </main>
    </div>
  );
}

