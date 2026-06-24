import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardActions, Button,
  Chip, LinearProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, TextField, Paper, InputAdornment,
  IconButton, Collapse, Stack,
  MenuItem,
  CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  CheckCircle as ConnectedIcon, Cancel as NotConnectedIcon,
  LinkOff as LinkOffIcon, Science as DemoIcon,
  Visibility as ShowIcon, VisibilityOff as HideIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
  Link as ConnectIcon, OpenInNew as OpenIcon,
  PeopleAlt as PeopleIcon,
  NotificationsActive as AlertIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { saasApi } from '../api';
import type { SaasConnection, SaasIdentity, SaasType } from '../types';

// 각 SaaS별 토큰 발급 방법 안내
const SAAS_INFO: Record<SaasType, {
  label: string; color: string; emoji: string;
  tokenLabel: string; tokenPlaceholder: string; tokenPrefix: string;
  steps: string[]; docsUrl: string; appUrl: string;
  quickLinks: { label: string; url: string }[];
  detectItems: string[]; revokeNote: string;
}> = {
  SLACK: {
    label: 'Slack', color: '#4A154B', emoji: '💬',
    tokenLabel: 'Slack Token (xoxb- 또는 xoxp-...)',
    tokenPlaceholder: 'xoxb- 또는 xoxp- 로 시작하는 Slack token',
    tokenPrefix: 'xoxb- 또는 xoxp-',
    steps: [
      'Slack API Apps 페이지 접속 → "Create New App" 클릭',
      '생성 방식 선택에서 "From scratch" 선택\n  ※ Manifest를 이미 준비한 경우가 아니라면 From scratch가 가장 쉽습니다.',
      'App Name에 ORAM 같은 이름 입력 → 대상 Workspace 선택 → "Create App" 클릭',
      '왼쪽 메뉴에서 "OAuth & Permissions" 이동',
      '계정 수집만 할 경우 "Bot Token Scopes"에 users:read, users:read.email 추가',
      '퇴사자 접근 차단까지 하려면 "User Token Scopes"에 admin.users:write 추가\n  ※ 이 scope는 Enterprise Grid에서만 동작하며 일반 워크스페이스에서는 승인/실행이 제한될 수 있습니다.',
      '"Install to Workspace" 또는 "Reinstall to Workspace" 클릭 → Slack 관리자 계정으로 승인',
      '"OAuth Tokens for Your Workspace" 섹션에서 토큰 복사\n  - Bot User OAuth Token(xoxb-): 사용자 수집 가능, 접근 차단 불가\n  - User OAuth Token(xoxp-): Enterprise + admin.users:write일 때 접근 차단 가능',
      '채널에서만 내보내는 것은 오프보딩 차단이 아닙니다. 워크스페이스 제거 또는 비활성 처리가 필요합니다.',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://api.slack.com/authentication/basics',
    appUrl: 'https://api.slack.com/apps',
    quickLinks: [
      { label: 'Slack Apps', url: 'https://api.slack.com/apps' },
      { label: 'OAuth 문서', url: 'https://api.slack.com/authentication/oauth-v2' },
      { label: 'admin.users API', url: 'https://api.slack.com/methods/admin.users.remove' },
    ],
    detectItems: ['워크스페이스 멤버', '관리자(Admin)', '소유자(Owner)', '비활성 계정'],
    revokeNote: 'xoxb는 수집 전용, 자동 차단은 Enterprise + xoxp User Token(admin.users:write) 필요',
  },
  GITHUB: {
    label: 'GitHub', color: '#181717', emoji: '🐙',
    tokenLabel: 'Personal Access Token (ghp_...)',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenPrefix: 'ghp_',
    steps: [
      'GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)',
      '"Generate new token (classic)" 클릭',
      '토큰을 만드는 GitHub 계정이 대상 Organization의 Owner 또는 관리자 권한을 가지고 있어야 함',
      'Scopes 선택: read:org, admin:org, repo (조직 멤버와 저장소 collaborator 조회/제거용)',
      '조직에서 SSO/SAML을 사용한다면 생성한 토큰을 해당 Organization에 Authorize 해야 함',
      '"Generate token" 클릭 → 토큰 복사 (한 번만 표시됨)',
      'GitHub 계정 범위에서 개인/조직/기업 계정 중 실제 관리 범위를 선택',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://docs.github.com/ko/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    appUrl: 'https://github.com/settings/tokens',
    quickLinks: [
      { label: '토큰 만들기', url: 'https://github.com/settings/tokens' },
      { label: 'GitHub 토큰 문서', url: 'https://docs.github.com/ko/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens' },
      { label: '조직 설정', url: 'https://github.com/settings/organizations' },
    ],
    detectItems: ['Organization 멤버십', '저장소 Collaborator', '저장소 접근 권한'],
    revokeNote: '조직 관리자 권한이 있는 토큰에서 조직 멤버 또는 저장소 collaborator 제거 가능',
  },
  NOTION: {
    label: 'Notion', color: '#000000', emoji: '📝',
    tokenLabel: 'Internal Integration Token (secret_...)',
    tokenPlaceholder: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenPrefix: 'secret_',
    steps: [
      'https://www.notion.so/my-integrations 접속',
      '"New integration" 클릭 → 이름 입력 (예: ORAM)',
      '"Associated workspace" 선택 → "Submit"',
      '"Secrets" 탭에서 "Internal Integration Token" 복사',
      '연동 토큰은 사용자/페이지 조회용입니다. Notion 공식 API는 워크스페이스 멤버 제거를 제공하지 않습니다.',
      '퇴사자 차단은 Notion Settings > Members에서 수동 제거하거나, Enterprise 환경이면 IdP/SCIM으로 비활성 처리합니다.',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://developers.notion.com/docs/create-a-notion-integration',
    appUrl: 'https://www.notion.so/my-integrations',
    quickLinks: [
      { label: 'Notion Integrations', url: 'https://www.notion.so/my-integrations' },
      { label: 'Integration 문서', url: 'https://developers.notion.com/docs/create-a-notion-integration' },
      { label: 'Notion API 참조', url: 'https://developers.notion.com/reference/intro' },
    ],
    detectItems: ['워크스페이스 멤버', '페이지 접근 권한', '수동 제거 대상'],
    revokeNote: '⚠️ 사용자 목록 조회 가능, 멤버 제거는 Notion API 제한으로 관리자 수동 처리 또는 IdP/SCIM 처리',
  },
};

const DEFAULT_CONNECTIONS: SaasConnection[] = (Object.keys(SAAS_INFO) as SaasType[]).map((saasType) => ({
  saasType,
  isConnected: false,
}));

const GITHUB_ACCOUNT_SCOPES = [
  { value: 'PERSONAL', label: '개인 계정', description: '개인 저장소와 본인이 접근 가능한 저장소 중심으로 수집합니다.' },
  { value: 'ORGANIZATION', label: '조직 계정', description: 'GitHub Organization 멤버와 저장소 collaborator를 수집합니다.' },
  { value: 'ENTERPRISE', label: '기업 계정', description: 'Enterprise 소속 조직으로 관리되는 GitHub 계정으로 표시합니다. Enterprise API 직접 연동은 확장 범위입니다.' },
];

function accountScopeLabel(saasType: SaasType, scope?: string, enterpriseAccount?: boolean) {
  if (saasType !== 'GITHUB') return '워크스페이스';
  if (enterpriseAccount || scope === 'ENTERPRISE') return '기업 계정';
  if (scope === 'PERSONAL') return '개인 계정';
  return '조직 계정';
}

function identitySourceLabel(row: SaasIdentity) {
  if (row.department && row.department.trim()) {
    return row.department;
  }
  if (row.saasType === 'GITHUB') return 'GitHub';
  if (row.saasType === 'SLACK') return 'Slack Workspace';
  if (row.saasType === 'NOTION') return 'Notion Workspace';
  return row.saasType;
}

function formatDateTime(value?: string) {
  if (!value) return '아직 없음';
  return new Date(value).toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SaasConnections() {
  const [connections, setConnections] = useState<SaasConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 연결 다이얼로그
  const [connectDialog, setConnectDialog] = useState<SaasType | null>(null);
  const [token, setToken] = useState('');
  const [accountScope, setAccountScope] = useState('ORGANIZATION');
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncingSaas, setSyncingSaas] = useState<SaasType | null>(null);

  // 해제 다이얼로그
  const [disconnectDialog, setDisconnectDialog] = useState<SaasType | null>(null);
  const [identityDialog, setIdentityDialog] = useState<SaasType | null>(null);
  const [identityRows, setIdentityRows] = useState<SaasIdentity[]>([]);
  const [identityLoading, setIdentityLoading] = useState(false);

  const load = () => {
    setLoading(true);
    saasApi.getAll()
      .then(setConnections)
      .catch(() => setError('연결 정보를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const openConnect = (saasType: SaasType) => {
    setToken('');
    setAccountScope(saasType === 'GITHUB' ? 'ORGANIZATION' : 'WORKSPACE');
    setShowToken(false);
    setShowGuide(true);
    setConnectDialog(saasType);
  };

  const handleTokenConnect = async () => {
    if (!connectDialog || !token.trim()) return;
    setConnecting(true);
    setError(null);
    const normalizedToken = token.replace(/\s+/g, '');
    try {
      await saasApi.tokenConnect(connectDialog, normalizedToken, undefined, accountScope);
      setSuccess(`${SAAS_INFO[connectDialog].label} 연결 완료! 연결 가능한 사용자 동기화를 실행했습니다.`);
      setConnectDialog(null);
      load();
    } catch (err: any) {
      const status = err?.response?.status;
      const serverMessage = err?.response?.data?.error;
      const serverEmail = err?.response?.data?.email;
      const serverRole = err?.response?.data?.role;
      const msg = status === 401
        ? '로그인 세션이 만료되었습니다. 다시 로그인한 뒤 연결하세요.'
        : status === 403
          ? `관리자 또는 보안 담당자 계정만 SaaS를 연결할 수 있습니다. 서버 인식: ${serverEmail || '확인 불가'} / ${serverRole || '확인 불가'}`
          : serverMessage || '토큰 연결에 실패했습니다. 토큰 값과 GitHub 권한(scope)을 확인하세요.';
      setError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDemoConnect = async (saasType: SaasType) => {
    setConnecting(true);
    try {
      await saasApi.demoConnect(saasType);
      setSuccess(`${SAAS_INFO[saasType].label} 데모 연결 완료!`);
      load();
    } catch {
      setError('데모 연결에 실패했습니다');
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncUsers = async (saasType: SaasType) => {
    setSyncingSaas(saasType);
    setError(null);
    try {
      const result = await saasApi.syncUsers(saasType);
      const details = [
        `확인 ${result.totalFound}명`,
        `신규 ${result.syncedCount}명`,
        result.inactiveCount ? `비활성 ${result.inactiveCount}명` : null,
        result.missingCount ? `누락 ${result.missingCount}명` : null,
        result.resolvedAlertCount ? `해제 알림 ${result.resolvedAlertCount}건` : null,
      ].filter(Boolean).join(', ');
      const warningText = result.warnings?.length ? `\n확인 필요: ${result.warnings.join(' / ')}` : '';
      setSuccess(`${SAAS_INFO[saasType].label} 사용자 동기화 완료: ${details}${warningText}`);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '사용자 동기화에 실패했습니다. 토큰 권한을 확인하세요.';
      setError(msg);
    } finally {
      setSyncingSaas(null);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog) return;
    try {
      await saasApi.disconnect(disconnectDialog);
      setDisconnectDialog(null);
      setSuccess(`${SAAS_INFO[disconnectDialog].label} 연결이 해제되었습니다`);
      load();
    } catch {
      setError('연결 해제에 실패했습니다');
    }
  };

  const openIdentityDialog = async (saasType: SaasType) => {
    setIdentityDialog(saasType);
    setIdentityLoading(true);
    setError(null);
    try {
      const rows = await saasApi.getIdentities(saasType);
      setIdentityRows(rows);
    } catch (err: any) {
      setIdentityRows([]);
      const status = err?.response?.status;
      setError(
        status === 403
          ? '수집 계정 목록 조회 권한이 거부되었습니다. 다시 로그인하거나 백엔드 서버를 재시작해 최신 코드가 반영됐는지 확인하세요.'
          : err?.response?.data?.error || 'SaaS 수집 계정 목록을 불러오지 못했습니다.'
      );
    } finally {
      setIdentityLoading(false);
    }
  };

  if (loading) return <LinearProgress />;

  const info = connectDialog ? SAAS_INFO[connectDialog] : null;
  const visibleConnections = connections.length > 0 ? connections : DEFAULT_CONNECTIONS;
  const connectedConnections = visibleConnections.filter((conn) => conn.isConnected);
  const connectedCount = connectedConnections.length;
  const identityCount = connectedConnections.reduce((sum, conn) => sum + (conn.identityCount ?? 0), 0);
  const openAlertCount = connectedConnections.reduce((sum, conn) => sum + (conn.openAlertCount ?? 0), 0);
  const syncedDates = connectedConnections
    .map((conn) => conn.lastSyncedAt)
    .filter(Boolean)
    .sort();
  const lastSyncedAt = syncedDates.length > 0 ? syncedDates[syncedDates.length - 1] : undefined;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>SaaS 연결 관리</Typography>

      <Grid container spacing={1.5} mb={2.5}>
        <Grid item xs={6} md={3}>
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
            <Typography variant="caption" color="#64748b">연결 SaaS</Typography>
            <Typography variant="h5" fontWeight={700}>{connectedCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
            <Typography variant="caption" color="#64748b">수집 계정</Typography>
            <Typography variant="h5" fontWeight={700}>{identityCount}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper
            variant="outlined"
            sx={{
              p: 1.75,
              borderRadius: 2.5,
              bgcolor: openAlertCount > 0 ? '#fffbeb' : '#ecfdf5',
              borderColor: openAlertCount > 0 ? '#fde68a' : '#a7f3d0',
            }}
          >
            <Typography variant="caption" color="#64748b">열린 감지 알림</Typography>
            <Typography variant="h5" fontWeight={700} color={openAlertCount > 0 ? '#b45309' : '#047857'}>
              {openAlertCount}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={6} md={3}>
          <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
            <Typography variant="caption" color="#64748b">최근 동기화</Typography>
            <Typography variant="body2" fontWeight={700} mt={0.75}>{formatDateTime(lastSyncedAt)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0', borderRadius: 2.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>관리자 감지 기준</Typography>
        <Typography variant="body2" color="#475569" mt={0.25}>
          SaaS 동기화는 단순 계정 수집이 아니라 이전 동기화 대비 비활성/누락 계정을 감지해 권한 회수 대상과 대시보드 알림으로 연결합니다.
          같은 이메일은 직원으로 통합하고, SaaS별 원본 계정은 각 카드의 <strong>수집 계정</strong>에서 확인합니다.
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        {visibleConnections.map((conn) => {
          const meta = SAAS_INFO[conn.saasType];
          return (
            <Grid item xs={12} sm={6} md={4} key={conn.saasType}>
              <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column',
                borderLeft: conn.isConnected ? `4px solid #2e7d32` : `4px solid #bdbdbd` }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" gap={2} mb={1.5}>
                    <Typography fontSize={40}>{meta.emoji}</Typography>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">{meta.label}</Typography>
                      <Chip
                        icon={conn.isConnected ? <ConnectedIcon /> : <NotConnectedIcon />}
                        label={conn.isConnected ? '연결됨' : '미연결'}
                        color={conn.isConnected ? 'success' : 'default'} size="small"
                      />
                      {conn.saasType === 'GITHUB' && (
                        <Chip
                          label={accountScopeLabel(conn.saasType, conn.accountScope, conn.enterpriseAccount)}
                          color={conn.enterpriseAccount ? 'primary' : 'default'}
                          size="small"
                          variant="outlined"
                          sx={{ ml: 0.75 }}
                        />
                      )}
                    </Box>
                  </Box>

                  <Typography variant="caption" color="text.secondary" fontWeight="bold">탐지 항목</Typography>
                  {meta.detectItems.map(d => (
                    <Typography key={d} variant="caption" display="block" color="text.secondary">• {d}</Typography>
                  ))}
                  <Typography variant="caption" color="text.secondary" fontWeight="bold" display="block" mt={1}>권한 해제</Typography>
                  <Typography variant="caption" color={meta.revokeNote.startsWith('⚠️') ? 'warning.main' : 'text.secondary'}>
                    {meta.revokeNote}
                  </Typography>

                  <Stack direction="row" flexWrap="wrap" gap={1} mt={1.5}>
                    {meta.quickLinks.slice(0, 2).map(link => (
                      <Button
                        key={link.url}
                        component="a"
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="text"
                        endIcon={<OpenIcon fontSize="small" />}
                        sx={{ px: 0.5, minWidth: 'auto' }}
                      >
                        {link.label}
                      </Button>
                    ))}
                  </Stack>

                  {conn.isConnected && (
                    <Box mt={1.5} p={1} bgcolor="success.50" borderRadius={1}>
                      <Typography variant="body2" color="success.dark">
                        <strong>{conn.workspaceName}</strong>
                      </Typography>
                      {conn.saasType === 'GITHUB' && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          계정 범위: {accountScopeLabel(conn.saasType, conn.accountScope, conn.enterpriseAccount)}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" display="block">
                        수집 계정: {conn.identityCount ?? 0}명
                      </Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" mt={0.5}>
                        <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          마지막 동기화: {formatDateTime(conn.lastSyncedAt)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center" mt={0.25}>
                        <AlertIcon sx={{ fontSize: 14, color: (conn.openAlertCount ?? 0) > 0 ? 'warning.main' : 'text.secondary' }} />
                        <Typography variant="caption" color={(conn.openAlertCount ?? 0) > 0 ? 'warning.main' : 'text.secondary'}>
                          감지 알림: {conn.openAlertCount ?? 0}건
                        </Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block">
                        비활성/누락 계정은 권한 회수 대상으로 자동 연결됩니다.
                      </Typography>
                      {conn.connectedAt && (
                        <Typography variant="caption" color="text.secondary">
                          연결일: {new Date(conn.connectedAt).toLocaleDateString('ko-KR')}
                        </Typography>
                      )}
                    </Box>
                  )}
                </CardContent>

                <Divider />
                <CardActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
                  {conn.isConnected ? (
                    <>
                      <Button
                        variant="contained"
                        startIcon={syncingSaas === conn.saasType ? <CircularProgress size={16} color="inherit" /> : <ConnectIcon />}
                        size="small"
                        onClick={() => handleSyncUsers(conn.saasType)}
                        disabled={syncingSaas === conn.saasType}
                      >
                        {syncingSaas === conn.saasType ? '동기화 중...' : '동기화'}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<PeopleIcon />}
                        size="small"
                        onClick={() => openIdentityDialog(conn.saasType)}
                      >
                        수집 계정
                      </Button>
                      <Button variant="outlined" color="error" startIcon={<LinkOffIcon />} size="small"
                        onClick={() => setDisconnectDialog(conn.saasType)}>
                        연결 해제
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="contained" startIcon={<ConnectIcon />} size="small"
                        onClick={() => openConnect(conn.saasType)}
                        sx={{ bgcolor: meta.color, '&:hover': { bgcolor: meta.color, opacity: 0.85 } }}>
                        토큰으로 연결
                      </Button>
                      <Button variant="outlined" startIcon={<DemoIcon />} size="small"
                        onClick={() => handleDemoConnect(conn.saasType)} disabled={connecting}>
                        데모
                      </Button>
                    </>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {connections.some(c => c.isConnected) && (
        <Alert severity="success" sx={{ mt: 3 }}>
          연결된 SaaS가 있습니다. <strong>직원 관리</strong> 페이지에서 퇴사 처리 시 자동으로 권한이 탐지됩니다.
        </Alert>
      )}

      {/* 토큰 입력 연결 다이얼로그 */}
      <Dialog open={Boolean(connectDialog)} onClose={() => setConnectDialog(null)} maxWidth="sm" fullWidth>
        {info && connectDialog && (
          <>
            <DialogTitle>
              {info.emoji} {info.label} 연결
            </DialogTitle>
            <DialogContent>
              {/* 토큰 발급 안내 (접기 가능) */}
              <Box
                display="flex" alignItems="center" justifyContent="space-between"
                onClick={() => setShowGuide(g => !g)}
                sx={{ cursor: 'pointer', mb: 1 }}
              >
                <Typography variant="subtitle2" fontWeight="bold" color="primary">
                  📋 토큰 발급 방법 ({info.steps.length}단계)
                </Typography>
                {showGuide ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
              </Box>
              <Collapse in={showGuide}>
                <Box p={2} bgcolor="grey.50" borderRadius={1} mb={2}>
                  {info.steps.map((step, i) => (
                    <Box key={i} mb={i < info.steps.length - 1 ? 1 : 0}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                        <strong>{i + 1}.</strong> {step.replace(/^\d+\.\s/, '')}
                      </Typography>
                    </Box>
                  ))}
                  <Stack direction="row" flexWrap="wrap" gap={1} mt={1.5}>
                    <Button
                      component="a"
                      href={info.appUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      size="small"
                      variant="contained"
                      endIcon={<OpenIcon fontSize="small" />}
                      sx={{ bgcolor: info.color, '&:hover': { bgcolor: info.color, opacity: 0.85 } }}
                    >
                      설정 페이지 열기
                    </Button>
                    {info.quickLinks.map(link => (
                      <Button
                        key={link.url}
                        component="a"
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="small"
                        variant="outlined"
                        endIcon={<OpenIcon fontSize="small" />}
                      >
                        {link.label}
                      </Button>
                    ))}
                  </Stack>
                </Box>
              </Collapse>

              {/* 토큰 입력 */}
              {connectDialog === 'GITHUB' && (
                <TextField
                  select
                  fullWidth
                  label="GitHub 계정 범위"
                  value={accountScope}
                  onChange={(event) => setAccountScope(event.target.value)}
                  size="small"
                  sx={{ mb: 2 }}
                  helperText={GITHUB_ACCOUNT_SCOPES.find((item) => item.value === accountScope)?.description}
                >
                  {GITHUB_ACCOUNT_SCOPES.map((item) => (
                    <MenuItem key={item.value} value={item.value}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              <TextField
                fullWidth label={info.tokenLabel}
                placeholder={info.tokenPlaceholder}
                value={token}
                onChange={e => setToken(e.target.value)}
                type={showToken ? 'text' : 'password'}
                size="small"
                helperText={`토큰은 ${info.tokenPrefix}로 시작합니다`}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowToken(s => !s)}>
                        {showToken ? <HideIcon /> : <ShowIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

              <Alert severity="info" sx={{ mt: 2 }}>
                토큰이 입력되면 ORAM이 실제 {info.label} API를 호출해 토큰 유효성을 검증하고,
                가능한 사용자 목록을 자동 동기화합니다. 검증 성공 시 AES-256 암호화 후 저장됩니다.
              </Alert>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => { setConnectDialog(null); setError(null); }}>취소</Button>
              <Button variant="contained" onClick={handleTokenConnect}
                disabled={!token.trim() || connecting}
                sx={{ bgcolor: info.color }}>
                {connecting ? '검증 중...' : '연결'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* 연결 해제 다이얼로그 */}
      <Dialog open={Boolean(disconnectDialog)} onClose={() => setDisconnectDialog(null)}>
        <DialogTitle>연결 해제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{disconnectDialog && SAAS_INFO[disconnectDialog].label}</strong>와의 연결을 해제하시겠습니까?
            <br /><br />
            연결 해제 후에는 이 플랫폼의 직원 권한을 탐지하거나 해제할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectDialog(null)}>취소</Button>
          <Button color="error" variant="contained" onClick={handleDisconnect}>연결 해제</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(identityDialog)} onClose={() => setIdentityDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {identityDialog && `${SAAS_INFO[identityDialog].label} 수집 계정 목록 (${identityRows.length}명)`}
        </DialogTitle>
        <DialogContent>
          {identityLoading ? (
            <Box display="flex" alignItems="center" gap={1} py={3}>
              <CircularProgress size={22} />
              <Typography variant="body2">수집 계정을 불러오는 중...</Typography>
            </Box>
          ) : identityRows.length === 0 ? (
            <Alert severity="info">
              수집된 계정이 없습니다. 먼저 해당 SaaS 동기화를 실행해 주세요.
            </Alert>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                같은 이메일을 가진 계정은 하나의 직원으로 자동 매핑됩니다. GitHub 비공개 이메일처럼 실제 이메일을 알 수 없는 경우
                <strong> @github.local</strong> 계정으로 분리될 수 있습니다.
              </Alert>
              <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'hidden', borderRadius: 2 }}>
                <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', '& th, & td': { whiteSpace: 'nowrap', px: 1.1 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell width="20%">SaaS 계정</TableCell>
                      <TableCell width="24%">이메일</TableCell>
                      <TableCell width="14%" align="center">수집 출처</TableCell>
                      <TableCell width="20%">매핑된 직원</TableCell>
                      <TableCell width="10%" align="center">상태</TableCell>
                      <TableCell width="12%">동기화 시각</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {identityRows.map(row => (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} noWrap>
                            {row.displayName || row.externalUsername || row.externalUserId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {row.externalUsername || row.externalUserId}
                          </Typography>
                        </TableCell>
                        <TableCell><Typography variant="body2" noWrap>{row.externalEmail || '-'}</Typography></TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={identitySourceLabel(row)}
                            variant="outlined"
                            color={row.saasType === 'GITHUB' && identitySourceLabel(row).includes('Repo') ? 'default' : 'primary'}
                          />
                        </TableCell>
                        <TableCell>
                          {row.employeeName ? (
                            <>
                              <Typography variant="body2" noWrap>{row.employeeName}</Typography>
                              <Typography variant="caption" color="text.secondary" noWrap display="block">{row.employeeEmail}</Typography>
                            </>
                          ) : (
                            <Chip size="small" label="미매핑" />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            color={row.accessRevoked ? 'default' : row.status === 'ACTIVE' ? 'success' : 'warning'}
                            label={row.accessRevoked ? '회수됨' : row.status === 'ACTIVE' ? '활성' : '비활성'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap>
                            {row.lastSyncedAt ? formatDateTime(row.lastSyncedAt) : '-'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIdentityDialog(null)}>닫기</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
