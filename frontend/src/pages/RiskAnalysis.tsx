import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Paper,
  Slider,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tooltip,
  Typography,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  AutoAwesome as AutoIcon,
  CheckCircle as CheckIcon,
  DeleteSweep as RevokeIcon,
  FactCheck as DecisionIcon,
  HelpOutline as HelpIcon,
  Psychology as AIIcon,
  Warning as WarnIcon,
} from '@mui/icons-material';
import { offboardingApi, riskApi } from '../api';
import RiskBadge from '../components/common/RiskBadge';
import RiskCriteriaHelp from '../components/common/RiskCriteriaHelp';
import type { OffboardingSummary, RiskLevel, RiskScoreResponse } from '../types';

const SAMPLE_SCENARIOS = [
  { label: 'GitHub Owner + Slack 관리자 + PAT', config: { isAdmin: true, isOwner: true, hasApiToken: true, recentLogin: true, repoCount: 42, workspaceCount: 1 } },
  { label: '일반 관리자, 최근 미접속', config: { isAdmin: true, isOwner: false, hasApiToken: false, recentLogin: false, repoCount: 5, workspaceCount: 2 } },
  { label: '일반 멤버', config: { isAdmin: false, isOwner: false, hasApiToken: false, recentLogin: true, repoCount: 2, workspaceCount: 1 } },
];

const FEATURE_HELP: Record<string, string> = {
  isAdmin: 'SaaS 관리자 권한입니다. 다른 사용자 계정이나 권한을 변경할 수 있으면 점수가 올라갑니다.',
  isOwner: 'GitHub Organization Owner 같은 최상위 권한입니다. 조직 설정까지 바꿀 수 있어 높은 가중치를 둡니다.',
  hasApiToken: 'PAT/API Key가 있으면 퇴사 후에도 외부에서 접근할 수 있어 잔여 접근 위험이 커집니다.',
  recentLogin: '최근 로그인 기록은 계정이 아직 활성 사용 중일 가능성을 의미합니다.',
  repoCount: '접근 가능한 코드 저장소 수입니다. 접근 범위가 넓을수록 위험 점수가 올라갑니다.',
  workspaceCount: '접근 가능한 워크스페이스 수입니다. 여러 SaaS/워크스페이스에 걸쳐 있으면 위험도가 올라갑니다.',
};

const LEVEL_ACTION: Record<RiskLevel, string> = {
  LOW: '표준 회수 절차',
  MEDIUM: '관리자 검토 후 회수',
  HIGH: '24시간 내 회수 승인',
  CRITICAL: '즉시 회수 승인',
};

const getScoreColor = (score = 0) => {
  if (score >= 75) return '#dc2626';
  if (score >= 50) return '#ea580c';
  if (score >= 25) return '#2563eb';
  return '#15803d';
};

function triggerLabel(trigger?: string) {
  if (!trigger) return '-';
  if (trigger.includes('SYNC_RESIGNED_ACCOUNT_STILL_ACTIVE')) return '퇴사자 활성 SaaS 계정 감지';
  if (trigger.includes('SYNC_INACTIVE_ACCOUNT')) return 'SaaS 동기화에서 비활성 계정 감지';
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) return '이전 동기화 대비 SaaS 계정 누락 감지';
  if (trigger === 'MANUAL_TRIGGER') return '퇴사 처리 후 자동 분석';
  if (trigger === 'MANUAL_ANALYSIS_REQUEST') return '관리자 재분석';
  return trigger;
}

function sourceLabel(source?: string) {
  if (source === 'AUTOMATIC') return '자동 분석';
  if (source === 'MANUAL') return '수동 재분석';
  return source || '-';
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

function DecisionMetric({ label, value, tone }: { label: string; value: number; tone: 'danger' | 'warning' | 'info' | 'success' }) {
  const colors = {
    danger: { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  }[tone];

  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, bgcolor: colors.bg, borderColor: colors.border }}>
      <Typography variant="caption" color="#64748b">{label}</Typography>
      <Typography variant="h5" fontWeight={700} color={colors.text} mt={0.25}>{value}</Typography>
    </Paper>
  );
}

