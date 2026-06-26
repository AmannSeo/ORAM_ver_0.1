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
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
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
  PersonSearch as ManualIcon,
  Security as SecurityIcon,
  VpnKey as TokenIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { offboardingApi } from '../api';
import RiskBadge from '../components/common/RiskBadge';
import EmployeeLogPanel from '../components/employees/EmployeeLogPanel';
import { formatDateTime } from '../utils/format';
import { analysisTriggerLabel } from '../utils/riskLabels';
import type { OffboardingDetail, RevokePlanItem, RevokePlanResponse, SaasType } from '../types';

const SAAS_LABEL: Record<SaasType, string> = {
  SLACK: 'Slack',
  GITHUB: 'GitHub',
  NOTION: 'Notion',
};

const PLAN_STATUS_LABEL: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' | 'info' }> = {
  READY: { label: 'API 회수 가능', color: 'success' },
  MANUAL: { label: '수동 조치 필요', color: 'warning' },
  NO_ACCOUNT: { label: '매핑 계정 없음', color: 'default' },
  REVOKED: { label: '회수 완료', color: 'success' },
  FAILED: { label: '회수 실패', color: 'error' },
};

const LEVEL_ACTION: Record<string, string> = {
  LOW: '표준 절차로 회수',
  MEDIUM: '관리자 확인 후 회수',
  HIGH: '24시간 내 회수 승인',
  CRITICAL: '즉시 회수 승인',
};

function planReasonKo(item: RevokePlanItem) {
  if (item.status === 'FAILED') {
    return readableRevokeReason(item.reason);
  }
  if (item.status === 'NO_ACCOUNT') {
    return '직원과 매핑된 SaaS 계정이 없습니다. SaaS 동기화 결과와 이메일 매핑 상태를 먼저 확인해야 합니다.';
  }
  if (item.saasType === 'NOTION') {
    return 'Notion API는 워크스페이스 멤버 제거를 공식 제공하지 않습니다. Notion 관리자 화면에서 수동 제거하거나 IdP/SCIM으로 비활성 처리해야 합니다.';
  }
  if (item.saasType === 'SLACK') {
    return 'Slack API 회수는 Enterprise Grid와 admin.users:write 권한이 있는 xoxp 사용자 토큰에서만 가능합니다. xoxb 봇 토큰은 수집만 가능합니다.';
  }
  if (item.saasType === 'GITHUB') {
    return 'GitHub 토큰 권한으로 조직 멤버 또는 저장소 collaborator 제거를 시도합니다.';
  }
  return item.reason;
}

function readableRevokeReason(reason?: string) {
  if (!reason) return '상세 사유가 제공되지 않았습니다.';
  if (reason.includes('GitHub user could not be matched')) {
    return 'GitHub 계정을 이메일로 매핑하지 못했습니다. GitHub 비공개 이메일 계정은 수집 계정 목록의 login@github.local 계정과 직원 매핑을 확인해야 합니다.';
  }
  if (reason.includes('No removable GitHub access found')) {
    return '제거 가능한 GitHub 권한을 찾지 못했습니다. 권한이 팀/조직 역할로 상속되었거나 토큰이 해당 계정을 볼 수 없을 수 있습니다.';
  }
  if (reason.includes('token lacks admin permission') || reason.includes('403 Forbidden')) {
    return '토큰에 관리자 권한 또는 필요한 scope가 부족합니다. GitHub는 admin:org, repo 권한과 조직 관리자 권한이 필요할 수 있습니다.';
  }
  if (reason.includes('404 Not Found')) {
    return '대상 계정이나 저장소가 토큰에서 보이지 않거나 이미 제거된 상태입니다.';
  }
  if (reason.includes('422 Unprocessable Entity')) {
    return 'GitHub가 제거 요청을 거부했습니다. 조직 정책, 팀 상속 권한, 외부 collaborator 여부를 확인해야 합니다.';
  }
  if (reason.includes('Slack revoke failed')) {
    return 'Slack 권한 회수에 실패했습니다. Enterprise Grid 여부와 admin.users:write 사용자 토큰 권한을 확인해야 합니다.';
  }
  if (reason.includes('Bot tokens can collect users') || reason.includes('xoxp-')) {
    return 'Slack Bot Token(xoxb)은 사용자 수집만 가능하고 워크스페이스 접근 제거는 할 수 없습니다. Enterprise Grid에서 admin.users:write 권한이 있는 xoxp 사용자 토큰을 연결해야 합니다.';
  }
  if (reason.includes('Notion')) {
    return 'Notion은 API 제한으로 자동 멤버 제거가 어렵습니다. Notion 관리자 화면에서 수동 제거하거나 IdP/SCIM으로 비활성 처리해야 합니다.';
  }
  return reason;
}

