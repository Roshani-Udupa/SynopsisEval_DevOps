import uuid
from datetime import datetime
from sqlalchemy import (
    String, Boolean, Integer, Text, Numeric, BigInteger,
    ForeignKey, TIMESTAMP, Enum as SAEnum, UniqueConstraint, Index, ARRAY
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from app.core.database import Base


# ── Users ──────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(255))
    designation: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(
        SAEnum("student_leader", "student_member", "reviewer", "admin", name="user_role"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        SAEnum("pending", "approved", "rejected", name="account_status"),
        nullable=False, default="pending",
    )
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    led_teams: Mapped[list["Team"]] = relationship("Team", foreign_keys="Team.leader_id", back_populates="leader")
    memberships: Mapped[list["TeamMember"]] = relationship("TeamMember", foreign_keys="TeamMember.user_id", back_populates="user")
    reviewer_profile: Mapped["ReviewerProfile"] = relationship("ReviewerProfile", back_populates="user", uselist=False)
    uploaded_documents: Mapped[list["Document"]] = relationship("Document", foreign_keys="Document.uploaded_by", back_populates="uploader")
    review_scores: Mapped[list["ReviewScore"]] = relationship("ReviewScore", foreign_keys="ReviewScore.reviewer_id", back_populates="reviewer")
    notifications: Mapped[list["Notification"]] = relationship("Notification", foreign_keys="Notification.recipient_id", back_populates="recipient")


# ── Reviewer Profiles ──────────────────────────────────────────────────────
class ReviewerProfile(Base):
    __tablename__ = "reviewer_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    department: Mapped[str | None] = mapped_column(String(255))
    designation: Mapped[str | None] = mapped_column(String(255))
    expertise: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User", back_populates="reviewer_profile")


# ── Guides ─────────────────────────────────────────────────────────────────
class Guide(Base):
    __tablename__ = "guides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    teams: Mapped[list["Team"]] = relationship("Team", back_populates="guide")


# ── Teams ──────────────────────────────────────────────────────────────────
class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_name: Mapped[str] = mapped_column(String(255), nullable=False)
    leader_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    guide_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("guides.id"))
    status: Mapped[str] = mapped_column(
        SAEnum("pending", "approved", "rejected", name="team_status"),
        nullable=False, default="pending",
    )
    scores_released: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rejection_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    leader: Mapped["User"] = relationship("User", foreign_keys=[leader_id], back_populates="led_teams")
    guide: Mapped["Guide"] = relationship("Guide", back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")
    documents: Mapped[list["Document"]] = relationship("Document", back_populates="team")
    review_scores: Mapped[list["ReviewScore"]] = relationship("ReviewScore", back_populates="team")
    reviewer_assignments: Mapped[list["ReviewerAssignment"]] = relationship("ReviewerAssignment", back_populates="team")


# ── Team Members ───────────────────────────────────────────────────────────
class TeamMember(Base):
    __tablename__ = "team_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    usn: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    joined_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    team: Mapped["Team"] = relationship("Team", back_populates="members")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id], back_populates="memberships")

    __table_args__ = (UniqueConstraint("team_id", "user_id"),)


# ── Reviewer Assignments ───────────────────────────────────────────────────
class ReviewerAssignment(Base):
    __tablename__ = "reviewer_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"))
    assigned_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    assigned_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    team: Mapped["Team"] = relationship("Team", back_populates="reviewer_assignments")
    reviewer: Mapped["User"] = relationship("User", foreign_keys=[reviewer_id])
    assigner: Mapped["User"] = relationship("User", foreign_keys=[assigned_by])

    __table_args__ = (UniqueConstraint("reviewer_id", "team_id"),)


# ── Documents ──────────────────────────────────────────────────────────────
class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False, default="application/pdf")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_latest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    team: Mapped["Team"] = relationship("Team", back_populates="documents")
    uploader: Mapped["User"] = relationship("User", foreign_keys=[uploaded_by], back_populates="uploaded_documents")
    plagiarism_job: Mapped["PlagiarismJob"] = relationship("PlagiarismJob", back_populates="document", uselist=False)


# ── Plagiarism Jobs ────────────────────────────────────────────────────────
class PlagiarismJob(Base):
    __tablename__ = "plagiarism_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), unique=True)
    triggered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(
        SAEnum("pending", "processing", "completed", "failed", name="job_status"),
        nullable=False, default="pending",
    )
    similarity_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    report_url: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    document: Mapped["Document"] = relationship("Document", back_populates="plagiarism_job")
    triggerer: Mapped["User"] = relationship("User", foreign_keys=[triggered_by])


# ── Review Scores ──────────────────────────────────────────────────────────
class ReviewScore(Base):
    __tablename__ = "review_scores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", ondelete="CASCADE"))
    reviewer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    relevance_score: Mapped[float | None] = mapped_column(Numeric(4, 1))
    methodology_score: Mapped[float | None] = mapped_column(Numeric(4, 1))
    presentation_score: Mapped[float | None] = mapped_column(Numeric(4, 1))
    innovation_score: Mapped[float | None] = mapped_column(Numeric(4, 1))
    feedback_text: Mapped[str | None] = mapped_column(Text)
    submitted_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

    team: Mapped["Team"] = relationship("Team", back_populates="review_scores")
    reviewer: Mapped["User"] = relationship("User", foreign_keys=[reviewer_id], back_populates="review_scores")

    __table_args__ = (UniqueConstraint("team_id", "reviewer_id"),)


# ── Email Logs ─────────────────────────────────────────────────────────────
class EmailLog(Base):
    __tablename__ = "email_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sent_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    recipient_type: Mapped[str] = mapped_column(String(50), nullable=False)
    recipient_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    template_used: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(
        SAEnum("queued", "sent", "failed", name="email_status"),
        nullable=False, default="queued",
    )
    sent_at: Mapped[datetime | None] = mapped_column("mock_sent_at", TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    sender: Mapped["User"] = relationship("User", foreign_keys=[sent_by])


# ── Notifications ────────────────────────────────────────────────────────
class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(
        SAEnum("info", "success", "warning", "error", name="notification_type"),
        nullable=False,
        default="info",
    )
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    action_url: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_id], back_populates="notifications")


# ── Password Reset Tokens ──────────────────────────────────────────────────
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship("User")


# ── Audit Logs ─────────────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(200), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONB)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
