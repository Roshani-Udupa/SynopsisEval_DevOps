import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str          # student_leader | student_member | reviewer | admin
    full_name: str
    status: str        # pending | approved | rejected


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str
    confirm_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordResetConfirm":
        if self.new_password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self



class ReviewerRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    department: Optional[str] = None
    designation: Optional[str] = None
    expertise: Optional[list[str]] = None   

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if len(v.strip()) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v.strip()



class MemberInput(BaseModel):
    full_name: str
    email: EmailStr
    usn: str           # University Seat Number, e.g. "1AB21CS042"
    password: str

    @field_validator("usn")
    @classmethod
    def normalise_usn(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip()


class GuideInput(BaseModel):
    full_name: str
    email: EmailStr
    department: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        return v.strip()


class TeamRegisterRequest(BaseModel):
    # Team info
    team_name: str

    # Leader (also becomes a team member with student_leader role)
    leader_name: str
    leader_email: EmailStr
    leader_usn: str
    leader_password: str

    # Additional members (student_member role)
    members: list[MemberInput]

    # Faculty guide
    guide: GuideInput

    @field_validator("team_name")
    @classmethod
    def validate_team_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Team name must be at least 3 characters")
        return v

    @field_validator("leader_usn")
    @classmethod
    def normalise_leader_usn(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("leader_password")
    @classmethod
    def validate_leader_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        return v

    @model_validator(mode="after")
    def no_duplicate_usns(self) -> "TeamRegisterRequest":
        all_usns = [self.leader_usn] + [m.usn for m in self.members]
        if len(all_usns) != len(set(all_usns)):
            raise ValueError("Duplicate USN found — each member must have a unique USN")
        all_emails = [str(self.leader_email)] + [str(m.email) for m in self.members]
        if len(all_emails) != len(set(all_emails)):
            raise ValueError("Duplicate email found — each member must have a unique email")
        return self


# ══════════════════════════════════════════════════════════════════════════
#  Shared Response Schemas
# ══════════════════════════════════════════════════════════════════════════

class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    message: str
    success: bool = True
