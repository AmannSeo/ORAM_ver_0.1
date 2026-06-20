import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  CheckCircle as CheckIcon,
  Cloud as CloudIcon,
  History as HistoryIcon,
  People as PeopleIcon,
  Pending as PendingIcon,
  Security as SecurityIcon,
  Sensors as LiveIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../api';
import type { DashboardStats, SaasSyncAlert } from '../types';

type Severity = 'error' | 'warning' | 'info' | 'success';

interface StatCardProps {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  tone: Severity;
  onClick?: () => void;
}

const TONE: Record<Severity, { color: string; bg: string; border: string }> = {
  error: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  warning: { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  info: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  success: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
};

function formatDateTime(value?: string | Date) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function saasAlertReasonLabel(reason: string) {
  switch (reason) {
    case 'MISSING_FROM_LATEST_SYNC':
      return '동기화 누락';
    case 'INACTIVE_FROM_LATEST_SYNC':
      return '비활성 계정';
    default:
      return '계정 점검';
  }
}

function saasAlertDescription(alert: SaasSyncAlert) {
  const account = alert.employeeName || alert.displayName || alert.externalUsername || alert.externalEmail || '미매핑 계정';
  if (alert.reason === 'INACTIVE_FROM_LATEST_SYNC') {
    return `${account} 계정이 최근 ${alert.saasType} 동기화에서 비활성 상태로 확인됐습니다.`;
  }
  if (alert.reason === 'MISSING_FROM_LATEST_SYNC') {
    return `${account} 계정이 이전 동기화에는 있었지만 최근 ${alert.saasType} 결과에서 사라졌습니다.`;
  }
  return alert.detail || `${account} 계정 상태 확인이 필요합니다.`;
}

function downloadDashboardReport(stats: DashboardStats, alerts: SaasSyncAlert[]) {
  const createdAt = new Date();
  const lines = [
    '# ORAM 접근 권한 점검 보고서',
    '',
    `생성 시각: ${formatDateTime(createdAt)}`,
    '',
    '## 핵심 지표',
    `- 전체 직원: ${stats.totalEmployees}명`,
    `- 퇴사자: ${stats.resignedEmployees}명`,
    `- 최고 위험 분석 결과: ${stats.criticalRiskCount}건`,
    `- 진행 중 오프보딩: ${stats.pendingOffboardings}건`,
    `- 열린 SaaS 동기화 알림: ${stats.openSaasSyncAlerts || 0}건`,
    '',
    '## 최근 감지 알림',
    ...(alerts.length > 0
      ? alerts.map((alert) => `- [${alert.saasType}] ${saasAlertReasonLabel(alert.reason)} / ${saasAlertDescription(alert)} / ${formatDateTime(alert.createdAt)}`)
      : ['- 열린 감지 알림이 없습니다.']),
    '',
    '## 우선순위',
    stats.criticalRiskCount > 0
      ? '1. 최고 위험 분석 결과의 권한 회수 가능 여부를 먼저 확인합니다.'
      : '1. 현재 최고 위험 계정은 없습니다.',
    (stats.openSaasSyncAlerts || 0) > 0
      ? '2. SaaS 동기화에서 비활성 또는 누락된 계정의 퇴사 여부를 확인합니다.'
      : '2. 열린 SaaS 동기화 알림은 없습니다.',
    stats.pendingOffboardings > 0
      ? '3. 진행 중 오프보딩의 권한 회수 상태를 확인합니다.'
      : '3. 대기 중인 오프보딩 작업은 없습니다.',
    '',
  ];

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `oram-access-report-${createdAt.toISOString().slice(0, 10)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function StatCard({ title, value, description, icon, tone, onClick }: StatCardProps) {
  const style = TONE[tone];
  const content = (
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box minWidth={0}>
          <Typography variant="body2" fontWeight={800} color="#64748b">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={900} color="#0f172a" mt={1}>
            {value.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="#64748b" display="block" mt={0.75}>
            {description}
          </Typography>
        </Box>
        <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'grid', placeItems: 'center', color: style.color, bgcolor: style.bg, border: `1px solid ${style.border}`, flexShrink: 0 }}>
          {icon}
        </Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card elevation={0} sx={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 3, bgcolor: 'white', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
      {onClick ? <CardActionArea onClick={onClick} sx={{ height: '100%' }}>{content}</CardActionArea> : content}
    </Card>
  );
}

function AnalysisScopeCard() {
  const rows = [
    ['분석 대상', '직원에게 매핑된 Slack, GitHub, Notion 계정'],
    ['주요 특징값', '관리자/소유자 권한, API 토큰, 최근 로그인, 저장소·워크스페이스 범위'],
    ['실행 시점', 'SaaS 동기화에서 비활성·누락 감지 또는 직원 목록의 분석 버튼'],
    ['결과 위치', '오프보딩 분석 상세 화면'],
  ];

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={2}>
          <SecurityIcon color="primary" />
          <Typography variant="h6" fontWeight={900}>AI 분석 범위</Typography>
        </Stack>
        <Stack divider={<Divider flexItem />} spacing={1.5}>
          {rows.map(([label, value]) => (
            <Box key={label}>
              <Typography variant="caption" color="#64748b" fontWeight={800}>{label}</Typography>
              <Typography variant="body2" color="#0f172a" mt={0.25}>{value}</Typography>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function ActionQueueChart({ stats }: { stats: DashboardStats }) {
  const data = [
    { name: 'SaaS 알림', value: stats.openSaasSyncAlerts || 0, fill: '#2563eb' },
    { name: '위험 분석', value: stats.criticalRiskCount, fill: '#dc2626' },
    { name: '오프보딩', value: stats.pendingOffboardings, fill: '#d97706' },
  ];

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="h6" fontWeight={900}>조치 큐</Typography>
        <Typography variant="body2" color="#64748b" mt={0.5} mb={2}>
          지금 관리자가 확인해야 하는 항목만 표시합니다.
        </Typography>
        <Box sx={{ width: '100%', height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 16, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <ChartTooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {data.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}

function DetectionLog({ alerts }: { alerts: SaasSyncAlert[] }) {
  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <LiveIcon color="primary" />
            <Typography variant="h6" fontWeight={900}>최근 SaaS 감지</Typography>
          </Stack>
          <Chip label="30초 자동 갱신" size="small" variant="outlined" color="primary" />
        </Stack>
        {alerts.length === 0 ? (
          <Alert severity="success" icon={<CheckIcon />}>열린 SaaS 감지 알림이 없습니다.</Alert>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {alerts.map((alert) => (
              <Box key={alert.id} py={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={900} noWrap>
                    {alert.saasType} · {saasAlertReasonLabel(alert.reason)}
                  </Typography>
                  <Chip label="확인 필요" size="small" color={alert.reason === 'INACTIVE_FROM_LATEST_SYNC' ? 'error' : 'warning'} variant="outlined" />
                </Stack>
                <Typography variant="body2" color="#475569" mt={0.75}>
                  {saasAlertDescription(alert)}
                </Typography>
                <Typography variant="caption" color="#94a3b8" display="block" mt={0.5}>
                  {formatDateTime(alert.createdAt)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [saasAlerts, setSaasAlerts] = useState<SaasSyncAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const loadDashboard = () => {
      Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getSaasSyncAlerts(8),
      ])
        .then(([statsData, alertData]) => {
          if (!active) return;
          setStats(statsData);
          setSaasAlerts(alertData);
          setError(null);
        })
        .catch(() => {
          if (active) setError('대시보드 정보를 불러오지 못했습니다.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    loadDashboard();
    const timer = window.setInterval(loadDashboard, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (loading) return <LinearProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!stats) return null;

  const actionCount = stats.criticalRiskCount + stats.pendingOffboardings + (stats.openSaasSyncAlerts || 0);

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={900} color="#0f172a">
            대시보드
          </Typography>
          <Typography variant="body2" color="#64748b" mt={0.75}>
            퇴사자 잔여 접근권한, SaaS 동기화 이상, AI 위험 분석 결과를 조치 우선순위 기준으로 확인합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<HistoryIcon />} label="SaaS 동기화 기반 자동 감지" color="primary" variant="outlined" />
          <Button variant="contained" startIcon={<ReportIcon />} onClick={() => downloadDashboardReport(stats, saasAlerts)} sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}>
            보고서 다운로드
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="총 인원" value={stats.totalEmployees} description="ORAM에 등록된 전체 직원" icon={<PeopleIcon />} tone="info" onClick={() => navigate('/employees')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="조치 필요" value={actionCount} description="알림 + 위험 분석 + 진행 중 오프보딩" icon={<WarningIcon />} tone={actionCount > 0 ? 'error' : 'success'} onClick={() => navigate('/offboarding')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="퇴사자" value={stats.resignedEmployees} description="권한 회수 검토 대상" icon={<PeopleIcon />} tone="warning" onClick={() => navigate('/employees?status=RESIGNED')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="SaaS 감지 알림" value={stats.openSaasSyncAlerts || 0} description="비활성 또는 누락 계정" icon={<CloudIcon />} tone={(stats.openSaasSyncAlerts || 0) > 0 ? 'info' : 'success'} onClick={() => navigate('/saas-connections')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="최고 위험" value={stats.criticalRiskCount} description="XGBoost 분석 결과" icon={<SecurityIcon />} tone={stats.criticalRiskCount > 0 ? 'error' : 'success'} onClick={() => navigate('/offboarding')} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} alignItems="stretch">
        <Grid item xs={12} lg={5}>
          <ActionQueueChart stats={stats} />
        </Grid>
        <Grid item xs={12} lg={3}>
          <AnalysisScopeCard />
        </Grid>
        <Grid item xs={12} lg={4}>
          <DetectionLog alerts={saasAlerts} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} mt={0}>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="h6" fontWeight={900}>운영 기준</Typography>
              <Typography variant="body2" color="#64748b" mt={1}>
                대시보드는 전체 인원 비율을 보여주기 위한 화면이 아니라, 지금 관리자가 확인해야 할 잔여 접근권한과 오프보딩 조치를 모으는 화면입니다.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography variant="h6" fontWeight={900}>다음 확인 위치</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mt={1.5}>
                <Button size="small" variant="outlined" onClick={() => navigate('/saas-connections')}>SaaS 수집 계정</Button>
                <Button size="small" variant="outlined" onClick={() => navigate('/employees')}>직원 권한 목록</Button>
                <Button size="small" variant="outlined" onClick={() => navigate('/offboarding')}>오프보딩 결과</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