function RiskDecisionList() {
  const navigate = useNavigate();
  const [results, setResults] = useState<OffboardingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    offboardingApi.getAll()
      .then((data) => {
        const pending = data
          .filter((item) => !item.revokedAll && !item.falsePositive)
          .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
        setResults(pending);
      })
      .catch(() => setError('AI 리스크 분석 대상을 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => ({
    total: results.length,
    urgent: results.filter((item) => item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH').length,
    automatic: results.filter((item) => item.analysisSource === 'AUTOMATIC').length,
    review: results.filter((item) => item.riskLevel === 'MEDIUM' || item.riskLevel === 'LOW').length,
  }), [results]);

  if (loading) return <LinearProgress />;

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        이 화면은 직원 전체 목록이 아닙니다. 퇴사 처리 또는 SaaS 동기화로 감지된 권한 회수 대상 중,
        AI가 잔여 접근 위험도를 산정한 항목만 보여줍니다. 실제 회수 실행은 상세 판단 화면에서 승인 후 진행합니다.
      </Alert>

      {error && <Alert severity="error">{error}</Alert>}

      <Grid container spacing={1.5}>
        <Grid item xs={6} md={3}><DecisionMetric label="분석 대상" value={metrics.total} tone="info" /></Grid>
        <Grid item xs={6} md={3}><DecisionMetric label="즉시/긴급 검토" value={metrics.urgent} tone={metrics.urgent > 0 ? 'danger' : 'success'} /></Grid>
        <Grid item xs={6} md={3}><DecisionMetric label="자동 감지" value={metrics.automatic} tone="success" /></Grid>
        <Grid item xs={6} md={3}><DecisionMetric label="관리자 검토" value={metrics.review} tone="warning" /></Grid>
      </Grid>

      <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
        <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" gap={1.5} mb={2}>
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography variant="h6" fontWeight={700}>AI 판단 대상</Typography>
                <RiskCriteriaHelp />
              </Stack>
              <Typography variant="body2" color="#64748b" mt={0.25}>
                점수, 감지 근거, 권장 판단을 기준으로 권한 회수 승인 여부를 결정합니다.
              </Typography>
            </Box>
            <Chip icon={<AutoIcon />} label="자동 분석 결과 포함" color="primary" variant="outlined" />
          </Stack>

          <TableContainer>
            <Table sx={{ minWidth: 1080 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell width={70}>No.</TableCell>
                  <TableCell>대상</TableCell>
                  <TableCell>위험도</TableCell>
                  <TableCell>감지 근거</TableCell>
                  <TableCell>AI 판단</TableCell>
                  <TableCell>분석 시각</TableCell>
                  <TableCell align="right">다음 단계</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
                      현재 AI 분석 후 조치가 필요한 권한 회수 대상이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
                {results.map((item, index) => (
                  <TableRow key={item.id} hover sx={{ '& td': { borderColor: '#f1f5f9' } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="#64748b">#{index + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700}>{item.employee.name}</Typography>
                      <Typography variant="caption" color="#64748b">{item.employee.email}</Typography>
                      <Typography variant="caption" color="#94a3b8" display="block">{item.employee.department || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.75} alignItems="flex-start">
                        <RiskBadge level={item.riskLevel} score={item.riskScore} />
                        <Typography variant="caption" color="#64748b">{item.analysisEngine || 'ORAM Risk Fusion'}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{triggerLabel(item.analysisTrigger)}</Typography>
                      <Chip
                        icon={item.analysisSource === 'AUTOMATIC' ? <AutoIcon /> : <AIIcon />}
                        label={sourceLabel(item.analysisSource)}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.75 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700}>
                        {item.riskLevel ? LEVEL_ACTION[item.riskLevel] : '관리자 검토'}
                      </Typography>
                      <Typography variant="caption" color="#64748b">
                        {item.riskScore ?? 0}점 기준
                      </Typography>
                    </TableCell>
                    <TableCell>{formatDateTime(item.startedAt)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end" flexWrap="nowrap">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<DecisionIcon />}
                          onClick={() => navigate(`/offboarding/${item.id}`)}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          상세 판단
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<RevokeIcon />}
                          onClick={() => navigate('/offboarding')}
                          sx={{ whiteSpace: 'nowrap' }}
                        >
                          회수 대상
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}

function RiskSimulator() {
  const [features, setFeatures] = useState({ isAdmin: false, isOwner: false, hasApiToken: false, recentLogin: true, repoCount: 0, workspaceCount: 0 });
  const [result, setResult] = useState<RiskScoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await riskApi.calculateScore(features));
    } catch {
      setError('계산에 실패했습니다. 로그인 상태와 서버 실행 상태를 확인하세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        시뮬레이터는 실제 직원 데이터를 바꾸지 않습니다. 권한 조합에 따라 점수가 어떻게 달라지는지 검증하는 보조 도구입니다.
      </Alert>

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="h6" fontWeight={700}>권한 조건 입력</Typography>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                {SAMPLE_SCENARIOS.map((scenario) => (
                  <Button key={scenario.label} size="small" variant="outlined" onClick={() => { setFeatures(scenario.config); setResult(null); }}>
                    {scenario.label}
                  </Button>
                ))}
              </Stack>

              <Stack spacing={1.25}>
                {([
                  { key: 'isAdmin', label: '관리자 권한', weight: '25점' },
                  { key: 'isOwner', label: 'Owner 권한', weight: '20점' },
                  { key: 'hasApiToken', label: 'API 토큰/PAT 보유', weight: '20점' },
                  { key: 'recentLogin', label: '최근 30일 로그인', weight: '15점' },
                ] as const).map(({ key, label, weight }) => (
                  <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                    <Stack direction="row" alignItems="center">
                      <FormControlLabel
                        control={<Checkbox checked={features[key]} onChange={(event) => setFeatures({ ...features, [key]: event.target.checked })} />}
                        label={label}
                      />
                      <Tooltip title={FEATURE_HELP[key]} arrow>
                        <HelpIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                      </Tooltip>
                    </Stack>
                    <Chip label={weight} size="small" variant="outlined" />
                  </Stack>
                ))}

                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">저장소 수: <strong>{features.repoCount}</strong></Typography>
                    <Chip label="최대 10점" size="small" variant="outlined" />
                  </Stack>
                  <Slider value={features.repoCount} onChange={(_, value) => setFeatures({ ...features, repoCount: value as number })} min={0} max={50} />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">워크스페이스 수: <strong>{features.workspaceCount}</strong></Typography>
                    <Chip label="최대 10점" size="small" variant="outlined" />
                  </Stack>
                  <Slider value={features.workspaceCount} onChange={(_, value) => setFeatures({ ...features, workspaceCount: value as number })} min={0} max={10} />
                </Box>
              </Stack>

              {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
              <Button
                fullWidth
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AIIcon />}
                onClick={handleCalculate}
                disabled={loading}
                sx={{ mt: 2.5 }}
              >
                {loading ? '계산 중...' : '점수 계산'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="h6" fontWeight={700}>계산 결과</Typography>
              <Divider sx={{ my: 2 }} />
              {!result ? (
                <Stack alignItems="center" justifyContent="center" minHeight={260} color="#94a3b8">
                  <AIIcon sx={{ fontSize: 56, mb: 1 }} />
                  <Typography variant="body2">권한 조건을 입력한 뒤 점수를 계산하세요.</Typography>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <Stack alignItems="center" spacing={1}>
                    <Typography variant="h2" fontWeight={800} color={getScoreColor(result.score)}>{result.score}</Typography>
                    <RiskBadge level={result.level} />
                    <Typography variant="body2" color="#64748b">권장 판단: {LEVEL_ACTION[result.level]}</Typography>
                  </Stack>

                  {([
                    ['관리자 권한', result.breakdown.adminWeight, 25],
                    ['Owner 권한', result.breakdown.ownerWeight, 20],
                    ['API 토큰', result.breakdown.apiTokenWeight, 20],
                    ['최근 로그인', result.breakdown.recentLoginWeight, 15],
                    ['저장소 수', result.breakdown.repoWeight, 10],
                    ['워크스페이스 수', result.breakdown.workspaceWeight, 10],
                  ] as [string, number, number][]).map(([label, value, max]) => (
                    <Box key={label}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="#64748b">{label}</Typography>
                        <Typography variant="caption" fontWeight={700}>{value}/{max}점</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(value / max) * 100}
                        sx={{ mt: 0.5, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(result.score) } }}
                      />
                    </Box>
                  ))}

                  {result.explanations && result.explanations.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700} mb={1}>상위 판단 근거</Typography>
                      <Stack spacing={1}>
                        {result.explanations.filter((item) => item.contribution > 0).slice(0, 4).map((item) => (
                          <Paper key={item.feature} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                            <Stack direction="row" justifyContent="space-between" gap={1}>
                              <Typography variant="body2" fontWeight={700}>{item.feature}</Typography>
                              <Typography variant="body2" fontWeight={700}>{item.contribution}점</Typography>
                            </Stack>
                            <Typography variant="caption" color="#64748b">{item.description}</Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}

export default function RiskAnalysis() {
  const [tab, setTab] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);

  useEffect(() => {
    offboardingApi.getAll()
      .then((data) => {
        setUrgentCount(data.filter((item) => !item.revokedAll && !item.falsePositive && (item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH')).length);
      })
      .catch(() => {});
  }, []);

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={1.5} mb={2.5}>
        <Box>
          <Typography variant="h4" fontWeight={700}>AI 리스크 분석</Typography>
          <Typography variant="body2" color="#64748b" mt={0.75}>
            SaaS에서 감지된 잔여 접근 권한을 점수화하고, 관리자가 승인해야 할 회수 판단을 정리합니다.
          </Typography>
        </Box>
        <Chip icon={<WarnIcon />} label={`긴급 검토 ${urgentCount}건`} color={urgentCount > 0 ? 'error' : 'default'} variant="outlined" />
      </Stack>

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2.5, borderBottom: '1px solid #e2e8f0' }}>
        <Tab
          label={
            <Badge badgeContent={urgentCount} color="error" max={99}>
              <Box pr={1}>위험 판단 목록</Box>
            </Badge>
          }
        />
        <Tab label="점수 시뮬레이터" />
      </Tabs>

      {tab === 0 && <RiskDecisionList />}
      {tab === 1 && <RiskSimulator />}
    </Box>
  );
}
