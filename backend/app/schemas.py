from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


# ── User Schemas ──────────────────────────────────────────────────────────────


class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "student"
    department: Optional[str] = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    department: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


# ── Token Schemas ─────────────────────────────────────────────────────────────


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Location Schemas ──────────────────────────────────────────────────────────


class LocationCreate(BaseModel):
    block: str
    room: str
    floor: int = 0
    latitude: float
    longitude: float
    location_type: str = "classroom"


class LocationResponse(BaseModel):
    id: int
    block: str
    room: str
    floor: int
    latitude: float
    longitude: float
    location_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Report Schemas ────────────────────────────────────────────────────────────


class ReportCreate(BaseModel):
    description: str
    location_id: int


class ReportUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[int] = None
    category: Optional[str] = None
    priority: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    user_id: int
    location_id: int
    description: str
    category: Optional[str] = None
    suggested_category: Optional[str] = None
    priority: str
    status: str
    photo_url: Optional[str] = None
    assigned_to: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    reporter: Optional[UserResponse] = None
    location: Optional[LocationResponse] = None
    assignee: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class ReportListResponse(BaseModel):
    reports: list[ReportResponse]
    total: int
    page: int
    pages: int


# ── Prediction Schemas ────────────────────────────────────────────────────────


class PredictionResponse(BaseModel):
    predicted_category: str
    category_confidence: float
    priority_score: Optional[str] = None
    duplicate_score: Optional[float] = None
    duplicate_of: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ReportWithPrediction(BaseModel):
    report: ReportResponse
    prediction: Optional[PredictionResponse] = None


# ── Resolution Schemas ────────────────────────────────────────────────────────


class ResolutionCreate(BaseModel):
    action: str
    remarks: Optional[str] = None


class ResolutionResponse(BaseModel):
    id: int
    report_id: int
    staff_id: int
    action: str
    remarks: Optional[str] = None
    created_at: datetime
    staff: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ── Analytics Schemas ─────────────────────────────────────────────────────────


class AnalyticsSummary(BaseModel):
    total_reports: int
    open_reports: int
    resolved_reports: int
    avg_resolution_hours: float
    reports_today: int
    reports_this_week: int


class HeatmapLocation(BaseModel):
    id: int
    block: str
    room: str
    latitude: float
    longitude: float
    total: int
    open: int
    resolved: int
    categories: dict


class TrendData(BaseModel):
    date: str
    count: int


class CategoryData(BaseModel):
    category: str
    count: int
    percentage: float


class ResolutionTimeData(BaseModel):
    block: str
    avg_hours: float
    count: int
