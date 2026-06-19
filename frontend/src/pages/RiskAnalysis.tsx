import { useEffect, useState } from 'react';
import {
  Box, Typography, Tabs, Tab, Grid, Card, CardContent, Button, Slider,
  Checkbox, FormControlLabel, LinearProgress, Alert, Divider,
  CircularProgress, Paper, Chip, Tooltip, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, IconButton, Badge,
} from '@mui/material';
import {
  Psychology as AIIcon, HelpOutline as HelpIcon,
  DeleteSweep as RevokeIcon,
  Warning as WarnIcon, CheckCircle as OkIcon,
} from '@mui/icons-material';
import { riskApi, offboardingApi } from '../api';
import type { RiskScoreResponse, OffboardingSummary, RiskLevel } from '../types';
import RiskBadge from '../components/common/RiskBadge';
import { useNavigate } from 'react-router-dom';

// ─── 시뮬레이터 상수 ──────────────────────────────────────────
const SAMPLE_SCENARIOS = [
  { label: '🔴 GitHub Owner + Slack 관리자 + PAT', config: { isAdmin: true, isOwner: true, hasApiToken: true, recentLogin: true, repoCount: 42, workspaceCount: 1 } },
  { label: '🟡 일반 관리자 (최근 미접속)',         config: { isAdmin: true, isOwner: false, hasApiToken: false, recentLogin: false, repoCount: 5, workspaceCount: 2 } },
  { label: '🟢 일반 멤버',                         config: { isAdmin: false, isOwner: false, hasApiToken: false, recentLogin: true, repoCount: 2, workspaceCount: 1 } },
];

const FEATURE_HELP: Record<string, string> = {
  isAdmin: '해당 SaaS에서 관리자(Admin) 권한 보유 — 다른 사용자 계정을 수정하거나 삭제 가능.',
  isOwner: 'GitHub Organization Owner 등 최상위 소유자 권한 — 전체 조직 설정 변경 가능.',
  hasApiToken: 'PAT/API Key 발급 — 퇴사 후에도 외부에서 코드/데이터에 접근 가능.',
  recentLogin: '최근 30일 이내 로그인 — 활성 상태임을 나타냄.',
  repoCount: '접근 가능한 코드 저장소(Repository) 수.',
  workspaceCount: '접근 가능한 워크스페이스 수.',
};

const LEVEL_DESC: Record<RiskLevel, { label: string; color: string; action: string }> = {
  LOW:      { label: '낮음 (0-24점)',        color: '#2e7d32', action: '표준 절차 진행' },
  MEDIUM:   { label: '보통 (25-49점)',       color: '#0288d1', action: '1주일 내 해제 권장' },
  HIGH:     { label: '높음 (50-74점)',       color: '#f57c00', action: '24시간 내 해제 필요' },
  CRITICAL: { label: '매우 위험 (75-100점)', color: '#d32f2f', action: '즉시 해제 필요' },
};

const getScoreColor = (score: number) => {
  if (score >= 75) return '#d32f2f';
  if (score >= 50) return '#f57c00';
  if (score >= 25) return '#0288d1';
  return '#2e7d32';
};

