-- ============================================================
-- ORAM Sample Mock Data
-- 로컬 개발 / 데모용 초기 데이터
-- ============================================================

-- ============================================================
-- Employees (15명 샘플)
-- ============================================================
INSERT INTO employees (id, employee_id, name, email, department, status) VALUES
-- Active employees
('11111111-0001-0001-0001-000000000001', 'EMP001', '홍길동', 'hong@company.com', 'Engineering', 'RESIGNED'),
('11111111-0001-0001-0001-000000000002', 'EMP002', '김철수', 'kim.cs@company.com', 'Engineering', 'ACTIVE'),
('11111111-0001-0001-0001-000000000003', 'EMP003', '이영희', 'lee.yh@company.com', 'Marketing', 'ACTIVE'),
('11111111-0001-0001-0001-000000000004', 'EMP004', '박민준', 'park.mj@company.com', 'Sales', 'ACTIVE'),
('11111111-0001-0001-0001-000000000005', 'EMP005', '최지원', 'choi.jw@company.com', 'Engineering', 'ACTIVE'),
('11111111-0001-0001-0001-000000000006', 'EMP006', '정수연', 'jung.sy@company.com', 'HR', 'ACTIVE'),
('11111111-0001-0001-0001-000000000007', 'EMP007', '한상우', 'han.sw@company.com', 'Engineering', 'ACTIVE'),
('11111111-0001-0001-0001-000000000008', 'EMP008', '오소영', 'oh.sy@company.com', 'Design', 'ACTIVE'),
('11111111-0001-0001-0001-000000000009', 'EMP009', '윤태민', 'yoon.tm@company.com', 'DevOps', 'ACTIVE'),
('11111111-0001-0001-0001-000000000010', 'EMP010', '서지현', 'seo.jh@company.com', 'Product', 'ACTIVE'),
-- Resigned employees
('11111111-0001-0001-0001-000000000011', 'EMP011', '강동원', 'kang.dw@company.com', 'Engineering', 'RESIGNED'),
('11111111-0001-0001-0001-000000000012', 'EMP012', '임수정', 'lim.sj@company.com', 'Marketing', 'RESIGNED'),
('11111111-0001-0001-0001-000000000013', 'EMP013', '배성우', 'bae.sw@company.com', 'Sales', 'ACTIVE'),
('11111111-0001-0001-0001-000000000014', 'EMP014', '신혜선', 'shin.hs@company.com', 'Engineering', 'ACTIVE'),
('11111111-0001-0001-0001-000000000015', 'EMP015', '유재석', 'yoo.js@company.com', 'DevOps', 'ACTIVE')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SaaS Connections (Slack 연결됨, GitHub/Notion 미연결)
-- ============================================================
INSERT INTO saas_connections (id, saas_type, workspace_id, workspace_name, is_connected, connected_at) VALUES
('22222222-0002-0002-0002-000000000001', 'SLACK', 'T_COMPANY_123', 'Company Slack', TRUE, NOW() - INTERVAL '30 days'),
('22222222-0002-0002-0002-000000000002', 'GITHUB', NULL, NULL, FALSE, NULL),
('22222222-0002-0002-0002-000000000003', 'NOTION', NULL, NULL, FALSE, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Offboarding Results (홍길동, 강동원 샘플)
-- ============================================================
INSERT INTO offboarding_results (id, employee_id, status, risk_score, risk_level, started_at, completed_at, revoked_all) VALUES
(
  '33333333-0003-0003-0003-000000000001',
  '11111111-0001-0001-0001-000000000001',
  'COMPLETED', 95, 'CRITICAL',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days' + INTERVAL '5 minutes',
  FALSE
),
(
  '33333333-0003-0003-0003-000000000002',
  '11111111-0001-0001-0001-000000000011',
  'COMPLETED', 42, 'MEDIUM',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days' + INTERVAL '3 minutes',
  TRUE
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Permission Records (홍길동: CRITICAL 케이스)
-- ============================================================
INSERT INTO permission_records (offboarding_result_id, saas_type, permission_type, resource_name, is_admin, is_owner, has_api_token, recent_login, repo_count, workspace_count) VALUES
-- Slack: Admin
('33333333-0003-0003-0003-000000000001', 'SLACK', 'ADMIN', 'Company Slack Workspace', TRUE, FALSE, FALSE, TRUE, 0, 1),
-- GitHub: Owner + PAT
('33333333-0003-0003-0003-000000000001', 'GITHUB', 'OWNER', 'company-org', TRUE, TRUE, TRUE, TRUE, 42, 0),
-- Notion: Member
('33333333-0003-0003-0003-000000000001', 'NOTION', 'MEMBER', 'Company Notion', FALSE, FALSE, FALSE, TRUE, 0, 1),

-- 강동원: MEDIUM 케이스
('33333333-0003-0003-0003-000000000002', 'SLACK', 'MEMBER', 'Company Slack Workspace', FALSE, FALSE, FALSE, FALSE, 0, 1),
('33333333-0003-0003-0003-000000000002', 'GITHUB', 'MEMBER', 'company-org', FALSE, FALSE, FALSE, TRUE, 3, 0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Audit Logs (샘플)
-- ============================================================
INSERT INTO audit_logs (action, target_type, target_id, detail, ip_address) VALUES
('OFFBOARDING_TRIGGERED', 'EMPLOYEE', 'EMP001', 'Offboarding triggered for hong@company.com. Risk: 95/CRITICAL', '192.168.1.1'),
('OFFBOARDING_TRIGGERED', 'EMPLOYEE', 'EMP011', 'Offboarding triggered for kang.dw@company.com. Risk: 42/MEDIUM', '192.168.1.1'),
('REVOKE_ALL', 'EMPLOYEE', 'EMP011', 'All access revoked for kang.dw@company.com', '192.168.1.1'),
('CONNECT_SAAS', 'SAAS_CONNECTION', 'SLACK', 'Connected to SLACK workspace: Company Slack', '192.168.1.1')
ON CONFLICT DO NOTHING;
