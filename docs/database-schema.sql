-- ============================================================
-- ORAM Database Schema
-- PostgreSQL 14+
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. Users (ORAM 관리자 계정)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(100) NOT NULL,
    role            VARCHAR(50)  NOT NULL CHECK (role IN ('ADMIN', 'SECURITY_MANAGER', 'AUDITOR')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 2. Employees (HR 직원 정보)
-- ============================================================
CREATE TABLE IF NOT EXISTS employees (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id     VARCHAR(50)  NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    department      VARCHAR(100) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESIGNED')),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 3. SaaS Connections (OAuth 연결 정보)
-- ============================================================
CREATE TABLE IF NOT EXISTS saas_connections (
    id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    saas_type                VARCHAR(50)  NOT NULL UNIQUE CHECK (saas_type IN ('SLACK', 'GITHUB', 'NOTION')),
    access_token_encrypted   TEXT,
    refresh_token_encrypted  TEXT,
    workspace_id             VARCHAR(255),
    workspace_name           VARCHAR(255),
    is_connected             BOOLEAN NOT NULL DEFAULT FALSE,
    connected_at             TIMESTAMP WITH TIME ZONE,
    expires_at               TIMESTAMP WITH TIME ZONE,
    connected_by             UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. Offboarding Results (오프보딩 워크플로우 결과)
-- ============================================================
CREATE TABLE IF NOT EXISTS offboarding_results (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    risk_score      INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
    risk_level      VARCHAR(20) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    started_at      TIMESTAMP WITH TIME ZONE,
    completed_at    TIMESTAMP WITH TIME ZONE,
    revoked_all     BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. Permission Records (발견된 권한 기록)
-- ============================================================
CREATE TABLE IF NOT EXISTS permission_records (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offboarding_result_id   UUID NOT NULL REFERENCES offboarding_results(id) ON DELETE CASCADE,
    saas_type               VARCHAR(50) NOT NULL CHECK (saas_type IN ('SLACK', 'GITHUB', 'NOTION')),
    permission_type         VARCHAR(100) NOT NULL,
    resource_name           VARCHAR(255),
    is_admin                BOOLEAN NOT NULL DEFAULT FALSE,
    is_owner                BOOLEAN NOT NULL DEFAULT FALSE,
    has_api_token           BOOLEAN NOT NULL DEFAULT FALSE,
    recent_login            BOOLEAN NOT NULL DEFAULT FALSE,
    repo_count              INTEGER NOT NULL DEFAULT 0,
    workspace_count         INTEGER NOT NULL DEFAULT 0,
    discovered_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. Audit Logs (감사 로그)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       VARCHAR(255),
    detail          TEXT,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_employees_status     ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_email      ON employees(email);
CREATE INDEX IF NOT EXISTS idx_offboarding_employee ON offboarding_results(employee_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_status   ON offboarding_results(status);
CREATE INDEX IF NOT EXISTS idx_offboarding_risk     ON offboarding_results(risk_level);
CREATE INDEX IF NOT EXISTS idx_permissions_result   ON permission_records(offboarding_result_id);
CREATE INDEX IF NOT EXISTS idx_audit_user           ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created        ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action         ON audit_logs(action);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at     BEFORE UPDATE ON users     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
