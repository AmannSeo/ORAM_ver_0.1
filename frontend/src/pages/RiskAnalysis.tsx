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
  HelpOutline as HelpIcon,
  Psychology as AIIcon,
  Warning as WarnIcon,
} from '@mui/icons-material';
import { offboardingApi, riskApi } from '../api';
import PageHeader from '../components/common/PageHeader';
import RiskBadge from '../components/common/RiskBadge';
import RiskCriteriaHelp from '../components/common/RiskCriteriaHelp';
import { formatDateTime } from '../utils/format';
import { analysisSourceHelp, analysisSourceLabel, analysisTriggerLabel, RISK_ACTION_LABEL } from '../utils/riskLabels';
import type { OffboardingSummary, RiskScoreResponse } from '../types';

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

const getScoreColor = (score = 0) => {
  if (score >= 75) return '#dc2626';
  if (score >= 50) return '#ea580c';
  if (score >= 25) return '#2563eb';
  return '#15803d';
};

function DecisionMetric({
  label,
  value,
  tone,
  help,
}: {
  label: string;
  value: number;
  tone: 'danger' | 'warning' | 'info' | 'success';
  help: string;
}) {
  const colors = {
    danger: { bg: '#fff1f2', border: '#fecdd3', text: '#e11d48' },
    warning: { bg: '#fffbeb', border: '#fde68a', text: '#b45309' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    success: { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
  }[tone];

  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2.5, bgcolor: colors.bg, borderColor: colors.border }}>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography variant="caption" color="#64748b">{label}</Typography>
        <Tooltip title={help} arrow placement="top">
          <HelpIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
        </Tooltip>
      </Stack>
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
        <Grid item xs={6} md={3}>
          <DecisionMetric
            label="분석 대상"
            value={metrics.total}
            tone="info"
            help="권한 회수 대상 중 아직 회수 완료나 오탐 제외가 되지 않았고, AI 위험도 산정 결과가 있는 직원 수입니다."
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <DecisionMetric
            label="즉시/긴급 검토"
            value={metrics.urgent}
            tone="danger"
            help="위험도가 HIGH 또는 CRITICAL인 대상입니다. 관리자/Owner 권한, API 토큰, 넓은 접근 범위, 퇴사자 활성 계정 같은 요소가 높게 반영된 경우입니다."
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <DecisionMetric
            label="자동 감지"
            value={metrics.automatic}
            tone="success"
            help="SaaS 동기화, 비활성 계정, 누락 계정, 퇴사자 활성 계정처럼 시스템 이벤트로 생성된 분석 대상 수입니다."
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <DecisionMetric
            label="관리자 검토"
            value={metrics.review}
            tone="warning"
            help="위험도가 LOW 또는 MEDIUM인 대상입니다. 즉시 회수보다는 관리자가 분석 근거와 회수 계획을 확인한 뒤 판단할 대상입니다."
          />
        </Grid>
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
                위험도와 감지 근거를 기준으로 권한 회수 승인 여부를 결정합니다.
              </Typography>
            </Box>
            <Chip icon={<AutoIcon />} label="시스템 감지 항목 포함" color="primary" variant="outlined" />
          </Stack>

          <TableContainer sx={{ overflowX: 'hidden' }}>
            <Table sx={{ width: '100%', tableLayout: 'fixed', '& th, & td': { whiteSpace: 'nowrap', px: 1.1 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell width="5%">No.</TableCell>
                  <TableCell width="10%">이름</TableCell>
                  <TableCell width="17%">이메일</TableCell>
                  <TableCell width="8%">부서</TableCell>
                  <TableCell width="11%">위험도</TableCell>
                  <TableCell width="27%">판단 근거</TableCell>
                  <TableCell width="10%">생성 시각</TableCell>
                  <TableCell width="12%" align="center">다음 단계</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                      현재 AI 분석 후 조치가 필요한 권한 회수 대상이 없습니다.
                    </TableCell>
                  </TableRow>
                )}
                {results.map((item, index) => (
                  <TableRow key={item.id} hover sx={{ '& td': { borderColor: '#f1f5f9' } }}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} color="#64748b">{index + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight={700} noWrap>{item.employee.name}</Typography>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="#64748b" noWrap>{item.employee.email}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="#64748b" noWrap>-</Typography></TableCell>
                    <TableCell>
                      <Stack spacing={0.75} alignItems="flex-start">
                        <RiskBadge level={item.riskLevel} score={item.riskScore} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={analysisSourceHelp(item.analysisSource)} arrow placement="top">
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {analysisTriggerLabel(item.analysisTrigger)}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell><Typography variant="body2" noWrap>{formatDateTime(item.startedAt)}</Typography></TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.75} justifyContent="center" flexWrap="nowrap">
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => navigate(`/offboarding/${item.id}`)}
                          sx={{ minWidth: 46, px: 0.8, whiteSpace: 'nowrap' }}
                        >
                          상세
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => navigate('/offboarding')}
                          sx={{ minWidth: 46, px: 0.8, whiteSpace: 'nowrap' }}
                        >
                          회수
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
                  { key: 'isAdmin', label: '관리자 권한', weight: '영향 매우 큼' },
                  { key: 'isOwner', label: 'Owner 권한', weight: '영향 큼' },
                  { key: 'hasApiToken', label: 'API 토큰/PAT 보유', weight: '영향 큼' },
                  { key: 'recentLogin', label: '최근 30일 로그인', weight: '영향 보통' },
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
                    <Chip label="영향 작음" size="small" variant="outlined" />
                  </Stack>
                  <Slider value={features.repoCount} onChange={(_, value) => setFeatures({ ...features, repoCount: value as number })} min={0} max={50} />
                </Box>

                <Box>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2">워크스페이스 수: <strong>{features.workspaceCount}</strong></Typography>
                    <Chip label="영향 작음" size="small" variant="outlined" />
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
                    <Typography variant="body2" color="#64748b">권장 판단: {RISK_ACTION_LABEL[result.level]}</Typography>
                    {result.engine && (
                      <Chip label={`엔진: ${result.engine}`} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                    )}
                  </Stack>

                  <Typography variant="subtitle2" fontWeight={700}>피처별 SHAP 기여도(점)</Typography>
                  {(() => {
                    const rows: [string, number][] = [
                      ['관리자 권한', result.breakdown.adminWeight],
                      ['Owner 권한', result.breakdown.ownerWeight],
                      ['API 토큰/PAT', result.breakdown.apiTokenWeight],
                      ['최근 로그인', result.breakdown.recentLoginWeight],
                      ['저장소 접근 범위', result.breakdown.repoWeight],
                      ['워크스페이스 접근 범위', result.breakdown.workspaceWeight],
                    ];
                    const maxVal = Math.max(1, ...rows.map((r) => r[1]));
                    return rows.map(([label, value]) => (
                      <Box key={label}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="#64748b">{label}</Typography>
                          <Typography variant="caption" fontWeight={700}>+{value}점</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, (value / maxVal) * 100)}
                          sx={{ mt: 0.5, bgcolor: '#e5e7eb', '& .MuiLinearProgress-bar': { bgcolor: getScoreColor(result.score) } }}
                        />
                      </Box>
                    ));
                  })()}

                  {result.explanations && result.explanations.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700} mb={1}>상위 판단 근거 (TreeSHAP)</Typography>
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

