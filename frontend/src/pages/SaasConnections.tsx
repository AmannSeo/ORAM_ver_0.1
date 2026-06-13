import { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, CardActions, Button,
  Chip, LinearProgress, Alert, Dialog, DialogTitle, DialogContent,
  DialogActions, Divider, Tooltip, Paper, List, ListItem, ListItemText,
  Stepper, Step, StepLabel, StepContent,
} from '@mui/material';
import {
  CheckCircle as ConnectedIcon,
  Cancel as NotConnectedIcon,
  LinkOff as LinkOffIcon,
  Science as DemoIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { saasApi } from '../api';
import type { SaasConnection, SaasType } from '../types';

const SAAS_META: Record<SaasType, { label: string; color: string; emoji: string; desc: string }> = {
  SLACK:  { label: 'Slack',  color: '#4A154B', emoji: '💬', desc: '팀 메신저. 채널 멤버십, 워크스페이스 관리자 권한을 탐지합니다.' },
  GITHUB: { label: 'GitHub', color: '#181717', emoji: '🐙', desc: '코드 저장소. Organization Owner, 저장소 접근, PAT 토큰을 탐지합니다.' },
  NOTION: { label: 'Notion', color: '#000000', emoji: '📝', desc: '협업 도구. 워크스페이스 멤버십, 페이지 접근 권한을 탐지합니다.' },
};

// OAuth 실제 연결 설정 가이드
const OAUTH_GUIDE: Record<SaasType, { steps: string[]; envVars: string[]; docsUrl: string }> = {
  SLACK: {
    steps: [
      '1. https://api.slack.com/apps 접속 → "Create New App" 클릭',
      '2. OAuth & Permissions 메뉴에서 Redirect URL 추가:\n   http://localhost:8080/api/saas-connections/oauth/callback/SLACK',
      '3. Scopes: users:read, users:read.email, admin.users:read 추가',
      '4. Basic Information에서 Client ID, Client Secret 복사',
      '5. backend/.env 파일에 SLACK_CLIENT_ID, SLACK_CLIENT_SECRET 설정 후 서버 재시작',
    ],
    envVars: ['SLACK_CLIENT_ID=xoxp-...', 'SLACK_CLIENT_SECRET=...'],
    docsUrl: 'https://api.slack.com/authentication/oauth-v2',
  },
  GITHUB: {
    steps: [
      '1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App',
      '2. Homepage URL: http://localhost:5173',
      '3. Authorization callback URL:\n   http://localhost:8080/api/saas-connections/oauth/callback/GITHUB',
      '4. Client ID, Client Secret 생성 후 복사',
      '5. backend/.env 파일에 GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET 설정 후 서버 재시작',
    ],
    envVars: ['GITHUB_CLIENT_ID=...', 'GITHUB_CLIENT_SECRET=...'],
    docsUrl: 'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps',
  },
  NOTION: {
    steps: [
      '1. https://www.notion.so/my-integrations 접속 → "New integration" 클릭',
      '2. Integration type: Public 선택',
      '3. Redirect URIs 추가:\n   http://localhost:8080/api/saas-connections/oauth/callback/NOTION',
      '4. OAuth Credentials에서 Client ID, Client Secret 복사',
      '5. backend/.env 파일에 NOTION_CLIENT_ID, NOTION_CLIENT_SECRET 설정 후 서버 재시작',
    ],
    envVars: ['NOTION_CLIENT_ID=...', 'NOTION_CLIENT_SECRET=...'],
    docsUrl: 'https://developers.notion.com/docs/authorization',
  },
};

export default function SaasConnections() {
  const [connections, setConnections] = useState<SaasConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [disconnectDialog, setDisconnectDialog] = useState<SaasType | null>(null);
  const [connecting, setConnecting] = useState<SaasType | null>(null);
  const [setupDialog, setSetupDialog] = useState<SaasType | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    saasApi.getAll()
      .then(setConnections)
      .catch(() => setError('SaaS 연결 정보를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleDemoConnect = async (saasType: SaasType) => {
    setConnecting(saasType);
    setError(null);
    try {
      await saasApi.demoConnect(saasType);
      setSuccess(`${SAAS_META[saasType].label} 데모 연결 완료! 이제 오프보딩 시 이 플랫폼의 권한을 탐지합니다.`);
      load();
    } catch {
      setError('데모 연결에 실패했습니다');
    } finally {
      setConnecting(null);
    }
  };

  const handleRealConnect = (saasType: SaasType) => {
    // OAuth 자격증명이 없으면 설정 가이드를 표시
    setSetupDialog(saasType);
  };

  const handleStartOAuth = async (saasType: SaasType) => {
    try {
      const { authorizationUrl } = await saasApi.getOAuthUrl(saasType);
      window.open(authorizationUrl, '_blank', 'width=600,height=700');
      setSetupDialog(null);
    } catch {
      setError('OAuth URL 생성에 실패했습니다. 서버의 client-id/secret 설정을 확인하세요.');
      setSetupDialog(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const handleDisconnect = async () => {
    if (!disconnectDialog) return;
    try {
      await saasApi.disconnect(disconnectDialog);
      setDisconnectDialog(null);
      setSuccess(`${SAAS_META[disconnectDialog].label} 연결이 해제되었습니다`);
      load();
    } catch {
      setError('연결 해제에 실패했습니다');
      setDisconnectDialog(null);
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>SaaS 연결 관리</Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'info.50', borderColor: 'info.200' }}>
        <Box display="flex" alignItems="flex-start" gap={1}>
          <InfoIcon color="info" sx={{ mt: 0.3 }} />
          <Box>
            <Typography variant="subtitle2" fontWeight="bold" color="info.dark">SaaS 연결이란?</Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              ORAM이 Slack, GitHub, Notion에 접근하려면 먼저 연결이 필요합니다.
              연결된 플랫폼에서만 직원의 권한을 탐지하고 해제할 수 있습니다.
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              <strong>실제 연결</strong>: OAuth 앱 등록 후 client-id/secret 설정 필요 &nbsp;|&nbsp;
              <strong>데모 연결</strong>: OAuth 없이 Mock 데이터로 즉시 테스트 가능
            </Typography>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        {connections.map((conn) => {
          const meta = SAAS_META[conn.saasType];
          const isConnecting = connecting === conn.saasType;
          return (
            <Grid item xs={12} sm={6} md={4} key={conn.saasType}>
              <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Typography fontSize={44}>{meta.emoji}</Typography>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">{meta.label}</Typography>
                      <Chip
                        icon={conn.isConnected ? <ConnectedIcon /> : <NotConnectedIcon />}
                        label={conn.isConnected ? '연결됨' : '미연결'}
                        color={conn.isConnected ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>
                  </Box>
                  <Typography variant="body2" color="text.secondary" mb={1.5}>{meta.desc}</Typography>
                  {conn.isConnected ? (
                    <Box mt={1} p={1.5} bgcolor="success.50" borderRadius={1}>
                      <Typography variant="body2" color="success.dark">
                        <strong>워크스페이스:</strong> {conn.workspaceName}
                      </Typography>
                      {conn.connectedAt && (
                        <Typography variant="caption" color="text.secondary">
                          연결일: {new Date(conn.connectedAt).toLocaleDateString('ko-KR')}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Box mt={1} p={1.5} bgcolor="grey.50" borderRadius={1}>
                      <Typography variant="body2" color="text.secondary">
                        연결되지 않았습니다. 이 플랫폼의 직원 권한을 탐지할 수 없습니다.
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                <Divider />
                <CardActions sx={{ px: 2, py: 1.5, gap: 1, flexWrap: 'wrap' }}>
                  {conn.isConnected ? (
                    <Button variant="outlined" color="error" startIcon={<LinkOffIcon />} size="small"
                      onClick={() => setDisconnectDialog(conn.saasType)}>
                      연결 해제
                    </Button>
                  ) : (
                    <>
                      <Tooltip title="OAuth App 등록 실제 연결 차례 안내">
                        <Button variant="outlined" startIcon={<SettingsIcon />} size="small"
                          onClick={() => handleRealConnect(conn.saasType)}
                          sx={{ borderColor: meta.color, color: meta.color }}>
                          실제 연결 방법
                        </Button>
                      </Tooltip>
                      <Tooltip title="OAuth 없이 Mock 데이터로 즉시 연결 — PoC 시연용">
                        <Button variant="contained" startIcon={<DemoIcon />} size="small"
                          onClick={() => handleDemoConnect(conn.saasType)}
                          disabled={isConnecting}
                          sx={{ bgcolor: meta.color, '&:hover': { bgcolor: meta.color, opacity: 0.85 } }}>
                          {isConnecting ? '연결 중...' : '데모 연결'}
                        </Button>
                      </Tooltip>
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
          <strong>연결 완료!</strong> 이제 직원을 퇴사 처리하면 연결된 SaaS에서 해당 직원의 모든 권한이 자동으로 탐지됩니다.
          <br />→ <strong>직원 관리</strong> 페이지에서 직원을 선택하고 <strong>"오프보딩"</strong> 버튼을 클릭하세요.
        </Alert>
      )}

      <Dialog open={Boolean(disconnectDialog)} onClose={() => setDisconnectDialog(null)}>
        <DialogTitle>연결 해제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{disconnectDialog && SAAS_META[disconnectDialog].label}</strong>와의 연결을 해제하시겠습니까?
            <br /><br />
            연결 해제 후에는 이 플랫폼의 직원 권한을 탐지하거나 해제할 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisconnectDialog(null)}>취소</Button>
          <Button color="error" variant="contained" onClick={handleDisconnect}>연결 해제</Button>
        </DialogActions>
      </Dialog>

      {/* OAuth 실제 연결 설정 다이얼로그 */}
      <Dialog open={Boolean(setupDialog)} onClose={() => setSetupDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {setupDialog && SAAS_META[setupDialog].emoji} {setupDialog && SAAS_META[setupDialog].label} OAuth 실제 연결 설정
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            실제 연결은 각 SaaS에서 <strong>OAuth App을 등록</strong>하고
            서버에 <strong>환경변수를 설정</strong>해야 합니다.
            PoC 시연 시는 <strong>"데모 연결"</strong> 버튼을 사용하세요.
          </Alert>

          {setupDialog && (
            <>
              <Typography variant="subtitle2" fontWeight="bold" mb={1}>플닸설정 단계</Typography>
              <Stepper orientation="vertical" activeStep={-1}>
                {OAUTH_GUIDE[setupDialog].steps.map((step, i) => (
                  <Step key={i} expanded>
                    <StepLabel>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{step}</Typography>
                    </StepLabel>
                    <StepContent />
                  </Step>
                ))}
              </Stepper>

              <Typography variant="subtitle2" fontWeight="bold" mt={2} mb={1}>.env 설정 예시</Typography>
              <Box p={1.5} bgcolor="grey.900" borderRadius={1} mb={1}>
                {OAUTH_GUIDE[setupDialog].envVars.map((v) => (
                  <Typography key={v} variant="caption" sx={{ color: '#98c379', display: 'block', fontFamily: 'monospace' }}>{v}</Typography>
                ))}
              </Box>

              <Typography variant="subtitle2" fontWeight="bold" mt={2} mb={1}>연결 후 OAuth 시작</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                위 설정 완료 후 서버를 재시작하면 아래 버튼이 정상 동작합니다.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSetupDialog(null)}>닫기</Button>
          {setupDialog && (
            <Button
              variant="outlined"
              onClick={() => window.open(OAUTH_GUIDE[setupDialog].docsUrl, '_blank')}
            >
              공식 문서 보기
            </Button>
          )}
          {setupDialog && (
            <Button
              variant="contained"
              sx={{ bgcolor: setupDialog ? SAAS_META[setupDialog].color : undefined }}
              onClick={() => handleStartOAuth(setupDialog)}
            >
              OAuth 시작 (설정 완료 후)
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}