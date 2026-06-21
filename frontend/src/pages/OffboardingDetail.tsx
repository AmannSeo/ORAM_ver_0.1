import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AutoAwesome as AutoIcon,
  Block as FalsePositiveIcon,
  CheckCircle as CheckIcon,
  DeleteSweep as RevokeIcon,
  ErrorOutline as ErrorIcon,
  FactCheck as PlanIcon,
  PersonSearch as ManualIcon,
  Security as SecurityIcon,
  VpnKey as TokenIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { offboardingApi } from '../api';
import RiskBadge from '../components/common/RiskBadge';
import type { OffboardingDetail, RevokePlanItem, RevokePlanResponse, SaasType } from '../types';

const SAAS_LABEL: Record<SaasType, string> = {
  SLACK: 'Slack',
  GITHUB: 'GitHub',
  NOTION: 'Notion',
};

const PLAN_STATUS_LABEL: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  READY: { label: '자동 회수 가능', color: 'success' },
  MANUAL: { label: '수동 조치 필요', color: 'warning' },
  NO_ACCOUNT: { label: '매핑 계정 없음', color: 'default' },
  REVOKED: { label: '회수 완료', color: 'success' },
  FAILED: { label: '회수 실패', color: 'error' },
};

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function triggerLabel(trigger?: string) {
  if (!trigger) return '-';
  if (trigger.includes('SYNC_INACTIVE_ACCOUNT')) return 'SaaS 동기화에서 비활성 계정이 감지되었습니다.';
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) return '이전 동기화에 있던 SaaS 계정이 최신 동기화에서 사라졌습니다.';
  if (trigger === 'MANUAL_TRIGGER') return '퇴사 처리 후 자동으로 잔여 접근 권한 분석이 실행되었습니다.';
  if (trigger === 'MANUAL_ANALYSIS_REQUEST') return '관리자가 기존 권한 회수 대상을 재분석했습니다.';
  return trigger;
}

function planReasonKo(item: RevokePlanItem) {
  if (item.status === 'NO_ACCOUNT') {
    return '이 직원과 매핑된 SaaS 계정이 없습니다. 먼저 SaaS 동기화와 이메일 매핑 상태를 확인하세요.';
  }
  if (item.saasType === 'NOTION') {
    return 'Notion API는 워크스페이스 멤버 제거를 공식 제공하지 않습니다. Notion 관리자 화면에서 직접 제거해야 합니다.';
  }
  if (item.saasType === 'SLACK') {
    return 'Slack 자동 제거는 Enterprise Grid 및 admin.users:write 권한이 있는 사용자 토큰에서만 가능합니다.';
  }
  if (item.saasType === 'GITHUB') {
    return 'GitHub 토큰 권한으로 조직 멤버 또는 저장소 collaborator 제거를 시도합니다.';
  }
  return item.reason;
}

function revokeResultKo(item: RevokePlanItem) {
  if (item.status === 'REVOKED') return `${SAAS_LABEL[item.saasType]} 권한 회수가 완료되었습니다.`;
  if (item.status === 'FAILED') return `${SAAS_LABEL[item.saasType]} 권한 회수에 실패했습니다: ${item.reason}`;
  return `${SAAS_LABEL[item.saasType]}: ${planReasonKo(item)}`;
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="#64748b" fontWeight={700}>
        {label}
      </Typography>
      <Typography fontWeight={600} color="#0f172a" sx={{ wordBreak: 'break-word' }}>
        {value || '-'}
      </Typography>
    </Box>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'success' | 'warning' | 'default' }) {
  const colors = {
    success: { bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' },
    warning: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
    default: { bg: '#f8fafc', border: '#e2e8f0', color: '#475569' },
  }[tone];

  return (
    <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.bg, border: `1px solid ${colors.border}` }}>
      <Typography variant="caption" color="#64748b" fontWeight={700}>{label}</Typography>
      <Typography variant="h5" fontWeight={700} color={colors.color}>{value}</Typography>
    </Box>
  );
}

