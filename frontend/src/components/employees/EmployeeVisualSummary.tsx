import { Box, Grid, Paper, Stack, Typography } from '@mui/material';
import type { DashboardStats } from '../../types';

export default function EmployeeVisualSummary({
  stats,
  totalElements,
  currentPageLinkedCount,
  currentPageCount,
}: {
  stats: DashboardStats | null;
  totalElements: number;
  currentPageLinkedCount: number;
  currentPageCount: number;
}) {
  const total = Math.max(stats?.totalEmployees ?? totalElements, 0);
  const active = stats?.activeEmployees ?? 0;
  const resigned = stats?.resignedEmployees ?? 0;
  const linkedRatio = currentPageCount > 0 ? Math.round((currentPageLinkedCount / currentPageCount) * 100) : 0;

  return (
    <Grid container spacing={2} mb={2.5}>
      <Grid item xs={12} md={4}>
        <SummaryBar
          label="직원 상태"
          value={`${active} 재직 / ${resigned} 퇴사`}
          ratio={total > 0 ? Math.round((active / total) * 100) : 0}
          color="#2563eb"
          helper="전체 직원 기준 재직 비율"
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <SummaryBar
          label="현재 페이지 SaaS 연동"
          value={`${currentPageLinkedCount} / ${currentPageCount}명`}
          ratio={linkedRatio}
          color="#059669"
          helper="현재 조회 페이지 기준"
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <SummaryBar
          label="퇴사자 비율"
          value={`${resigned}명`}
          ratio={total > 0 ? Math.round((resigned / total) * 100) : 0}
          color="#dc2626"
          helper="권한 회수 검토 대상 비율"
        />
      </Grid>
    </Grid>
  );
}

function SummaryBar({
  label,
  value,
  ratio,
  color,
  helper,
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
  helper: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" mb={1}>
        <Typography variant="body2" fontWeight={800} color="#334155">{label}</Typography>
        <Typography variant="body2" fontWeight={900} color="#0f172a">{value}</Typography>
      </Stack>
      <Box sx={{ height: 8, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
        <Box sx={{ width: `${Math.max(0, Math.min(100, ratio))}%`, height: '100%', bgcolor: color, borderRadius: 99 }} />
      </Box>
      <Stack direction="row" justifyContent="space-between" mt={0.75}>
        <Typography variant="caption" color="#64748b">{helper}</Typography>
        <Typography variant="caption" fontWeight={800} color={color}>{ratio}%</Typography>
      </Stack>
    </Paper>
  );
}
