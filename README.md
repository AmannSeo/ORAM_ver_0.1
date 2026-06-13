# ORAM — Offboarding & Revocation Access Manager

> **University Capstone PoC** | Agentless SaaS Access Management Platform

ORAM은 직원 퇴사 시 연결된 SaaS 플랫폼(Slack, GitHub, Notion)의 잔여 권한을 자동으로 탐지하고, 단일 대시보드에서 일괄 해제할 수 있는 **Agentless SaaS 접근 관리 플랫폼**입니다.

---

## Architecture Overview

```
React + MUI Frontend (port 5173)
         │ REST + JWT
Spring Boot 3 Backend (port 8080)
    ├── Controller Layer
    ├── Service Layer
    ├── Connector Layer (Plugin Architecture)
    │   ├── SlackConnector
    │   ├── GitHubConnector
    │   └── NotionConnector
    └── Risk Analysis (XGBoost Scorer)
         │ JPA
PostgreSQL Database (port 5432)
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🔐 OAuth 2.0 | Slack, GitHub, Notion OAuth 연결 |
| 👥 HR Integration | 직원 상태 관리 (Active/Resigned) |
| 🤖 AI Risk Scoring | XGBoost 기반 리스크 점수 (0-100) |
| 🔌 Plugin Architecture | `SaaSConnector` 인터페이스로 확장 가능 |
| 🛡️ RBAC | Admin / Security Manager / Auditor 역할 |
| 📋 Audit Log | 모든 접근 변경 이력 기록 |
| 🔒 Token Encryption | AES-256-GCM OAuth 토큰 암호화 |

---

## Quick Start

### Prerequisites
- Java 21+, Maven 3.9+
- Node.js 18+
- PostgreSQL 14+ (또는 Docker)

### 1. Database

```bash
# Docker
docker run -d --name oram-postgres \
  -e POSTGRES_DB=oram_db \
  -e POSTGRES_USER=oram_user \
  -e POSTGRES_PASSWORD=oram_pass \
  -p 5432:5432 postgres:16-alpine

# Schema
psql -U oram_user -d oram_db -f docs/database-schema.sql

# Sample data (optional)
psql -U oram_user -d oram_db -f docs/sample-data.sql
```

### 2. Backend

```bash
cd backend
mvn spring-boot:run
```

Backend runs on `http://localhost:8080`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

### 4. Login

```
URL:      http://localhost:5173/login
Email:    admin@oram.local
Password: Admin1234!
```

---

## Offboarding Workflow

```
1. HR marks employee as Resigned
2. ORAM searches all connected SaaS platforms by email
3. Permissions collected (Slack Admin, GitHub Owner, Notion Member, ...)
4. XGBoost risk score calculated (0-100)
5. Results displayed on dashboard
6. Admin clicks "Revoke All Access" → all permissions removed
```

---

## Risk Score Examples

| Profile | Score | Level |
|---------|-------|-------|
| GitHub Owner + Slack Admin + PAT Token | **95** | 🔴 CRITICAL |
| Admin, no recent login | **35** | 🟡 MEDIUM |
| Regular member, recent login | **18** | 🟢 LOW |

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/architecture.md](docs/architecture.md) | System Architecture Diagram |
| [docs/erd.md](docs/erd.md) | ERD & Table Descriptions |
| [docs/api-design.md](docs/api-design.md) | REST API Design |
| [docs/database-schema.sql](docs/database-schema.sql) | PostgreSQL Schema |
| [docs/sample-data.sql](docs/sample-data.sql) | Mock Data |
| [docs/setup-guide.md](docs/setup-guide.md) | Local Development Guide |
| [scripts/train_risk_model.py](scripts/train_risk_model.py) | XGBoost Training Script |

---

## Tech Stack

**Backend**
- Java 21, Spring Boot 3.3
- Spring Security + JWT (jjwt 0.12)
- Spring Data JPA + PostgreSQL
- WebFlux (SaaS API HTTP 클라이언트)
- AES-256-GCM Token Encryption

**Frontend**
- React 18 + TypeScript
- Material UI v5
- React Router v6
- Axios + Zustand
- Vite + Recharts

**AI/ML**
- XGBoost (PoC: weighted scorer, 교체 가능)
- Python training script (`scripts/train_risk_model.py`)

---

## Adding New SaaS Connectors

1. `SaaSConnector` 인터페이스 구현
2. `@Component` 등록 → `ConnectorRegistry`에 자동 반영
3. `SaasType` enum에 추가
4. 프론트엔드 카드 추가

```java
@Component
public class JiraConnector implements SaaSConnector {
    @Override
    public SaasType getSaasType() { return SaasType.JIRA; }
    // ... implement other methods
}
```

---

## RBAC Roles

| Role | Dashboard | Employees | SaaS | Revoke | Audit |
|------|-----------|-----------|------|--------|-------|
| ADMIN | ✅ | ✅ CRUD | ✅ Connect/Disconnect | ✅ | ✅ |
| SECURITY_MANAGER | ✅ | ✅ View + Resign | ✅ View | ✅ | ❌ |
| AUDITOR | ✅ | ✅ View | ✅ View | ❌ | ✅ |

---

*ORAM v0.1 — University Capstone Project*