function PlanItem({ item }: { item: RevokePlanItem }) {
  const status = PLAN_STATUS_LABEL[item.status] ?? { label: item.status, color: 'default' as const };
  const icon = item.status === 'READY' || item.status === 'REVOKED'
    ? <CheckIcon color="success" fontSize="small" />
    : item.status === 'FAILED'
      ? <ErrorIcon color="error" fontSize="small" />
      : <WarningIcon color="warning" fontSize="small" />;

  return (
    <Box
      sx={{
        border: '1px solid #e2e8f0',
        borderRadius: 2,
        p: 1.5,
        bgcolor: '#fff',
      }}
    >
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1}>
        <Stack direction="row" alignItems="center" spacing={0.75} minWidth={0}>
          {icon}
          <Typography fontWeight={700}>{SAAS_LABEL[item.saasType]}</Typography>
        </Stack>
        <Chip size="small" label={status.label} color={status.color} />
      </Stack>
      <Typography variant="body2" color="#475569" mt={1}>
        대상 {item.resourceCount}개 · {item.action}
      </Typography>
      <Typography variant="caption" color="#64748b" display="block" mt={0.5}>
        {planReasonKo(item)}
      </Typography>
      {item.resources && item.resources.length > 0 && (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap mt={1}>
          {item.resources.map((resource) => (
            <Chip key={resource} size="small" label={resource} variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default function OffboardingDetailPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<OffboardingDetail | null>(null);
  const [plan, setPlan] = useState<RevokePlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState(false);
  const [falsePositiveDialog, setFalsePositiveDialog] = useState(false);
  const [falsePositiveReason, setFalsePositiveReason] = useState('');
  const [falsePositiveLoading, setFalsePositiveLoading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
  const [falsePositiveSuccess, setFalsePositiveSuccess] = useState<string | null>(null);
  const [revokeResults, setRevokeResults] = useState<RevokePlanItem[]>([]);

  const load = async () => {
    if (!resultId) return;
    setLoading(true);
    setError(null);
    try {
      const [detailRes, planRes] = await Promise.all([
        offboardingApi.getById(resultId),
        offboardingApi.getRevokePlan(resultId),
      ]);
      setDetail(detailRes);
      setPlan(planRes);
    } catch {
      setError('권한 회수 상세 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resultId]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<SaasType, OffboardingDetail['permissions']>();
    detail?.permissions.forEach((permission) => {
      const current = groups.get(permission.saasType) ?? [];
      groups.set(permission.saasType, [...current, permission]);
    });
    return Array.from(groups.entries());
  }, [detail]);

  const handleRevokeAll = async () => {
    if (!resultId) return;
    setRevoking(true);
    setError(null);
    try {
      const res = await offboardingApi.revokeAll(resultId);
      setRevokeDialog(false);
      setRevokeResults(res.items ?? []);
      setRevokeSuccess(
        res.revokedSaas.length > 0
          ? `권한 회수 요청이 완료되었습니다. 성공: ${res.revokedSaas.map((saas) => SAAS_LABEL[saas]).join(', ')}`
          : '자동으로 회수할 권한이 없습니다. 실패 사유와 수동 조치 항목을 확인하세요.',
      );
      await load();
    } catch {
      setError('권한 회수 요청에 실패했습니다.');
      setRevokeDialog(false);
    } finally {
      setRevoking(false);
    }
  };

  const handleFalsePositive = async () => {
    if (!resultId) return;
    setFalsePositiveLoading(true);
    setError(null);
    try {
      const res = await offboardingApi.markFalsePositive(resultId, falsePositiveReason);
      setFalsePositiveDialog(false);
      setFalsePositiveSuccess(res.message);
      await load();
    } catch {
      setError('오탐 처리 요청에 실패했습니다.');
      setFalsePositiveDialog(false);
    } finally {
      setFalsePositiveLoading(false);
    }
  };

  if (loading) return <LinearProgress />;
  if (error && !detail) return <Alert severity="error">{error}</Alert>;
  if (!detail) return null;

  const automatic = detail.analysisSource === 'AUTOMATIC';
  const readyCount = plan?.readyCount ?? 0;
  const manualCount = plan?.manualCount ?? 0;
  const blockedCount = plan?.blockedCount ?? 0;
  const canRevoke = !detail.falsePositive && !detail.revokedAll && !!plan && plan.items.length > 0;

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Card elevation={0} sx={{ mb: 2.5, border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: '#fff' }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start" minWidth={0}>
              <Tooltip title="권한 회수 목록으로 돌아가기">
                <IconButton onClick={() => navigate('/offboarding')} sx={{ border: '1px solid #e2e8f0', mt: 0.25 }}>
                  <BackIcon />
                </IconButton>
              </Tooltip>
              <Box minWidth={0}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="h4" fontWeight={700} color="#0f172a">
                    권한 회수 상세
                  </Typography>
                  {detail.falsePositive && <Chip icon={<FalsePositiveIcon />} label="오탐 처리됨" color="default" />}
                  {detail.revokedAll && <Chip icon={<CheckIcon />} label="권한 회수 완료" color="success" />}
                </Stack>
                <Typography variant="body2" color="#64748b" mt={0.75}>
                  잔여 SaaS 권한, 위험도 산정 근거, 권한 회수 가능 여부를 확인합니다.
                </Typography>
              </Box>
            </Stack>

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<FalsePositiveIcon />}
                onClick={() => setFalsePositiveDialog(true)}
                disabled={detail.falsePositive || detail.revokedAll}
                sx={{ borderRadius: 1.5, whiteSpace: 'nowrap', height: 34 }}
              >
                오탐 처리
              </Button>
              <Button
                variant="contained"
                color="error"
                size="small"
                startIcon={<RevokeIcon />}
                onClick={() => setRevokeDialog(true)}
                disabled={!canRevoke}
                sx={{ borderRadius: 1.5, whiteSpace: 'nowrap', height: 34 }}
              >
                권한 회수 실행
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {revokeSuccess && <Alert severity="success" sx={{ mb: 2 }}>{revokeSuccess}</Alert>}
      {falsePositiveSuccess && <Alert severity="success" sx={{ mb: 2 }}>{falsePositiveSuccess}</Alert>}
      {detail.falsePositive && (
        <Alert severity="info" sx={{ mb: 2 }}>
          오탐으로 처리된 항목입니다. 권한 회수 대상과 AI 리스크 목록에서 제외됩니다.
          {detail.falsePositiveReason ? ` 사유: ${detail.falsePositiveReason}` : ''}
        </Alert>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {revokeResults.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {revokeResults.map(revokeResultKo).join(' / ')}
        </Alert>
      )}

      <Grid container spacing={2.5} alignItems="stretch">
        <Grid item xs={12} lg={4}>
          <Stack spacing={2.5}>
            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="h6" fontWeight={700}>직원 정보</Typography>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={1.75}>
                  <InfoRow label="이름" value={detail.employee.name} />
                  <InfoRow label="이메일" value={detail.employee.email} />
                  <InfoRow label="부서" value={detail.employee.department} />
                  <Box>
                    <Typography variant="caption" color="#64748b" fontWeight={700}>잔여 접근 위험도</Typography>
                    <Box mt={0.75}>
                      <RiskBadge level={detail.riskLevel} score={detail.riskScore} />
                    </Box>
                  </Box>
                  <InfoRow label="생성/갱신 시각" value={formatDateTime(detail.startedAt)} />
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="h6" fontWeight={700}>분석 정보</Typography>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={1.75}>
                  <Chip
                    icon={automatic ? <AutoIcon /> : <ManualIcon />}
                    label={automatic ? '자동 감지' : '수동 분석'}
                    color={automatic ? 'primary' : 'default'}
                    sx={{ alignSelf: 'flex-start', fontWeight: 600 }}
                  />
                  <InfoRow label="감지 사유" value={triggerLabel(detail.analysisTrigger)} />
                  <InfoRow label="분석 엔진" value={detail.analysisEngine || 'ORAM2 XGBoost'} />
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <PlanIcon color="primary" />
                  <Typography variant="h6" fontWeight={700}>회수 실행 계획</Typography>
                </Stack>
                <Grid container spacing={1.25} mt={1}>
                  <Grid item xs={4}><MetricCard label="자동" value={readyCount} tone="success" /></Grid>
                  <Grid item xs={4}><MetricCard label="수동" value={manualCount} tone="warning" /></Grid>
                  <Grid item xs={4}><MetricCard label="확인" value={blockedCount} tone="default" /></Grid>
                </Grid>
                <Stack spacing={1.25} mt={2}>
                  {!plan ? (
                    <Alert severity="warning">회수 계획을 불러오지 못했습니다.</Alert>
                  ) : plan.items.length === 0 ? (
                    <Alert severity="info">연결된 SaaS가 없거나 회수 계획을 만들 계정이 없습니다.</Alert>
                  ) : (
                    plan.items.map((item) => <PlanItem key={item.saasType} item={item} />)
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Stack spacing={2.5}>
            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} mb={2}>
                  <Box>
                    <Typography variant="h6" fontWeight={700}>발견된 SaaS 권한</Typography>
                    <Typography variant="body2" color="#64748b" mt={0.5}>
                      직원과 매핑된 계정에서 수집한 권한입니다.
                    </Typography>
                  </Box>
                  <Chip label={`${detail.permissions.length}개 권한`} color="primary" variant="outlined" />
                </Stack>
                {groupedPermissions.length === 0 ? (
                  <Alert severity="info">
                    발견된 권한이 없습니다. SaaS 연결 상태와 계정 동기화 결과를 확인하세요.
                  </Alert>
                ) : (
                  <Stack spacing={2}>
                    {groupedPermissions.map(([saasType, permissions]) => (
                      <Box key={saasType} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, p: 2 }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} mb={1.5}>
                          <Typography fontWeight={700}>{SAAS_LABEL[saasType]}</Typography>
                          <Chip label={`${permissions.length}개`} size="small" variant="outlined" />
                        </Stack>
                        <Grid container spacing={1.5}>
                          {permissions.map((permission, index) => (
                            <Grid item xs={12} md={6} key={`${permission.saasType}-${index}`}>
                              <Card variant="outlined" sx={{ borderRadius: 2, height: '100%' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                  <Typography fontWeight={700}>{permission.permissionType}</Typography>
                                  <Typography variant="caption" color="#64748b">
                                    {permission.resourceName || '-'}
                                  </Typography>
                                  <Stack direction="row" gap={0.75} flexWrap="wrap" useFlexGap mt={1.25}>
                                    {permission.isAdmin && <Chip icon={<SecurityIcon />} label="Admin" size="small" color="warning" />}
                                    {permission.isOwner && <Chip icon={<SecurityIcon />} label="Owner" size="small" color="error" />}
                                    {permission.hasApiToken && <Chip icon={<TokenIcon />} label="API Token" size="small" color="error" />}
                                    {permission.repoCount > 0 && <Chip label={`${permission.repoCount} Repos`} size="small" />}
                                    {permission.workspaceCount > 0 && <Chip label={`${permission.workspaceCount} Workspaces`} size="small" />}
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="h6" fontWeight={700}>권장 조치</Typography>
                <Divider sx={{ my: 2 }} />
                {detail.recommendedActions.length === 0 ? (
                  <Typography color="#64748b">추가 권장 조치가 없습니다.</Typography>
                ) : (
                  <List dense disablePadding>
                    {detail.recommendedActions.map((action, index) => (
                      <ListItem key={index} disablePadding sx={{ py: 0.75 }}>
                        <ListItemIcon sx={{ minWidth: 34 }}>
                          <WarningIcon fontSize="small" color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={action} primaryTypographyProps={{ fontWeight: 500 }} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={revokeDialog} onClose={() => setRevokeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>권한 회수 실행 확인</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <Typography>
              <strong>{detail.employee.name}</strong> 직원의 연결된 SaaS 권한 회수를 실행합니다.
              자동 회수가 불가능한 SaaS는 수동 조치 사유가 함께 표시됩니다.
            </Typography>
            {plan?.items.map((item) => (
              <PlanItem key={item.saasType} item={item} />
            ))}
            {plan && readyCount === 0 && (
              <Alert severity="warning">
                현재 자동 회수 가능한 SaaS가 없습니다. 연결 토큰 권한 또는 계정 매핑 상태를 먼저 확인하세요.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRevokeDialog(false)} disabled={revoking}>
            취소
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRevokeAll}
            disabled={revoking || !plan || readyCount === 0}
            startIcon={revoking ? <CircularProgress size={16} color="inherit" /> : <RevokeIcon />}
          >
            {revoking ? '회수 중...' : '권한 회수 실행'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={falsePositiveDialog} onClose={() => setFalsePositiveDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>오탐 처리</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography>
              <strong>{detail.employee.name}</strong> 직원의 AI 리스크 분석 결과를 오탐으로 처리합니다.
              처리 후 권한 회수 대상과 AI 리스크 목록에서 제외되며, 감사 로그에는 기록됩니다.
            </Typography>
            <TextField
              label="오탐 처리 사유"
              value={falsePositiveReason}
              onChange={(event) => setFalsePositiveReason(event.target.value)}
              placeholder="예: 별도 관리자 검토로 정상 권한임을 확인"
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFalsePositiveDialog(false)} disabled={falsePositiveLoading}>
            취소
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleFalsePositive}
            disabled={falsePositiveLoading}
            startIcon={falsePositiveLoading ? <CircularProgress size={16} color="inherit" /> : <FalsePositiveIcon />}
          >
            {falsePositiveLoading ? '처리 중...' : '오탐으로 제외'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
