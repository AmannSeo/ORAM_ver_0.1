import { useEffect, useMemo, useState } from 'react';
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
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoIcon,
  Block as FalsePositiveIcon,
  CheckCircle as CheckIcon,
  DeleteSweep as RevokeIcon,
  FactCheck as QueueIcon,
  PersonSearch as ManualIcon,
  Visibility as ViewIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { offboardingApi } from '../api';
import RiskBadge from '../components/common/RiskBadge';
import type { OffboardingSummary, RiskLevel } from '../types';

const RISK_ORDER: Record<RiskLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행 중',
  COMPLETED: '분석 완료',
  FAILED: '실패',
};

const STATUS_COLOR: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
};

function triggerLabel(trigger?: string) {
  if (!trigger) return '-';
  if (trigger.includes('SYNC_INACTIVE_ACCOUNT')) return 'SaaS 비활성 계정 감지';
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) return 'SaaS 계정 누락 감지';
  if (trigger === 'MANUAL_TRIGGER') return '퇴사 처리 기반 자동 분석';
  if (trigger === 'MANUAL_ANALYSIS_REQUEST') return '관리자 재분석';
  return trigger;
}

function actionGuide(result: OffboardingSummary) {
  if (result.revokedAll) return '조치 완료';
  if (result.riskLevel === 'CRITICAL') return '즉시 권한 회수';
  if (result.riskLevel === 'HIGH') return '24시간 내 회수';
  if (result.riskLevel === 'MEDIUM') return '담당자 검토 후 회수';
  return '표준 오프보딩 절차';
}

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

function QueueMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'error' | 'warning' | 'info' | 'success';
}) {
  const color = {
    error: '#dc2626',
    warning: '#d97706',
    info: '#2563eb',
    success: '#059669',
  }[tone];
  const bg = {
    error: '#fef2f2',
    warning: '#fffbeb',
    info: '#eff6ff',
    success: '#ecfdf5',
  }[tone];

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: bg }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="body2" color="#64748b">{label}</Typography>
        <Typography variant="h4" fontWeight={700} color={color} mt={0.75}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export default function Offboarding() {
  const navigate = useNavigate();
  const [results, setResults] = useState<OffboardingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [revokeLoadingId, setRevokeLoadingId] = useState<string | null>(null);
  const [falsePositiveTarget, setFalsePositiveTarget] = useState<OffboardingSummary | null>(null);
  const [falsePositiveReason, setFalsePositiveReason] = useState('');
  const [falsePositiveLoading, setFalsePositiveLoading] = useState(false);

  const loadResults = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const data = await offboardingApi.getAll();
      const sorted = [...data].sort((a, b) => {
        const aRisk = a.riskLevel ? RISK_ORDER[a.riskLevel] : 9;
        const bRisk = b.riskLevel ? RISK_ORDER[b.riskLevel] : 9;
        if (aRisk !== bRisk) return aRisk - bRisk;
        return (b.riskScore ?? 0) - (a.riskScore ?? 0);
      });
      setResults(sorted);
    } catch {
      setError('권한 회수 대상을 불러오지 못했습니다.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const metrics = useMemo(() => {
    const pending = results.filter((result) => !result.revokedAll);
    return {
      total: results.length,
      pending: pending.length,
      urgent: pending.filter((result) => result.riskLevel === 'CRITICAL' || result.riskLevel === 'HIGH').length,
      automatic: results.filter((result) => result.analysisSource === 'AUTOMATIC').length,
    };
  }, [results]);

  const handleRevoke = async (result: OffboardingSummary) => {
    setRevokeLoadingId(result.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await offboardingApi.revokeAll(result.id);
      setSuccess(res.message || `${result.employee.name}님의 권한 회수 요청이 완료되었습니다.`);
      await loadResults(false);
    } catch {
      setError(`${result.employee.name}님의 권한 회수 요청에 실패했습니다.`);
    } finally {
      setRevokeLoadingId(null);
    }
  };

  const handleFalsePositive = async () => {
    if (!falsePositiveTarget) return;
    setFalsePositiveLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await offboardingApi.markFalsePositive(falsePositiveTarget.id, falsePositiveReason);
      setSuccess(res.message);
      setFalsePositiveTarget(null);
      setFalsePositiveReason('');
      await loadResults(false);
    } catch {
      setError(`${falsePositiveTarget.employee.name}님의 오탐 처리 요청에 실패했습니다.`);
    } finally {
      setFalsePositiveLoading(false);
    }
  };

  if (loading) return <LinearProgress />;

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={2} mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <QueueIcon color="primary" />
            <Typography variant="h4" fontWeight={700}>권한 회수 큐</Typography>
          </Stack>
          <Typography variant="body2" color="#64748b" mt={0.75}>
            직원 전체 목록이 아니라, AI 분석과 SaaS 동기화 결과로 조치가 필요한 대상만 모아 처리합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<AutoIcon />} label={`자동 감지 ${metrics.automatic}건`} color="primary" variant="outlined" />
          <Chip icon={<WarningIcon />} label={`긴급 ${metrics.urgent}건`} color={metrics.urgent > 0 ? 'error' : 'default'} variant="outlined" />
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12} sm={6} lg={3}><QueueMetric label="전체 큐" value={metrics.total} tone="info" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><QueueMetric label="미회수" value={metrics.pending} tone="warning" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><QueueMetric label="긴급 조치" value={metrics.urgent} tone={metrics.urgent > 0 ? 'error' : 'success'} /></Grid>
        <Grid item xs={12} sm={6} lg={3}><QueueMetric label="자동 감지" value={metrics.automatic} tone="success" /></Grid>
      </Grid>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Card} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
        <Table sx={{ minWidth: 1120 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell width={72}>우선순위</TableCell>
              <TableCell>대상</TableCell>
              <TableCell>AI 판단</TableCell>
              <TableCell>감지 근거</TableCell>
              <TableCell>회수 상태</TableCell>
              <TableCell>권장 조치</TableCell>
              <TableCell>생성 시각</TableCell>
              <TableCell align="right">처리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                  아직 권한 회수 대상이 없습니다. 퇴사 처리 또는 SaaS 동기화에서 비활성/누락 계정이 감지되면 이곳에 표시됩니다.
                </TableCell>
              </TableRow>
            )}
            {results.map((result, index) => {
              const revoking = revokeLoadingId === result.id;
              const automatic = result.analysisSource === 'AUTOMATIC';
              return (
                <TableRow key={result.id} hover sx={{ '& td': { borderColor: '#f1f5f9' } }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color="#64748b">#{index + 1}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={700}>{result.employee.name}</Typography>
                    <Typography variant="caption" color="#64748b">{result.employee.email}</Typography>
                    <Typography variant="caption" color="#94a3b8" display="block">{result.employee.department || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.75} alignItems="flex-start">
                      <RiskBadge level={result.riskLevel} score={result.riskScore} />
                      <Chip
                        icon={automatic ? <AutoIcon /> : <ManualIcon />}
                        label={automatic ? '자동 분석' : '수동 분석'}
                        size="small"
                        variant="outlined"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{triggerLabel(result.analysisTrigger)}</Typography>
                    <Typography variant="caption" color="#64748b">{result.analysisEngine || '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack spacing={0.75} alignItems="flex-start">
                      <Chip
                        label={result.revokedAll ? '회수 완료' : '미회수'}
                        color={result.revokedAll ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                      <Chip
                        label={STATUS_LABEL[result.status] ?? result.status}
                        color={STATUS_COLOR[result.status] ?? 'default'}
                        size="small"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{actionGuide(result)}</Typography>
                  </TableCell>
                  <TableCell>{formatDateTime(result.startedAt)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="nowrap">
                      <Tooltip title={result.revokedAll ? '이미 권한 회수가 완료되었습니다.' : '연결된 SaaS 권한 회수를 실행합니다.'}>
                        <span>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            startIcon={revoking ? <CircularProgress size={14} color="inherit" /> : <RevokeIcon />}
                            disabled={result.revokedAll || revoking}
                            onClick={() => handleRevoke(result)}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            회수
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="AI 분석 결과를 오탐으로 처리하고 목록에서 제외합니다.">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            startIcon={<FalsePositiveIcon />}
                            disabled={result.revokedAll || revoking}
                            onClick={() => {
                              setFalsePositiveTarget(result);
                              setFalsePositiveReason('');
                            }}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            오탐
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="상세 보기">
                        <IconButton size="small" color="primary" onClick={() => navigate(`/offboarding/${result.id}`)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(falsePositiveTarget)} onClose={() => setFalsePositiveTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>오탐 처리</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography>
              <strong>{falsePositiveTarget?.employee.name}</strong> 직원의 AI 분석 결과를 오탐으로 처리합니다.
              처리 후 권한 회수 큐와 AI 리스크 목록에서 제외되며, 감사 로그에는 기록됩니다.
            </Typography>
            <TextField
              label="오탐 처리 사유"
              value={falsePositiveReason}
              onChange={(event) => setFalsePositiveReason(event.target.value)}
              placeholder="예: 담당자 검토 결과 정상 권한으로 확인"
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setFalsePositiveTarget(null)} disabled={falsePositiveLoading}>
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
