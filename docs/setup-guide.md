# ORAM Local Development Setup Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Java | 21+ | OpenJDK or Eclipse Temurin |
| Maven | 3.9+ | 또는 `./mvnw` wrapper 사용 |
| Node.js | 18+ | LTS 권장 |
| PostgreSQL | 14+ | 로컬 설치 또는 Docker |
| Docker | 24+ | Optional (DB 컨테이너용) |

---

## 1. Database Setup

### Option A: Docker (권장)

```bash
docker run -d \
  --name oram-postgres \
  -e POSTGRES_DB=oram_db \
  -e POSTGRES_USER=oram_user \
  -e POSTGRES_PASSWORD=oram_pass \
  -p 5432:5432 \
  postgres:16-alpine
```

### Option B: 로컬 PostgreSQL 설치

```sql
-- psql에서 실행
CREATE DATABASE oram_db;
CREATE USER oram_user WITH PASSWORD 'oram_pass';
GRANT ALL PRIVILEGES ON DATABASE oram_db TO oram_user;
```

### 스키마 초기화

```bash
psql -U oram_user -d oram_db -f docs/database-schema.sql
```

### 샘플 데이터 삽입 (선택사항)

```bash
psql -U oram_user -d oram_db -f docs/sample-data.sql
```

---

## 2. Backend Setup

### 2-1. 환경변수 설정

`backend/` 디렉토리에 `.env` 파일 생성 (또는 시스템 환경변수):

```env
DB_USERNAME=oram_user
DB_PASSWORD=oram_pass
JWT_SECRET=oram-super-secret-key-must-be-at-least-256-bits-long-for-hs256-algorithm
ENCRYPTION_KEY=dGhpcy1pcy1hLTMyLWJ5dGUta2V5LWZvci1hZXMyNTY=

# OAuth (실제 앱 등록 후 설정)
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
NOTION_CLIENT_ID=your-notion-client-id
NOTION_CLIENT_SECRET=your-notion-client-secret
```

> **PoC 참고**: OAuth 자격증명 없이도 Mock 데이터로 동작합니다.

### 2-2. 빌드 및 실행

```bash
cd backend
mvn clean package -DskipTests
mvn spring-boot:run
```

또는 IDE에서 `OramApplication.java` 실행.

### 2-3. 초기 계정 확인

서버 시작 시 자동 생성되는 계정:

| Email | Password | Role |
|-------|----------|------|
| admin@oram.local | Admin1234! | ADMIN |
| security@oram.local | Security1234! | SECURITY_MANAGER |
| auditor@oram.local | Auditor1234! | AUDITOR |

### 2-4. API 테스트

```bash
# 로그인
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@oram.local","password":"Admin1234!"}'

# 대시보드 통계 (토큰 필요)
curl http://localhost:8080/api/dashboard/stats \
  -H "Authorization: Bearer <TOKEN>"

# 직원 목록
curl http://localhost:8080/api/employees \
  -H "Authorization: Bearer <TOKEN>"
```

---

## 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

Vite가 `/api` 요청을 `http://localhost:8080`으로 프록시합니다.

---

## 4. XGBoost Model (Optional)

```bash
cd scripts
pip install xgboost scikit-learn pandas numpy
python train_risk_model.py
```

모델 파일 `oram_risk_model.json`이 생성됩니다.
Spring Boot의 `XGBoostRiskAnalyzer.java`를 실제 xgboost4j를 사용하도록 교체할 수 있습니다.

---

## 5. Offboarding Workflow Demo

1. 브라우저에서 `http://localhost:5173/login` 접속
2. `admin@oram.local` / `Admin1234!` 로그인
3. **SaaS Connections** → Slack/GitHub/Notion 연결 (또는 Mock 상태로 진행)
4. **Employees** → 직원 선택 → "Offboarding" 버튼 클릭
5. 오프보딩 워크플로우 자동 실행
6. **Offboarding** 페이지에서 결과 및 리스크 점수 확인
7. "Revoke All Access" 클릭하여 전체 권한 해제

---

## 6. Project Structure

```
ORAM_ver_0.1/
├── docs/
│   ├── architecture.md        # 시스템 아키텍처
│   ├── erd.md                 # ERD 다이어그램
│   ├── api-design.md          # REST API 설계
│   ├── database-schema.sql    # PostgreSQL 스키마
│   └── sample-data.sql        # 샘플 데이터
├── backend/
│   ├── pom.xml
│   └── src/main/java/com/oram/
│       ├── OramApplication.java
│       ├── config/            # Security, Encryption
│       ├── controller/        # REST Controllers
│       ├── service/           # Business Logic
│       ├── repository/        # JPA Repositories
│       ├── entity/            # JPA Entities
│       ├── dto/               # Data Transfer Objects
│       ├── connector/         # Plugin Architecture
│       │   ├── SaaSConnector.java  (interface)
│       │   ├── SlackConnector.java
│       │   ├── GitHubConnector.java
│       │   └── NotionConnector.java
│       ├── risk/              # Risk Analysis
│       │   ├── RiskFeatures.java
│       │   └── XGBoostRiskAnalyzer.java
│       ├── security/          # JWT
│       └── enums/
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── api/               # API 호출 레이어
│       ├── components/        # 공통 컴포넌트
│       ├── pages/             # 5개 페이지
│       ├── store/             # Zustand 상태관리
│       └── types/             # TypeScript 타입
├── scripts/
│   └── train_risk_model.py    # XGBoost 모델 훈련
└── README.md
```

---

## 7. Troubleshooting

| 문제 | 해결 방법 |
|------|----------|
| DB 연결 실패 | PostgreSQL 실행 여부 확인, `application.yml` DB 설정 확인 |
| JWT 오류 | `JWT_SECRET` 환경변수 설정 확인 (256bit 이상) |
| OAuth 연결 실패 | Mock 모드로 동작 - 실제 client-id/secret 없어도 됨 |
| CORS 오류 | `cors.allowed-origins` = `http://localhost:5173` 확인 |
| 포트 충돌 | 8080(백엔드), 5432(DB), 5173(프론트엔드) 포트 확인 |
