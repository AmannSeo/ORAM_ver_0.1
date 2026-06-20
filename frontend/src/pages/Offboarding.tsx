import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
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
  Paper,
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
  PersonSearch as ManualIcon,
  Sync as SyncIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { offboardingApi } from '../api';
import RiskBadge from '../components/common/RiskBadge';
import type { OffboardingSummary } from '../types';

const STATUS_COLOR: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행 중',
  COMPLETED: '분석 완료',
  FAILED: '실패',
};

function triggerLabel(trigger?: string) {
  if (!trigger) return '-';
  if (trigger.includes('SYNC_INACTIVE_ACCOUNT')) return 'SaaS 비활성 계정 감지';
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) return 'SaaS 계정 누락 감지';
  if (trigger === 'MANUAL_TRIGGER') return '퇴사 처리 후 자동 분석';
  if (trigger === 'MANUAL_ANALYSIS_REQUEST') return '관리자 재분석';
  return trigger;
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
      setResults(data);
    } catch {
      setError('권한 회수 대상을 불러오지 못했습니다.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const autoCount = useMemo(
    () => results.filter((result) => result.analysisSource === 'AUTOMATIC').length,
    [results],
  );
  const manualCount = results.length - autoCount;

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

  const openFalsePositiveDialog = (result: OffboardingSummary) => {
    setFalsePositiveTarget(result);
    setFalsePositiveReason('');
    setError(null);
    setSuccess(null);
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
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            권한 회수 대상
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            퇴사 처리 또는 SaaS 동기화 이상 감지로 생성된 잔여 접근 권한 회수 대상을 확인합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip icon={<AutoIcon />} label={`자동 감지 ${autoCount}건`} color="primary" variant="outlined" />
          <Chip label={`전체 ${results.length}건`} variant="outlined" />
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <StatusCard
            icon={<CheckIcon color="success" />}
            title="자동 감지 파이프라인"
            value="활성"
            description="퇴사 처리, SaaS 비활성 계정, 동기화 누락 계정을 확인하면 자동으로 잔여 접근 위험도를 계산합니다."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatusCard
            icon={<SyncIcon color="primary" />}
            title="감지 방식"
            value="주기 동기화"
            description="GitHub, Slack, Notion 계정 목록을 다시 조회하고 이전 상태와 비교합니다."
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <StatusCard
            icon={<AutoIcon color="primary" />}
            title="대상 생성 방식"
            value={`${autoCount} 자동 / ${manualCount} 수동`}
            description="목록에서 감지 사유, 위험도, 권한 회수 여부를 함께 확인할 수 있습니다."
          />
        </Grid>
      </Grid>

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>직원</strong></TableCell>
              <TableCell><strong>생성 방식</strong></TableCell>
              <TableCell><strong>감지 사유</strong></TableCell>
              <TableCell><strong>상태</strong></TableCell>
              <TableCell><strong>잔여 접근 위험도</strong></TableCell>
              <TableCell><strong>권한 회수</strong></TableCell>
              <TableCell><strong>생성/갱신 시각</strong></TableCell>
              <TableCell align="center"><strong>처리</strong></TableCell>
              <TableCell align="center"><strong>상세</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  아직 권한 회수 대상이 없습니다. 퇴사 처리 또는 SaaS 동기화에서 비활성/누락 계정이 감지되면 이곳에 표시됩니다.
                </TableCell>
              </TableRow>
            )}
            {results.map((result) => {
              const automatic = result.analysisSource === 'AUTOMATIC';
              const revoking = revokeLoadingId === result.id;
              return (
                <TableRow key={result.id} hover>
                  <TableCell>
                    <Typography fontWeight="bold">{result.employee.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{result.employee.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={automatic ? <AutoIcon /> : <ManualIcon />}
                      label={automatic ? '자동 감지' : '수동'}
                      color={automatic ? 'primary' : 'default'}
                      size="small"
                      variant={automatic ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell>{triggerLabel(result.analysisTrigger)}</TableCell>
                  <TableCell>
                    <Chip
                      label={STATUS_LABEL[result.status] ?? result.status}
                      color={STATUS_COLOR[result.status]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <RiskBadge level={result.riskLevel} score={result.riskScore} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={result.revokedAll ? '회수 완료' : '미회수'}
                      color={result.revokedAll ? 'success' : 'warning'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {result.startedAt ? new Date(result.startedAt).toLocaleString('ko-KR') : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="wrap" useFlexGap>
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
                            권한 회수
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
                            onClick={() => openFalsePositiveDialog(result)}
                            sx={{ whiteSpace: 'nowrap' }}
                          >
                            오탐 처리
                          </Button>
                        </span>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="상세 보기">
                      <IconButton size="small" color="primary" onClick={() => navigate(`/offboarding/${result.id}`)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={Boolean(falsePositiveTarget)}
        onClose={() => setFalsePositiveTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>오탐 처리</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography>
              <strong>{falsePositiveTarget?.employee.name}</strong> 직원의 AI 리스크 분석 결과를 오탐으로 처리합니다.
              처리 후 권한 회수 대상과 AI 리스크 목록에서 제외되며, 감사 로그에는 기록됩니다.
            </Typography>
            <TextField
              label="오탐 처리 사유"
              value={falsePositiveReason}
              onChange={(event) => setFalsePositiveReason(event.target.value)}
              placeholder="예: 이미 별도 관리자 검토로 정상 권한임을 확인"
              fullWidth
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
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

function StatusCard({
  icon,
  title,
  value,
  description,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.25} alignItems="center" mb={1}>
          {icon}
          <Typography variant="body2" fontWeight="bold" color="text.secondary">
            {title}
          </Typography>
        </Stack>
        <Typography variant="h6" fontWeight="bold">
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          {description}
        </Typography>
      </CardContent>
    </Card>
  );
}
