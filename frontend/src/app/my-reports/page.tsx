"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiGetMyReports, apiGetReportHistory } from "@/lib/api";
import { Report } from "@/types";

export default function MyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    try {
      const data = await apiGetMyReports();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(r: Report) {
    setSelectedReport(r);
    try {
      const data = await apiGetReportHistory(r.id);
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Incident Reports</h1>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>Track the live status and timeline of your reported issues.</p>
        </div>
        <Link href="/report" style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
          + New Report
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading your reports...</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>No reports submitted yet</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4, marginBottom: 16 }}>Issues you report will appear here with live resolution status.</p>
          <Link href="/report" style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13 }}>
            Report an Incident
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {reports.map((r) => (
            <div
              key={r.id}
              onClick={() => openDetail(r)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: 16,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700 }}>#{r.id} · {r.location?.block || "Block 1"} · {r.location?.room || "Room"}</span>
                <span style={{ fontSize: 12, textTransform: "capitalize", fontWeight: 600 }}>{r.status.replace("_", " ")}</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedReport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 500, width: "90%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>Report #{selectedReport.id}</h3>
              <button onClick={() => setSelectedReport(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
            </div>
            <p style={{ fontSize: 13, background: "var(--surface)", padding: 12, borderRadius: 8, marginBottom: 16 }}>
              {selectedReport.description}
            </p>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", marginBottom: 8 }}>
              Status History Timeline
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
              {history.map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 10px", background: "var(--surface)", borderRadius: 6 }}>
                  <span>{h.from_status ? `${h.from_status} → ${h.to_status}` : `Submitted as ${h.to_status}`}</span>
                  <span style={{ color: "var(--muted)" }}>{new Date(h.changed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

