import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';

const LEVEL_ROWS = [
  { label: 'LOW', range: '0-24점', action: '표준 검토', bg: '#dcfce7', color: '#166534', border: '#86efac' },
  { label: 'MEDIUM', range: '25-49점', action: '일정 내 회수 권장', bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
  { label: 'HIGH', range: '50-74점', action: '24시간 내 회수 권장', bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
  { label: 'CRITICAL', range: '75-100점', action: '즉시 회수 필요', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
];

const SCORE_ROWS = [
  { label: '관리자 권한', score: '+18점' },
  { label: 'Owner 권한', score: '+16점' },
  { label: 'API 토큰/PAT', score: '+14점' },
  { label: '최근 로그인', score: '+8점' },
  { label: '저장소 접근 범위', score: '최대 +8점' },
  { label: '워크스페이스 범위', score: '최대 +6점' },
  { label: '이상 접근 특성', score: '추가 반영' },
];

function ScoreFactorsContent() {
  return (
    <Box sx={{ p: 0.5, maxWidth: 320 }}>
      <Typography variant="subtitle2" fontWeight={800} mb={1}>
        점수 산정 요소
      </Typography>
      <Stack spacing={0.65}>
        {SCORE_ROWS.map((row) => (
          <Stack key={row.label} direction="row" justifyContent="space-between" gap={2}>
            <Typography variant="caption">{row.label}</Typography>
            <Typography variant="caption" fontWeight={800}>{row.score}</Typography>
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" display="block" mt={1}>
        수집된 SaaS 권한을 집계한 뒤 XGBoost 모델 또는 fallback 가중치로 0-100점 범위에서 계산합니다.
      </Typography>
    </Box>
  );
}

export function RiskLevelLegend() {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#f8fafc', borderColor: '#e2e8f0', borderRadius: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
        <Typography variant="body2" fontWeight={900} color="#334155" sx={{ minWidth: 108 }}>
          위험도 점수 기준
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {LEVEL_ROWS.map((row) => (
            <Chip
              key={row.label}
              label={`${row.label} ${row.range} · ${row.action}`}
              size="small"
              sx={{
                bgcolor: row.bg,
                color: row.color,
                border: `1px solid ${row.border}`,
                fontWeight: 800,
              }}
            />
          ))}
        </Stack>
      </Stack>
    </Paper>
  );
}

export default function RiskCriteriaHelp() {
  return (
    <Tooltip title={<ScoreFactorsContent />} arrow placement="top">
      <IconButton size="small" aria-label="점수 산정 요소">
        <HelpIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
