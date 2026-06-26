import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  HelpOutline as InfoIcon,
  PersonSearch as ManualIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { offboardingApi } from '../api';
import PageHeader from '../components/common/PageHeader';
import RiskBadge from '../components/common/RiskBadge';
import { formatDateTime } from '../utils/format';
import {
  analysisSourceLabel,
  analysisTriggerLabel,
  offboardingActionGuide,
  OFFBOARDING_STATUS_COLOR,
  OFFBOARDING_STATUS_LABEL,
  RISK_ORDER,
} from '../utils/riskLabels';
import type { OffboardingSummary } from '../types';

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
      <PageHeader
        title="권한 회수 대상"
        description="분석된 잔여 접근 권한을 승인, 회수, 오탐 처리하고 처리 결과를 기록합니다."
      />

      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Card} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflowX: 'hidden' }}>
        <Table
          sx={{
            width: '100%',
            tableLayout: 'fixed',
            '& th, & td': { whiteSpace: 'nowrap', px: 1.1 },
            '& td': { overflow: 'hidden', textOverflow: 'ellipsis' },
          }}
        >
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell width="4%">No.</TableCell>
              <TableCell width="7%">이름</TableCell>
              <TableCell width="13%">이메일</TableCell>
              <TableCell width="5%">부서</TableCell>
              <TableCell width="8%">위험도</TableCell>
              <TableCell width="7%">생성 경로</TableCell>
              <TableCell width="12%">
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Box component="span">탐지 방법</Box>
                  <Tooltip title="권한 회수 대상이 생성된 원인입니다. 예: 퇴사자 활성 계정, 비활성 계정, 계정 누락, 관리자 점검 실행." arrow>
                    <InfoIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
                  </Tooltip>
                </Stack>
              </TableCell>
              <TableCell width="7%">회수 여부</TableCell>
              <TableCell width="7%">처리 상태</TableCell>
              <TableCell width="7%">권장 조치</TableCell>
              <TableCell width="9%">퇴직 시각</TableCell>
              <TableCell width="9%">분석 시간</TableCell>
              <TableCell width="9%" align="center">처리</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} align="center" sx={{ py: 6, color: '#64748b' }}>
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
                    <Typography variant="body2" fontWeight={700} color="#64748b">{index + 1}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight={700} noWrap>{result.employee.name}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2" color="#64748b" noWrap>{result.employee.email}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="#64748b" noWrap>-</Typography></TableCell>
                  <TableCell>
                    <RiskBadge level={result.riskLevel} score={result.riskScore} />
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={automatic ? <AutoIcon /> : <ManualIcon />}
                      label={analysisSourceLabel(result.analysisSource)}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>{analysisTriggerLabel(result.analysisTrigger)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={result.falsePositive ? '오탐 제외' : result.revokedAll ? '회수 완료' : '미회수'}
                      color={result.falsePositive ? 'default' : result.revokedAll ? 'success' : 'warning'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={OFFBOARDING_STATUS_LABEL[result.status] ?? result.status}
                      color={OFFBOARDING_STATUS_COLOR[result.status] ?? 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600} noWrap>{offboardingActionGuide(result)}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2" noWrap>{formatDateTime(result.employee.resignedAt || result.startedAt)}</Typography></TableCell>
                  <TableCell><Typography variant="body2" noWrap>{formatDateTime(result.startedAt)}</Typography></TableCell>
                  <TableCell align="center">
                    <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="nowrap">
                      <Tooltip title={result.revokedAll ? '이미 권한 회수가 완료되었습니다.' : '연결된 SaaS 권한 회수를 실행합니다.'}>
                        <span>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            disabled={result.revokedAll || result.falsePositive || revoking}
                            onClick={() => handleRevoke(result)}
                            sx={{ minWidth: 42, px: 0.8, whiteSpace: 'nowrap' }}
                          >
                            {revoking ? <CircularProgress size={14} color="inherit" /> : '회수'}
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="AI 분석 결과를 오탐으로 처리하고 목록에서 제외합니다.">
                        <span>
                          <Button
                            size="small"
                            variant="outlined"
                            color="inherit"
                            disabled={result.revokedAll || result.falsePositive || revoking}
                            onClick={() => {
                              setFalsePositiveTarget(result);
                              setFalsePositiveReason('');
                            }}
                            sx={{ minWidth: 42, px: 0.8, whiteSpace: 'nowrap' }}
                          >
                            오탐
                          </Button>
                        </span>
                      </Tooltip>
                      <Tooltip title="상세 판단 화면">
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
              처리 후 권한 회수 대상과 AI 리스크 목록에서 제외되며, 감사 로그에는 기록됩니다.
            </Typography>
            <TextField
              label="오탐 처리 사유"
              value={falsePositiveReason}
              onChange={(event) => setFalsePositiveReason(event.target.value)}
              placeholder="예: 해당 권한은 별도 관리자 검토 결과 정상 권한으로 확인"
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
