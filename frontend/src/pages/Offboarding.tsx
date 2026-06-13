import { useEffect, useState } from 'react';
import {
  Box, Typography, LinearProgress, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Paper, Chip,
  IconButton, Tooltip,
} from '@mui/material';
import { Visibility as ViewIcon } from '@mui/icons-material';
import { offboardingApi } from '../api';
import type { OffboardingSummary } from '../types';
import RiskBadge from '../components/common/RiskBadge';
import { useNavigate } from 'react-router-dom';

const STATUS_COLOR: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning', IN_PROGRESS: 'info', COMPLETED: 'success', FAILED: 'error',
};

export default function Offboarding() {
  const navigate = useNavigate();
  const [results, setResults] = useState<OffboardingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    offboardingApi.getAll()
      .then(setResults)
      .catch(() => setError('Failed to load offboarding results'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>오프보딩 결과</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        퇴사 직원의 SaaS 권한 탐지 결과를 확인하고 권한을 해제합니다.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>직원명</strong></TableCell>
              <TableCell><strong>이메일</strong></TableCell>
              <TableCell><strong>부서</strong></TableCell>
              <TableCell><strong>상태</strong></TableCell>
              <TableCell><strong>리스크 점수</strong></TableCell>
              <TableCell><strong>해제 여부</strong></TableCell>
              <TableCell><strong>시작일</strong></TableCell>
              <TableCell align="center"><strong>상세</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  오프보딩 결과가 없습니다. 직원 관리 페이지에서 직원을 퇴사 처리하세요.
                </TableCell>
              </TableRow>
            )}
            {results.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell><strong>{r.employee.name}</strong></TableCell>
                <TableCell>{r.employee.email}</TableCell>
                <TableCell>{r.employee.department}</TableCell>
                <TableCell>
                  <Chip
                    label={r.status === 'PENDING' ? '대기' : r.status === 'IN_PROGRESS' ? '진행 중' : r.status === 'COMPLETED' ? '완료' : '실패'}
                    color={STATUS_COLOR[r.status]} size="small" />
                </TableCell>
                <TableCell>
                  <RiskBadge level={r.riskLevel} score={r.riskScore} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={r.revokedAll ? '해제 완료' : '미해제'}
                    color={r.revokedAll ? 'success' : 'warning'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  {r.startedAt ? new Date(r.startedAt).toLocaleDateString() : '-'}
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="View Details">
                    <IconButton size="small" color="primary" onClick={() => navigate(`/offboarding/${r.id}`)}>
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
