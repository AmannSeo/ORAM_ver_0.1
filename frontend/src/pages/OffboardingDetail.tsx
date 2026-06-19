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
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AutoAwesome as AutoIcon,
  CheckCircle as CheckIcon,
  DeleteSweep as RevokeIcon,
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

const PLAN_STATUS_LABEL: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  READY: { label: '자동 회수 가능', color: 'success' },
  MANUAL: { label: '수동 조치 필요', color: 'warning' },
  NO_ACCOUNT: { label: '계정 매핑 없음', color: 'default' },
  REVOKED: { label: '회수 완료', color: 'success' },
  FAILED: { label: '회수 실패', color: 'error' },
};

function triggerLabel(trigger?: string) {
  if (!trigger) return '-';
  if (trigger.includes('SYNC_INACTIVE_ACCOUNT')) return 'SaaS 동기화에서 비활성 계정이 감지되어 자동 분석되었습니다.';
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) return '이전 동기화에 있던 SaaS 계정이 사라져 자동 분석되었습니다.';
  if (trigger === 'MANUAL_TRIGGER') return '관리자가 퇴사 처리 또는 분석을 직접 요청했습니다.';
  return trigger;
}

export default function OffboardingDetailPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<OffboardingDetail | null>(null);
  const [plan, setPlan] = useState<RevokePlanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
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
      setError('오프보딩 상세 정보를 불러오지 못했습니다.');
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
          ? `${res.message} (${res.revokedSaas.map((saas) => SAAS_LABEL[saas]).join(', ')})`
          : res.message,
      );
      await load();
    } catch {
      setError('권한 회수 요청에 실패했습니다.');
      setRevokeDialog(false);
    } finally {
      setRevoking(false);
    }
  };

  if (loading) return <LinearProgress />;
  if (error && !detail) return <Alert severity="error">{error}</Alert>;
  if (!detail) return null;

  const automatic = detail.analysisSource === 'AUTOMATIC';

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/offboarding')} sx={{ mb: 2 }}>
        목록으로 돌아가기
      </Button>

      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            오프보딩 분석 상세
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            SaaS 권한 수집 결과와 AI 분석 근거를 확인합니다.
          </Typography>
        </Box>
        {!detail.revokedAll ? (
          <Button
            variant="contained"
            color="error"
            startIcon={<RevokeIcon />}
            size="large"
            onClick={() => setRevokeDialog(true)}
          >
            권한 일괄 회수
          </Button>
        ) : (
          <Chip icon={<CheckIcon />} label="권한 회수 완료" color="success" />
        )}
      </Stack>

      {revokeSuccess && <Alert severity="success" sx={{ mb: 2 }}>{revokeSuccess}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {revokeResults.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {revokeResults.map((item) => `${SAAS_LABEL[item.saasType]}: ${item.reason}`).join(' / ')}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card elevation={1} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                직원 정보
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                <InfoRow label="이름" value={detail.employee.name} />
                <InfoRow label="이메일" value={detail.employee.email} />
                <InfoRow label="부서" value={detail.employee.department} />
                <Box>
                  <Typography variant="caption" color="text.secondary">AI 위험도</Typography>
                  <Box mt={0.5}>
                    <RiskBadge level={detail.riskLevel} score={detail.riskScore} />
                  </Box>
                </Box>
                <InfoRow
                  label="분석 시각"
                  value={detail.startedAt ? new Date(detail.startedAt).toLocaleString('ko-KR') : '-'}
                />
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={1} sx={{ mt: 2, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                분석 출처
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.25}>
                <Chip
                  icon={automatic ? <AutoIcon /> : <ManualIcon />}
                  label={automatic ? '자동 분석' : '수동 분석'}
                  color={automatic ? 'primary' : 'default'}
                  sx={{ alignSelf: 'flex-start' }}
                />
                <InfoRow label="감지 사유" value={triggerLabel(detail.analysisTrigger)} />
                <InfoRow label="분석 엔진" value={detail.analysisEngine || 'ORAM2 XGBoost'} />
              </Stack>
            </CardContent>
          </Card>

          <Card elevation={1} sx={{ mt: 2, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                회수 실행 계획
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {plan ? (
                <Stack spacing={1.25}>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    <Chip size="small" color="success" label={`자동 가능 ${plan.readyCount}`} />
                    <Chip size="small" color="warning" label={`수동 필요 ${plan.manualCount}`} />
                    <Chip size="small" label={`확인 필요 ${plan.blockedCount}`} />
                  </Box>
                  {plan.items.map((item) => (
                    <PlanItem key={item.saasType} item={item} />
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">회수 계획을 불러오지 못했습니다.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card elevation={1} sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                발견된 SaaS 권한
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {groupedPermissions.length === 0 ? (
                <Typography color="text.secondary">
                  발견된 권한이 없습니다. SaaS 연결 상태와 계정 동기화 결과를 확인하세요.
                </Typography>
              ) : (
                <Stack spacing={2}>
                  {groupedPermissions.map(([saasType, permissions]) => (
                    <Box key={saasType}>
                      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                        <Typography fontWeight="bold">{SAAS_LABEL[saasType]}</Typography>
                        <Chip label={`${permissions.length}개 권한`} size="small" variant="outlined" />
                      </Stack>
                      <Grid container spacing={1.5}>
                        {permissions.map((permission, index) => (
                          <Grid item xs={12} sm={6} key={`${permission.saasType}-${index}`}>
                            <Card variant="outlined" sx={{ borderRadius: 1.5 }}>
                              <CardContent sx={{ pb: '16px !important' }}>
                                <Typography fontWeight="bold">{permission.permissionType}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {permission.resourceName || '-'}
                                </Typography>
                                <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
                                  {permission.isAdmin && <Chip icon={<SecurityIcon />} label="Admin" size="small" color="warning" />}
                                  {permission.isOwner && <Chip icon={<SecurityIcon />} label="Owner" size="small" color="error" />}
                                  {permission.hasApiToken && <Chip icon={<TokenIcon />} label="API Token" size="small" color="error" />}
                                  {permission.repoCount > 0 && <Chip label={`${permission.repoCount} Repos`} size="small" />}
                                  {permission.workspaceCount > 0 && <Chip label={`${permission.workspaceCount} Workspaces`} size="small" />}
                                </Box>
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

          <Card elevation={1} sx={{ mt: 2, borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                권장 조치
              </Typography>
              <Divider sx={{ mb: 1 }} />
              <List dense>
                {detail.recommendedActions.map((action, index) => (
                  <ListItem key={index} disablePadding>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <WarningIcon fontSize="small" color="warning" />
                    </ListItemIcon>
                    <ListItemText primary={action} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={revokeDialog} onClose={() => setRevokeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>권한 일괄 회수 확인</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography>
              <strong>{detail.employee.name}</strong> 직원의 연결된 SaaS 권한 회수를 실행합니다.
              자동 회수가 불가능한 SaaS는 수동 조치 사유가 함께 표시됩니다.
            </Typography>
            {plan?.items.map((item) => (
              <PlanItem key={item.saasType} item={item} />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialog(false)} disabled={revoking}>
            취소
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRevokeAll}
            disabled={revoking}
            startIcon={revoking ? <CircularProgress size={16} color="inherit" /> : <RevokeIcon />}
          >
            {revoking ? '회수 중...' : '권한 회수 실행'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography fontWeight="bold">{value || '-'}</Typography>
    </Box>
  );
}

function PlanItem({ item }: { item: RevokePlanItem }) {
  const status = PLAN_STATUS_LABEL[item.status] ?? { label: item.status, color: 'default' as const };

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        p: 1.25,
        bgcolor: 'background.default',
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={0.75}>
        <Typography fontWeight="bold">{SAAS_LABEL[item.saasType]}</Typography>
        <Chip size="small" label={status.label} color={status.color} />
      </Box>
      <Typography variant="body2" color="text.secondary">
        대상 {item.resourceCount}개 · {item.action}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {item.reason}
      </Typography>
    </Box>
  );
}
