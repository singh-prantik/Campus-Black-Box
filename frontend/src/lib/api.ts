import {
  Report,
  Location,
  Prediction,
  AuthResponse,
  User,
  NotificationItem,
  StatusHistoryItem,
} from "@/types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
export const REPORTER_TOKEN_KEY = "cbb_reporter_token";
export const REPORTER_AUTH_INVALID_EVENT = "cbb-reporter-auth-invalid";
export const SESSION_INVALID_MSG = "Your session is not valid for reporting. Please sign in again.";

/** Decode JWT payload client-side without external deps (validation happens server-side). */
export function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = typeof window !== "undefined" ? window.atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isValidReporterJwt(token: string | null): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload) return false;
  if (payload.aud !== "reporter") return false;
  if (payload.role !== "student" && payload.role !== "faculty") return false;
  if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) return false;
  return true;
}

/** Reporter portal reads ONLY cbb_reporter_token from localStorage. */
export function getReporterToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REPORTER_TOKEN_KEY);
}

export function setReporterToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REPORTER_TOKEN_KEY, token);
}

export function clearReporterToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REPORTER_TOKEN_KEY);
}

function notifyReporterAuthInvalid(): void {
  clearReporterToken();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REPORTER_AUTH_INVALID_EVENT));
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  { authRequired = false }: { authRequired?: boolean } = {}
): Promise<T> {
  const token = getReporterToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  } else if (authRequired) {
    notifyReporterAuthInvalid();
    throw new Error(SESSION_INVALID_MSG);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const rawMsg =
      (isJson && (data?.detail || data?.message)) ||
      res.statusText ||
      "API request failed";
    const isAuthEndpoint = path === "/api/auth/login" || path === "/api/auth/register";
    const isPortalSessionFailure =
      !isAuthEndpoint &&
      (res.status === 401 ||
        (res.status === 403 &&
          (/reporter portal|forbidden|session|token/i.test(String(rawMsg)) ||
            path.startsWith("/api/reports") ||
            path.startsWith("/api/auth/me") ||
            path.startsWith("/api/notifications"))));

    if (isPortalSessionFailure) {
      notifyReporterAuthInvalid();
      throw new Error(SESSION_INVALID_MSG);
    }

    throw new Error(typeof rawMsg === "string" ? rawMsg : "API request failed");
  }

  return data as T;
}

// ==========================================
// Reporter Auth
// ==========================================
export async function apiLogin(email: string, password?: string): Promise<AuthResponse> {
  return await apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRegister(
  name: string,
  email: string,
  password?: string,
  role?: string
): Promise<AuthResponse> {
  await apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, role: role || "student" }),
  });
  return await apiLogin(email, password);
}

export async function apiGetMe(): Promise<{ user: User }> {
  return await apiFetch<{ user: User }>("/api/auth/me", {}, { authRequired: true });
}

// ==========================================
// Reporter Incidents (Strict Reporter Allowlist)
// ==========================================
export async function apiGetMyReports(): Promise<{ reports: Report[] }> {
  return await apiFetch<{ reports: Report[] }>("/api/reports/mine", {}, { authRequired: true });
}

export async function apiGetReport(id: number): Promise<{ report: Report }> {
  return await apiFetch<{ report: Report }>(`/api/reports/${id}`, {}, { authRequired: true });
}

export async function apiGetReportHistory(id: number): Promise<{ history: StatusHistoryItem[]; timeline?: StatusHistoryItem[] }> {
  return await apiFetch<{ history: StatusHistoryItem[]; timeline?: StatusHistoryItem[] }>(
    `/api/reports/${id}/history`,
    {},
    { authRequired: true }
  );
}

export async function apiAddReportUpdate(id: number, text: string): Promise<{ success: boolean }> {
  return await apiFetch<{ success: boolean }>(
    `/api/reports/${id}/updates`,
    {
      method: "POST",
      body: JSON.stringify({ text }),
    },
    { authRequired: true }
  );
}

export async function apiCreateReport(payload: {
  description: string;
  location_id: number;
  category?: string;
  photo_data?: string;
}): Promise<{ report: Report; prediction: Prediction }> {
  const token = getReporterToken();
  if (!token || !isValidReporterJwt(token)) {
    notifyReporterAuthInvalid();
    throw new Error(SESSION_INVALID_MSG);
  }

  if (process.env.NODE_ENV !== "production") {
    const decoded = decodeJwtPayload(token);
    console.debug("[CampusBlackBox] POST /api/reports token aud:", decoded?.aud ?? "unknown");
  }

  return await apiFetch<{ report: Report; prediction: Prediction }>(
    "/api/reports",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { authRequired: true }
  );
}

export async function apiFetchProtectedPhoto(photoPath: string): Promise<string | null> {
  if (!photoPath) return null;
  if (photoPath.startsWith("data:")) return photoPath;
  const url = photoPath.startsWith("http") ? photoPath : `${API_BASE}${photoPath}`;
  if (!photoPath.includes("/api/photos/")) return url;

  const token = getReporterToken();
  if (!token) return null;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

// ==========================================
// Notifications (Reporter Only)
// ==========================================
export async function apiGetNotifications(): Promise<{ notifications: NotificationItem[]; unread_count: number }> {
  return await apiFetch<{ notifications: NotificationItem[]; unread_count: number }>(
    "/api/notifications",
    {},
    { authRequired: true }
  );
}

export async function apiMarkNotificationRead(id: number): Promise<{ success: boolean }> {
  return await apiFetch<{ success: boolean }>(
    `/api/notifications/${id}/read`,
    { method: "PUT" },
    { authRequired: true }
  );
}

export async function apiMarkNotificationsRead(): Promise<{ success: boolean }> {
  return await apiFetch<{ success: boolean }>(
    "/api/notifications/read-all",
    { method: "PUT" },
    { authRequired: true }
  );
}

// ==========================================
// Public AI Assist & Campus Locations
// ==========================================
export async function apiPredict(
  description: string,
  locationId: number = 1
): Promise<{
  predicted_category: string | null;
  category_confidence: number | null;
  duplicate_score: number | null;
  duplicate_of: number | null;
  is_duplicate: boolean;
}> {
  return await apiFetch("/api/ai/predict", {
    method: "POST",
    body: JSON.stringify({ description, location_id: locationId }),
  });
}

export async function apiGetLocations(): Promise<{ locations: Location[] }> {
  return await apiFetch<{ locations: Location[] }>("/api/locations");
}

export async function apiGetLocationByQr(token: string): Promise<{
  location: Location;
  active_issues?: Array<{ id: number; category: string; status: string; hours_ago?: number; created_at?: string }>;
}> {
  return await apiFetch(`/api/locations/qr/${encodeURIComponent(token)}`);
}
