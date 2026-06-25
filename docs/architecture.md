# ORAM System Architecture

## Overview

ORAM (Offboarding & Revocation Access Manager) is an Agentless SaaS Access Management platform built on a layered Spring Boot + React architecture.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ORAM Platform                            │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                   Frontend (React + MUI)                  │  │
│  │  Dashboard │ Employees │ SaaS Connections │ Risk Analysis │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │ REST / JWT                        │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │                 Backend (Spring Boot 3)                   │  │
│  │                                                          │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │  Controller  │  │   Service    │  │   Repository   │  │  │
│  │  │    Layer     │  │    Layer     │  │     Layer      │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └───────┬────────┘  │  │
│  │         │                 │                   │           │  │
│  │  ┌──────▼─────────────────▼───────────┐       │           │  │
│  │  │        Connector Layer (Plugin)     │       │           │  │
│  │  │  SaaSConnector (Interface)          │       │           │  │
│  │  │  ├── SlackConnector                │       │           │  │
│  │  │  ├── GitHubConnector               │       │           │  │
│  │  │  └── NotionConnector               │       │           │  │
│  │  └────────────────────────────────────┘       │           │  │
│  │                                               │           │  │
│  │  ┌─────────────────────────────────┐          │           │  │
│  │  │   Risk Analysis Layer           │          │           │  │
│  │  │   XGBoost Scorer + TreeSHAP     │          │           │  │
│  │  └─────────────────────────────────┘          │           │  │
│  └────────────────────────────────────────┬───────┘           │  │
│                                           │ JPA               │  │
│  ┌────────────────────────────────────────▼───────────────┐  │  │
│  │              PostgreSQL Database                        │  │  │
│  │  users │ employees │ saas_connections │ audit_logs     │  │  │
│  └─────────────────────────────────────────────────────────┘  │  │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  Slack   │        │  GitHub  │        │  Notion  │
   │  API     │        │  API     │        │  API     │
   └──────────┘        └──────────┘        └──────────┘
```

---

## Layer Responsibilities

### Controller Layer
- HTTP 요청 수신 및 응답 반환
- JWT 인증 처리
- RBAC 권한 검사 (`@PreAuthorize`)
- DTO 변환

### Service Layer
- 비즈니스 로직
- 오프보딩 워크플로우 오케스트레이션
- Connector 호출 및 결과 집계
- Risk Score 계산 트리거

### Repository Layer
- JPA Repository 인터페이스
- DB CRUD 연산

### Connector Layer (Plugin Architecture)
```
SaaSConnector (interface)
    ├── connect(token)
    ├── disconnect(connectionId)
    ├── getUsers(email)
    ├── getPermissions(email)
    └── revokeAccess(email)

구현체:
    SlackConnector   → Slack Web API
    GitHubConnector  → GitHub REST API
    NotionConnector  → Notion API
    (Future: JiraConnector, SalesforceConnector, ...)
```

### Risk Analysis Layer
- `RiskFeatures` 입력 객체 수집 (실수집 6피처: admin/owner/apiToken/recentLogin/repoCount/workspaceCount)
- `XGBoostRiskAnalyzer`가 Python 모델 서버(`ai-service`)를 호출해 0~100 위험 점수와 **TreeSHAP 기여도**를 받음
- 모델 서버 미가동 시 동일 규칙의 Java 근사 가중치로 폴백
- 관리자 결정(`revokedAll`/`falsePositive`)을 라벨로 **Champion–Challenger 재학습** 가능 (`/retrain`·`/promote`)

---

## Security Architecture

```
Client Request
    │
    ▼
JwtAuthenticationFilter   ← JWT 토큰 검증
    │
    ▼
SecurityFilterChain       ← RBAC (Admin / SecurityManager / Auditor)
    │
    ▼
Controller (@PreAuthorize)
    │
    ▼
AuditService              ← 모든 접근 변경사항 감사 로그 기록
```

OAuth 토큰은 AES-256-GCM 으로 암호화하여 DB 저장.

---

## Offboarding Workflow

```
1. HR → PUT /api/employees/{id}/resign
2. OffboardingService.triggerOffboarding(employee)
3. ConnectorRegistry → 연결된 모든 SaaS에 getPermissions(email) 호출
4. PermissionRecord 집계 → DB 저장
5. RiskAnalyzer.score(features) → RiskScore 산출
6. OffboardingResult 생성 → Dashboard 반영
7. Admin → POST /api/offboarding/{resultId}/revoke-all
8. 각 Connector.revokeAccess(email) 호출
9. AuditLog 기록
```

---

## Plugin Extension Guide

새 SaaS 추가 방법:
1. `SaaSConnector` 인터페이스 구현체 작성 (e.g., `JiraConnector.java`)
2. `@Component` + `@Qualifier("jira")` 애노테이션 부여
3. `ConnectorRegistry`에 자동 등록 (Spring Bean 스캔)
4. `SaasType` enum에 `JIRA` 추가
5. 프론트엔드 SaaS Connections 페이지에 카드 추가
