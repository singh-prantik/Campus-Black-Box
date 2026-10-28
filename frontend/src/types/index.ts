export type UserRole = "admin" | "reporter" | "student" | "faculty" | "technician";

export interface User {
  id: number;
  name?: string;
  email: string;
  role: UserRole | string;
  department?: string;
}

export interface Location {
  id: number;
  block: string; // "Block 1", "Block 2", "Block 3", "Block 4", "Library"
  room: string;
  floor: number | string;
  latitude: number;
  longitude: number;
  location_type?: string;
  qr_token?: string;
}

export interface Report {
  id: number;
  title?: string;
  description: string;
  user_id?: number;
  location_id?: number;
  category: string;
  suggested_category?: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "assigned" | "in_progress" | "resolved";
  photo_url: string | null;
  alt_text?: string;
  assigned_to?: number | null;
  similar_count?: number;
  reporter_role?: "Student" | "Faculty" | "Technician" | string;
  created_at: string;
  updated_at?: string;
  resolved_at?: string | null;
  reporter?: User;
  location?: Location;
  assignee?: User;
  resolutions?: Resolution[];
  predictions?: Prediction[];
}

export interface Resolution {
  id: number;
  report_id: number;
  staff_id: number;
  action: string;
  remarks?: string;
  created_at: string;
  staff?: User;
}

export interface Prediction {
  id?: number;
  predicted_category: string;
  category_confidence: number;
  priority_score: string;
  duplicate_score?: number | null;
  duplicate_of?: number | null;
}

export interface AnalyticsSummary {
  total_reports: number;
  pending_reports?: number;
  assigned_reports?: number;
  in_progress_reports?: number;
  resolved_reports: number;
  open_reports: number;
  avg_resolution_hours: number;
  has_resolved_tickets?: boolean;
  reports_today: number;
  reports_this_week: number;
}

export interface HeatmapLocation {
  id: number;
  block: string;
  room: string;
  latitude: number;
  longitude: number;
  total: number;
  open: number;
  resolved: number;
  categories: Record<string, number>;
}

export interface ReportsResponse {
  reports: Report[];
  total: number;
  page: number;
  pages: number;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface StaffMember {
  id: number;
  name?: string;
  role: string;
  assigned_count: number;
}

export interface TrendData {
  date: string;
  count: number;
}

export interface CategoryData {
  category: string;
  count: number;
  percentage: number;
}

export interface ResolutionTimeData {
  block: string;
  avg_hours: number;
  count: number;
}
