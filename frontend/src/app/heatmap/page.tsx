"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import CampusMap from "@/components/CampusMap";
import { HeatmapLocation } from "@/types";
import { apiGetHeatmap } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function HeatmapPage() {
  const [locations, setLocations] = useState<HeatmapLocation[]>([]);
  const [selectedLoc, setSelectedLoc] = useState<HeatmapLocation | null>(null);

  useEffect(() => {
    apiGetHeatmap().then((res) => {
      setLocations(res.locations);
      if (res.locations.length > 0) setSelectedLoc(res.locations[0]);
    });
  }, []);

  return (
    <div className="min-h-screen bg-bg text-text pb-16">
      <Navbar />

      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-text mb-6 transition-colors font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
          Back to incident feed
        </Link>

        <CampusMap
          locations={locations}
          selectedLocation={selectedLoc}
          onSelectLocation={(loc) => setSelectedLoc(loc)}
        />
      </main>
    </div>
  );
}

