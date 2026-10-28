import io

import qrcode
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user, require_admin
from ..models import Location, Report, User
from ..schemas import LocationCreate, LocationResponse

router = APIRouter()


@router.get("/", response_model=list[LocationResponse])
def list_locations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all locations."""
    locations = db.query(Location).order_by(Location.block, Location.room).all()
    return [LocationResponse.model_validate(loc) for loc in locations]


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single location with stats."""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return LocationResponse.model_validate(location)


@router.post("/", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(
    location_data: LocationCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new location (admin/super_admin only)."""
    location = Location(
        block=location_data.block,
        room=location_data.room,
        floor=location_data.floor,
        latitude=location_data.latitude,
        longitude=location_data.longitude,
        location_type=location_data.location_type,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return LocationResponse.model_validate(location)


@router.get("/{location_id}/qr")
def get_location_qr(
    location_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate and return a QR code image (PNG) for the given location."""
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")

    url = f"http://localhost:3000/report/{location_id}"
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png")
