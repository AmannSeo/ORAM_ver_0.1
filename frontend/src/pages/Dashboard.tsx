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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Assessment as ReportIcon,
  CheckCircle as CheckIcon,
  Cloud as CloudIcon,
  Groups as GroupsIcon,
  History as HistoryIcon,
  People as PeopleIcon,
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
import { dashboardApi, employeeApi, offboardingApi } from '../api';
import RiskBadge from '../components/common/RiskBadge';
import RiskCriteriaHelp from '../components/common/RiskCriteriaHelp';
import type { DashboardStats, Employee, OffboardingSummary, SaasSyncAlert } from '../types';

type Severity = 'error' | 'warning' | 'info' | 'success';

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
  if (reason === 'MISSING_FROM_LATEST_SYNC') return '동기화 누락';
  if (reason === 'INACTIVE_FROM_LATEST_SYNC') return '비활성 계정';
  return '계정 점검';
}

function saasAlertDescription(alert: SaasSyncAlert) {
  const account = alert.employeeName || alert.displayName || alert.externalUsername || alert.externalEmail || '미매핑 계정';
  if (alert.reason === 'INACTIVE_FROM_LATEST_SYNC') {
    return `${account} 계정이 최근 ${alert.saasType} 동기화에서 비활성 상태로 확인되었습니다.`;
  }
  if (alert.reason === 'MISSING_FROM_LATEST_SYNC') {
    return `${account} 계정이 이전 동기화에는 있었지만 최근 ${alert.saasType} 결과에서 사라졌습니다.`;
  }
  return alert.detail || `${account} 계정 상태 확인이 필요합니다.`;
}

function statusLabel(status: string) {
  if (status === 'ACTIVE') return '재직 중';
  if (status === 'RESIGNED') return '퇴사';
  return status;
}

