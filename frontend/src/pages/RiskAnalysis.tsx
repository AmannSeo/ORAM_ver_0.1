import { useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Button, Slider,
  Checkbox, FormControlLabel, LinearProgress, Alert, Divider,
  CircularProgress, Paper, Chip, Tooltip,
} from '@mui/material';
import { Psychology as AIIcon, HelpOutline as HelpIcon } from '@mui/icons-material';
import { riskApi } from '../api';
import type { RiskScoreResponse } from '../types';
import RiskBadge from '../components/common/RiskBadge';

const SAMPLE_SCENARIOS = [
  {
    label: '🔴 고위험: GitHub Owner + Slack 관리자 + PAT',
    config: { isAdmin: true, isOwner: true, hasApiToken: true, recentLogin: true, repoCount: 42, workspaceCount: 1 },
  },
  {
    label: '🟡 중간: 일반 관리자 (최근 미접속)',
    config: { isAdmin: true, isOwner: false, hasApiToken: false, recentLogin: false, repoCount: 5, workspaceCount: 2 },
  },
  {
    label: '🟢 저위험: 일반 멤버',
    config: { isAdmin: false, isOwner: false, hasApiToken: false, recentLogin: true, repoCount: 2, workspaceCount: 1 },
  },
];

const FEATURE_HELP: Record<string, string> = {
  isAdmin: '해당 SaaS 플랫폼에서 관리자(Admin) 권한을 보유한 경우.',
  isOwner: 'GitHub Organization Owner 등 최상위 소유자 권한.',
  hasApiToken: 'Personal Access Token(PAT) 또는 API Key를 발급받은 경우.',
  recentLogin: '최근 30일 이내 로그인 기록이 있는 경우.',
  repoCount: '접근 가능한 코드 저장소(Repository)의 수.',
  workspaceCount: '접근 가능한 워크스페이스의 수.',
};

const LEVEL_DESC: Record<string, { label: string; color: string; action: string }> = {
  LOW:      { label: '낮음 (0-24점)',        color: '#2e7d32', action: '표준 절차에 따라 오프보딩 진행' },
  MEDIUM:   { label: '보통 (25-49점)',       color: '#0288d1', action: '1주일 내 권한 해제 권장' },
  HIGH:     { label: '높음 (50-74점)',       color: '#f57c00', action: '24시간 내 권한 해제 필요' },
  CRITICAL: { label: '매우 위험 (75-100점)', color: '#d32f2f', action: '즉시 모든 권한 해제 필요' },
};

