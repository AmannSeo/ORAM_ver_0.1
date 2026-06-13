# ORAM REST API Design

Base URL: `http://localhost:8080/api`

Authorization: `Bearer <JWT_TOKEN>` (모든 엔드포인트, `/auth/**` 제외)

---

## 1. Auth API

### POST /auth/login
관리자 로그인 및 JWT 발급

**Request Body:**
```json
{
  "email": "admin@company.com",
  "password": "secret123"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "id": "uuid",
    "email": "admin@company.com",
    "name": "Admin",
    "role": "ADMIN"
  }
}
```

---

## 2. Dashboard API

### GET /dashboard/stats
대시보드 통계 조회

**Roles:** ADMIN, SECURITY_MANAGER, AUDITOR

**Response 200:**
```json
{
  "totalEmployees": 150,
  "activeEmployees": 142,
  "resignedEmployees": 8,
  "connectedSaasCount": 3,
  "criticalRiskCount": 2,
  "pendingOffboardings": 3
}
```

---

## 3. Employee API

### GET /employees
직원 목록 조회

**Roles:** ADMIN, SECURITY_MANAGER, AUDITOR

**Query Params:**
- `status` (optional): `ACTIVE` | `RESIGNED`
- `department` (optional): 부서명
- `page` (default: 0), `size` (default: 20)

**Response 200:**
```json
{
  "content": [
    {
      "id": "uuid",
      "employeeId": "EMP001",
      "name": "홍길동",
      "email": "hong@company.com",
      "department": "Engineering",
      "status": "ACTIVE",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "totalElements": 150,
  "totalPages": 8,
  "page": 0,
  "size": 20
}
```

### GET /employees/{id}
직원 상세 조회

**Response 200:**
```json
{
  "id": "uuid",
  "employeeId": "EMP001",
  "name": "홍길동",
  "email": "hong@company.com",
  "department": "Engineering",
  "status": "ACTIVE",
  "offboardingHistory": []
}
```

### POST /employees
직원 등록

**Roles:** ADMIN

**Request Body:**
```json
{
  "employeeId": "EMP010",
  "name": "김철수",
  "email": "kim@company.com",
  "department": "Marketing",
  "status": "ACTIVE"
}
```

### PUT /employees/{id}
직원 정보 수정

### PUT /employees/{id}/resign
직원 퇴사 처리 → 오프보딩 워크플로우 자동 트리거

**Roles:** ADMIN, SECURITY_MANAGER

**Response 200:**
```json
{
  "message": "Employee resigned. Offboarding workflow triggered.",
  "offboardingResultId": "uuid"
}
```

### DELETE /employees/{id}
직원 삭제 (소프트 삭제)

**Roles:** ADMIN

---

## 4. SaaS Connection API

### GET /saas-connections
연결된 SaaS 목록 조회

**Response 200:**
```json
[
  {
    "id": "uuid",
    "saasType": "SLACK",
    "workspaceName": "My Company",
    "isConnected": true,
    "connectedAt": "2025-06-01T10:00:00Z",
    "connectedBy": "admin@company.com"
  },
  {
    "id": null,
    "saasType": "GITHUB",
    "workspaceName": null,
    "isConnected": false,
    "connectedAt": null
  },
  {
    "id": null,
    "saasType": "NOTION",
    "workspaceName": null,
    "isConnected": false,
    "connectedAt": null
  }
]
```

### GET /saas-connections/oauth/authorize/{saasType}
OAuth 인증 URL 반환

**Response 200:**
```json
{
  "authorizationUrl": "https://slack.com/oauth/v2/authorize?client_id=...&scope=..."
}
```

### GET /saas-connections/oauth/callback/{saasType}
OAuth 콜백 처리 (토큰 저장)

**Query Params:** `code`, `state`

### DELETE /saas-connections/{saasType}
SaaS 연결 해제

**Roles:** ADMIN

---

## 5. Offboarding API

### GET /offboarding
오프보딩 결과 목록

**Response 200:**
```json
[
  {
    "id": "uuid",
    "employee": {
      "id": "uuid",
      "name": "홍길동",
      "email": "hong@company.com"
    },
    "status": "COMPLETED",
    "riskScore": 95,
    "riskLevel": "CRITICAL",
    "startedAt": "2025-06-10T09:00:00Z",
    "revokedAll": false
  }
]
```

