export type UserRole = "admin" | "super_admin" | "maintenance" | "reporter" | "student" | "faculty" | "technician";

export interface User {
  id: number;
  name?: string;
  email: string;
  role: UserRole | string;
  aud?: "reporter" | "staff" | string;
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

export interface StatusHistoryItem {
  from_status: string | null;
  to_status: string;
  changed_at: string;
}

export interface ReportUpdateItem {
  text: string;
  created_at: string;
}

export interface NotificationItem {
  id: number;
  report_id: number | null;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface Report {
  id: number;
  title?: string;
  description: string;
  user_id?: number;
  location_id?: number;
  category: string;
  suggested_category?: string;
  priority?: "low" | "medium" | "high" | "critical";
  status: "submitted" | "pending" | "assigned" | "in_progress" | "resolved";
  photo_url: string | null;
  photo_path?: string | null;
  has_photo?: boolean;
  alt_text?: string;
  block?: string | null;
  room?: string | null;
  location_type?: string | null;
  assigned_to?: number | null;
  assignee_name?: string | null;
  similar_count?: number;
  similar_updates_count?: number;
  reporter_name?: string | null;
  reporter_role?: "Student" | "Faculty" | "Technician" | string | null;
  category_confidence?: number | null;
  created_at: string;
  updated_at?: string | null;
  resolved_at?: string | null;
  resolution_action?: string | null;
  timeline?: StatusHistoryItem[];
  updates?: ReportUpdateItem[];
  reporter?: User;
  location?: Partial<Location> & { block?: string | null; room?: string | null; location_type?: string | null };
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

export interface BlockTopCategory {
  category: string;
  count: number;
}

export interface BlockSummaryItem {
  block: string;
  location_count: number;
  total: number;
  pending: number;
  assigned: number;
  in_progress: number;
  resolved: number;
  open: number;
  has_resolved: boolean;
  avg_resolution_hours: number;
  top_categories: BlockTopCategory[];
  incidents: Report[];
}

export interface BlocksSummaryTotals {
  total_reports: number;
  pending_reports: number;
  assigned_reports: number;
  in_progress_reports: number;
  resolved_reports: number;
  open_reports: number;
  has_resolved_tickets: boolean;
  avg_resolution_hours: number;
  busiest_open_count: number;
}

export interface BlocksSummaryResponse {
  window: "7d" | "30d" | "all";
  totals: BlocksSummaryTotals;
  blocks: BlockSummaryItem[];
  notice: string;
}