export default function RiskAnalysis() {
  const [features, setFeatures] = useState({
    isAdmin: false, isOwner: false, hasApiToken: false, recentLogin: true,
    repoCount: 0, workspaceCount: 0,
  });
  const [result, setResult] = useState<RiskScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await riskApi.calculateScore(features);
      setResult(res);
    } catch {
      setError('점수 계산에 실패했습니다. 로그인 상태를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return '#d32f2f';
    if (score >= 50) return '#f57c00';
    if (score >= 25) return '#0288d1';
    return '#2e7d32';
  };

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <AIIcon color="primary" />
        <Typography variant="h4" fontWeight="bold">AI 리스크 분석</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={1}>
        XGBoost 알고리즘 기반으로 퇴사 직원의 보안 위험도를 0~100점으로 계산합니다
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" fontWeight="bold" mb={1}>📊 리스크 등급 기준</Typography>
        <Box display="flex" gap={2} flexWrap="wrap">
          {Object.entries(LEVEL_DESC).map(([level, info]) => (
            <Box key={level} display="flex" alignItems="center" gap={0.5}>
              <Box width={12} height={12} borderRadius="50%" bgcolor={info.color} />
              <Typography variant="caption">
                <strong style={{ color: info.color }}>{info.label}</strong>: {info.action}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>위험 요소 입력</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                퇴사 직원의 SaaS 권한 정보를 입력하면 리스크 점수가 계산됩니다.
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>빠른 시나리오 선택</Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
                {SAMPLE_SCENARIOS.map((s) => (
                  <Button key={s.label} size="small" variant="outlined"
                    onClick={() => { setFeatures(s.config); setResult(null); }}>
                    {s.label}
                  </Button>
                ))}
              </Box>
              <Box display="flex" flexDirection="column" gap={1.5}>
                {[
                  { key: 'isAdmin',     label: '관리자(Admin) 권한 보유', weight: '25점' },
                  { key: 'isOwner',     label: 'Owner(최상위) 권한 보유', weight: '20점' },
                  { key: 'hasApiToken', label: 'API 토큰 / PAT 발급됨',   weight: '20점' },
                  { key: 'recentLogin', label: '최근 30일 내 로그인',      weight: '15점' },
                ].map(({ key, label, weight }) => (
                  <Box key={key} display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center" gap={0.5}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={features[key as keyof typeof features] as boolean}
                            onChange={(e) => setFeatures({ ...features, [key]: e.target.checked })}
                          />
                        }
                        label={label}
                      />
                      <Tooltip title={FEATURE_HELP[key]} arrow>
                        <HelpIcon fontSize="small" sx={{ color: 'text.disabled', cursor: 'help' }} />
                      </Tooltip>
                    </Box>
                    <Chip label={weight} size="small" variant="outlined" />
                  </Box>
                ))}
                <Box mt={1}>
                  <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                    <Typography variant="body2">접근 가능한 저장소 수: <strong>{features.repoCount}개</strong></Typography>
                    <Tooltip title={FEATURE_HELP.repoCount} arrow>
                      <HelpIcon fontSize="small" sx={{ color: 'text.disabled', cursor: 'help' }} />
                    </Tooltip>
                    <Chip label="최대 10점" size="small" variant="outlined" sx={{ ml: 'auto' }} />
                  </Box>
                  <Slider value={features.repoCount}
                    onChange={(_, v) => setFeatures({ ...features, repoCount: v as number })}
                    min={0} max={50} step={1} marks={[{ value: 0, label: '0' }, { value: 50, label: '50' }]} />
                </Box>
                <Box>
                  <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                    <Typography variant="body2">접근 가능한 워크스페이스 수: <strong>{features.workspaceCount}개</strong></Typography>
                    <Tooltip title={FEATURE_HELP.workspaceCount} arrow>
                      <HelpIcon fontSize="small" sx={{ color: 'text.disabled', cursor: 'help' }} />
                    </Tooltip>
                    <Chip label="최대 10점" size="small" variant="outlined" sx={{ ml: 'auto' }} />
                  </Box>
                  <Slider value={features.workspaceCount}
                    onChange={(_, v) => setFeatures({ ...features, workspaceCount: v as number })}
                    min={0} max={10} step={1} marks={[{ value: 0, label: '0' }, { value: 10, label: '10' }]} />
                </Box>
              </Box>
              <Button fullWidth variant="contained" size="large"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AIIcon />}
                onClick={handleCalculate} disabled={loading} sx={{ mt: 3 }}>
                {loading ? '계산 중...' : '리스크 점수 계산'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>계산 결과</Typography>
              <Divider sx={{ mb: 2 }} />
              {!result ? (
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center"
                  height={300} color="text.disabled">
                  <AIIcon sx={{ fontSize: 64, mb: 2 }} />
                  <Typography>위험 요소를 선택하고 계산 버튼을 눌러주세요</Typography>
                </Box>
              ) : (
                <Box>
                  <Box display="flex" flexDirection="column" alignItems="center" my={3}>
                    <Box position="relative" display="inline-flex" mb={2}>
                      <CircularProgress variant="determinate" value={result.score} size={130} thickness={6}
                        sx={{ color: getScoreColor(result.score) }} />
                      <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="h3" fontWeight="bold" color={getScoreColor(result.score)}>
                          {result.score}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">/ 100</Typography>
                      </Box>
                    </Box>
                    <RiskBadge level={result.level} />
                    {result.level && (
                      <Typography variant="body2" color="text.secondary" mt={1} textAlign="center">
                        권장 조치: <strong>{LEVEL_DESC[result.level]?.action}</strong>
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>항목별 점수</Typography>
                  {([
                    ['관리자 권한',    result.breakdown.adminWeight,      25],
                    ['Owner 권한',     result.breakdown.ownerWeight,      20],
                    ['API 토큰',       result.breakdown.apiTokenWeight,   20],
                    ['최근 로그인',    result.breakdown.recentLoginWeight, 15],
                    ['저장소 수',      result.breakdown.repoWeight,       10],
                    ['워크스페이스 수', result.breakdown.workspaceWeight, 10],
                  ] as [string, number, number][]).map(([label, weight, max]) => (
                    <Box key={label} mb={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="caption" fontWeight="bold">{weight}점 / {max}점</Typography>
                      </Box>
                      <LinearProgress variant="determinate"
                        value={(weight / max) * 100}
                        sx={{ bgcolor: 'grey.200', '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(result.score) } }} />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}