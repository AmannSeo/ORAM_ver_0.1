import { useState } from 'react';
import {
  Box, Typography, Paper, Stepper, Step, StepLabel, StepContent,
  Accordion, AccordionSummary, AccordionDetails, Chip,
  Grid, Card, CardContent, Alert, List, ListItem,
  ListItemIcon, ListItemText, Table, TableHead, TableRow,
  TableCell, TableBody, TableContainer,
} from '@mui/material';
import {
  ExpandMore as ExpandIcon,
  People as HRIcon,
  Cloud as SaaSIcon,
  PersonOff as OffboardIcon,
  Security as RiskIcon,
  DeleteSweep as RevokeIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon,
  Warning as WarnIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';

const WORKFLOW_STEPS = [
  {
    label: '1단계: HR에서 퇴사 처리',
    icon: <HRIcon />,
    desc: '직원 관리 페이지에서 퇴사할 직원 옆의 "오프보딩" 버튼을 클릭합니다.',
    detail: `ORAM의 HR 시스템은 직원 정보를 관리합니다. 
직원 상태는 '재직 중(ACTIVE)' 또는 '퇴사(RESIGNED)' 두 가지입니다.
오프보딩 버튼을 클릭하면 자동으로 상태가 RESIGNED로 변경되고, 다음 단계가 시작됩니다.`,
  },
  {
    label: '2단계: SaaS 자동 탐색',
    icon: <SaaSIcon />,
    desc: 'ORAM이 연결된 모든 SaaS 플랫폼(Slack, GitHub, Notion)에서 해당 직원의 이메일로 계정을 검색합니다.',
    detail: `예시: hong@company.com으로 검색
• Slack: 워크스페이스 멤버 여부, 관리자 여부 확인
• GitHub: Organization 멤버 여부, PAT 토큰 존재 여부 확인  
• Notion: 워크스페이스 멤버 여부 확인

중요: 이 탐색은 "연결된" SaaS에서만 이루어집니다.
SaaS 연결 페이지에서 먼저 연결이 필요합니다.`,
  },
  {
    label: '3단계: 권한 목록 수집',
    icon: <OffboardIcon />,
    desc: '발견된 모든 권한이 오프보딩 결과 페이지에 표시됩니다.',
    detail: `수집되는 권한 예시:
• Slack: 멤버, 관리자(Admin), 워크스페이스 소유자
• GitHub: 저장소 접근, Organization Owner, PAT 토큰
• Notion: 워크스페이스 멤버, 페이지 편집자

모든 플랫폼의 권한이 한 곳에 모입니다.`,
  },
  {
    label: '4단계: AI 리스크 점수 계산',
    icon: <RiskIcon />,
    desc: 'XGBoost 알고리즘이 수집된 권한 정보를 분석해 0~100점의 리스크 점수를 산출합니다.',
    detail: `점수 계산 기준:
• 관리자 권한: +25점
• Owner 권한: +20점  
• API 토큰: +20점
• 최근 로그인: +15점
• 저장소 수: 최대 +10점
• 워크스페이스 수: 최대 +10점

75점 이상 = CRITICAL → 즉시 조치 필요`,
  },
  {
    label: '5단계: 결과 확인',
    icon: <CheckIcon />,
    desc: '오프보딩 결과 페이지에서 발견된 권한과 리스크 점수, 권장 조치를 확인합니다.',
    detail: `오프보딩 결과 페이지에서 확인 가능한 정보:
• 직원 기본 정보
• 각 SaaS별 발견된 권한 상세
• 리스크 점수 및 등급
• 권장 조치 사항 목록`,
  },
  {
    label: '6단계: 권한 일괄 해제',
    icon: <RevokeIcon />,
    desc: '"모든 권한 해제" 버튼 하나로 연결된 모든 SaaS에서 해당 직원의 권한이 동시에 해제됩니다.',
    detail: `"모든 권한 해제" 버튼을 클릭하면:
• Slack: 워크스페이스에서 비활성화
• GitHub: Organization에서 제거, PAT 무효화
• Notion: 워크스페이스 멤버 제거

모든 작업은 감사 로그에 기록됩니다.`,
  },
];

const FAQ = [
  {
    q: 'SaaS 연결은 어떻게 하나요?',
    a: `"SaaS 연결 관리" 페이지에서 각 플랫폼의 연결 버튼을 클릭합니다.
    
• 데모 연결: OAuth 설정 없이 즉시 테스트 가능 (PoC용)
• 실제 연결: 각 SaaS에서 OAuth App을 생성하고 client-id/secret을 설정 후 사용

PoC 시연 시에는 "데모 연결" 버튼을 사용하세요.`,
  },
  {
    q: 'SaaS 클릭하면 그 플랫폼 사용자 목록이 나와야 하지 않나요?',
    a: `ORAM은 "직원 중심(Employee-centric)" 모델입니다.
    
SaaS를 클릭하면 사용자 목록을 보여주는 방식이 아니라,
퇴사할 직원을 선택하면 → 그 직원이 어떤 SaaS에 어떤 권한을 가졌는지를 보여줍니다.

흐름: 직원 선택 → 오프보딩 → SaaS 탐색 → 권한 확인 → 해제

SaaS별 전체 사용자 현황은 향후 추가될 "SaaS 사용자 감사" 기능에서 제공될 예정입니다.`,
  },
  {
    q: 'HR 시스템은 별도로 존재하나요?',
    a: `현재 PoC 버전에서는 ORAM 자체가 HR 시스템 역할을 합니다.
    
"직원 관리" 페이지에서 직원 정보를 직접 입력/관리합니다.

실제 기업 환경에서는 Workday, BambooHR, SAP SuccessFactors 등 
외부 HR 시스템과 Webhook/API로 연동하여 퇴사 정보를 자동으로 수신할 수 있습니다.`,
  },
  {
    q: '권한 해제가 실제로 되나요?',
    a: `현재 PoC 버전의 동작 방식:
    
• 데모 연결 상태: Mock API를 사용하므로 실제 권한 해제는 되지 않습니다
• 실제 OAuth 연결: 실제 SaaS API를 호출하여 권한 해제가 이루어집니다

실제 운영을 위해서는 각 SaaS에서 관리자급 OAuth 권한을 받아야 합니다.`,
  },
  {
    q: '감사 로그는 어디서 볼 수 있나요?',
    a: `현재 PoC에서 감사 로그는 데이터베이스(audit_logs 테이블)에 저장됩니다.
모든 연결, 해제, 오프보딩 작업이 자동으로 기록됩니다.
UI 감사 로그 페이지는 추후 추가 예정입니다.`,
  },
  {
    q: '리스크 점수는 어떻게 계산되나요?',
    a: `XGBoost 기반 가중치 모델을 사용합니다:

• 관리자(Admin) 권한: 25점
• Owner 권한: 20점
• API 토큰/PAT 보유: 20점  
• 최근 30일 로그인: 15점
• 저장소 접근 수 (최대 10점): repos/10 × 10
• 워크스페이스 수 (최대 10점): workspaces/3 × 10

예시: Slack Admin + GitHub Owner + PAT 토큰 = 25+20+20+15+α = 95점 (CRITICAL)`,
  },
];

export default function HelpGuide() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <ShieldIcon color="primary" />
        <Typography variant="h4" fontWeight="bold">도움말 & 사용 가이드</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={3}>
        ORAM의 모든 기능과 동작 방식을 설명합니다
      </Typography>

      {/* 개요 */}
      <Paper variant="outlined" sx={{ p: 3, mb: 4, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
        <Typography variant="h6" fontWeight="bold" color="primary.dark" gutterBottom>
          🛡️ ORAM이란?
        </Typography>
        <Typography variant="body2" mb={1}>
          <strong>ORAM (Offboarding & Revocation Access Manager)</strong>은 직원 퇴사 시
          회사의 모든 SaaS 플랫폼에 남아있는 계정과 권한을 자동으로 탐지하고 해제하는 플랫폼입니다.
        </Typography>
        <Grid container spacing={2} mt={1}>
          {[
            { icon: '👥', title: 'HR 연동', desc: '직원 퇴사 처리 시 자동 감지' },
            { icon: '🔍', title: '자동 탐색', desc: 'Slack·GitHub·Notion 권한 탐지' },
            { icon: '🤖', title: 'AI 분석', desc: 'XGBoost 리스크 점수 산출' },
            { icon: '⚡', title: '원클릭 해제', desc: '모든 SaaS 권한 동시 해제' },
          ].map(item => (
            <Grid item xs={6} sm={3} key={item.title}>
              <Box textAlign="center" p={1}>
                <Typography fontSize={32}>{item.icon}</Typography>
                <Typography variant="subtitle2" fontWeight="bold">{item.title}</Typography>
                <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* 오프보딩 워크플로우 */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>📋 오프보딩 워크플로우</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        직원 퇴사 처리부터 권한 해제까지 6단계 자동화 프로세스
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical" sx={{ mb: 4 }}>
        {WORKFLOW_STEPS.map((step, index) => (
          <Step key={step.label} expanded>
            <StepLabel
              StepIconProps={{ icon: index + 1 }}
              onClick={() => setActiveStep(index)}
              sx={{ cursor: 'pointer' }}
            >
              <Typography fontWeight="bold">{step.label}</Typography>
              <Typography variant="body2" color="text.secondary">{step.desc}</Typography>
            </StepLabel>
            <StepContent>
              <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                  {step.detail}
                </Typography>
              </Paper>
            </StepContent>
          </Step>
        ))}
      </Stepper>

      {/* HR 시스템 설명 */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>👥 HR 시스템 구조</Typography>
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            현재 PoC에서는 <strong>ORAM 자체가 HR 시스템</strong>입니다. 실제 Workday/BambooHR과 별도 연동은 없습니다.
          </Alert>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>직원 상태</Typography>
              <Box display="flex" gap={2} mb={2}>
                <Chip label="ACTIVE (재직 중)" color="success" />
                <ArrowIcon />
                <Chip label="RESIGNED (퇴사)" color="default" />
              </Box>
              <Typography variant="body2" color="text.secondary">
                상태가 RESIGNED로 변경되는 순간 오프보딩 워크플로우가 자동 시작됩니다.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>직원 정보 필드</Typography>
              <List dense>
                {[
                  ['사번 (employee_id)', '고유 식별자'],
                  ['이름 (name)', '직원 표시 이름'],
                  ['이메일 (email)', '🔑 SaaS 탐색에 사용되는 핵심 키'],
                  ['부서 (department)', '소속 부서'],
                  ['상태 (status)', 'ACTIVE / RESIGNED'],
                ].map(([field, desc]) => (
                  <ListItem key={field} disablePadding>
                    <ListItemIcon sx={{ minWidth: 8 }}>
                      <Box width={6} height={6} borderRadius="50%" bgcolor="primary.main" mt={1} />
                    </ListItemIcon>
                    <ListItemText
                      primary={<strong>{field}</strong>}
                      secondary={desc}
                    />
                  </ListItem>
                ))}
              </List>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* SaaS 연결 vs 권한 해제 구조 설명 */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>🔌 SaaS 연결과 권한 해제의 차이</Typography>
      <Card variant="outlined" sx={{ mb: 4 }}>
        <CardContent>
          <Alert severity="warning" icon={<WarnIcon />} sx={{ mb: 2 }}>
            SaaS 연결 페이지는 "ORAM이 SaaS에 접근할 수 있도록 인증하는 곳"입니다.
            직원별 권한을 보거나 해제하는 곳이 아닙니다.
          </Alert>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'info.50' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="info.dark" gutterBottom>
                  🔌 SaaS 연결 관리 페이지
                </Typography>
                <Typography variant="body2">
                  ORAM ↔ Slack/GitHub/Notion 사이의 <strong>관리자 인증</strong>을 설정합니다.
                  <br /><br />
                  여기서 연결하는 것 = "ORAM이 그 SaaS의 관리자 API에 접근할 수 있는 권한"
                </Typography>
                <Box mt={1.5}>
                  <Typography variant="caption" color="text.secondary">예시:</Typography>
                  <br />
                  <Typography variant="caption">
                    Slack 연결 완료 → ORAM이 Slack API를 통해 멤버 조회/삭제 가능
                  </Typography>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'error.50' }}>
                <Typography variant="subtitle2" fontWeight="bold" color="error.dark" gutterBottom>
                  ⚡ 오프보딩 결과 페이지
                </Typography>
                <Typography variant="body2">
                  특정 퇴사 직원이 각 SaaS에서 보유한 <strong>권한 목록과 해제</strong>를 담당합니다.
                  <br /><br />
                  "모든 권한 해제" 버튼 = 연결된 모든 SaaS에서 그 직원을 제거
                </Typography>
                <Box mt={1.5}>
                  <Typography variant="caption" color="text.secondary">예시:</Typography>
                  <br />
                  <Typography variant="caption">
                    홍길동 오프보딩 → Slack Admin 해제 + GitHub Owner 해제 동시 실행
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 역할별 권한 */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>🛡️ 역할별 권한 (RBAC)</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>기능</strong></TableCell>
              <TableCell align="center"><strong>Admin</strong></TableCell>
              <TableCell align="center"><strong>Security Manager</strong></TableCell>
              <TableCell align="center"><strong>Auditor</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {[
              ['대시보드 조회', '✅', '✅', '✅'],
              ['직원 목록 조회', '✅', '✅', '✅'],
              ['직원 등록/수정', '✅', '❌', '❌'],
              ['오프보딩 실행', '✅', '✅', '❌'],
              ['SaaS 연결/해제', '✅', '❌', '❌'],
              ['권한 일괄 해제', '✅', '✅', '❌'],
              ['감사 로그 조회', '✅', '❌', '✅'],
            ].map(([feat, ...perms]) => (
              <TableRow key={feat} hover>
                <TableCell>{feat}</TableCell>
                {perms.map((p, i) => (
                  <TableCell key={i} align="center">{p}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 데모 계정 */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>🔑 데모 계정</Typography>
      <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
        <Grid container spacing={2}>
          {[
            { email: 'admin@oram.local', pass: 'Admin1234!', role: 'Admin', color: 'primary' },
            { email: 'security@oram.local', pass: 'Security1234!', role: 'Security Manager', color: 'warning' },
            { email: 'auditor@oram.local', pass: 'Auditor1234!', role: 'Auditor', color: 'info' },
          ].map(acc => (
            <Grid item xs={12} sm={4} key={acc.email}>
              <Box p={1.5} bgcolor="grey.50" borderRadius={1}>
                <Chip label={acc.role} color={acc.color as any} size="small" sx={{ mb: 1 }} />
                <Typography variant="body2"><strong>이메일:</strong> {acc.email}</Typography>
                <Typography variant="body2"><strong>비밀번호:</strong> {acc.pass}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* FAQ */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>❓ 자주 묻는 질문</Typography>
      {/* ❓ FAQ */}
      <Typography variant="h5" fontWeight="bold" gutterBottom>❓ 자주 묻는 질문</Typography>

      {/* HR 통합 섹션 - FAQ 전 강조 */}
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, bgcolor: 'warning.50', borderColor: 'warning.300' }}>
        <Typography variant="h6" fontWeight="bold" color="warning.dark" gutterBottom>
          🏢 기존 HR 시스템이 있다면?
        </Typography>
        <Typography variant="body2" mb={2}>
          회사에 이미 <strong>Workday, BambooHR, SAP SuccessFactors, 그룹웨어</strong> 등이 있는 경우,
          두 가지 방식으로 ORAM과 연동할 수 있습니다.
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box p={2} bgcolor="white" borderRadius={1} border="1px solid" borderColor="warning.200">
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>방식 1: Webhook 연동 (권장)</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                HR 시스템에서 퇴사 처리 시 ORAM에 자동 알림을 보냅니다.
              </Typography>
              <Box p={1} bgcolor="grey.900" borderRadius={1}>
                <Typography variant="caption" sx={{ color: '#98c379', fontFamily: 'monospace', display: 'block' }}>
                  {'// HR 시스템에서 퇴사 처리 시:'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#61afef', fontFamily: 'monospace', display: 'block' }}>
                  {'POST http://oram-server/api/employees/{id}/resign'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#abb2bf', fontFamily: 'monospace', display: 'block' }}>
                  {'Authorization: Bearer {ORAM_API_TOKEN}'}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <Box p={2} bgcolor="white" borderRadius={1} border="1px solid" borderColor="warning.200">
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>방식 2: CSV/API 직원 동기화</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                HR 시스템의 직원 명부를 주기적으로 ORAM과 동기화합니다.
              </Typography>
              <List dense>
                {[
                  '매일 자정 HR DB → ORAM DB 동기화',
                  '상태 변경(퇴사) 감지 시 자동 오프보딩',
                  'REST API 또는 CSV 파일 업로드 방식 지원 가능',
                ].map((item, i) => (
                  <ListItem key={i} disablePadding>
                    <ListItemIcon sx={{ minWidth: 20 }}>
                      <Box width={5} height={5} borderRadius="50%" bgcolor="warning.main" mt={0.5} />
                    </ListItemIcon>
                    <ListItemText primary={<Typography variant="caption">{item}</Typography>} />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Grid>
        </Grid>
        <Alert severity="info" sx={{ mt: 2 }}>
          <strong>현재 PoC에서는:</strong> ORAM 직원 관리 페이지에서 직접 직원을 등록/관리합니다.
          실제 HR 시스템 연동은 백엔드 <code>EmployeeController.resignEmployee()</code> 엔드포인트를 활용하면 됩니다.
        </Alert>
      </Paper>

      {FAQ.map((item) => (
        <Accordion key={item.q} variant="outlined" sx={{ mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography fontWeight="bold">{item.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 2 }}>
              {item.a}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* 빠른 시작 */}
      <Typography variant="h5" fontWeight="bold" mt={4} gutterBottom>🚀 5분 만에 시작하기</Typography>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <List>
          {[
            ['SaaS 연결 관리 페이지로 이동', 'Slack, GitHub, Notion의 "데모 연결" 버튼을 클릭합니다'],
            ['직원 관리 페이지로 이동', '"홍길동" 또는 다른 직원 옆의 오프보딩(👤) 버튼을 클릭합니다'],
            ['오프보딩 결과 확인', '탐지된 권한과 리스크 점수를 확인합니다'],
            ['"모든 권한 해제" 클릭', '연결된 모든 SaaS에서 해당 직원의 권한이 제거됩니다'],
          ].map(([title, desc], i) => (
            <ListItem key={i} disablePadding sx={{ mb: 1 }}>
              <ListItemIcon>
                <Chip label={i + 1} size="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={<strong>{title}</strong>}
                secondary={desc}
              />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
