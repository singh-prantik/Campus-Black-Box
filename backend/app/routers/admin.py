from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import require_admin
from ..models import Report, User
from ..schemas import UserResponse, UserUpdate

router = APIRouter()


@router.get("/users", response_model=list[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all users (admin/super_admin only)."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserResponse.model_validate(u) for u in users]


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_role(
    user_id: int,
    update: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user role (super_admin only)."""
    if current_user.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only super admins can change user roles",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if update.role is not None:
        user.role = update.role
    if update.is_active is not None:
        user.is_active = update.is_active

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/staff")
def list_staff(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List maintenance staff with their assigned ticket count."""
    staff_users = db.query(User).filter(User.role == "maintenance").all()

    result = []
    for s in staff_users:
        assigned_count = (
            db.query(func.count(Report.id))
            .filter(Report.assigned_to == s.id, Report.status != "resolved")
            .scalar()
        )
        total_resolved = (
            db.query(func.count(Report.id))
            .filter(Report.assigned_to == s.id, Report.status == "resolved")
            .scalar()
        )
        result.append(
            {
                "id": s.id,
                "name": s.name,
                "email": s.email,
                "department": s.department,
                "is_active": s.is_active,
                "assigned_open": assigned_count,
                "total_resolved": total_resolved,
            }
        )

    return result
