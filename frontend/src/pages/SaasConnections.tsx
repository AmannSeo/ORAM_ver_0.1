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
  Warning as WarnIcon,
} from '@mui/icons-material';
import { saasApi } from '../api';
import PageHeader from '../components/common/PageHeader';
import { accountScopeLabel, DEFAULT_CONNECTIONS, GITHUB_ACCOUNT_SCOPES, SAAS_INFO } from '../constants/saas';
import { formatDateTime } from '../utils/format';
import type { SaasConnection, SaasIdentity, SaasType } from '../types';

export default function SaasConnections() {
  const [connections, setConnections] = useState<SaasConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 연결 다이얼로그
  const [connectDialog, setConnectDialog] = useState<SaasType | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [token, setToken] = useState('');
  const [accountScope, setAccountScope] = useState('ORGANIZATION');
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncingSaas, setSyncingSaas] = useState<SaasType | null>(null);
  const [syncToast, setSyncToast] = useState<{ saasType: SaasType; msg: string } | null>(null);

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

  const toggleDetails = (saasType: SaasType) =>
    setExpandedDetails((prev) => ({ ...prev, [saasType]: !prev[saasType] }));

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
      await saasApi.syncUsers(saasType);
      // 각 카드 위에 간결한 토스트로 표시 (3초 후 자동 닫힘)
      setSyncToast({ saasType, msg: `${SAAS_INFO[saasType].label} 사용자 동기화 완료` });
      setTimeout(() => setSyncToast((cur) => (cur?.saasType === saasType ? null : cur)), 3000);
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

  return (
    <Box>
      <PageHeader title="SaaS 연결 관리" />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      <Grid container spacing={3}>
        {visibleConnections.map((conn) => {
          const meta = SAAS_INFO[conn.saasType];
          return (
            <Grid item xs={12} sm={6} md={4} key={conn.saasType}>
              {syncToast?.saasType === conn.saasType && (
                <Alert severity="success" sx={{ mb: 1, py: 0.25 }} onClose={() => setSyncToast(null)}>
                  {syncToast.msg}
                </Alert>
              )}
              <Card elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column',
                borderLeft: conn.isConnected ? `4px solid #2e7d32` : `4px solid #bdbdbd` }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="center" gap={2} mb={1.5}>
                    <Typography fontSize={42}>{meta.emoji}</Typography>
                    <Box>
                      <Typography variant="h6" fontWeight={700} sx={{ fontSize: 21 }}>{meta.label}</Typography>
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

                  {conn.isConnected ? (
                    <Box mt={0.5} p={1.25} bgcolor="success.50" borderRadius={1}>
                      {/* 항상 노출: 핵심 4개 (가져온 이름 / 수집 계정 / 마지막 동기화 / 미처리 감지) */}
                      <Typography variant="body2" color="success.dark" fontWeight={700} sx={{ fontSize: 14 }}>
                        {conn.workspaceName}
                      </Typography>
                      <Stack direction="row" spacing={0.75} alignItems="center" mt={0.5}>
                        <PeopleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
                          수집 계정: {conn.identityCount ?? 0}명
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center" mt={0.25}>
                        <ScheduleIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12.5 }}>
                          마지막 동기화: {formatDateTime(conn.lastSyncedAt)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.75} alignItems="center" mt={0.25}>
                        <AlertIcon sx={{ fontSize: 14, color: (conn.openAlertCount ?? 0) > 0 ? 'warning.main' : 'text.secondary' }} />
                        <Typography variant="caption" color={(conn.openAlertCount ?? 0) > 0 ? 'warning.main' : 'text.secondary'} sx={{ fontSize: 12.5 }}>
                          미처리 감지: {conn.openAlertCount ?? 0}건
                        </Typography>
                      </Stack>

                      {/* 상세 토글 버튼 */}
                      <Box display="flex" justifyContent="flex-end" mt={0.25}>
                        <Button
                          size="small"
                          variant="text"
                          onClick={() => toggleDetails(conn.saasType)}
                          endIcon={expandedDetails[conn.saasType] ? <CollapseIcon fontSize="small" /> : <ExpandIcon fontSize="small" />}
                          sx={{ px: 0.75, minWidth: 'auto', fontSize: 12.5 }}
                          aria-expanded={Boolean(expandedDetails[conn.saasType])}
                        >
                          상세
                        </Button>
                      </Box>

                      {/* 상세: 탐지 항목 / 권한 해제 / 링크 / 연결 정보 */}
                      <Collapse in={Boolean(expandedDetails[conn.saasType])}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ fontSize: 12.5 }}>탐지 항목</Typography>
                        {meta.detectItems.map(d => (
                          <Typography key={d} variant="caption" display="block" color="text.secondary" sx={{ fontSize: 12.5, lineHeight: 1.65 }}>• {d}</Typography>
                        ))}
                        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mt={1} sx={{ fontSize: 12.5 }}>권한 해제</Typography>
                        <Typography variant="caption" display="block" color={meta.revokeNote.startsWith('⚠️') ? 'warning.main' : 'text.secondary'} sx={{ fontSize: 12.5, lineHeight: 1.65 }}>
                          {meta.revokeNote}
                        </Typography>

                        <Stack direction="row" flexWrap="wrap" gap={1} mt={1}>
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
                              sx={{ px: 0.5, minWidth: 'auto', fontSize: 12.5 }}
                            >
                              {link.label}
                            </Button>
                          ))}
                        </Stack>

                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ fontSize: 12.5, mb: 0.5 }}>
                          연결 정보
                        </Typography>
                        {conn.saasType === 'GITHUB' && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 12.5 }}>
                            계정 범위: {accountScopeLabel(conn.saasType, conn.accountScope, conn.enterpriseAccount)}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block" mt={0.5} sx={{ fontSize: 12.5, lineHeight: 1.6 }}>
                          퇴사자 활성 계정, 비활성 계정, 이전 동기화 대비 누락 계정을 권한 회수 검토 대상으로 표시합니다.
                        </Typography>
                        {conn.connectedAt && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 12.5 }}>
                            연결일: {new Date(conn.connectedAt).toLocaleDateString('ko-KR')}
                          </Typography>
                        )}
                      </Collapse>
                    </Box>
                  ) : (
                    <>
                      {/* 미연결: 연결 전 안내 (탐지 항목 / 권한 해제 / 링크) */}
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ fontSize: 13 }}>탐지 항목</Typography>
                      {meta.detectItems.map(d => (
                        <Typography key={d} variant="caption" display="block" color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.65 }}>• {d}</Typography>
                      ))}
                      <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" mt={1} sx={{ fontSize: 13 }}>권한 해제</Typography>
                      <Typography variant="caption" display="block" color={meta.revokeNote.startsWith('⚠️') ? 'warning.main' : 'text.secondary'} sx={{ fontSize: 13, lineHeight: 1.65 }}>
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
                            sx={{ px: 0.5, minWidth: 'auto', fontSize: 13 }}
                          >
                            {link.label}
                          </Button>
                        ))}
                      </Stack>
                    </>
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
                      <TableCell width="34%">SaaS 계정</TableCell>
                      <TableCell width="32%">이메일</TableCell>
                      <TableCell width="14%" align="center">상태</TableCell>
                      <TableCell width="20%">동기화 시각</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {identityRows.map(row => (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={0.5}>
                            {row.employeeStatus === 'RESIGNED' && !row.accessRevoked && (
                              <WarnIcon titleAccess="퇴사자인데 권한이 회수되지 않았습니다" sx={{ fontSize: 16, color: '#dc2626' }} />
                            )}
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {row.displayName || row.externalUsername || row.externalUserId}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell><Typography variant="body2" noWrap>{row.externalEmail || '-'}</Typography></TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            color={row.accessRevoked ? 'default' : row.employeeStatus === 'RESIGNED' ? 'error' : row.status === 'ACTIVE' ? 'success' : 'warning'}
                            label={row.accessRevoked ? '회수됨' : row.employeeStatus === 'RESIGNED' ? '미회수' : row.status === 'ACTIVE' ? '활성' : '비활성'}
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