function downloadDashboardReport(stats: DashboardStats, alerts: SaasSyncAlert[], offboardingTargets: OffboardingSummary[]) {
  const createdAt = new Date();
  const lines = [
    '# ORAM 접근 권한 점검 보고서',
    '',
    `생성 시각: ${formatDateTime(createdAt)}`,
    '',
    '## 핵심 지표',
    `- 전체 직원: ${stats.totalEmployees}명`,
    `- 퇴사자: ${stats.resignedEmployees}명`,
    `- 권한 회수 대상: ${offboardingTargets.length}건`,
    `- 열린 SaaS 동기화 알림: ${stats.openSaasSyncAlerts || 0}건`,
    '',
    '## 권한 회수 대상',
    ...(offboardingTargets.length > 0
      ? offboardingTargets.map((target, index) => `${index + 1}. ${target.employee.name} / ${target.employee.email} / ${target.riskLevel || '-'} ${target.riskScore ?? '-'}점`)
      : ['- 현재 권한 회수 대상이 없습니다.']),
    '',
    '## 최근 SaaS 감지 알림',
    ...(alerts.length > 0
      ? alerts.map((alert) => `- [${alert.saasType}] ${saasAlertReasonLabel(alert.reason)} / ${saasAlertDescription(alert)} / ${formatDateTime(alert.createdAt)}`)
      : ['- 열린 감지 알림이 없습니다.']),
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

function StatCard({
  title,
  value,
  description,
  icon,
  tone,
  onClick,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
  tone: Severity;
  onClick?: () => void;
}) {
  const style = TONE[tone];
  const content = (
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box minWidth={0}>
          <Typography variant="body2" fontWeight={800} color="#64748b">{title}</Typography>
          <Typography variant="h4" fontWeight={900} color="#0f172a" mt={1}>{value.toLocaleString()}</Typography>
          <Typography variant="caption" color="#64748b" display="block" mt={0.75}>{description}</Typography>
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

function ActionQueueChart({ stats, offboardingCount }: { stats: DashboardStats; offboardingCount: number }) {
  const data = [
    { name: 'SaaS 알림', value: stats.openSaasSyncAlerts || 0, fill: '#2563eb' },
    { name: '최고 위험', value: stats.criticalRiskCount, fill: '#dc2626' },
    { name: '권한 회수', value: offboardingCount, fill: '#d97706' },
  ];

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="h6" fontWeight={900}>조치 대기 현황</Typography>
        <Typography variant="body2" color="#64748b" mt={0.5} mb={2}>관리자가 우선 확인해야 하는 항목입니다.</Typography>
        <Box sx={{ width: '100%', height: 240 }}>
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

function OffboardingQueue({ items }: { items: OffboardingSummary[] }) {
  const navigate = useNavigate();
  const visible = items.slice(0, 5);

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="h6" fontWeight={900}>권한 회수 대상</Typography>
          <Button size="small" variant="outlined" onClick={() => navigate('/offboarding')}>전체 보기</Button>
        </Stack>
        {visible.length === 0 ? (
          <Alert severity="success" icon={<CheckIcon />}>현재 권한 회수 대상이 없습니다.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={56}>No.</TableCell>
                  <TableCell>직원</TableCell>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      <span>위험도</span>
                      <RiskCriteriaHelp />
                    </Stack>
                  </TableCell>
                  <TableCell>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((item, index) => (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/offboarding/${item.id}`)}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={800} color="text.secondary">{index + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={800}>{item.employee.name}</Typography>
                      <Typography variant="caption" color="#64748b">{item.employee.email}</Typography>
                    </TableCell>
                    <TableCell><RiskBadge level={item.riskLevel} score={item.riskScore} /></TableCell>
                    <TableCell>
                      <Chip size="small" label={item.revokedAll ? '회수 완료' : '미회수'} color={item.revokedAll ? 'success' : 'warning'} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeBriefList({ employees }: { employees: Employee[] }) {
  const navigate = useNavigate();

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Typography variant="h6" fontWeight={900}>직원 목록 요약</Typography>
          <Button size="small" variant="outlined" onClick={() => navigate('/employees')}>전체 보기</Button>
        </Stack>
        {employees.length === 0 ? (
          <Alert severity="info">등록된 직원이 없습니다.</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={56}>No.</TableCell>
                  <TableCell>직원</TableCell>
                  <TableCell>부서</TableCell>
                  <TableCell>SaaS</TableCell>
                  <TableCell>상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.slice(0, 6).map((employee, index) => (
                  <TableRow key={employee.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate('/employees')}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={800} color="text.secondary">{index + 1}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={800}>{employee.name}</Typography>
                      <Typography variant="caption" color="#64748b">{employee.email}</Typography>
                    </TableCell>
                    <TableCell>{employee.department || '-'}</TableCell>
                    <TableCell><Chip size="small" label={`${employee.connectedSaas?.length ?? 0}개`} variant="outlined" /></TableCell>
                    <TableCell>
                      <Chip size="small" label={statusLabel(employee.status)} color={employee.status === 'ACTIVE' ? 'success' : 'warning'} variant="outlined" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
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
                <Typography variant="body2" color="#475569" mt={0.75}>{saasAlertDescription(alert)}</Typography>
                <Typography variant="caption" color="#94a3b8" display="block" mt={0.5}>{formatDateTime(alert.createdAt)}</Typography>
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
  const [offboardingTargets, setOffboardingTargets] = useState<OffboardingSummary[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const loadDashboard = () => {
      Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getSaasSyncAlerts(8),
        offboardingApi.getAll(),
        employeeApi.getAll({ page: 0, size: 6 }),
      ])
        .then(([statsData, alertData, offboardingData, employeeData]) => {
          if (!active) return;
          setStats(statsData);
          setSaasAlerts(alertData);
          setOffboardingTargets(
            offboardingData
              .filter((item) => !item.revokedAll && !item.falsePositive)
              .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0)),
          );
          setEmployees(employeeData.content ?? []);
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

  const actionCount = offboardingTargets.length + (stats.openSaasSyncAlerts || 0);

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={900} color="#0f172a">대시보드</Typography>
          <Typography variant="body2" color="#64748b" mt={0.75}>
            직원, 권한 회수 대상, SaaS 감지 알림을 한 화면에서 확인합니다.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip icon={<HistoryIcon />} label="30초 자동 갱신" color="primary" variant="outlined" />
          <Button
            variant="contained"
            startIcon={<ReportIcon />}
            onClick={() => downloadDashboardReport(stats, saasAlerts, offboardingTargets)}
            sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
          >
            보고서 다운로드
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="총 인원" value={stats.totalEmployees} description="ORAM에 등록된 전체 직원" icon={<PeopleIcon />} tone="info" onClick={() => navigate('/employees')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="조치 필요" value={actionCount} description="권한 회수 대상 + SaaS 알림" icon={<WarningIcon />} tone={actionCount > 0 ? 'error' : 'success'} onClick={() => navigate('/offboarding')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="권한 회수 대상" value={offboardingTargets.length} description="미회수·오탐 제외 대상" icon={<SecurityIcon />} tone={offboardingTargets.length > 0 ? 'warning' : 'success'} onClick={() => navigate('/offboarding')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="SaaS 감지 알림" value={stats.openSaasSyncAlerts || 0} description="비활성 또는 누락 계정" icon={<CloudIcon />} tone={(stats.openSaasSyncAlerts || 0) > 0 ? 'info' : 'success'} onClick={() => navigate('/saas-connections')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="퇴사자" value={stats.resignedEmployees} description="권한 회수 검토 대상" icon={<GroupsIcon />} tone="warning" onClick={() => navigate('/employees?status=RESIGNED')} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} alignItems="stretch">
        <Grid item xs={12} lg={4}>
          <ActionQueueChart stats={stats} offboardingCount={offboardingTargets.length} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <OffboardingQueue items={offboardingTargets} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <DetectionLog alerts={saasAlerts} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} mt={0}>
        <Grid item xs={12}>
          <EmployeeBriefList employees={employees} />
        </Grid>
      </Grid>
    </Box>
  );
}
