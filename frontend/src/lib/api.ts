import {
  AuthResponse,
  User,
  Report,
  ReportsResponse,
  Location,
  AnalyticsSummary,
  HeatmapLocation,
  TrendData,
  CategoryData,
  StaffMember,
} from "@/types";
import { SAMPLE_INCIDENTS, SAMPLE_LOCATIONS, SAMPLE_ANALYTICS } from "./mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

let localReports: Report[] = [...SAMPLE_INCIDENTS];

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("cbb_staff_token") ||
    localStorage.getItem("cbb_reporter_token") ||
    localStorage.getItem("token") ||
    null
  );
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  const contentType = res.headers.get("content-type") || "";
  let data: any = null;
  if (contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  if (!res.ok) {
    const errorMsg = data?.detail || data?.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    (err as any).status = res.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

// ─── AUTH (SEPARATE REPORTER VS STAFF) ───────────────────────────────

export async function apiLogin(email: string, password?: string): Promise<AuthResponse> {
  return await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: password || "DemoPass123!" }),
  });
}

export async function apiStaffLogin(email: string, password?: string): Promise<AuthResponse> {
  return await apiFetch<AuthResponse>("/api/staff/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: password || "DemoPass123!" }),
  });
}

export async function apiGetMe(): Promise<{ user: User }> {
  return await apiFetch<{ user: User }>("/api/auth/me");
}

export async function apiGetStaffMe(): Promise<{ user: User }> {
  return await apiFetch<{ user: User }>("/api/staff/auth/me");
}

// ─── INCIDENTS / REPORTS ───────────────────────────────────────────

export async function apiGetReports(params: Record<string, any> = {}): Promise<ReportsResponse> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      qs.append(k, String(v));
    }
  });
  const queryString = qs.toString();
  return await apiFetch<ReportsResponse>(queryString ? `/api/staff/reports?${queryString}` : "/api/staff/reports");
}

export async function apiGetMyReports(): Promise<{ reports: Report[] }> {
  return await apiFetch<{ reports: Report[] }>("/api/reports/mine");
}

export async function apiGetReport(id: number): Promise<{ report: Report; resolutions?: any[] }> {
  return await apiFetch<{ report: Report; resolutions?: any[] }>(`/api/reports/${id}`);
}

export async function apiGetReportHistory(id: number): Promise<{ history: any[] }> {
  return await apiFetch<{ history: any[] }>(`/api/reports/${id}/history`);
}

export async function apiCreateReport(payload: {
  description: string;
  location_id: number;
  category?: string;
  priority?: string;
  photo_data?: string | null;
  photo_url?: string;
}): Promise<{ report: Report; prediction: any }> {
  return await apiFetch<{ report: Report; prediction: any }>("/api/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function apiUpdateReport(
  id: number,
  data: Partial<Report> & { action?: string; remarks?: string }
): Promise<Report> {
  return await apiFetch<Report>(`/api/staff/reports/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiResolveReport(
  id: number,
  action: string,
  remarks?: string
): Promise<{ success: boolean; message: string; report?: Report }> {
  return await apiFetch<{ success: boolean; message: string; report?: Report }>(`/api/staff/reports/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ action, remarks }),
  });
}

// ─── IN-APP NOTIFICATIONS ───────────────────────────────────────────

export async function apiGetNotifications(): Promise<{ notifications: any[] }> {
  return await apiFetch<{ notifications: any[] }>("/api/notifications");
}

export async function apiMarkNotificationsRead(): Promise<{ success: boolean }> {
  return await apiFetch<{ success: boolean }>("/api/notifications/read-all", { method: "PUT" });
}

// ─── AI PREDICTION ─────────────────────────────────────────────────

export async function apiPredict(description: string, locationId: number = 1): Promise<{
  category: string | null;
  confidence: number | null;
  priority: string | null;
  duplicate: { isDuplicate: boolean; matchScore: number; matchedReportId: number | null };
  model_version?: string;
  label?: string;
  message?: string;
}> {
  return await apiFetch("/api/ai/predict", {
    method: "POST",
    body: JSON.stringify({ description, location_id: locationId }),
  });
}

// ─── LOCATIONS & QR ────────────────────────────────────────────────

export async function apiGetLocations(): Promise<{ locations: Location[] }> {
  try {
    return await apiFetch<{ locations: Location[] }>("/api/locations");
  } catch {
    return { locations: SAMPLE_LOCATIONS };
  }
}

export async function apiGetLocationByQr(token: string): Promise<{ location: Location }> {
  return await apiFetch<{ location: Location }>(`/api/locations/qr/${token}`);
}

export async function apiGetQrCodes(): Promise<{ qr_codes: (Location & { qr_url: string; full_url: string })[] }> {
  return await apiFetch<{ qr_codes: (Location & { qr_url: string; full_url: string })[] }>("/api/staff/qr-codes");
}

// ─── ADMIN & STAFF ─────────────────────────────────────────────────

export async function apiGetStaff(): Promise<{ staff: StaffMember[] }> {
  return await apiFetch<{ staff: StaffMember[] }>("/api/staff/staff");
}

export async function apiGetAdminUsers(): Promise<{ users: User[] }> {
  return await apiFetch<{ users: User[] }>("/api/staff/users");
}

// ─── ANALYTICS ─────────────────────────────────────────────────────

export async function apiGetAnalyticsSummary(): Promise<AnalyticsSummary> {
  return await apiFetch<AnalyticsSummary>("/api/staff/analytics/summary");
}

export async function apiGetHeatmap(): Promise<{ locations: HeatmapLocation[] }> {
  return await apiFetch<{ locations: HeatmapLocation[] }>("/api/staff/analytics/heatmap");
}

export async function apiGetCategories(): Promise<{ data: CategoryData[] }> {
  return await apiFetch<{ data: CategoryData[] }>("/api/staff/analytics/categories");
}

export async function apiGetTrends(): Promise<{ data: TrendData[] }> {
  return {
    data: [
      { date: "Mon", count: 2 },
      { date: "Tue", count: 4 },
      { date: "Wed", count: 3 },
      { date: "Thu", count: 6 },
      { date: "Fri", count: 5 },
      { date: "Sat", count: 1 },
      { date: "Sun", count: 2 },
    ],
  };
}
