"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Report,
  Location,
  AnalyticsSummary,
  HeatmapLocation,
  ReportsResponse,
  AuthResponse,
  StaffMember,
  CategoryData,
  TrendData,
  User,
  BlocksSummaryResponse,
} from "@/types";
import { API_BASE, decodeJwtPayload } from "./api";

export const STAFF_TOKEN_KEY = "cbb_staff_token";
export const STAFF_AUTH_INVALID_EVENT = "cbb-staff-auth-invalid";
const STAFF_ROLES = ["maintenance", "admin", "super_admin"];

export function isValidStaffJwt(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (payload.aud !== "staff") return false;
  if (!STAFF_ROLES.includes(String(payload.role || ""))) return false;
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return false;
  return true;
}

/** Staff portal reads ONLY cbb_staff_token from tab-scoped sessionStorage. */
export function getStaffToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(STAFF_TOKEN_KEY);
}

export function setStaffToken(token: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STAFF_TOKEN_KEY, token);
}

export function clearStaffToken(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STAFF_TOKEN_KEY);
}

function notifyStaffAuthInvalid(): void {
  clearStaffToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STAFF_AUTH_INVALID_EVENT));
  }
}

export async function apiStaffFetch<T>(
  path: string,
  options: RequestInit = {},
  { authRequired = true }: { authRequired?: boolean } = {}
): Promise<T> {
  const token = getStaffToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (authRequired) {
    notifyStaffAuthInvalid();
    throw new Error("Staff session required. Please sign in on the staff portal.");
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message =
      (isJson && (data?.detail || data?.message)) ||
      res.statusText ||
      "Staff API request failed";
    if (path !== "/api/staff/auth/login" && (res.status === 401 || res.status === 403)) {
      if (res.status === 401 || /staff portal/i.test(String(message))) {
        notifyStaffAuthInvalid();
      }
    }
    throw new Error(typeof message === "string" ? message : "Staff API request failed");
  }

  return data as T;
}

export async function apiStaffLogin(email: string, password?: string): Promise<AuthResponse> {
  return await apiStaffFetch<AuthResponse>(
    "/api/staff/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    { authRequired: false }
  );
}

export async function apiGetStaffMe(): Promise<{ user: User }> {
  return await apiStaffFetch<{ user: User }>("/api/staff/auth/me");
}

export async function apiGetStaffProfile(): Promise<{ user: User }> {
  return await apiStaffFetch<{ user: User }>("/api/staff/me");
}

export async function apiUpdateMyAvailability(
  availability: "active" | "inactive"
): Promise<{ success: boolean; user: User }> {
  return await apiStaffFetch<{ success: boolean; user: User }>("/api/staff/me/availability", {
    method: "PATCH",
    body: JSON.stringify({ availability }),
  });
}

export async function apiGetPublicConfig(): Promise<{ demo_mode: boolean }> {
  return await apiStaffFetch<{ demo_mode: boolean }>("/api/config", {}, { authRequired: false });
}

export interface StaffReportDetailResponse {
  report: Report;
  resolution?: {
    action: string;
    remarks?: string | null;
    resolved_by?: string | null;
    resolved_by_id?: number | null;
    resolved_at?: string | null;
  } | null;
  resolutions?: Resolution[];
  updates?: any[];
  history?: any[];
}

export async function apiGetStaffReportDetail(id: number): Promise<StaffReportDetailResponse> {
  return await apiStaffFetch<StaffReportDetailResponse>(`/api/staff/reports/${id}`);
}

export async function apiGetReports(params: Record<string, any> = {}): Promise<ReportsResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== "All") {
      query.set(k, String(v));
    }
  });
  const queryString = query.toString();
  return await apiStaffFetch<ReportsResponse>(
    queryString ? `/api/staff/reports?${queryString}` : "/api/staff/reports"
  );
}

