import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cloud as SaaSIcon,
  DeleteSweep as RevokeIcon,
  ExpandMore as ExpandIcon,
  FactCheck as DecisionIcon,
  Groups as EmployeeIcon,
  Psychology as RiskIcon,
  Report as ReportIcon,
  Sync as SyncIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const WORKFLOW_STEPS = [
  {
    title: '1. SaaS 연결',
    icon: <SaaSIcon />,
    summary: 'Slack, GitHub, Notion 관리자 토큰을 등록합니다.',
    detail: [
      'SaaS 연결 관리에서 토큰을 입력하면 ORAM이 실제 API로 토큰 유효성을 확인합니다.',
      'GitHub는 개인/조직/기업 계정 범위를 관리자가 선택해 표시할 수 있습니다.',
      '기업 계정 표시는 관리용 메타데이터이며, GitHub Enterprise 전용 API 자동 판별은 아직 확장 범위입니다.',
    ],
  },
  {
    title: '2. 계정 동기화',
    icon: <SyncIcon />,
    summary: '연결된 SaaS에서 사용자 계정을 수집하고 직원과 매핑합니다.',
    detail: [
      '같은 이메일은 하나의 직원으로 통합됩니다.',
      'GitHub 비공개 이메일처럼 실제 이메일을 알 수 없는 경우 login@github.local 형태로 별도 계정이 생성될 수 있습니다.',
      '수집 계정 목록에서 SaaS별 원본 계정과 수집 출처를 확인할 수 있습니다.',
    ],
  },
  {
    title: '3. 퇴사 또는 비활성 감지',
    icon: <EmployeeIcon />,
    summary: '직원 퇴사 처리 또는 SaaS 동기화 결과로 권한 회수 대상이 생성됩니다.',
    detail: [
      '직원 권한 관리에서 퇴사 처리하면 연결된 SaaS 권한을 기준으로 자동 분석이 실행됩니다.',
      'SaaS 동기화에서 이전에 있던 계정이 사라지거나 비활성 상태로 확인되면 감지 알림이 생성됩니다.',
      'HR Webhook 엔드포인트도 존재하며, 외부 HR 시스템에서 퇴사 이벤트를 보낼 수 있습니다.',
    ],
  },
  {
    title: '4. AI 리스크 분석',
    icon: <RiskIcon />,
    summary: '수집된 권한을 기반으로 잔여 접근 위험도를 계산합니다.',
    detail: [
      '관리자 권한, Owner 권한, API 토큰 여부, 최근 로그인, 저장소/워크스페이스 범위 등 6개 피처를 수집합니다.',
      'XGBoost 회귀 모델이 피처의 조합을 학습해 0~100 위험 점수를 예측합니다(단일 권한으로 확정하지 않음).',
      '각 피처가 점수에 기여한 정도는 SHAP으로 산출해 판단 근거(xAI)로 제시하며, 모델 사용이 어려우면 근사 가중치로 폴백합니다.',
      'AI 리스크 분석 화면에서는 점수, 감지 근거(SHAP), 권장 판단을 확인합니다.',
    ],
  },
  {
    title: '5. 관리자 판단',
    icon: <DecisionIcon />,
    summary: '상세 화면에서 분석 근거와 회수 계획을 확인합니다.',
    detail: [
      '권한 회수 판단 화면은 분석, 승인, 회수, 기록 흐름으로 구성됩니다.',
      '관리자는 권한 회수를 승인하거나, AI 판단이 잘못된 경우 오탐으로 제외할 수 있습니다.',
      '오탐 처리된 항목은 권한 회수 대상과 AI 리스크 목록에서 제외됩니다.',
    ],
  },
  {
    title: '6. 권한 회수 및 기록',
    icon: <RevokeIcon />,
    summary: '가능한 SaaS 권한을 회수하고 결과를 기록합니다.',
    detail: [
      'GitHub는 조직 멤버 또는 저장소 collaborator 제거를 시도합니다.',
      'Slack은 Enterprise Grid와 admin.users:write 권한이 있는 xoxp 사용자 토큰에서 워크스페이스 제거를 시도합니다. 채널 내보내기는 전체 접근 차단이 아닙니다.',
      'Notion은 API 제한으로 자동 멤버 제거가 어렵기 때문에 관리자 화면 또는 IdP/SCIM 수동 처리 대상으로 안내합니다.',
      '회수 성공, 실패, 오탐 처리 결과는 권한 회수 화면에서 확인합니다.',
    ],
  },
];

