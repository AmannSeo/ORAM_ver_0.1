import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, LinearProgress, Alert, Card, CardContent,
  Grid, Chip, Button, Divider, List, ListItem, ListItemIcon,
  ListItemText, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  DeleteSweep as RevokeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Lock as LockIcon,
  VpnKey as TokenIcon,
  AdminPanelSettings as AdminIcon,
} from '@mui/icons-material';
import { offboardingApi } from '../api';
import type { OffboardingDetail, SaasType } from '../types';
import RiskBadge from '../components/common/RiskBadge';

const SAAS_EMOJI: Record<SaasType, string> = { SLACK: '💬', GITHUB: '🐙', NOTION: '📝' };

export default function OffboardingDetailPage() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<OffboardingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeDialog, setRevokeDialog] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);

  const load = () => {
    if (!resultId) return;
    offboardingApi.getById(resultId)
      .then(setDetail)
      .catch(() => setError('Failed to load offboarding detail'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [resultId]);

  const handleRevokeAll = async () => {
    if (!resultId) return;
    setRevoking(true);
    try {
      const res = await offboardingApi.revokeAll(resultId);
      setRevokeDialog(false);
      setRevokeSuccess(
        res.revokedSaas.length > 0
          ? `${res.message} (${res.revokedSaas.join(', ')})`
          : res.message
      );
      load();
    } catch {
      setError('Failed to revoke access');
      setRevokeDialog(false);
    } finally {
      setRevoking(false);
    }
  };

  if (loading) return <LinearProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!detail) return null;

  return (
    <Box>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/offboarding')} sx={{ mb: 2 }}>
        리스트로 돌아가기
      </Button>

      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">오프보딩 결과 상세</Typography>
          <Typography variant="body2" color="text.secondary">ID: {detail.id}</Typography>
        </Box>
        {!detail.revokedAll && (
          <Button
            variant="contained"
            color="error"
            startIcon={<RevokeIcon />}
            size="large"
            onClick={() => setRevokeDialog(true)}
          >
            모든 권한 해제
          </Button>
        )}
        {detail.revokedAll && (
          <Chip icon={<CheckIcon />} label="모든 권한 해제 완료" color="success" />
        )}
      </Box>

      {revokeSuccess && <Alert severity="success" sx={{ mb: 2 }}>{revokeSuccess}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Employee Info */}
        <Grid item xs={12} md={4}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>직원 정보</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box display="flex" flexDirection="column" gap={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary">이름</Typography>
                  <Typography fontWeight="bold">{detail.employee.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">이메일</Typography>
                  <Typography>{detail.employee.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">부서</Typography>
                  <Typography>{detail.employee.department}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">리스크 점수</Typography>
                  <Box mt={0.5}>
                    <RiskBadge level={detail.riskLevel} score={detail.riskScore} />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">시작 시각</Typography>
                  <Typography>{detail.startedAt ? new Date(detail.startedAt).toLocaleString('ko-KR') : '-'}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Permissions */}
        <Grid item xs={12} md={8}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>탐지된 권한</Typography>
              <Divider sx={{ mb: 2 }} />
              {detail.permissions.length === 0 ? (
                <Typography color="text.secondary">탐지된 권한이 없습니다.</Typography>
              ) : (
                <Grid container spacing={2}>
                  {detail.permissions.map((p, i) => (
                    <Grid item xs={12} sm={6} key={i}>
                      <Card variant="outlined">
                        <CardContent sx={{ pb: '16px !important' }}>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography fontSize={20}>{SAAS_EMOJI[p.saasType]}</Typography>
                            <Typography fontWeight="bold">{p.saasType}</Typography>
                            <Chip label={p.permissionType} size="small" color={p.isOwner || p.isAdmin ? 'error' : 'default'} />
                          </Box>
                          <Typography variant="caption" color="text.secondary">{p.resourceName}</Typography>
                          <Box display="flex" gap={0.5} flexWrap="wrap" mt={1}>
                            {p.isAdmin && <Chip icon={<AdminIcon />} label="Admin" size="small" color="warning" />}
                            {p.isOwner && <Chip icon={<LockIcon />} label="Owner" size="small" color="error" />}
                            {p.hasApiToken && <Chip icon={<TokenIcon />} label="API Token" size="small" color="error" />}
                            {p.repoCount > 0 && <Chip label={`${p.repoCount} Repos`} size="small" />}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </CardContent>
          </Card>

          {/* Recommended Actions */}
          <Card elevation={2} sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>권장 조치</Typography>
              <Divider sx={{ mb: 1 }} />
              <List dense>
                {detail.recommendedActions.map((action, i) => (
                  <ListItem key={i} disablePadding>
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

      {/* Revoke Confirmation Dialog */}
      <Dialog open={revokeDialog} onClose={() => setRevokeDialog(false)}>
        <DialogTitle>모든 권한 해제 확인</DialogTitle>
        <DialogContent>
          <Typography>
            <strong>{detail.employee.name}</strong> 직원의 모든 SaaS 접근 권한을 해제합니다.
            <br /><br />
            연결된 모든 플랫폼(Slack, GitHub, Notion)에서 동시에 제거됩니다.
            <br />
            이 작업은 되돌릴 수 없습니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeDialog(false)} disabled={revoking}>취소</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRevokeAll}
            disabled={revoking}
            startIcon={revoking ? <CircularProgress size={16} color="inherit" /> : <RevokeIcon />}
          >
            {revoking ? '해제 중...' : '모든 권한 해제'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
