"use client";

import React, { useState } from "react";
import { HeatmapLocation } from "@/types";
import { MapPin } from "lucide-react";

interface CampusMapProps {
  locations?: HeatmapLocation[];
  selectedLocation?: HeatmapLocation | null;
  onSelectLocation?: (loc: HeatmapLocation) => void;
}

interface BlockMetric {
  block: string;
  name: string;
  total: number;
  open: number;
  resolved: number;
  avgHours: number;
  topCategory: string;
}

const BLOCK_STATS: BlockMetric[] = [
  { block: "Block 1", name: "Engineering Labs", total: 4, open: 2, resolved: 2, avgHours: 2.8, topCategory: "Electrical" },
  { block: "Block 2", name: "Science Wing", total: 3, open: 2, resolved: 1, avgHours: 3.5, topCategory: "Water" },
  { block: "Block 3", name: "Lecture Complex", total: 5, open: 3, resolved: 2, avgHours: 3.1, topCategory: "Equipment" },
  { block: "Block 4", name: "Faculty Wing", total: 2, open: 1, resolved: 1, avgHours: 1.9, topCategory: "Safety" },
];

export default function CampusMap({
  locations: _locations,
  selectedLocation: _selectedLocation,
  onSelectLocation: _onSelectLocation,
}: CampusMapProps) {
  const [activeBlock, setActiveBlock] = useState<BlockMetric>(BLOCK_STATS[2]); // Default Block 3

  // Single-hue flat colour scale based on incident density
  const getBlockFill = (openCount: number) => {
    if (openCount >= 3) return "var(--accent)"; // Highest intensity
    if (openCount === 2) return "rgba(47, 91, 255, 0.4)";
    return "rgba(47, 91, 255, 0.15)";
  };

  return (
    <div className="w-full bg-surface border border-border rounded-card p-6 text-text space-y-6">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-4">
        <div>
          <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">
            Geo-Spatial Grid
          </span>
          <h2 className="text-lg font-bold text-text">Campus Heat Map (Block 1 – 4)</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span>Single-hue scale:</span>
          <span className="px-2 py-0.5 rounded text-[11px] bg-accent/20 border border-border text-text">
            Low (1)
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] bg-accent/50 border border-border text-text">
            Moderate (2)
          </span>
          <span className="px-2 py-0.5 rounded text-[11px] bg-accent text-white font-semibold">
            Elevated (3+)
          </span>
        </div>
      </div>

      {/* Grid of Blocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {BLOCK_STATS.map((b) => {
          const isSelected = activeBlock.block === b.block;
          return (
            <div
              key={b.block}
              onClick={() => setActiveBlock(b)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setActiveBlock(b);
                }
              }}
              style={{
                borderColor: isSelected ? "var(--accent)" : "var(--border)",
              }}
              className={`p-4 rounded-card bg-bg border cursor-pointer transition-colors ${
                isSelected ? "ring-1 ring-accent" : "hover:border-accent/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-text">{b.block}</span>
                <span
                  style={{
                    backgroundColor: getBlockFill(b.open),
                    color: b.open >= 3 ? "#FFFFFF" : "var(--text)",
                  }}
                  className="px-2 py-0.5 rounded-chip text-[11px] font-semibold border border-border"
                >
                  {b.open} open
                </span>
              </div>
              <div className="text-xs text-muted mb-3">{b.name}</div>
              <div className="text-[11px] text-muted space-y-1 border-t border-border pt-2">
                <div className="flex justify-between">
                  <span>Total reported:</span>
                  <span className="font-semibold text-text">{b.total}</span>
                </div>
                <div className="flex justify-between">
                  <span>Avg turnaround:</span>
                  <span className="font-semibold text-text">{b.avgHours} hrs</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Block Detailed Inspection Panel */}
      <div className="p-4 bg-bg border border-border rounded-card text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3 mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent stroke-[1.5]" />
            <span className="text-sm font-bold text-text">
              {activeBlock.block} — {activeBlock.name}
            </span>
          </div>
          <span className="text-muted">Sample data telemetry</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-2.5 bg-surface border border-border rounded-input">
            <div className="text-muted text-[11px]">Total Incidents</div>
            <div className="text-base font-bold text-text mt-0.5">{activeBlock.total}</div>
          </div>
          <div className="p-2.5 bg-surface border border-border rounded-input">
            <div className="text-muted text-[11px]">Open & In Progress</div>
            <div className="text-base font-bold text-accent mt-0.5">{activeBlock.open}</div>
          </div>
          <div className="p-2.5 bg-surface border border-border rounded-input">
            <div className="text-muted text-[11px]">Resolved</div>
            <div className="text-base font-bold text-text mt-0.5">{activeBlock.resolved}</div>
          </div>
          <div className="p-2.5 bg-surface border border-border rounded-input">
            <div className="text-muted text-[11px]">Avg Fix Duration</div>
            <div className="text-base font-bold text-text mt-0.5">{activeBlock.avgHours} hrs</div>
          </div>
        </div>
      </div>
    </div>
  );
}
