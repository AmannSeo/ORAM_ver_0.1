# ORAM — Agentless SaaS Access Revocation Platform

> **Version:** 0.1.0 (University Capstone PoC)

ORAM is an agentless SaaS Access Management platform focused on **employee offboarding**. When an employee leaves the company, ORAM automatically identifies remaining accounts and permissions across connected SaaS platforms and helps administrators revoke those permissions from a single dashboard.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Entity Relationship Diagram](#entity-relationship-diagram)
3. [REST API Design](#rest-api-design)
4. [Database Schema](#database-schema)
5. [Backend Project Structure](#backend-project-structure)
6. [Frontend Project Structure](#frontend-project-structure)
7. [Local Development Setup](#local-development-setup)
8. [Sample Mock Data](#sample-mock-data)
9. [Plugin Architecture](#plugin-architecture)
10. [AI Risk Scoring Model](#ai-risk-scoring-model)

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ORAM Platform                            │
│                                                                  │
│  ┌──────────────┐    ┌────────────────────────────────────────┐ │
│  │  React + MUI │    │         Spring Boot 3 Backend           │ │
│  │  Frontend    │───▶│  ┌──────────┐  ┌──────────────────┐   │ │
│  │              │    │  │Controller│  │   Service Layer   │   │ │
│  │  Pages:      │    │  │  Layer   │  │                  │   │ │
│  │  - Dashboard │    │  │ /api/*   │  │ EmployeeService  │   │ │
│  │  - Employees │    │  └──────────┘  │ Offboarding Svc  │   │ │
│  │  - SaaS Conn │    │        │       │ SaaS Conn Svc    │   │ │
│  │  - Risk      │    │        ▼       │ Dashboard Svc    │   │ │
│  │  - Offboard  │    │  ┌──────────┐  │ Risk Analysis    │   │ │
│  └──────────────┘    │  │ Security │  └──────────────────┘   │ │
│         │            │  │ JWT+RBAC │          │               │ │
│         │ HTTP/REST  │  └──────────┘          ▼               │ │
│         └────────────▶  ┌──────────────────────────────────┐  │ │
│                      │  │        Connector Layer             │  │ │
│                      │  │  ┌──────────┐ ┌──────┐ ┌──────┐  │  │ │
│                      │  │  │  Slack   │ │GitHub│ │Notion│  │  │ │
│                      │  │  │Connector │ │ Conn │ │ Conn │  │  │ │
│                      │  │  └──────────┘ └──────┘ └──────┘  │  │ │
│                      │  │  (SaaSConnector interface)         │  │ │
│                      │  └──────────────────────────────────┘  │ │
│                      │          │                  │           │ │
│                      │          ▼                  ▼           │ │
│                      │  ┌──────────────┐  ┌─────────────────┐ │ │
│                      │  │  PostgreSQL  │  │  Risk Analysis  │ │ │
│                      │  │  (JPA/ORM)   │  │  (XGBoost PoC)  │ │ │
│                      │  └──────────────┘  └─────────────────┘ │ │
│                      └────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                 ▼
         Slack API         GitHub API        Notion API
         (users.list)   (orgs/members)     (/v1/users)
```

---

## Entity Relationship Diagram

```
┌─────────────────┐        ┌──────────────────────┐
│     users       │        │      employees        │
├─────────────────┤        ├──────────────────────┤
│ id (PK)         │        │ id (PK)              │
│ username (UNIQ) │        │ employee_id (UNIQ)   │
│ email (UNIQ)    │        │ name                 │
│ password        │        │ email (UNIQ)         │
│ full_name       │        │ department           │
│ role            │        │ status               │
│ enabled         │        │ offboarding_triggered│
│ created_at      │        │ resigned_at          │
│ updated_at      │        │ created_at           │
└─────────────────┘        │ updated_at           │
                           └──────────────────────┘
                                      │ 1
                                      │
                                      │ N
                           ┌──────────────────────┐
                           │  offboarding_results  │
                           ├──────────────────────┤
                           │ id (PK)              │
                           │ employee_id (FK)     │
                           │ status               │
                           │ risk_score           │
                           │ risk_level           │
                           │ total_permissions    │
                           │ revoked_permissions  │
                           │ initiated_at         │
                           │ completed_at         │
                           └──────────────────────┘
                                      │ 1
                                      │
                                      │ N
                           ┌──────────────────────┐
                           │     permissions       │
                           ├──────────────────────┤
                           │ id (PK)              │
                           │ offboarding_result_id│
                           │ platform             │
                           │ permission_type      │
                           │ permission_detail    │
                           │ is_admin             │
                           │ is_owner             │
                           │ has_api_token        │
                           │ revoke_status        │
                           │ revoked_at           │
                           │ discovered_at        │
                           └──────────────────────┘

┌──────────────────────┐   ┌──────────────────────┐
│   saas_connections   │   │     audit_logs        │
├──────────────────────┤   ├──────────────────────┤
│ id (PK)              │   │ id (PK)              │
│ platform (UNIQ)      │   │ actor_username       │
│ connected            │   │ action               │
│ access_token (enc)   │   │ target_type          │
│ refresh_token (enc)  │   │ target_id            │
│ workspace_id         │   │ details              │
│ workspace_name       │   │ ip_address           │
│ connected_by         │   │ created_at           │
│ last_synced_at       │   └──────────────────────┘
│ created_at           │
│ updated_at           │
└──────────────────────┘
```

---

## REST API Design

### Authentication

| Method | Endpoint          | Description           | Role   |
|--------|-------------------|-----------------------|--------|
| POST   | /api/auth/login   | Login with credentials | Public |
| GET    | /api/auth/me      | Get current user       | All    |
| POST   | /api/auth/logout  | Invalidate session     | All    |

### Dashboard

| Method | Endpoint              | Description          | Role     |
|--------|-----------------------|----------------------|----------|
| GET    | /api/dashboard/stats  | Get dashboard stats  | All      |

### Employees (HR Integration)

| Method | Endpoint            | Description          | Role            |
|--------|---------------------|----------------------|-----------------|
| GET    | /api/employees      | List all employees   | Admin, SecMgr   |
| GET    | /api/employees/{id} | Get employee by ID   | Admin, SecMgr   |
| POST   | /api/employees      | Create employee      | Admin, SecMgr   |
| PUT    | /api/employees/{id} | Update employee      | Admin, SecMgr   |
| DELETE | /api/employees/{id} | Delete employee      | Admin           |

### SaaS Connections

| Method | Endpoint                              | Description            | Role          |
|--------|---------------------------------------|------------------------|---------------|
| GET    | /api/saas/connections                 | List all connections   | Admin, SecMgr |
| GET    | /api/saas/connections/{platform}      | Get connection status  | Admin, SecMgr |
| POST   | /api/saas/connections/{platform}/connect    | Connect platform | Admin, SecMgr |
| POST   | /api/saas/connections/{platform}/disconnect | Disconnect       | Admin, SecMgr |
| GET    | /api/saas/oauth2/authorize/{platform} | Get OAuth URL          | Admin, SecMgr |

### Offboarding

| Method | Endpoint                        | Description                | Role          |
|--------|---------------------------------|----------------------------|---------------|
| GET    | /api/offboarding                | List all offboarding results | All          |
| GET    | /api/offboarding/{id}           | Get result by ID           | All           |
| GET    | /api/offboarding/employee/{id}  | Results for employee       | All           |
| POST   | /api/offboarding/initiate/{id}  | Initiate offboarding       | Admin, SecMgr |
| POST   | /api/offboarding/{id}/revoke-all| Revoke all access          | Admin, SecMgr |

---

## Database Schema

```sql
-- Users table (RBAC)
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(100) UNIQUE NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password    VARCHAR(255) NOT NULL,  -- BCrypt hashed
    full_name   VARCHAR(255),
    role        VARCHAR(50) NOT NULL DEFAULT 'AUDITOR',
    enabled     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Employees table (HR Integration)
CREATE TABLE employees (
    id                    BIGSERIAL PRIMARY KEY,
    employee_id           VARCHAR(50) UNIQUE NOT NULL,
    name                  VARCHAR(255) NOT NULL,
    email                 VARCHAR(255) UNIQUE NOT NULL,
    department            VARCHAR(100) NOT NULL,
    status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    offboarding_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    resigned_at           TIMESTAMP,
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- SaaS connections
CREATE TABLE saas_connections (
    id              BIGSERIAL PRIMARY KEY,
    platform        VARCHAR(50) UNIQUE NOT NULL,
    connected       BOOLEAN NOT NULL DEFAULT FALSE,
    access_token    TEXT,     -- AES-256 encrypted
    refresh_token   TEXT,     -- AES-256 encrypted
    workspace_id    VARCHAR(255),
    workspace_name  VARCHAR(255),
    connected_by    VARCHAR(100),
    last_synced_at  TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Offboarding results
CREATE TABLE offboarding_results (
    id                  BIGSERIAL PRIMARY KEY,
    employee_id         BIGINT NOT NULL REFERENCES employees(id),
    status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    risk_score          INTEGER,
    risk_level          VARCHAR(20),
    total_permissions   INTEGER NOT NULL DEFAULT 0,
    revoked_permissions INTEGER NOT NULL DEFAULT 0,
    initiated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at        TIMESTAMP
);

-- Permissions discovered during offboarding
CREATE TABLE permissions (
    id                    BIGSERIAL PRIMARY KEY,
    offboarding_result_id BIGINT NOT NULL REFERENCES offboarding_results(id),
    platform              VARCHAR(50) NOT NULL,
    permission_type       VARCHAR(100) NOT NULL,
    permission_detail     VARCHAR(500),
    is_admin              BOOLEAN NOT NULL DEFAULT FALSE,
    is_owner              BOOLEAN NOT NULL DEFAULT FALSE,
    has_api_token         BOOLEAN NOT NULL DEFAULT FALSE,
    revoke_status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    revoked_at            TIMESTAMP,
    discovered_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Audit logs
CREATE TABLE audit_logs (
    id             BIGSERIAL PRIMARY KEY,
    actor_username VARCHAR(100) NOT NULL,
    action         VARCHAR(255) NOT NULL,
    target_type    VARCHAR(100),
    target_id      VARCHAR(100),
    details        TEXT,
    ip_address     VARCHAR(45),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## Backend Project Structure

```
backend/
├── Dockerfile
├── pom.xml
└── src/main/java/com/oram/
    ├── OramApplication.java
    ├── config/
    │   ├── SecurityConfig.java
    │   ├── HttpClientConfig.java
    │   └── DataInitializer.java
    ├── controller/
    │   ├── AuthController.java
    │   ├── DashboardController.java
    │   ├── EmployeeController.java
    │   ├── SaaSController.java
    │   └── OffboardingController.java
    ├── service/
    │   ├── EmployeeService.java
    │   ├── OffboardingService.java
    │   ├── SaaSConnectionService.java
    │   ├── DashboardService.java
    │   └── AuditService.java
    ├── repository/ (JPA repositories)
    ├── entity/ (JPA entities)
    ├── connector/
    │   ├── SaaSConnector.java     ← Plugin interface
    │   ├── SlackConnector.java
    │   ├── GitHubConnector.java
    │   └── NotionConnector.java
    ├── risk/
    │   ├── RiskFeatures.java
    │   └── RiskAnalysisService.java
    ├── security/
    │   ├── JwtUtil.java
    │   ├── JwtAuthFilter.java
    │   └── CustomUserDetailsService.java
    └── dto/
        ├── request/
        └── response/
```

---

## Frontend Project Structure

```
frontend/
├── Dockerfile
├── nginx.conf
├── package.json
├── tsconfig.json
└── src/
    ├── index.tsx
    ├── App.tsx
    ├── types/index.ts
    ├── context/AuthContext.tsx
    ├── services/api.ts
    ├── components/
    │   ├── Layout.tsx
    │   └── Sidebar.tsx
    └── pages/
        ├── Login.tsx
        ├── Dashboard.tsx
        ├── Employees.tsx
        ├── SaaSConnections.tsx
        ├── RiskAnalysis.tsx
        └── OffboardingResults.tsx
```

---

## Local Development Setup

### Prerequisites

- Java 17 (JDK)
- Maven 3.9+
- Node.js 20+
- Docker & Docker Compose

### Option A: Docker Compose (Recommended)

```bash
# Start all services
docker compose up -d

# Access:
# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
```

### Option B: Manual

```bash
# 1. Start PostgreSQL
docker run -d --name oram_postgres \
  -e POSTGRES_DB=oram_db -e POSTGRES_USER=oram_user -e POSTGRES_PASSWORD=oram_password \
  -p 5432:5432 postgres:16-alpine

# 2. Start Backend
cd backend && mvn spring-boot:run

# 3. Start Frontend
cd frontend && npm install && npm start
```

### Default Login Credentials

| Username     | Password       | Role             |
|--------------|----------------|------------------|
| admin        | Admin1234!     | ADMIN            |
| security_mgr | Security1234!  | SECURITY_MANAGER |
| auditor      | Auditor1234!   | AUDITOR          |

---

## Sample Mock Data

**Mock Employees:**

| ID     | Name          | Email               | Status   | Risk Score |
|--------|---------------|---------------------|----------|------------|
| EMP001 | Alice Johnson | alice@company.com   | ACTIVE   | —          |
| EMP002 | Bob Smith     | bob@company.com     | RESIGNED | 95 CRITICAL|
| EMP003 | Charlie Brown | charlie@company.com | ACTIVE   | —          |
| EMP004 | Diana Prince  | diana@company.com   | RESIGNED | 62 HIGH    |

**Mock Permissions (Bob Smith - Risk 95 CRITICAL):**
- SLACK: Member, Admin
- GITHUB: Repository Access (5 repos, PAT), Organization Owner
- NOTION: Workspace Member

---

## Plugin Architecture

Add a new SaaS connector in 3 steps:

1. Create a class implementing `SaaSConnector`
2. Annotate with `@Component`
3. Spring auto-discovers it — no other changes needed

---

## AI Risk Scoring Model

**Features & Weights:**

| Feature               | Weight | Description                        |
|-----------------------|--------|------------------------------------|
| Is Owner              | 40%    | Org ownership on any platform      |
| Is Admin              | 28%    | Admin privileges (non-owner)       |
| Has API Token         | 20%    | Active PATs or service account keys|
| Recent Login          | 15%    | Activity within last 30 days       |
| Repository Breadth    | 15%    | Number of accessible repos         |
| Multi-platform        | 10%    | Platforms with access              |

**Risk Bands:** LOW (0-24) · MEDIUM (25-49) · HIGH (50-74) · CRITICAL (75-100)