export async function apiUpdateReport(
  id: number,
  payload: { status?: string; assigned_to?: number | null; priority?: string; category?: string }
): Promise<Report> {
  return await apiStaffFetch<Report>(`/api/staff/reports/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function apiResolveReport(
  id: number,
  action: string,
  remarks?: string
): Promise<{ success: boolean; message: string; report?: Report }> {
  return await apiStaffFetch<{ success: boolean; message: string; report?: Report }>(
    `/api/staff/reports/${id}/resolve`,
    {
      method: "POST",
      body: JSON.stringify({ action, remarks }),
    }
  );
}

export async function apiGetStaff(): Promise<{ staff: StaffMember[] }> {
  return await apiStaffFetch<{ staff: StaffMember[] }>("/api/staff/staff");
}

export async function apiGetAdminUsers(): Promise<{ users: User[] }> {
  return await apiStaffFetch<{ users: User[] }>("/api/staff/users");
}

export async function apiGetQrCodes(): Promise<{ qr_codes: (Location & { qr_url: string; full_url: string })[] }> {
  return await apiStaffFetch<{ qr_codes: (Location & { qr_url: string; full_url: string })[] }>("/api/staff/qr-codes");
}

export async function apiGetAnalyticsSummary(): Promise<AnalyticsSummary> {
  return await apiStaffFetch<AnalyticsSummary>("/api/staff/analytics/summary");
}

export async function apiGetHeatmap(): Promise<{ locations: HeatmapLocation[] }> {
  return await apiStaffFetch<{ locations: HeatmapLocation[] }>("/api/staff/analytics/heatmap");
}

export async function apiGetBlocksSummary(
  window: "7d" | "30d" | "all" = "all"
): Promise<BlocksSummaryResponse> {
  return await apiStaffFetch<BlocksSummaryResponse>(
    `/api/staff/blocks/summary?window=${encodeURIComponent(window)}`
  );
}

export async function apiGetCategories(): Promise<{ data: CategoryData[] }> {
  return await apiStaffFetch<{ data: CategoryData[] }>("/api/staff/analytics/categories");
}

export async function apiGetTrends(): Promise<{ data: TrendData[] }> {
  return await apiStaffFetch<{ data: TrendData[] }>("/api/staff/analytics/trends");
}

export async function apiFetchStaffReportPhoto(reportId: number): Promise<string> {
  const token = getStaffToken();
  if (!token) {
    throw new Error("Photo unavailable");
  }
  const url = `${API_BASE}/api/staff/reports/${reportId}/photo`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error("Photo unavailable");
  }
  const blob = await res.blob();
  if (!blob || blob.size === 0) {
    throw new Error("Photo unavailable");
  }
  return URL.createObjectURL(blob);
}

export async function apiFetchStaffProtectedPhoto(photoPath: string): Promise<string | null> {
  if (!photoPath) return null;
  if (photoPath.startsWith("data:")) return photoPath;
  const url = photoPath.startsWith("http") ? photoPath : `${API_BASE}${photoPath}`;
  if (!photoPath.includes("/api/photos/") && !photoPath.includes("/api/staff/reports/")) return url;

  const token = getStaffToken();
  if (!token) return null;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob || blob.size === 0) return null;
  return URL.createObjectURL(blob);
}

export function useStaffSession() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const validateStaffSession = useCallback(async (): Promise<User | null> => {
    const stored = getStaffToken();
    if (!stored || !isValidStaffJwt(stored)) {
      clearStaffToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const res = await apiGetStaffMe();
      if (res?.user && res.user.aud === "staff" && STAFF_ROLES.includes(String(res.user.role || ""))) {
        setToken(stored);
        setUser(res.user);
        setLoading(false);
        return res.user;
      }
      clearStaffToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    } catch {
      clearStaffToken();
      setToken(null);
      setUser(null);
      setLoading(false);
      return null;
    }
  }, []);

  useEffect(() => {
    void validateStaffSession();

    const intervalId = window.setInterval(() => {
      void validateStaffSession();
    }, 60_000);

    const onFocus = () => {
      void validateStaffSession();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void validateStaffSession();
      }
    };
    const onInvalid = () => {
      clearStaffToken();
      setToken(null);
      setUser(null);
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener(STAFF_AUTH_INVALID_EVENT, onInvalid);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener(STAFF_AUTH_INVALID_EVENT, onInvalid);
    };
  }, [validateStaffSession]);

  const logout = useCallback(() => {
    clearStaffToken();
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      window.location.href = "/staff/login";
    }
  }, []);

  return {
    user,
    token,
    loading,
    isAuthenticated: !!user,
    isAdmin: !!user && (user.role === "admin" || user.role === "super_admin"),
    isTechnician: !!user && user.role === "maintenance",
    refresh: validateStaffSession,
    logout,
  };
}
