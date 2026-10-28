"use client";

import { useEffect, useState } from "react";
import { apiGetReports, apiGetAnalyticsSummary, apiUpdateReport, apiResolveReport, apiGetStaff } from "@/lib/api";
import { Report, AnalyticsSummary, StaffMember } from "@/types";

export default function StaffAdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [assignModalReport, setAssignModalReport] = useState<Report | null>(null);
  const [resolveModalReport, setResolveModalReport] = useState<Report | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<number | "">("");
  const [actionText, setActionText] = useState("");
  const [remarksText, setRemarksText] = useState("");

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  async function loadData() {
    try {
      const [repData, sumData, staffData] = await Promise.all([
        apiGetReports({ status: filterStatus !== "all" ? filterStatus : undefined }),
        apiGetAnalyticsSummary(),
        apiGetStaff(),
      ]);
      setReports(repData.reports || []);
      setSummary(sumData);
      setStaff(staffData.staff || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAssign() {
    if (!assignModalReport || !selectedStaffId) return;
    try {
      await apiUpdateReport(assignModalReport.id, {
        assigned_to: Number(selectedStaffId),
        status: "assigned",
      });
      setAssignModalReport(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to assign technician");
    }
  }

  async function handleResolve() {
    if (!resolveModalReport || !actionText.trim()) return;
    try {
      await apiResolveReport(resolveModalReport.id, actionText, remarksText);
      setResolveModalReport(null);
      setActionText("");
      setRemarksText("");
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to resolve report");
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 16px" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700 }}>Incident Triage &amp; Dispatch Console</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Review campus infrastructure tickets and allocate qualified technicians.</p>
      </div>

      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Pending Triage</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{summary.pending_reports}</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Assigned</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{summary.assigned_reports}</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>In Progress</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{summary.in_progress_reports}</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Resolved</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{summary.resolved_reports}</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Avg Resolution</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: "var(--accent)" }}>{Number(summary.avg_resolution_hours || 0).toFixed(1)}h</div>
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>
              <th style={{ padding: "12px 14px" }}>ID</th>
              <th style={{ padding: "12px 14px" }}>Location</th>
              <th style={{ padding: "12px 14px" }}>Description</th>
              <th style={{ padding: "12px 14px" }}>Category</th>
              <th style={{ padding: "12px 14px" }}>Priority</th>
              <th style={{ padding: "12px 14px" }}>Status</th>
              <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "12px 14px", fontWeight: 700 }}>#{r.id}</td>
                <td style={{ padding: "12px 14px" }}>{r.location?.block || "Block 1"} · {r.location?.room || "Room"}</td>
                <td style={{ padding: "12px 14px", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</td>
                <td style={{ padding: "12px 14px" }}>{r.category}</td>
                <td style={{ padding: "12px 14px" }}>{r.priority}</td>
                <td style={{ padding: "12px 14px", textTransform: "capitalize" }}>{r.status.replace("_", " ")}</td>
                <td style={{ padding: "12px 14px", textAlign: "right" }}>
                  {r.status === "pending" && (
                    <button onClick={() => setAssignModalReport(r)} style={{ padding: "4px 10px", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      Assign
                    </button>
                  )}
                  {r.status === "assigned" && (
                    <button onClick={() => apiUpdateReport(r.id, { status: "in_progress" }).then(loadData)} style={{ padding: "4px 10px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      Start Work
                    </button>
                  )}
                  {r.status === "in_progress" && (
                    <button onClick={() => setResolveModalReport(r)} style={{ padding: "4px 10px", background: "#10B981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>
                      Resolve
                    </button>
                  )}
                  {r.status === "resolved" && <span style={{ color: "var(--muted)", fontSize: 12 }}>Closed</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignModalReport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 400, width: "90%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Assign Ticket #{assignModalReport.id}</h3>
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(Number(e.target.value))}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", marginBottom: 16 }}
            >
              <option value="">Select Technician...</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setAssignModalReport(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleAssign} style={{ padding: "6px 12px", borderRadius: 6, background: "var(--accent)", color: "#fff", border: "none", cursor: "pointer" }}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {resolveModalReport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 460, width: "90%" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Resolve Ticket #{resolveModalReport.id}</h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Action Taken *</label>
              <textarea
                required
                value={actionText}
                onChange={(e) => setActionText(e.target.value)}
                placeholder="Physical corrective action taken..."
                rows={3}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Internal Remarks</label>
              <textarea
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                placeholder="Optional facility notes..."
                rows={2}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setResolveModalReport(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleResolve} style={{ padding: "6px 12px", borderRadius: 6, background: "#10B981", color: "#fff", border: "none", cursor: "pointer" }}>Complete &amp; Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