### GET /offboarding/{resultId}
오프보딩 상세 결과 조회

**Response 200:**
```json
{
  "id": "uuid",
  "employee": {
    "id": "uuid",
    "name": "홍길동",
    "email": "hong@company.com",
    "department": "Engineering"
  },
  "status": "COMPLETED",
  "riskScore": 95,
  "riskLevel": "CRITICAL",
  "permissions": [
    {
      "saasType": "SLACK",
      "permissionType": "ADMIN",
      "resourceName": "My Company Workspace",
      "isAdmin": true,
      "isOwner": false,
      "hasApiToken": false,
      "recentLogin": true
    },
    {
      "saasType": "GITHUB",
      "permissionType": "OWNER",
      "resourceName": "company-org",
      "isAdmin": true,
      "isOwner": true,
      "hasApiToken": true,
      "recentLogin": true,
      "repoCount": 42
    },
    {
      "saasType": "NOTION",
      "permissionType": "MEMBER",
      "resourceName": "Company Workspace",
      "isAdmin": false,
      "isOwner": false,
      "workspaceCount": 1
    }
  ],
  "recommendedActions": [
    "즉시 GitHub Organization Owner 권한 해제 필요",
    "GitHub PAT 토큰 즉시 무효화",
    "Slack Admin 권한 해제"
  ],
  "revokedAll": false,
  "startedAt": "2025-06-10T09:00:00Z"
}
```

### POST /offboarding/{resultId}/revoke-all
전체 권한 일괄 해제

**Roles:** ADMIN, SECURITY_MANAGER

**Response 200:**
```json
{
  "message": "All access revoked successfully.",
  "revokedAt": "2025-06-10T09:05:00Z",
  "revokedSaas": ["SLACK", "GITHUB", "NOTION"]
}
```

---

## 6. Risk Analysis API

### GET /risk-analysis
리스크 분석 목록 (전체 직원 기준)

### POST /risk-analysis/score
리스크 점수 즉시 계산

**Request Body:**
```json
{
  "isAdmin": true,
  "isOwner": true,
  "hasApiToken": true,
  "recentLogin": true,
  "repoCount": 42,
  "workspaceCount": 3
}
```

**Response 200:**
```json
{
  "score": 95,
  "level": "CRITICAL",
  "breakdown": {
    "adminWeight": 25,
    "ownerWeight": 20,
    "apiTokenWeight": 20,
    "recentLoginWeight": 15,
    "repoWeight": 10,
    "workspaceWeight": 5
  }
}
```

---

## 7. Audit Log API

### GET /audit-logs
감사 로그 조회

**Roles:** ADMIN, AUDITOR

**Query Params:** `page`, `size`, `action`, `targetType`

**Response 200:**
```json
{
  "content": [
    {
      "id": "uuid",
      "user": "admin@company.com",
      "action": "REVOKE_ALL",
      "targetType": "EMPLOYEE",
      "targetId": "EMP001",
      "detail": "Revoked all access for hong@company.com",
      "ipAddress": "192.168.1.1",
      "createdAt": "2025-06-10T09:05:00Z"
    }
  ],
  "totalElements": 250
}
```

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | 성공 |
| 201 | 생성 성공 |
| 400 | 잘못된 요청 |
| 401 | 인증 실패 |
| 403 | 권한 없음 |
| 404 | 리소스 없음 |
| 409 | 충돌 (중복 등) |
| 500 | 서버 내부 오류 |

## RBAC 권한 매트릭스

| Endpoint | ADMIN | SECURITY_MANAGER | AUDITOR |
|----------|-------|-----------------|---------|
| GET /dashboard | ✅ | ✅ | ✅ |
| GET /employees | ✅ | ✅ | ✅ |
| POST/PUT /employees | ✅ | ❌ | ❌ |
| PUT /employees/{id}/resign | ✅ | ✅ | ❌ |
| GET /saas-connections | ✅ | ✅ | ✅ |
| DELETE /saas-connections | ✅ | ❌ | ❌ |
| POST /offboarding/{id}/revoke-all | ✅ | ✅ | ❌ |
| GET /audit-logs | ✅ | ❌ | ✅ |
