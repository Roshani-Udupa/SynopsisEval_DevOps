-- ============================================================
-- SYNOPSIS REVIEW PORTAL — PostgreSQL Database Schema
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('student_leader', 'student_member', 'reviewer', 'admin');
CREATE TYPE account_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE team_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE document_status AS ENUM ('uploaded', 'processing', 'completed', 'failed');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE email_status AS ENUM ('queued', 'sent', 'failed');

-- ============================================================
-- USERS TABLE
-- ============================================================

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    status          account_status NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin seed (password: admin123)
INSERT INTO users (email, password_hash, full_name, role, status)
VALUES (
    'admin@synopsis.edu',
    crypt('admin123', gen_salt('bf', 12)),
    'System Administrator',
    'admin',
    'approved'
);

-- ============================================================
-- REVIEWER PROFILES TABLE
-- ============================================================

CREATE TABLE reviewer_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department      VARCHAR(255),
    designation     VARCHAR(255),
    expertise       TEXT[],             -- Array of expertise tags
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- ============================================================
-- GUIDES TABLE (referenced by teams)
-- ============================================================

CREATE TABLE guides (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    department      VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TEAMS TABLE
-- ============================================================

CREATE TABLE teams (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name       VARCHAR(255) NOT NULL,
    leader_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    guide_id        UUID REFERENCES guides(id),
    status          team_status NOT NULL DEFAULT 'pending',
    scores_released BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_note  TEXT,               -- Admin note on rejection
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TEAM MEMBERS TABLE (students belonging to a team)
-- ============================================================

CREATE TABLE team_members (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usn         VARCHAR(50) NOT NULL,       -- University Seat Number
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id),
    UNIQUE(usn)
);

-- ============================================================
-- REVIEWER ASSIGNMENTS TABLE
-- ============================================================

CREATE TABLE reviewer_assignments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    assigned_by     UUID NOT NULL REFERENCES users(id),
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(reviewer_id, team_id)
);

-- ============================================================
-- DOCUMENTS TABLE
-- ============================================================

CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    file_name       VARCHAR(500) NOT NULL,
    file_path       TEXT NOT NULL,          -- Storage path / S3 key
    file_size_bytes BIGINT NOT NULL,
    mime_type       VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    version         INTEGER NOT NULL DEFAULT 1,
    is_latest       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one "latest" doc per team
CREATE UNIQUE INDEX idx_documents_team_latest
    ON documents(team_id) WHERE is_latest = TRUE;

-- ============================================================
-- PLAGIARISM JOBS TABLE (mocked Ollama integration)
-- ============================================================

CREATE TABLE plagiarism_jobs (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    triggered_by        UUID NOT NULL REFERENCES users(id),
    status              job_status NOT NULL DEFAULT 'pending',
    similarity_score    NUMERIC(5, 2),      -- e.g. 23.45 (percent)
    report_url          TEXT,               -- Mock URL
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    error_message       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id)
);

-- ============================================================
-- REVIEW SCORES TABLE
-- ============================================================

CREATE TABLE review_scores (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id             UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    reviewer_id         UUID NOT NULL REFERENCES users(id),
    relevance_score     NUMERIC(4, 1),      -- 0–10
    methodology_score   NUMERIC(4, 1),      -- 0–10
    presentation_score  NUMERIC(4, 1),      -- 0–10
    innovation_score    NUMERIC(4, 1),      -- 0–10
    total_score         NUMERIC(5, 1) GENERATED ALWAYS AS (
                            relevance_score + methodology_score +
                            presentation_score + innovation_score
                        ) STORED,
    feedback_text       TEXT,
    submitted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, reviewer_id)
);

-- ============================================================
-- EMAIL LOGS TABLE (mocked Nodemailer integration)
-- ============================================================

CREATE TABLE email_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sent_by         UUID NOT NULL REFERENCES users(id),
    recipient_type  VARCHAR(50) NOT NULL,   -- 'all_teams', 'specific_team', 'all_reviewers', 'specific_user'
    recipient_id    UUID,                   -- nullable; for specific targets
    subject         VARCHAR(500) NOT NULL,
    body            TEXT NOT NULL,
    template_used   VARCHAR(100),
    status          email_status NOT NULL DEFAULT 'queued',
    mock_sent_at    TIMESTAMPTZ,            -- When the mock "sent" it
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PASSWORD RESET TOKENS TABLE
-- ============================================================

CREATE TABLE password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================

CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id    UUID REFERENCES users(id),
    action      VARCHAR(200) NOT NULL,      -- e.g. 'TEAM_APPROVED', 'SCORE_RELEASED'
    entity_type VARCHAR(100),               -- e.g. 'team', 'document'
    entity_id   UUID,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_teams_leader ON teams(leader_id);
CREATE INDEX idx_teams_status ON teams(status);
CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_documents_team ON documents(team_id);
CREATE INDEX idx_plagiarism_jobs_doc ON plagiarism_jobs(document_id);
CREATE INDEX idx_review_scores_team ON review_scores(team_id);
CREATE INDEX idx_email_logs_sent_by ON email_logs(sent_by);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_teams_updated_at
    BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_review_scores_updated_at
    BEFORE UPDATE ON review_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
