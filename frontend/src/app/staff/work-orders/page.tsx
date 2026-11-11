"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StaffNavbar from "@/components/StaffNavbar";
import { apiGetReports, apiUpdateReport, apiResolveReport, useStaffSession } from "@/lib/staffApi";
import { Report } from "@/types";

export default function TechnicianWorkOrdersPage() {
  const { isAuthenticated, loading: authLoading } = useStaffSession();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolveModalReport, setResolveModalReport] = useState<Report | null>(null);
  const [actionText, setActionText] = useState("");
  const [remarksText, setRemarksText] = useState("");

  useEffect(() => {
    if (authLoading || !isAuthenticated) {
      setLoading(false);
      return;
    }
    loadWorkOrders();
  }, [authLoading, isAuthenticated]);

  async function loadWorkOrders() {
    setLoading(true);
    try {
      const data = await apiGetReports();
      setReports(data.reports || []);
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  async function startWork(id: number) {
    try {
      await apiUpdateReport(id, { status: "in_progress" });
      loadWorkOrders();
    } catch (err: any) {
      alert(err.message || "Failed to update status");
    }
  }

  async function handleResolve() {
    if (!resolveModalReport || !actionText.trim()) return;
    try {
      await apiResolveReport(resolveModalReport.id, actionText, remarksText);
      setResolveModalReport(null);
      setActionText("");
      setRemarksText("");
      loadWorkOrders();
    } catch (err: any) {
      alert(err.message || "Failed to resolve work order");
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <StaffNavbar />
        <div className="p-12 text-center text-xs text-muted">Validating staff session...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <StaffNavbar />
        <div style={{ maxWidth: 440, margin: "64px auto", padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, textAlign: "center" }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Staff Sign-In Required</h1>
          <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 16 }}>
            Sign in with your technician or admin credentials to manage work orders.
          </p>
          <Link href="/staff/login" style={{ padding: "8px 16px", background: "var(--accent)", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            Staff Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <StaffNavbar />
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>My Assigned Work Orders</h1>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Work orders assigned to your maintenance technician profile.</p>
        </div>
        <button onClick={loadWorkOrders} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13 }}>
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--muted)" }}>Loading work orders...</div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600 }}>All Caught Up!</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>You have no open work orders allocated to you.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reports.map((r) => (
            <div key={r.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>#{r.id}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, color: "var(--muted)" }}>{r.location?.block || "Block 1"} · {r.location?.room || "Room"}</span>
                  <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--bg)", border: "1px solid var(--border)" }}>{r.priority}</span>
                  <span style={{ marginLeft: 6, fontSize: 11, padding: "2px 8px", borderRadius: 999, textTransform: "capitalize", background: "var(--bg)", border: "1px solid var(--border)" }}>{r.status.replace("_", " ")}</span>
                </div>
                <div>
                  {r.status === "assigned" && (
                    <button onClick={() => startWork(r.id)} style={{ padding: "6px 12px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Start Work
                    </button>
                  )}
                  {r.status === "in_progress" && (
                    <button onClick={() => setResolveModalReport(r)} style={{ padding: "6px 12px", background: "#10B981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                      Complete &amp; Resolve
                    </button>
                  )}
                  {r.status === "resolved" && (
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>Completed</span>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 8 }}>{r.description}</p>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Category: {r.category}</div>
            </div>
          ))}
        </div>
      )}

      {resolveModalReport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 460, width: "90%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Complete Work Order #{resolveModalReport.id}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Action Taken *</label>
              <textarea
                required
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Describe corrective maintenance performed..."
                rows={3}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Internal Remarks</label>
              <textarea
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setResolveModalReport(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleResolve} style={{ padding: "6px 12px", borderRadius: 6, background: "#10B981", color: "#fff", border: "none", cursor: "pointer" }}>Submit &amp; Close</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