// ─── 고위험 인원 목록 탭 ─────────────────────────────────────────
function RiskPersonList() {
  const navigate = useNavigate();
  const [results, setResults] = useState<OffboardingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    offboardingApi.getAll()
      .then(data => {
        const pending = data.filter(r => !r.revokedAll);
        // 리스크 점수 높은 순 정렬
        const sorted = [...pending].sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
        setResults(sorted);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;

  const critical = results.filter(r => r.riskLevel === 'CRITICAL');
  const high     = results.filter(r => r.riskLevel === 'HIGH');
  const rest     = results.filter(r => r.riskLevel !== 'CRITICAL' && r.riskLevel !== 'HIGH');

  if (results.length === 0) {
    return (
      <Box textAlign="center" py={8} color="text.disabled">
        <OkIcon sx={{ fontSize: 64, mb: 2 }} />
        <Typography variant="h6">처리할 리스크 항목이 없습니다</Typography>
        <Typography variant="body2">권한 해제가 완료된 직원은 이 목록에서 제외됩니다.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* 요약 카드 */}
      <Grid container spacing={2} mb={3}>
        {([
          { level: 'CRITICAL', count: critical.length, color: '#d32f2f', label: '즉시 조치 필요' },
          { level: 'HIGH',     count: high.length,     color: '#f57c00', label: '24시간 내 해제' },
          { level: 'MEDIUM',   count: results.filter(r => r.riskLevel === 'MEDIUM').length, color: '#0288d1', label: '1주일 내 해제' },
          { level: 'LOW',      count: results.filter(r => r.riskLevel === 'LOW').length,    color: '#2e7d32', label: '표준 처리' },
        ] as const).map(item => (
          <Grid item xs={6} sm={3} key={item.level}>
            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', borderColor: item.color, borderWidth: item.count > 0 && (item.level === 'CRITICAL' || item.level === 'HIGH') ? 2 : 1 }}>
              <Typography variant="h3" fontWeight="bold" color={item.color}>{item.count}</Typography>
              <RiskBadge level={item.level as RiskLevel} />
              <Typography variant="caption" display="block" color="text.secondary" mt={0.5}>{item.label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {critical.length > 0 && (
        <Alert severity="error" icon={<WarnIcon />} sx={{ mb: 2 }}>
          <strong>{critical.length}명의 CRITICAL 위험 직원</strong>이 있습니다. 즉시 권한을 해제하세요!
        </Alert>
      )}

      {/* 인원 테이블 */}
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>직원명</strong></TableCell>
              <TableCell><strong>이메일</strong></TableCell>
              <TableCell><strong>부서</strong></TableCell>
              <TableCell><strong>리스크 점수</strong></TableCell>
              <TableCell><strong>권한 해제</strong></TableCell>
              <TableCell align="center"><strong>바로 이동</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.map(r => (
              <TableRow
                key={r.id}
                hover
                sx={{
                  bgcolor: r.riskLevel === 'CRITICAL' ? 'error.50' :
                           r.riskLevel === 'HIGH' ? 'warning.50' : 'inherit',
                }}
              >
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    {(r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH') && (
                      <WarnIcon fontSize="small" color={r.riskLevel === 'CRITICAL' ? 'error' : 'warning'} />
                    )}
                    <strong>{r.employee.name}</strong>
                  </Box>
                </TableCell>
                <TableCell>{r.employee.email}</TableCell>
                <TableCell>{r.employee.department}</TableCell>
                <TableCell>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="h6" fontWeight="bold" color={getScoreColor(r.riskScore ?? 0)}>
                      {r.riskScore ?? '-'}
                    </Typography>
                    <RiskBadge level={r.riskLevel} />
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label="미해제" color={r.riskLevel === 'CRITICAL' ? 'error' : 'warning'} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="center">
                  <Tooltip title="오프보딩 상세 → 권한 해제">
                    <Button
                      variant="contained"
                      color={r.riskLevel === 'CRITICAL' ? 'error' : 'primary'}
                      size="small"
                      startIcon={<RevokeIcon />}
                      onClick={() => navigate(`/offboarding/${r.id}`)}
                    >
                      권한 해제
                    </Button>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
        <Typography variant="caption" color="text.secondary">
          💡 <strong>이 목록은 오프보딩 페이지와 동일한 데이터입니다.</strong>
          권한 해제가 완료된 직원은 제외되며, 리스크 점수 높은 순으로 정렬되어 어떤 직원을 먼저 처리해야 하는지 쉽게 파악할 수 있습니다.
          "권한 해제" 버튼을 클릭하면 해당 직원의 오프보딩 상세 페이지로 이동합니다.
        </Typography>
      </Paper>
    </Box>
  );
}

// ─── 점수 시뮬레이터 탭 ──────────────────────────────────────────
function RiskSimulator() {
  const [features, setFeatures] = useState({ isAdmin: false, isOwner: false, hasApiToken: false, recentLogin: true, repoCount: 0, workspaceCount: 0 });
  const [result, setResult] = useState<RiskScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setLoading(true); setError(null);
    try { setResult(await riskApi.calculateScore(features)); }
    catch { setError('계산 실패. 로그인 상태를 확인하세요.'); }
    finally { setLoading(false); }
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <strong>시뮬레이터란?</strong> 실제 오프보딩 시에는 점수가 자동 계산됩니다.
        이 도구는 "이런 권한 조합이면 점수가 얼마나 나올까?" 를 미리 테스트하는 용도입니다.
      </Alert>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" gutterBottom>권한 조합 입력</Typography>
              <Divider sx={{ mb: 2 }} />
              <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                {SAMPLE_SCENARIOS.map(s => (
                  <Button key={s.label} size="small" variant="outlined"
                    onClick={() => { setFeatures(s.config); setResult(null); }}>
                    {s.label}
                  </Button>
                ))}
              </Box>
              <Box display="flex" flexDirection="column" gap={1.5}>
                {([
                  { key: 'isAdmin',     label: '관리자(Admin) 권한 보유', weight: '25점' },
                  { key: 'isOwner',     label: 'Owner(최상위) 권한 보유', weight: '20점' },
                  { key: 'hasApiToken', label: 'API 토큰 / PAT 발급됨',   weight: '20점' },
                  { key: 'recentLogin', label: '최근 30일 내 로그인',      weight: '15점' },
                ] as const).map(({ key, label, weight }) => (
                  <Box key={key} display="flex" alignItems="center" justifyContent="space-between">
                    <Box display="flex" alignItems="center">
                      <FormControlLabel
                        control={<Checkbox checked={features[key]} onChange={e => setFeatures({ ...features, [key]: e.target.checked })} />}
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
                  <Box display="flex" justifyContent="space-between"><Typography variant="body2">저장소 수: <strong>{features.repoCount}개</strong></Typography><Chip label="최대 10점" size="small" variant="outlined" /></Box>
                  <Slider value={features.repoCount} onChange={(_, v) => setFeatures({ ...features, repoCount: v as number })} min={0} max={50} step={1} />
                </Box>
                <Box>
                  <Box display="flex" justifyContent="space-between"><Typography variant="body2">워크스페이스 수: <strong>{features.workspaceCount}개</strong></Typography><Chip label="최대 10점" size="small" variant="outlined" /></Box>
                  <Slider value={features.workspaceCount} onChange={(_, v) => setFeatures({ ...features, workspaceCount: v as number })} min={0} max={10} step={1} />
                </Box>
              </Box>
              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
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
                <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height={280} color="text.disabled">
                  <AIIcon sx={{ fontSize: 64, mb: 2 }} />
                  <Typography>권한 조합을 선택하고 계산 버튼을 눌러주세요</Typography>
                </Box>
              ) : (
                <Box>
                  <Box display="flex" flexDirection="column" alignItems="center" my={2}>
                    <Box position="relative" display="inline-flex" mb={2}>
                      <CircularProgress variant="determinate" value={result.score} size={120} thickness={6} sx={{ color: getScoreColor(result.score) }} />
                      <Box sx={{ top: 0, left: 0, bottom: 0, right: 0, position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="h3" fontWeight="bold" color={getScoreColor(result.score)}>{result.score}</Typography>
                        <Typography variant="caption" color="text.secondary">/ 100</Typography>
                      </Box>
                    </Box>
                    <RiskBadge level={result.level} />
                    <Typography variant="body2" color="text.secondary" mt={1} textAlign="center">
                      권장 조치: <strong>{result.level ? LEVEL_DESC[result.level]?.action : '-'}</strong>
                    </Typography>
                  </Box>
                  {([
                    ['관리자 권한', result.breakdown.adminWeight, 25],
                    ['Owner 권한', result.breakdown.ownerWeight, 20],
                    ['API 토큰', result.breakdown.apiTokenWeight, 20],
                    ['최근 로그인', result.breakdown.recentLoginWeight, 15],
                    ['저장소 수', result.breakdown.repoWeight, 10],
                    ['워크스페이스 수', result.breakdown.workspaceWeight, 10],
                  ] as [string, number, number][]).map(([label, weight, max]) => (
                    <Box key={label} mb={1}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                        <Typography variant="caption" fontWeight="bold">{weight}/{max}점</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={(weight / max) * 100}
                        sx={{ bgcolor: 'grey.200', '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(result.score) } }} />
                    </Box>
                  ))}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    AI 판단 근거
                  </Typography>
                  {result.engine && (
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      Engine: {result.engine}
                    </Typography>
                  )}
                  {(result.explanations || [])
                    .filter((item) => item.contribution > 0)
                    .slice(0, 5)
                    .map((item) => (
                      <Box key={item.feature} mb={1.25}>
                        <Box display="flex" justifyContent="space-between" gap={1}>
                          <Typography variant="caption" fontWeight={700}>{item.feature}</Typography>
                          <Typography variant="caption" fontWeight={700}>{item.contribution}점</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {item.description}
                        </Typography>
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

// ─── 메인 페이지 ────────────────────────────────────────────────
export default function RiskAnalysis() {
  const [tab, setTab] = useState(0);
  const [totalPending, setTotalPending] = useState(0);

  useEffect(() => {
    offboardingApi.getAll().then(data => {
      const pending = data.filter(r => !r.revokedAll && (r.riskLevel === 'CRITICAL' || r.riskLevel === 'HIGH')).length;
      setTotalPending(pending);
    }).catch(() => {});
  }, []);

  return (
    <Box>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <AIIcon color="primary" />
        <Typography variant="h4" fontWeight="bold">AI 리스크 분석</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        퇴사 직원의 보안 위험도를 AI가 분석하고, 우선 해제해야 할 인원을 알려줍니다
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab
          label={
            <Badge badgeContent={totalPending} color="error" max={99}>
              <Box pr={1}>고위험 인원 현황</Box>
            </Badge>
          }
        />
        <Tab label="점수 시뮬레이터" />
      </Tabs>

      {tab === 0 && <RiskPersonList />}
      {tab === 1 && <RiskSimulator />}
    </Box>
  );
}
