import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
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
  Tooltip,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AutoIcon,
  PersonSearch as ManualIcon,
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
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) return 'SaaS 계정 이탈 감지';
  if (trigger === 'MANUAL_TRIGGER') return '관리자 수동 요청';
  return trigger;
}

export default function Offboarding() {
  const navigate = useNavigate();
  const [results, setResults] = useState<OffboardingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    offboardingApi.getAll()
      .then(setResults)
      .catch(() => setError('오프보딩 결과를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const autoCount = useMemo(
    () => results.filter((result) => result.analysisSource === 'AUTOMATIC').length,
    [results],
  );

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            오프보딩 분석 결과
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            SaaS 동기화와 퇴사 이벤트에서 자동 생성된 AI 리스크 분석 결과를 확인합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip icon={<AutoIcon />} label={`자동 분석 ${autoCount}건`} color="primary" variant="outlined" />
          <Chip label={`전체 ${results.length}건`} variant="outlined" />
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>직원</strong></TableCell>
              <TableCell><strong>분석 방식</strong></TableCell>
              <TableCell><strong>감지 사유</strong></TableCell>
              <TableCell><strong>상태</strong></TableCell>
              <TableCell><strong>AI 위험도</strong></TableCell>
              <TableCell><strong>권한 회수</strong></TableCell>
              <TableCell><strong>분석 시각</strong></TableCell>
              <TableCell align="center"><strong>상세</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  아직 자동 분석 결과가 없습니다. SaaS 동기화 또는 퇴사 처리가 발생하면 이곳에 표시됩니다.
                </TableCell>
              </TableRow>
            )}
            {results.map((result) => {
              const automatic = result.analysisSource === 'AUTOMATIC';
              return (
                <TableRow key={result.id} hover>
                  <TableCell>
                    <Typography fontWeight="bold">{result.employee.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{result.employee.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      icon={automatic ? <AutoIcon /> : <ManualIcon />}
                      label={automatic ? '자동 분석' : '수동 분석'}
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
    </Box>
  );
}
