# Synopsis Review Portal

A full-stack academic project synopsis review platform featuring student submission,
admin management, plagiarism checking (mocked), and reviewer scoring.

---

## Tech Stack

| Layer    | Technology                                    |
| -------- | --------------------------------------------- |
| Frontend | React 18 + TypeScript, Vite, Tailwind CSS     |
| Backend  | FastAPI (Python 3.11+), SQLAlchemy 2, asyncpg |
| Database | PostgreSQL 15+                                |
| Auth     | JWT (python-jose) + bcrypt                    |
| State    | Zustand (frontend)                            |
| Forms    | react-hook-form                               |
| File DnD | react-dropzone                                |
| Toasts   | react-hot-toast                               |

---

## Database Schema Overview

```
users                → All portal users (students, reviewers, admin)
reviewer_profiles    → Extra metadata for reviewers (dept, expertise)
guides               → Faculty guides assigned to teams
teams                → Student project teams
team_members         → Junction: users ↔ teams (with USN)
reviewer_assignments → Junction: reviewers ↔ teams
documents            → Uploaded PDF synopses (versioned)
plagiarism_jobs      → Mocked Ollama AI check jobs
review_scores        → Reviewer scores per team (4 criteria × 10 pts)
email_logs           → SMTP delivery log
password_reset_tokens→ Time-limited reset tokens
audit_logs           → Admin action history
```

---

## Project Structure

```
synopsis-portal/
├── database/
│   └── schema.sql                  ← Full PostgreSQL DDL
│
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py                 ← FastAPI app + CORS + startup
│       ├── core/
│       │   ├── config.py           ← Pydantic settings
│       │   ├── database.py         ← Async SQLAlchemy engine
│       │   └── security.py        ← JWT, bcrypt, role guards
│       ├── models/
│       │   └── user.py             ← All SQLAlchemy ORM models
│       ├── schemas/
│       │   └── auth.py             ← Pydantic request/response models
│       └── routers/
│           ├── auth.py             ← /api/auth/* (login, register, reset)
│           ├── admin.py            ← /api/admin/* (full admin CRUD)
│           └── student.py          ← /api/student/* (team, docs, results)
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.tsx
        ├── App.tsx                 ← All routes + role guards
        ├── index.css               ← Tailwind + custom classes
        ├── store/
        │   └── authStore.ts        ← Zustand auth store (persisted)
        ├── utils/
        │   └── api.ts              ← Axios client + interceptors
        ├── components/
        │   ├── ui/index.tsx        ← Button, Input, Badge, Modal, etc.
        │   └── layout/
        │       └── PortalLayout.tsx ← Sidebar layout shell
        └── pages/
            ├── auth/
            │   ├── LoginPage.tsx
            │   ├── TeamRegistrationPage.tsx
            │   ├── ReviewerRegistrationPage.tsx
            │   └── ForgotPasswordPage.tsx
            ├── student/
            │   ├── StudentDashboard.tsx
            │   ├── DocumentManagementPage.tsx ← Drag & drop upload
            │   └── ResultsPage.tsx            ← Gated by scores_released
            └── admin/
                ├── AdminDashboard.tsx         ← KPI cards
                ├── TeamManagementPage.tsx     ← Approve/reject
                ├── ReviewerManagementPage.tsx ← Approve + assign
                ├── DocumentHubPage.tsx        ← Plagiarism check (mocked)
                ├── ScoreDashboardPage.tsx     ← Publish toggle per team
                └── CommunicationsPage.tsx     ← Email log (SMTP delivery)
```

---

## Quick Start

### 1. PostgreSQL with Docker

```bash
docker compose up -d db
```

This starts PostgreSQL 16, creates the `synopsis_portal` database, and loads `database/schema.sql` the first time the container initializes.

Database URL for the FastAPI app running on your machine:

```text
postgresql+asyncpg://postgres:postgres@localhost:5432/synopsis_portal
```

If you later run FastAPI inside the same Docker Compose network, use:

```text
postgresql+asyncpg://postgres:postgres@db:5432/synopsis_portal
```

To reset the database and rerun the schema from scratch:

```bash
docker compose down -v
```

### 2. Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your SECRET_KEY and SMTP passowrd and username.

# Start server
uvicorn app.main:app --reload --port 8000
```

The API will be live at `http://localhost:8000`
Interactive docs at `http://localhost:8000/api/docs`

### 3. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The app will be live at `http://localhost:5173`

---

## Default Admin Login

```
Email:    admin@synopsis.edu
Password: admin123
```

> **Important:** Change this password immediately in production.

---

## API Endpoints

### Public (no auth)

| Method | Path                               | Description              |
| ------ | ---------------------------------- | ------------------------ |
| POST   | `/api/auth/login`                  | Login → JWT              |
| POST   | `/api/auth/register/team`          | Team registration wizard |
| POST   | `/api/auth/register/reviewer`      | Reviewer signup          |
| POST   | `/api/auth/password-reset/request` | Request reset link       |
| POST   | `/api/auth/password-reset/confirm` | Set new password         |

### Student (JWT required)

| Method | Path                            | Description              |
| ------ | ------------------------------- | ------------------------ |
| GET    | `/api/student/team`             | Get own team info        |
| GET    | `/api/student/documents`        | List team documents      |
| POST   | `/api/student/documents/upload` | Upload PDF (leader only) |
| GET    | `/api/student/results`          | Get scores (if released) |

### Admin (JWT + admin role)

| Method | Path                                          | Description             |
| ------ | --------------------------------------------- | ----------------------- |
| GET    | `/api/admin/dashboard/stats`                  | KPI summary             |
| GET    | `/api/admin/teams`                            | List all teams          |
| PATCH  | `/api/admin/teams/{id}/status`                | Approve/reject team     |
| PATCH  | `/api/admin/teams/{id}/release-scores`        | Toggle score visibility |
| GET    | `/api/admin/reviewers`                        | List all reviewers      |
| PATCH  | `/api/admin/reviewers/{id}/approve`           | Approve reviewer        |
| POST   | `/api/admin/reviewer-assignments`             | Assign reviewer to team |
| DELETE | `/api/admin/reviewer-assignments/{rid}/{tid}` | Remove assignment       |
| GET    | `/api/admin/documents`                        | List all documents      |
| POST   | `/api/admin/documents/{id}/plagiarism-check`  | Start mock check        |
| PATCH  | `/api/admin/documents/{id}/plagiarism-result` | Update mock result      |
| GET    | `/api/admin/score-dashboard`                  | All teams + scores      |
| POST   | `/api/admin/score-dashboard/publish-all`      | Publish all scores      |
| POST   | `/api/admin/communications/send`              | Send email via SMTP     |
| GET    | `/api/admin/email-logs`                       | Email history           |

---

## Role & Access Matrix

| Feature              | Admin | Leader | Member    | Reviewer |
| -------------------- | ----- | ------ | --------- | -------- |
| Approve/reject teams | ✅    | —      | —         | —        |
| Upload documents     | —     | ✅     | —         | —        |
| View documents       | —     | ✅     | ✅ (read) | —        |
| View scores          | —     | ✅\*   | ✅\*      | —        |
| Trigger plagiarism   | ✅    | —      | —         | —        |
| Submit review scores | —     | —      | —         | ✅       |
| Publish scores       | ✅    | —      | —         | —        |
| Send communications  | ✅    | —      | —         | —        |

\*Only when `scores_released = true` on the team record.