const CAPABILITIES = [
  { area: '직원 관리', status: '지원', detail: '직원 등록, 수정, 삭제, CSV 가져오기, 퇴사 처리' },
  { area: 'SaaS 계정 수집', status: '지원', detail: 'Slack, GitHub, Notion 계정 동기화 및 직원 매핑' },
  { area: 'GitHub 권한 회수', status: '부분 지원', detail: '조직 멤버 및 저장소 collaborator 제거 시도' },
  { area: 'Slack 권한 회수', status: '조건부 지원', detail: 'Enterprise Grid 및 xoxp 사용자 토큰(admin.users:write) 필요. xoxb 봇 토큰은 수집만 가능' },
  { area: 'Notion 권한 회수', status: '수동 처리', detail: 'API 제한으로 관리자 화면에서 직접 제거하거나 IdP/SCIM으로 비활성 처리 필요' },
  { area: 'GitHub Enterprise', status: '표시 지원', detail: '기업 계정 여부를 관리자가 선택해 표시. Enterprise API 자동 제어는 확장 범위' },
  { area: '보고서', status: '지원', detail: '대시보드에서 엑셀로 열 수 있는 CSV 점검 보고서 다운로드' },
];

const GITHUB_TOKEN_REQUIREMENTS = [
  ['토큰 종류', 'Classic Personal Access Token 권장'],
  ['토큰 생성 계정', '대상 Organization의 Owner 또는 관리자 권한을 가진 GitHub 계정'],
  ['필수 scope', 'read:org, admin:org, repo, user:email'],
  ['SSO/SAML 조직', '토큰 생성 후 해당 Organization에 SSO authorize 필요'],
  ['수집 범위', 'Organization 멤버, 저장소 collaborator, 접근 가능한 저장소'],
  ['회수 범위', '조직 멤버 제거 및 저장소 collaborator 제거 시도'],
  ['Enterprise', '현재는 기업 계정 표시 지원. Enterprise API 기반 전체 계정 제어는 확장 범위'],
];

const ROLE_ROWS = [
  ['대시보드 조회', '가능', '가능', '가능'],
  ['직원 목록 조회', '가능', '가능', '가능'],
  ['직원 등록/수정/삭제', '가능', '가능', '조회 중심'],
  ['SaaS 연결/해제/동기화', '가능', '가능', '불가'],
  ['AI 리스크 분석 조회', '가능', '가능', '가능'],
  ['권한 회수 승인/실행', '가능', '가능', '불가'],
  ['오탐 처리', '가능', '가능', '불가'],
];

const FAQ = [
  {
    q: 'SaaS를 연결하면 직원 목록이 자동으로 만들어지나요?',
    a: '동기화 시 SaaS 계정의 이메일을 기준으로 직원을 매핑합니다. 기존 직원 이메일과 일치하면 같은 직원으로 연결되고, 매핑할 직원이 없으면 SaaS 기반 직원이 생성될 수 있습니다.',
  },
  {
    q: 'GitHub 기업 계정까지 자동으로 판별하나요?',
    a: '현재는 관리자가 GitHub 연결 시 개인/조직/기업 계정 범위를 선택해 표시합니다. GitHub Enterprise API로 기업 소속을 자동 판별하거나 Enterprise Managed User를 비활성화하는 기능은 아직 확장 범위입니다.',
  },
  {
    q: '권한 회수가 실제로 되나요?',
    a: 'GitHub 조직 멤버 또는 저장소 collaborator 제거, Slack Enterprise 조건부 제거는 실제 API 호출로 시도합니다. Slack 채널 내보내기는 전체 접근 차단이 아니므로 ORAM은 workspace removal 기준으로 판단합니다. Notion은 API 제한으로 자동 제거 대신 수동 처리 안내를 제공합니다. 토큰 권한이 부족하면 실패 사유가 화면에 표시됩니다.',
  },
  {
    q: 'AI 분석은 자동인가요?',
    a: '퇴사 처리 또는 SaaS 비활성/누락 감지 시 자동 분석이 생성됩니다. 직원 목록의 재분석 버튼은 이미 생성된 대상을 최신 SaaS 수집 정보 기준으로 다시 계산하기 위한 수동 보조 기능입니다.',
  },
  {
    q: 'HR 시스템과 연동되어 있나요?',
    a: 'ORAM에는 HR Webhook 엔드포인트가 있습니다. 외부 HR 시스템이 퇴사 이벤트를 전송하면 직원 상태를 퇴사로 바꾸고 오프보딩 분석을 시작할 수 있습니다. 실제 Workday, BambooHR 같은 제품별 커넥터는 별도 확장 범위입니다.',
  },
];

function StatusChip({ status }: { status: string }) {
  const color =
    status === '지원' ? 'success'
      : status === '부분 지원' || status === '조건부 지원' || status === '표시 지원' ? 'warning'
        : status === '수동 처리' ? 'info'
          : 'default';
  return <Chip label={status} size="small" color={color} variant="outlined" />;
}

