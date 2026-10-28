from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Location, Report, User
from ..schemas import (
    AnalyticsSummary,
    CategoryData,
    HeatmapLocation,
    ResolutionTimeData,
    TrendData,
)

router = APIRouter()


@router.get("/summary", response_model=AnalyticsSummary)
def get_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get overall analytics summary."""
    total_reports = db.query(func.count(Report.id)).scalar() or 0
    resolved_reports = (
        db.query(func.count(Report.id)).filter(Report.status == "resolved").scalar() or 0
    )
    open_reports = total_reports - resolved_reports

    # Average resolution time in hours
    resolved_with_times = (
        db.query(Report)
        .filter(Report.status == "resolved", Report.resolved_at.isnot(None))
        .all()
    )
    if resolved_with_times:
        total_hours = sum(
            (r.resolved_at - r.created_at).total_seconds() / 3600 for r in resolved_with_times
        )
        avg_resolution_hours = round(total_hours / len(resolved_with_times), 2)
    else:
        avg_resolution_hours = 0.0

    # Reports today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    reports_today = (
        db.query(func.count(Report.id)).filter(Report.created_at >= today_start).scalar() or 0
    )

    # Reports this week
    week_start = today_start - timedelta(days=today_start.weekday())
    reports_this_week = (
        db.query(func.count(Report.id)).filter(Report.created_at >= week_start).scalar() or 0
    )

    return AnalyticsSummary(
        total_reports=total_reports,
        open_reports=open_reports,
        resolved_reports=resolved_reports,
        avg_resolution_hours=avg_resolution_hours,
        reports_today=reports_today,
        reports_this_week=reports_this_week,
    )


@router.get("/heatmap", response_model=list[HeatmapLocation])
def get_heatmap(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List of locations with report counts and category breakdown."""
    locations = db.query(Location).all()
    result = []

    for loc in locations:
        reports = db.query(Report).filter(Report.location_id == loc.id).all()
        total = len(reports)
        open_count = sum(1 for r in reports if r.status != "resolved")
        resolved_count = sum(1 for r in reports if r.status == "resolved")

        categories: dict[str, int] = {}
        for r in reports:
            cat = r.category or "Uncategorized"
            categories[cat] = categories.get(cat, 0) + 1

        result.append(
            HeatmapLocation(
                id=loc.id,
                block=loc.block,
                room=loc.room,
                latitude=loc.latitude,
                longitude=loc.longitude,
                total=total,
                open=open_count,
                resolved=resolved_count,
                categories=categories,
            )
        )

    return result


@router.get("/trends", response_model=list[TrendData])
def get_trends(
    period: str = Query("day", regex="^(day|week)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Report count grouped by day or week for the last 30 days."""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=30)

    reports = (
        db.query(Report).filter(Report.created_at >= start_date).order_by(Report.created_at).all()
    )

    if period == "day":
        buckets: dict[str, int] = {}
        current = start_date.date()
        while current <= end_date.date():
            buckets[current.isoformat()] = 0
            current += timedelta(days=1)
        for r in reports:
            key = r.created_at.date().isoformat()
            if key in buckets:
                buckets[key] += 1
        return [TrendData(date=date, count=count) for date, count in buckets.items()]
    else:
        # Group by week (ISO week start = Monday)
        buckets = {}
        for r in reports:
            week_start = r.created_at.date() - timedelta(days=r.created_at.weekday())
            key = week_start.isoformat()
            buckets[key] = buckets.get(key, 0) + 1
        return [TrendData(date=date, count=count) for date, count in sorted(buckets.items())]


@router.get("/categories", response_model=list[CategoryData])
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Count and percentage per category."""
    total = db.query(func.count(Report.id)).scalar() or 0
    if total == 0:
        return []

    rows = (
        db.query(Report.category, func.count(Report.id).label("count"))
        .group_by(Report.category)
        .all()
    )

    return [
        CategoryData(
            category=row.category or "Uncategorized",
            count=row.count,
            percentage=round((row.count / total) * 100, 2),
        )
        for row in rows
    ]


@router.get("/resolution-times", response_model=list[ResolutionTimeData])
def get_resolution_times(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Average resolution time per block."""
    locations = db.query(Location).all()
    block_data: dict[str, dict] = {}

    for loc in locations:
        if loc.block not in block_data:
            block_data[loc.block] = {"total_hours": 0.0, "count": 0}

    resolved_reports = (
        db.query(Report)
        .filter(Report.status == "resolved", Report.resolved_at.isnot(None))
        .all()
    )

    # Build a location_id -> block map
    loc_map = {loc.id: loc.block for loc in locations}

    for r in resolved_reports:
        block = loc_map.get(r.location_id)
        if block and block in block_data:
            hours = (r.resolved_at - r.created_at).total_seconds() / 3600
            block_data[block]["total_hours"] += hours
            block_data[block]["count"] += 1

    result = []
    for block, data in sorted(block_data.items()):
        avg_hours = round(data["total_hours"] / data["count"], 2) if data["count"] > 0 else 0.0
        result.append(
            ResolutionTimeData(block=block, avg_hours=avg_hours, count=data["count"])
        )

    return result


@router.get("/by-location/{location_id}")
def get_location_analytics(
    location_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Detailed stats for a single location."""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    reports = db.query(Report).filter(Report.location_id == location_id).all()

    total = len(reports)
    open_count = sum(1 for r in reports if r.status != "resolved")
    resolved_count = sum(1 for r in reports if r.status == "resolved")

    categories: dict[str, int] = {}
    statuses: dict[str, int] = {}
    priorities: dict[str, int] = {}

    resolved_hours = []
    for r in reports:
        cat = r.category or "Uncategorized"
        categories[cat] = categories.get(cat, 0) + 1
        statuses[r.status] = statuses.get(r.status, 0) + 1
        priorities[r.priority] = priorities.get(r.priority, 0) + 1
        if r.status == "resolved" and r.resolved_at:
            hours = (r.resolved_at - r.created_at).total_seconds() / 3600
            resolved_hours.append(hours)

    avg_resolution = round(sum(resolved_hours) / len(resolved_hours), 2) if resolved_hours else 0.0

    return {
        "location": {
            "id": location.id,
            "block": location.block,
            "room": location.room,
            "floor": location.floor,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "location_type": location.location_type,
        },
        "total_reports": total,
        "open_reports": open_count,
        "resolved_reports": resolved_count,
        "avg_resolution_hours": avg_resolution,
        "categories": categories,
        "statuses": statuses,
        "priorities": priorities,
    }
