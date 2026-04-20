import uuid
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User, ReviewerProfile, Guide, Team, TeamMember, PasswordResetToken
from app.schemas.auth import (
    LoginRequest, TokenResponse, ReviewerRegisterRequest,
    TeamRegisterRequest, PasswordResetRequest, PasswordResetConfirm, MessageResponse
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Login ──────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    # Admin can always log in; others need approval
    if user.role != "admin" and user.status == "rejected":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been rejected. Please contact the administrator.",
        )

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role,
        "email": user.email,
    })

    return TokenResponse(
        access_token=token,
        user_id=str(user.id),
        role=user.role,
        full_name=user.full_name,
        status=user.status,
    )


# ── Reviewer Registration ──────────────────────────────────────────────────
@router.post("/register/reviewer", response_model=MessageResponse, status_code=201)
async def register_reviewer(payload: ReviewerRegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role="reviewer",
        status="pending",
    )
    db.add(user)
    await db.flush()

    profile = ReviewerProfile(
        user_id=user.id,
        department=payload.department,
        designation=payload.designation,
        expertise=payload.expertise or [],
    )
    db.add(profile)
    await db.commit()

    return MessageResponse(
        message="Reviewer account submitted for approval. You will be notified once approved."
    )


# ── Team Registration ──────────────────────────────────────────────────────
@router.post("/register/team", response_model=MessageResponse, status_code=201)
async def register_team(payload: TeamRegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check leader email uniqueness
    existing_emails = [payload.leader_email] + [m.email for m in payload.members]
    existing_usns = [payload.leader_usn] + [m.usn for m in payload.members]

    for email in existing_emails:
        result = await db.execute(select(User).where(User.email == email))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"Email already registered: {email}")

    for usn in existing_usns:
        result = await db.execute(select(TeamMember).where(TeamMember.usn == usn.upper()))
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"USN already registered: {usn}")

    # Create Guide
    guide = Guide(
        full_name=payload.guide.full_name,
        email=payload.guide.email,
        department=payload.guide.department,
    )
    db.add(guide)
    await db.flush()

    # Create Leader user
    leader = User(
        email=payload.leader_email,
        password_hash=hash_password(payload.leader_password),
        full_name=payload.leader_name,
        role="student_leader",
        status="pending",
    )
    db.add(leader)
    await db.flush()

    # Create Team
    team = Team(
        team_name=payload.team_name,
        leader_id=leader.id,
        guide_id=guide.id,
        status="pending",
    )
    db.add(team)
    await db.flush()

    # Add leader as member
    db.add(TeamMember(
        team_id=team.id,
        user_id=leader.id,
        usn=payload.leader_usn.upper(),
    ))

    # Create member users
    for m in payload.members:
        member_user = User(
            email=m.email,
            password_hash=hash_password(m.password),
            full_name=m.full_name,
            role="student_member",
            status="pending",
        )
        db.add(member_user)
        await db.flush()

        db.add(TeamMember(
            team_id=team.id,
            user_id=member_user.id,
            usn=m.usn.upper(),
        ))

    await db.commit()
    return MessageResponse(
        message="Team registration submitted. All members will gain access once approved by the administrator."
    )


# ── Password Reset Request ─────────────────────────────────────────────────
@router.post("/password-reset/request", response_model=MessageResponse)
async def request_password_reset(payload: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    # Always return success to prevent email enumeration
    if user:
        raw_token = str(uuid.uuid4())
        token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

        reset_token = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(reset_token)
        await db.commit()
        # In production: send email with reset link containing raw_token

    return MessageResponse(
        message="If an account exists with that email, a password reset link has been sent."
    )


# ── Password Reset Confirm ─────────────────────────────────────────────────
@router.post("/password-reset/confirm", response_model=MessageResponse)
async def confirm_password_reset(payload: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()

    result = await db.execute(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > datetime.now(timezone.utc),
        )
    )
    reset_token = result.scalar_one_or_none()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    # Update password
    user_result = await db.execute(select(User).where(User.id == reset_token.user_id))
    user = user_result.scalar_one()
    user.password_hash = hash_password(payload.new_password)
    reset_token.used = True

    await db.commit()
    return MessageResponse(message="Password updated successfully. You may now log in.")


# ── Me ─────────────────────────────────────────────────────────────────────
@router.get("/me")
async def get_me(db: AsyncSession = Depends(get_db)):
    from app.core.security import get_current_user
    from fastapi import Request
    return {"message": "Use Bearer token with /auth/me"}