export default function HelpGuide() {
  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Box mb={3}>
        <Typography variant="h4" fontWeight={700} color="#0f172a">도움말 & 가이드</Typography>
        <Typography variant="body2" color="#64748b" mt={0.75}>
          현재 ORAM에 실제 구현된 기능과 사용 범위를 정리합니다.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        ORAM은 SaaS 계정을 수집하고, 퇴사/비활성 계정의 잔여 접근 위험을 분석한 뒤,
        관리자가 승인한 권한 회수 결과를 확인하는 시스템입니다.
      </Alert>

      <Grid container spacing={2} mb={3}>
        {[
          { title: '계정 수집', desc: 'Slack, GitHub, Notion 사용자 동기화', icon: <SaaSIcon /> },
          { title: '위험 분석', desc: '권한·활동 기반 리스크 점수 계산', icon: <RiskIcon /> },
          { title: '관리자 승인', desc: '상세 판단 후 회수 또는 오탐 처리', icon: <DecisionIcon /> },
          { title: '보고서', desc: '점검 결과 CSV 다운로드', icon: <ReportIcon /> },
        ].map((item) => (
          <Grid item xs={12} sm={6} lg={3} key={item.title}>
            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1.25} alignItems="center" mb={1}>
                  <Box sx={{ color: '#2563eb', display: 'grid', placeItems: 'center' }}>{item.icon}</Box>
                  <Typography fontWeight={700}>{item.title}</Typography>
                </Stack>
                <Typography variant="body2" color="#64748b">{item.desc}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" fontWeight={700} gutterBottom>업무 흐름</Typography>
      <Grid container spacing={2} mb={4}>
        {WORKFLOW_STEPS.map((step) => (
          <Grid item xs={12} md={6} key={step.title}>
            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={1.25} alignItems="center" mb={1}>
                  <Box sx={{ color: '#2563eb', display: 'grid', placeItems: 'center' }}>{step.icon}</Box>
                  <Box>
                    <Typography fontWeight={700}>{step.title}</Typography>
                    <Typography variant="caption" color="#64748b">{step.summary}</Typography>
                  </Box>
                </Stack>
                <List dense disablePadding>
                  {step.detail.map((line) => (
                    <ListItem key={line} disablePadding sx={{ py: 0.4 }}>
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        <CheckIcon sx={{ fontSize: 16, color: '#059669' }} />
                      </ListItemIcon>
                      <ListItemText primary={<Typography variant="body2">{line}</Typography>} />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Typography variant="h5" fontWeight={700} gutterBottom>현재 기능 범위</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2.5, overflowX: 'hidden' }}>
        <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', '& th, & td': { px: 1.2 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell width="22%">영역</TableCell>
              <TableCell width="16%" align="center">상태</TableCell>
              <TableCell width="62%">설명</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {CAPABILITIES.map((item) => (
              <TableRow key={item.area} hover>
                <TableCell>{item.area}</TableCell>
                <TableCell align="center"><StatusChip status={item.status} /></TableCell>
                <TableCell>{item.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h5" fontWeight={700} gutterBottom>GitHub 토큰 준비 기준</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2.5, overflowX: 'hidden' }}>
        <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', '& th, & td': { px: 1.2 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell width="24%">항목</TableCell>
              <TableCell width="76%">기준</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {GITHUB_TOKEN_REQUIREMENTS.map(([label, value]) => (
              <TableRow key={label} hover>
                <TableCell>{label}</TableCell>
                <TableCell>{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="h5" fontWeight={700} gutterBottom>역할별 권한</Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 4, borderRadius: 2.5, overflowX: 'hidden' }}>
        <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', '& th, & td': { px: 1.2 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell width="40%">기능</TableCell>
              <TableCell width="20%" align="center">Admin</TableCell>
              <TableCell width="20%" align="center">Security Manager</TableCell>
              <TableCell width="20%" align="center">Auditor</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {ROLE_ROWS.map(([feature, admin, security, auditor]) => (
              <TableRow key={feature} hover>
                <TableCell>{feature}</TableCell>
                <TableCell align="center">{admin}</TableCell>
                <TableCell align="center">{security}</TableCell>
                <TableCell align="center">{auditor}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 3 }}>
        모든 SaaS 권한을 무조건 자동 차단하는 구조는 아닙니다.
        ORAM은 가능한 API 회수를 시도하고, API 제한 또는 토큰 권한 부족은 실패 사유와 수동 처리 대상으로 기록합니다.
      </Alert>

      <Typography variant="h5" fontWeight={700} gutterBottom>자주 묻는 질문</Typography>
      {FAQ.map((item) => (
        <Accordion key={item.q} variant="outlined" sx={{ mb: 1, borderRadius: 2, '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandIcon />}>
            <Typography fontWeight={700}>{item.q}</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" color="#475569" sx={{ lineHeight: 1.8 }}>
              {item.a}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}

    </Box>
  );
}
