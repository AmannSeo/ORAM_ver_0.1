import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardActions, Button,
  Chip, LinearProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, TextField, Paper, InputAdornment,
  IconButton, Collapse,
} from '@mui/material';
import {
  CheckCircle as ConnectedIcon, Cancel as NotConnectedIcon,
  LinkOff as LinkOffIcon, Science as DemoIcon,
  Visibility as ShowIcon, VisibilityOff as HideIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
  Link as ConnectIcon,
} from '@mui/icons-material';
import { saasApi } from '../api';
import type { SaasConnection, SaasType } from '../types';

// 각 SaaS별 토큰 발급 방법 안내
const SAAS_INFO: Record<SaasType, {
  label: string; color: string; emoji: string;
  tokenLabel: string; tokenPlaceholder: string; tokenPrefix: string;
  steps: string[]; docsUrl: string;
  detectItems: string[]; revokeNote: string;
}> = {
  SLACK: {
    label: 'Slack', color: '#4A154B', emoji: '💬',
    tokenLabel: 'Bot Token (xoxb-...)',
    tokenPlaceholder: 'Slack bot token',
    tokenPrefix: 'xoxb-',
    steps: [
      'https://api.slack.com/apps 접속 → "Create New App" → "From scratch"',
      '"OAuth & Permissions" → Bot Token Scopes에 추가:\n  users:read, users:read.email, admin.users:write',
      '"Install to Workspace" 클릭 → 관리자 계정으로 승인',
      '"OAuth Tokens" 섹션에서 "Bot User OAuth Token" (xoxb-...) 복사',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://api.slack.com/authentication/basics',
    detectItems: ['워크스페이스 멤버', '관리자(Admin)', '소유자(Owner)'],
    revokeNote: '계정 비활성화 (Slack Business+ 이상 필요)',
  },
  GITHUB: {
    label: 'GitHub', color: '#181717', emoji: '🐙',
    tokenLabel: 'Personal Access Token (ghp_...)',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenPrefix: 'ghp_',
    steps: [
      'GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)',
      '"Generate new token (classic)" 클릭',
      'Scopes 선택: read:org, admin:org (조직 멤버 관리용)',
      '"Generate token" 클릭 → 토큰 복사 (한 번만 표시됨)',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://docs.github.com/ko/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    detectItems: ['Organization 멤버십', 'Owner 권한', '저장소 접근', 'PAT 존재 여부'],
    revokeNote: 'Organization에서 멤버 제거',
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
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://developers.notion.com/docs/create-a-notion-integration',
    detectItems: ['워크스페이스 멤버', '페이지 접근 권한'],
    revokeNote: '⚠️ Notion API 제한으로 자동 제거 불가 — 수동 처리 필요',
  },
};

export default function SaasConnections() {
  const [connections, setConnections] = useState<SaasConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 연결 다이얼로그
  const [connectDialog, setConnectDialog] = useState<SaasType | null>(null);
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [connecting, setConnecting] = useState(false);

  // 해제 다이얼로그
  const [disconnectDialog, setDisconnectDialog] = useState<SaasType | null>(null);

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
    setShowToken(false);
    setShowGuide(true);
    setConnectDialog(saasType);
  };

  const handleTokenConnect = async () => {
    if (!connectDialog || !token.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      await saasApi.tokenConnect(connectDialog, token.trim());
      setSuccess(`${SAAS_INFO[connectDialog].label} 연결 완료! 이제 오프보딩 시 권한을 탐지합니다.`);
      setConnectDialog(null);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.error || '토큰 연결에 실패했습니다. 토큰이 올바른지 확인하세요.';
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

  if (loading) return <LinearProgress />;

  const info = connectDialog ? SAAS_INFO[connectDialog] : null;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>SaaS 연결 관리</Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'info.50', borderColor: 'info.200' }}>
        <Typography variant="body2" color="info.dark">
          <strong>연결 방식:</strong> 각 SaaS에서 관리자 토큰을 발급받아 붙여넣으면 즉시 연결됩니다.
          별도 앱 등록이나 서버 재시작 없이 바로 사용 가능합니다.
          <br />
          ORAM은 이 토큰으로 직원 권한 조회·해제 API를 대신 호출합니다. 토큰은 AES-256으로 암호화 저장됩니다.
        </Typography>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        {connections.map((conn) => {
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

                  {conn.isConnected && (
                    <Box mt={1.5} p={1} bgcolor="success.50" borderRadius={1}>
                      <Typography variant="body2" color="success.dark">
                        <strong>{conn.workspaceName}</strong>
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
                <CardActions sx={{ px: 2, py: 1.5, gap: 1 }}>
                  {conn.isConnected ? (
                    <Button variant="outlined" color="error" startIcon={<LinkOffIcon />} size="small"
                      onClick={() => setDisconnectDialog(conn.saasType)}>
                      연결 해제
                    </Button>
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
                  <Button size="small" variant="text" sx={{ mt: 1 }}
                    onClick={() => window.open(info.docsUrl, '_blank')}>
                    공식 문서 보기 →
                  </Button>
                </Box>
              </Collapse>

              {/* 토큰 입력 */}
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
                토큰이 입력되면 ORAM이 실제 {info.label} API를 호출해 토큰 유효성을 검증합니다.
                검증 성공 시 AES-256 암호화 후 저장됩니다.
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
    </Box>
  );
}
