import { Box, Chip, IconButton, Paper, Stack, Tooltip, Typography } from '@mui/material';
import { HelpOutline as HelpIcon } from '@mui/icons-material';

const LEVEL_ROWS = [
  { label: 'LOW', range: '0-24점', action: '표준 검토', bg: '#dcfce7', color: '#166534', border: '#86efac' },
  { label: 'MEDIUM', range: '25-49점', action: '일정 내 회수 권장', bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
  { label: 'HIGH', range: '50-74점', action: '24시간 내 회수 권장', bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
  { label: 'CRITICAL', range: '75-100점', action: '즉시 회수 필요', bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
];

const SCORE_GROUPS = [
  {
    title: '권한 강도',
    control: 'CIS Control 6 (접근 통제)',
    rows: [
      { label: '관리자 권한', score: '영향 매우 큼' },
      { label: 'Owner 권한', score: '영향 큼' },
      { label: 'API 토큰/PAT 보유', score: '영향 큼' },
    ],
  },
  {
    title: '계정 상태',
    control: 'CIS Control 5 (계정 관리)',
    rows: [
      { label: '최근 로그인', score: '영향 보통' },
    ],
  },
  {
    title: '접근 범위',
    control: 'CIS Control 6 (접근 통제)',
    rows: [
      { label: '저장소 접근 범위', score: '영향 작음' },
      { label: '워크스페이스 범위', score: '영향 작음' },
    ],
  },
];

function ScoreFactorsContent() {
  return (
    <Box sx={{ p: 0.5, maxWidth: 340 }}>
      <Typography variant="subtitle2" fontWeight={800} mb={1}>
        점수 산정 요소 (6개 피처)
      </Typography>
      <Stack spacing={1}>
        {SCORE_GROUPS.map((group) => (
          <Box key={group.title}>
            <Typography variant="caption" fontWeight={800} display="block">
              {group.title}
              <Typography component="span" variant="caption" sx={{ ml: 0.5, color: '#94a3b8', fontWeight: 600 }}>
                · {group.control}
              </Typography>
            </Typography>
            <Stack spacing={0.4} mt={0.4}>
              {group.rows.map((row) => (
                <Stack key={row.label} direction="row" justifyContent="space-between" gap={2}>
                  <Typography variant="caption">{row.label}</Typography>
                  <Typography variant="caption" fontWeight={800}>{row.score}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
      <Box sx={{ borderTop: '1px solid rgba(148,163,184,0.4)', mt: 1.25, pt: 1 }}>
        <Typography variant="caption" display="block">
          XGBoost가 6개 피처의 조합을 학습해 0~100점을 예측하며(단일 권한으로 확정하지 않음), 각 피처의 기여도는 SHAP으로 설명합니다.
          AI 서버 미가동 시 근사 가중치로 계산합니다.
        </Typography>
      </Box>
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
