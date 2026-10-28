from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="student")  # student, faculty, maintenance, admin, super_admin
    department = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # relationships
    reports = relationship("Report", back_populates="reporter", foreign_keys="Report.user_id")
    assigned_reports = relationship("Report", back_populates="assignee", foreign_keys="Report.assigned_to")
    resolutions = relationship("Resolution", back_populates="staff")


class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    block = Column(String, nullable=False)
    room = Column(String, nullable=False)
    floor = Column(Integer, default=0)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_type = Column(String, default="classroom")  # classroom, lab, corridor, outdoor, canteen, office, hostel
    created_at = Column(DateTime, default=datetime.utcnow)

    # relationships
    reports = relationship("Report", back_populates="location")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=True)  # Set by ML or admin
    suggested_category = Column(String, nullable=True)  # ML suggestion
    priority = Column(String, default="medium")  # low, medium, high, critical
    status = Column(String, default="pending")  # pending, assigned, in_progress, resolved
    photo_url = Column(String, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    # relationships
    reporter = relationship("User", back_populates="reports", foreign_keys=[user_id])
    assignee = relationship("User", back_populates="assigned_reports", foreign_keys=[assigned_to])
    location = relationship("Location", back_populates="reports")
    resolutions = relationship("Resolution", back_populates="report")
    predictions = relationship("AIPrediction", back_populates="report")


class Resolution(Base):
    __tablename__ = "resolutions"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Text, nullable=False)
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # relationships
    report = relationship("Report", back_populates="resolutions")
    staff = relationship("User", back_populates="resolutions")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), nullable=False)
    predicted_category = Column(String, nullable=False)
    category_confidence = Column(Float, nullable=False)
    priority_score = Column(String, nullable=True)
    duplicate_score = Column(Float, nullable=True)
    duplicate_of = Column(Integer, nullable=True)  # report_id of potential duplicate
    model_version = Column(String, default="v1.0")
    created_at = Column(DateTime, default=datetime.utcnow)

    # relationships
    report = relationship("Report", back_populates="predictions")
