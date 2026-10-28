import math
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from ..config import settings
from ..database import get_db
from ..dependencies import get_current_user, require_admin, require_staff
from ..models import AIPrediction, Report, Resolution, User
from ..schemas import (
    PredictionResponse,
    ReportListResponse,
    ReportResponse,
    ReportUpdate,
    ReportWithPrediction,
    ResolutionCreate,
    ResolutionResponse,
)

router = APIRouter()


def _run_ml(description: str, report_id: int, db: Session) -> PredictionResponse:
    """Run ML categorization, priority prediction, and duplicate detection for a report."""
    from ..ml.categorizer import categorizer
    from ..ml.duplicates import duplicate_detector
    from ..ml.priority import priority_predictor

    # Category prediction
    predicted_category, confidence = categorizer.predict(description)

    # Gather existing reports for duplicate detection
    existing_reports = (
        db.query(Report)
        .filter(Report.id != report_id)
        .order_by(Report.created_at.desc())
        .limit(200)
        .all()
    )
    existing_dicts = [{"id": r.id, "description": r.description} for r in existing_reports]

    # Duplicate detection
    duplicates = duplicate_detector.find_duplicates(description, existing_dicts, threshold=0.4)
    dup_score: Optional[float] = None
    dup_of: Optional[int] = None
    similar_count = len(duplicates)
    if duplicates:
        dup_score = duplicates[0]["score"]
        dup_of = duplicates[0]["report_id"]

    # Priority prediction
    priority_score = priority_predictor.predict(predicted_category, description, similar_count)

    # Save prediction
    prediction = AIPrediction(
        report_id=report_id,
        predicted_category=predicted_category,
        category_confidence=round(confidence, 4),
        priority_score=priority_score,
        duplicate_score=round(dup_score, 4) if dup_score is not None else None,
        duplicate_of=dup_of,
    )
    db.add(prediction)
    db.commit()
    db.refresh(prediction)

    return PredictionResponse(
        predicted_category=predicted_category,
        category_confidence=round(confidence, 4),
        priority_score=priority_score,
        duplicate_score=round(dup_score, 4) if dup_score is not None else None,
        duplicate_of=dup_of,
    )


@router.post("/", response_model=ReportWithPrediction, status_code=status.HTTP_201_CREATED)
async def create_report(
    description: str = Form(...),
    location_id: int = Form(...),
    photo: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new report with optional photo upload. Runs ML categorization."""
    photo_url: Optional[str] = None
    if photo and photo.filename:
        ext = os.path.splitext(photo.filename)[1] or ".jpg"
        filename = f"{uuid.uuid4().hex}{ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        contents = await photo.read()
        with open(filepath, "wb") as f:
            f.write(contents)
        photo_url = f"/uploads/{filename}"

    report = Report(
        user_id=current_user.id,
        location_id=location_id,
        description=description,
        photo_url=photo_url,
        status="pending",
        priority="medium",
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    # Run ML pipeline
    prediction_resp = _run_ml(description, report.id, db)

    # Update report with ML results
    report.suggested_category = prediction_resp.predicted_category
    report.category = prediction_resp.predicted_category
    report.priority = prediction_resp.priority_score or "medium"
    db.commit()
    db.refresh(report)

    # Eagerly load relationships for response
    report = (
        db.query(Report)
        .options(joinedload(Report.reporter), joinedload(Report.location), joinedload(Report.assignee))
        .filter(Report.id == report.id)
        .first()
    )

    return ReportWithPrediction(
        report=ReportResponse.model_validate(report),
        prediction=prediction_resp,
    )


@router.get("/", response_model=ReportListResponse)
def list_reports(
    status_filter: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    location_id: Optional[int] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List reports with filters and pagination. Visibility depends on user role."""
    query = db.query(Report).options(
        joinedload(Report.reporter),
        joinedload(Report.location),
        joinedload(Report.assignee),
    )

    # Role-based visibility
    if current_user.role == "student":
        query = query.filter(Report.user_id == current_user.id)
    elif current_user.role == "maintenance":
        query = query.filter(Report.assigned_to == current_user.id)
    # admin, super_admin, faculty see all

    # Apply filters
    if status_filter:
        query = query.filter(Report.status == status_filter)
    if category:
        query = query.filter(Report.category == category)
    if location_id:
        query = query.filter(Report.location_id == location_id)
    if priority:
        query = query.filter(Report.priority == priority)
    if search:
        query = query.filter(Report.description.ilike(f"%{search}%"))

    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit

    reports = query.order_by(Report.created_at.desc()).offset(offset).limit(limit).all()

    return ReportListResponse(
        reports=[ReportResponse.model_validate(r) for r in reports],
        total=total,
        page=page,
        pages=pages,
    )


@router.get("/{report_id}", response_model=ReportResponse)
def get_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single report with all relations."""
    report = (
        db.query(Report)
        .options(
            joinedload(Report.reporter),
            joinedload(Report.location),
            joinedload(Report.assignee),
            joinedload(Report.resolutions),
            joinedload(Report.predictions),
        )
        .filter(Report.id == report_id)
        .first()
    )
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Students can only view their own reports
    if current_user.role == "student" and report.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return ReportResponse.model_validate(report)


@router.patch("/{report_id}", response_model=ReportResponse)
def update_report(
    report_id: int,
    update: ReportUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update report fields. Admin can update status/assignment. Reporter can correct category."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    # Permission checks
    is_admin = current_user.role in ("admin", "super_admin")
    is_reporter = report.user_id == current_user.id

    if not is_admin and not is_reporter:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if update.status is not None:
        if not is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can change status")
        report.status = update.status
        if update.status == "resolved":
            report.resolved_at = datetime.utcnow()

    if update.assigned_to is not None:
        if not is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can assign reports")
        report.assigned_to = update.assigned_to
        if report.status == "pending":
            report.status = "assigned"

    if update.category is not None:
        report.category = update.category

    if update.priority is not None:
        if not is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can change priority")
        report.priority = update.priority

    report.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(report)

    report = (
        db.query(Report)
        .options(joinedload(Report.reporter), joinedload(Report.location), joinedload(Report.assignee))
        .filter(Report.id == report_id)
        .first()
    )

    return ReportResponse.model_validate(report)


@router.post("/{report_id}/resolve", response_model=ResolutionResponse, status_code=status.HTTP_201_CREATED)
def resolve_report(
    report_id: int,
    resolution_data: ResolutionCreate,
    current_user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    """Add a resolution entry and mark the report as resolved."""
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    resolution = Resolution(
        report_id=report_id,
        staff_id=current_user.id,
        action=resolution_data.action,
        remarks=resolution_data.remarks,
    )
    db.add(resolution)

    report.status = "resolved"
    report.resolved_at = datetime.utcnow()
    report.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(resolution)

    # Load staff relationship
    resolution = (
        db.query(Resolution)
        .options(joinedload(Resolution.staff))
        .filter(Resolution.id == resolution.id)
        .first()
    )

    return ResolutionResponse.model_validate(resolution)