type Metric = { rmse: number; mae: number; n: number } | null;

function MetricCell({ value }: { value?: Metric }) {
  if (!value) return <Typography variant="body2" color="#94a3b8">-</Typography>;
  return (
    <Stack spacing={0.25}>
      <Typography variant="body2" fontWeight={700}>RMSE {value.rmse}</Typography>
      <Typography variant="caption" color="#64748b">MAE {value.mae} · n={value.n}</Typography>
    </Stack>
  );
}

function RetrainPanel() {
  const [status, setStatus] = useState<any>(null);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const loadStatus = () => riskApi.getModelStatus().then(setStatus).catch(() => setStatus(null));
  useEffect(() => { loadStatus(); }, []);

  const handleRetrain = async () => {
    setLoading(true); setError(null); setMsg(null);
    try {
      const res: any = await riskApi.retrain();
      if (res?.error) setError(String(res.message || '재학습에 실패했습니다.'));
      else { setComparison(res); await loadStatus(); }
    } catch {
      setError('재학습 요청에 실패했습니다. AI 모델 서버 상태를 확인하세요.');
    } finally { setLoading(false); }
  };

  const handlePromote = async () => {
    setPromoting(true); setError(null);
    try {
      const res: any = await riskApi.promote();
      if (res?.promoted) { setMsg(String(res.reason || '챌린저가 챔피언으로 승격되었습니다.')); setComparison(null); await loadStatus(); }
      else setError(String(res?.reason || res?.message || '승격할 챌린저가 없습니다.'));
    } catch {
      setError('승격 요청에 실패했습니다.');
    } finally { setPromoting(false); }
  };

  const champion = status?.champion;
  const isPromote = comparison?.recommendation === 'PROMOTE_CHALLENGER';

  return (
    <Stack spacing={2.5}>
      <Alert severity="info">
        관리자가 실제로 <strong>권한 회수(REVOKED)</strong> 또는 <strong>오탐 처리(FALSE_POSITIVE)</strong>한 결정을 라벨로 모아
        챌린저 모델을 학습하고, 현재 챔피언과 성능을 비교합니다. 실데이터가 부족하면 목업으로 백필하되 실제 사용된 라벨 수를 그대로 표시합니다.
        더 나은 챌린저는 승격하여 운영 모델로 교체할 수 있습니다.
      </Alert>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
      {msg && <Alert severity="success" onClose={() => setMsg(null)}>{msg}</Alert>}

      <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
            <Typography variant="h6" fontWeight={700}>현재 챔피언 모델</Typography>
            <Button variant="outlined" size="small" onClick={loadStatus}>새로고침</Button>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {champion ? (
            <Grid container spacing={1.5}>
              <Grid item xs={6} md={3}><Typography variant="caption" color="#64748b">버전</Typography><Typography fontWeight={700}>{champion.model_version || '-'}</Typography></Grid>
              <Grid item xs={6} md={3}><Typography variant="caption" color="#64748b">학습 소스</Typography><Typography fontWeight={700}>{champion.label_source || champion.promoted_from || 'mock'}</Typography></Grid>
              <Grid item xs={6} md={3}><Typography variant="caption" color="#64748b">사용된 실제 라벨</Typography><Typography fontWeight={700}>{champion.real_sample_count ?? 0}건</Typography></Grid>
              <Grid item xs={6} md={3}><Typography variant="caption" color="#64748b">검증 RMSE</Typography><Typography fontWeight={700}>{champion.test_rmse ?? '-'}</Typography></Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="#94a3b8">모델 상태를 불러올 수 없습니다. AI 모델 서버가 실행 중인지 확인하세요.</Typography>
          )}
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AIIcon />}
            onClick={handleRetrain}
            disabled={loading}
            sx={{ mt: 2.5 }}
          >
            {loading ? '재학습 중...' : '재학습 실행 (챌린저 학습)'}
          </Button>
        </CardContent>
      </Card>

      {comparison && (
        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <CardContent sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} mb={1}>
              <Typography variant="h6" fontWeight={700}>챔피언 vs 챌린저 비교</Typography>
              <Chip size="small" variant="outlined" label={`실제 라벨 ${comparison.real_sample_count}건`} />
              <Chip size="small" variant="outlined" label={`목업 백필 ${comparison.mock_backfill_count}건`} />
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    <TableCell>구분</TableCell>
                    <TableCell>챔피언 (현재 운영)</TableCell>
                    <TableCell>챌린저 (신규)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell><Typography variant="body2" fontWeight={700}>검증셋(목업)</Typography></TableCell>
                    <TableCell><MetricCell value={comparison.validation?.champion} /></TableCell>
                    <TableCell><MetricCell value={comparison.validation?.challenger} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell><Typography variant="body2" fontWeight={700}>실데이터 라벨 적합도</Typography></TableCell>
                    <TableCell><MetricCell value={comparison.validation_real?.champion} /></TableCell>
                    <TableCell><MetricCell value={comparison.validation_real?.challenger} /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            <Alert severity={isPromote ? 'success' : 'info'} sx={{ mt: 2 }}>
              <strong>{isPromote ? '챌린저 승격 권장' : '챔피언 유지 권장'}</strong> — {comparison.reason}
            </Alert>

            <Button
              variant={isPromote ? 'contained' : 'outlined'}
              color={isPromote ? 'success' : 'primary'}
              startIcon={promoting ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
              onClick={handlePromote}
              disabled={promoting}
              sx={{ mt: 2 }}
            >
              {promoting ? '승격 중...' : '챌린저를 챔피언으로 승격'}
            </Button>
          </CardContent>
        </Card>
      )}
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
      <PageHeader
        title="AI 리스크 분석"
        description="SaaS에서 감지된 잔여 접근 권한을 점수화하고, 관리자가 승인해야 할 회수 판단을 정리합니다."
        actions={<Chip icon={<WarnIcon />} label={`긴급 검토 ${urgentCount}건`} color={urgentCount > 0 ? 'error' : 'default'} variant="outlined" />}
      />

      <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2.5, borderBottom: '1px solid #e2e8f0' }}>
        <Tab
          label={
            <Badge badgeContent={urgentCount} color="error" max={99}>
              <Box pr={1}>위험 판단 목록</Box>
            </Badge>
          }
        />
        <Tab label="모델 학습" />
      </Tabs>

      {tab === 0 && <RiskDecisionList />}
      {tab === 1 && <RetrainPanel />}
    </Box>
  );
}