function revokeResultKo(item: RevokePlanItem) {
  if (item.status === 'REVOKED') return `${SAAS_LABEL[item.saasType]} 권한 회수가 완료되었습니다.`;
  if (item.status === 'FAILED') return `${SAAS_LABEL[item.saasType]} 권한 회수에 실패했습니다: ${readableRevokeReason(item.reason)}`;
  return `${SAAS_LABEL[item.saasType]}: ${planReasonKo(item)}`;
}

function decisionStatus(detail: OffboardingDetail, plan?: RevokePlanResponse | null) {
  if (detail.falsePositive) return { step: 0, label: '오탐 처리됨', color: 'default' as const };
  if (detail.revokedAll) return { step: 3, label: '기록 완료', color: 'success' as const };
  if ((plan?.readyCount ?? 0) > 0) return { step: 1, label: '승인 대기', color: 'warning' as const };
  return { step: 1, label: '수동 검토 필요', color: 'warning' as const };
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="#64748b">{label}</Typography>
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
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: colors.bg, borderColor: colors.border }}>
      <Typography variant="caption" color="#64748b">{label}</Typography>
      <Typography variant="h5" fontWeight={700} color={colors.color}>{value}</Typography>
    </Paper>
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
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.25 }}>
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
    </Paper>
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
          : 'API로 회수할 수 있는 권한이 없습니다. 수동 조치 항목을 확인하세요.',
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
  const canRevoke = !detail.falsePositive && !detail.revokedAll && !!plan && plan.items.length > 0 && readyCount > 0;
  const status = decisionStatus(detail, plan);

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Card elevation={0} sx={{ mb: 2.5, border: '1px solid #e2e8f0', borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" gap={2}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start" minWidth={0}>
              <Tooltip title="권한 회수 대상 목록으로 돌아가기">
                <IconButton onClick={() => navigate('/offboarding')} sx={{ border: '1px solid #e2e8f0', mt: 0.25 }}>
                  <BackIcon />
                </IconButton>
              </Tooltip>
              <Box minWidth={0}>
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="h4" fontWeight={700} color="#0f172a">
                    권한 회수 판단
                  </Typography>
                  <Chip label={status.label} color={status.color} />
                  {detail.falsePositive && <Chip icon={<FalsePositiveIcon />} label="오탐 제외" color="default" />}
                  {detail.revokedAll && <Chip icon={<CheckIcon />} label="권한 회수 완료" color="success" />}
                </Stack>
                <Typography variant="body2" color="#64748b" mt={0.75}>
                  분석 근거를 확인하고, 관리자가 승인한 뒤 연결된 SaaS 권한을 회수합니다.
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
                승인 후 회수
              </Button>
            </Stack>
          </Stack>

          <Box mt={2.5}>
            <Stepper activeStep={status.step} alternativeLabel>
              {['분석', '승인', '회수', '기록'].map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
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
                <Typography variant="h6" fontWeight={700}>관리자 판단 요약</Typography>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={1.75}>
                  <Box>
                    <Typography variant="caption" color="#64748b">잔여 접근 위험도</Typography>
                    <Box mt={0.75}>
                      <RiskBadge level={detail.riskLevel} score={detail.riskScore} />
                    </Box>
                  </Box>
                  <InfoRow label="권장 판단" value={LEVEL_ACTION[detail.riskLevel || ''] || '관리자 검토'} />
                  <InfoRow label="감지 근거" value={analysisTriggerLabel(detail.analysisTrigger, true)} />
                  <InfoRow label="생성 경로" value={automatic ? '시스템 감지' : '관리자 실행'} />
                  <InfoRow label="분석 엔진" value={detail.analysisEngine || 'ORAM Risk Fusion'} />
                  <InfoRow label="생성 시각" value={formatDateTime(detail.startedAt)} />
                  {detail.completedAt && <InfoRow label="권한 회수 시각" value={formatDateTime(detail.completedAt)} />}
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h6" fontWeight={700}>대상 직원</Typography>
                  {detail.startedAt && (
                    <Typography variant="caption" color="#64748b">퇴직 시각: {formatDateTime(detail.startedAt)}</Typography>
                  )}
                </Stack>
                <Divider sx={{ my: 2 }} />
                <Stack spacing={1.75}>
                  <InfoRow label="이름" value={detail.employee.name} />
                  <InfoRow label="이메일" value={detail.employee.email} />
                  <InfoRow
                    label="부서"
                    value={
                      detail.employee.department
                        && !['SLACK', 'GITHUB', 'NOTION'].some((s) => detail.employee.department.toUpperCase().includes(s))
                        ? detail.employee.department
                        : '-'
                    }
                  />
                </Stack>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="h6" fontWeight={700}>회수 계획</Typography>
                <Grid container spacing={1.25} mt={1}>
                  <Grid item xs={4}><MetricCard label="자동" value={readyCount} tone="success" /></Grid>
                  <Grid item xs={4}><MetricCard label="수동" value={manualCount} tone="warning" /></Grid>
                  <Grid item xs={4}><MetricCard label="확인" value={blockedCount} tone="default" /></Grid>
                </Grid>
                <Stack spacing={1.25} mt={2}>
                  {!plan ? (
                    <Alert severity="warning">회수 계획을 불러오지 못했습니다.</Alert>
                  ) : plan.items.length === 0 ? (
                    <Alert severity="info">연결된 SaaS가 없거나 회수할 계정이 없습니다.</Alert>
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
                      직원과 매핑된 SaaS 계정에서 수집한 실제 권한입니다.
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
                      <Paper key={saasType} variant="outlined" sx={{ borderRadius: 2.5, p: 2 }}>
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
                                    {permission.recentLogin && <Chip label="최근 로그인" size="small" color="info" />}
                                    {permission.repoCount > 0 && <Chip label={`${permission.repoCount} Repos`} size="small" />}
                                    {permission.workspaceCount > 0 && <Chip label={`${permission.workspaceCount} Workspaces`} size="small" />}
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Paper>
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
                <Alert severity="info" sx={{ mt: 2 }}>
                  회수 실행 또는 오탐 처리는 감사 기록으로 남습니다. API 회수 불가 항목은 회수 계획의 수동 조치 사유를 기준으로 처리하세요.
                </Alert>
              </CardContent>
            </Card>

            <EmployeeLogPanel
              title="대상 직원 감사 로그"
              description="이 직원의 권한 점검, 회수, 오탐 처리 기록입니다."
              employeeFilter={detail.employee.email || detail.employee.name}
              maxTableHeight={360}
            />
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={revokeDialog} onClose={() => setRevokeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>권한 회수 승인</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={0.5}>
            <Typography>
              <strong>{detail.employee.name}</strong> 직원의 연결된 SaaS 권한 회수를 승인하고 실행합니다.
              API 회수가 불가능한 SaaS는 수동 조치 사유가 결과에 남습니다.
            </Typography>
            {plan?.items.map((item) => (
              <PlanItem key={item.saasType} item={item} />
            ))}
            {plan && readyCount === 0 && (
              <Alert severity="warning">
                현재 API로 회수 가능한 SaaS가 없습니다. 연결 토큰 권한 또는 계정 매핑 상태를 먼저 확인하세요.
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
            {revoking ? '회수 중...' : '승인 후 회수'}
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
              placeholder="예: 별도 관리자 검토 결과 정상 권한으로 확인"
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
