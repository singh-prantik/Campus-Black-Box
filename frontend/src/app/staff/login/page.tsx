"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiStaffLogin } from "@/lib/api";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiStaffLogin(email, password);
      localStorage.setItem("cbb_staff_token", res.token || res.access_token);
      if (res.user.role === "maintenance") {
        router.push("/staff/work-orders");
      } else {
        router.push("/staff/admin");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  function quickFill(role: string) {
    if (role === "tech1") {
      setEmail("tech1@campus.edu");
      setPassword("DemoPass123!");
    } else if (role === "admin") {
      setEmail("admin@campus.edu");
      setPassword("DemoPass123!");
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: "60px auto", padding: 32, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Staff Portal Login</h1>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>Maintenance Technicians &amp; Administrative Staff Only</p>
      </div>

      <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", marginBottom: 6 }}>DEMO STAFF QUICK-FILL</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => quickFill("tech1")} style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>Technician 1</button>
          <button type="button" onClick={() => quickFill("admin")} style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer" }}>Administrator</button>
        </div>
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "var(--prio-critical-bg)", color: "var(--prio-critical-text)", border: "1px solid var(--prio-critical-border)", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Staff Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@campus.edu"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: 10, background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", marginTop: 6 }}
        >
          {loading ? "Authenticating..." : "Sign In to Staff Portal"}
        </button>
      </form>
    </div>
  );
}

