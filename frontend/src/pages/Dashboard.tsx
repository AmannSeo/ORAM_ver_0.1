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
  People as PeopleIcon,
  Security as SecurityIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { dashboardApi, offboardingApi } from '../api';
import RiskBadge from '../components/common/RiskBadge';
import type { DashboardStats, OffboardingSummary, SaasSyncAlert } from '../types';

type Severity = 'error' | 'warning' | 'info' | 'success';

const TONE: Record<Severity, { color: string; bg: string; border: string }> = {
  error: { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  warning: { color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  info: { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  success: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
};

function formatDateTime(value?: string | Date) {
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

function analysisSourceLabel(source?: string) {
  if (source === 'AUTOMATIC') return '자동 분석';
  if (source === 'MANUAL') return '수동 재분석';
  return source || '-';
}

function saasAlertReasonLabel(reason: string) {
  if (reason === 'RESIGNED_ACCOUNT_STILL_ACTIVE') return '퇴사자 활성 계정';
  if (reason === 'MISSING_FROM_LATEST_SYNC') return '최근 동기화에서 누락';
  if (reason === 'INACTIVE_FROM_LATEST_SYNC') return '비활성 계정 감지';
  return '계정 상태 확인';
}

function saasAlertDescription(alert: SaasSyncAlert) {
  const account = alert.employeeName || alert.displayName || alert.externalUsername || alert.externalEmail || '매핑되지 않은 계정';
  if (alert.reason === 'RESIGNED_ACCOUNT_STILL_ACTIVE') {
    return `${account} 계정이 퇴사 상태인데도 최근 ${alert.saasType} 동기화에서 활성 계정으로 확인되었습니다. 즉시 권한 회수 또는 수동 제거가 필요합니다.`;
  }
  if (alert.reason === 'INACTIVE_FROM_LATEST_SYNC') {
    return `${account} 계정이 최근 ${alert.saasType} 동기화에서 비활성 상태로 확인되었습니다.`;
  }
  if (alert.reason === 'MISSING_FROM_LATEST_SYNC') {
    return `${account} 계정이 이전 동기화에는 있었지만 최근 ${alert.saasType} 결과에서 누락되었습니다.`;
  }
  return alert.detail || `${account} 계정 상태 확인이 필요합니다.`;
}

function escapeCsv(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function addCsvRow(rows: string[], values: unknown[]) {
  rows.push(values.map(escapeCsv).join(','));
}

function downloadDashboardReport(stats: DashboardStats, alerts: SaasSyncAlert[], targets: OffboardingSummary[]) {
  const createdAt = new Date();
  const rows: string[] = [];

  addCsvRow(rows, ['ORAM 접근 권한 점검 보고서']);
  addCsvRow(rows, ['생성 시각', formatDateTime(createdAt)]);
  rows.push('');

  addCsvRow(rows, ['요약']);
  addCsvRow(rows, ['항목', '값', '설명']);
  addCsvRow(rows, ['전체 직원', stats.totalEmployees, 'ORAM에 등록 또는 동기화된 직원']);
  addCsvRow(rows, ['재직자', stats.activeEmployees, '활성 상태 직원']);
  addCsvRow(rows, ['퇴사자', stats.resignedEmployees, '권한 회수 검토 대상']);
  addCsvRow(rows, ['연결 SaaS', stats.connectedSaasCount, '연동된 SaaS 수']);
  addCsvRow(rows, ['권한 회수 대상', targets.length, '미회수 및 오탐 제외 대상']);
  addCsvRow(rows, ['긴급 위험', stats.criticalRiskCount, 'CRITICAL 위험 대상']);
  addCsvRow(rows, ['잔여 접근 감지 로그', stats.openSaasSyncAlerts || 0, '권한 회수 대상 생성 또는 상태 변경 원인 로그']);
  rows.push('');

  addCsvRow(rows, ['권한 회수 대상']);
  addCsvRow(rows, ['No', '이름', '이메일', '부서', '위험도', '점수', '분석 방식', '회수 상태']);
  if (targets.length === 0) {
    addCsvRow(rows, ['-', '현재 권한 회수 대상이 없습니다.', '', '', '', '', '', '']);
  } else {
    targets.forEach((target, index) => {
      addCsvRow(rows, [
        index + 1,
        target.employee.name,
        target.employee.email,
        target.employee.department || '-',
        target.riskLevel || '-',
        target.riskScore ?? '-',
        analysisSourceLabel(target.analysisSource),
        target.revokedAll ? '회수 완료' : '미회수',
      ]);
    });
  }
  rows.push('');

  addCsvRow(rows, ['최근 SaaS 감지 알림']);
  addCsvRow(rows, ['No', 'SaaS', '사유', '설명', '감지 시각']);
  if (alerts.length === 0) {
    addCsvRow(rows, ['-', '열린 감지 알림이 없습니다.', '', '', '']);
  } else {
    alerts.forEach((alert, index) => {
      addCsvRow(rows, [
        index + 1,
        alert.saasType,
        saasAlertReasonLabel(alert.reason),
        saasAlertDescription(alert),
        formatDateTime(alert.createdAt),
      ]);
    });
  }

  const blob = new Blob([`\ufeff${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `oram-access-report-${createdAt.toISOString().slice(0, 10)}.csv`;
  anchor.click();
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
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
        <Box minWidth={0}>
          <Typography variant="body2" color="#64748b">{title}</Typography>
          <Typography variant="h4" fontWeight={700} color="#0f172a" mt={0.5}>{value.toLocaleString()}</Typography>
          <Typography variant="caption" color="#64748b" display="block" mt={0.5}>{description}</Typography>
        </Box>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: style.color,
            bgcolor: style.bg,
            border: `1px solid ${style.border}`,
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      </Stack>
    </CardContent>
  );

  return (
    <Card elevation={0} sx={{ height: '100%', border: '1px solid #e2e8f0', borderRadius: 2.5, bgcolor: 'white' }}>
      {onClick ? <CardActionArea onClick={onClick} sx={{ height: '100%' }}>{content}</CardActionArea> : content}
    </Card>
  );
}

function RevocationTargets({ items }: { items: OffboardingSummary[] }) {
  const navigate = useNavigate();
  const visible = items.slice(0, 8);

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1.5} mb={1.5}>
          <Box>
            <Typography variant="h6" fontWeight={700}>권한 회수 대상</Typography>
            <Typography variant="caption" color="#64748b">
              퇴사/비활성 감지 후 아직 권한 회수가 끝나지 않은 대상입니다.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => navigate('/risk-analysis')}>AI 분석</Button>
            <Button size="small" variant="contained" onClick={() => navigate('/offboarding')}>전체 관리</Button>
          </Stack>
        </Stack>

        {visible.length === 0 ? (
          <Alert severity="success" icon={<CheckIcon />}>현재 권한 회수 대상이 없습니다.</Alert>
        ) : (
          <TableContainer sx={{ overflowX: 'hidden' }}>
            <Table size="small" sx={{ width: '100%', tableLayout: 'fixed', '& th, & td': { whiteSpace: 'nowrap', px: 1 }, '& td': { overflow: 'hidden', textOverflow: 'ellipsis' } }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell width="8%">No.</TableCell>
                  <TableCell width="17%">이름</TableCell>
                  <TableCell width="31%">이메일</TableCell>
                  <TableCell width="16%">위험도</TableCell>
                  <TableCell width="14%" align="center">분석</TableCell>
                  <TableCell width="14%" align="center">상태</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((item, index) => (
                  <TableRow key={item.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/offboarding/${item.id}`)}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} noWrap>{item.employee.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="#64748b" noWrap>{item.employee.email}</Typography>
                    </TableCell>
                    <TableCell><RiskBadge level={item.riskLevel} score={item.riskScore} /></TableCell>
                    <TableCell align="center">
                      <Chip size="small" label={analysisSourceLabel(item.analysisSource)} variant="outlined" />
                    </TableCell>
                    <TableCell align="center">
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

function DetectionLog({ alerts, onOpenTargets }: { alerts: SaasSyncAlert[]; onOpenTargets: () => void }) {
  const chipColor = (reason: string) => (
    reason === 'RESIGNED_ACCOUNT_STILL_ACTIVE' || reason === 'INACTIVE_FROM_LATEST_SYNC' ? 'error' : 'warning'
  );

  return (
    <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box mb={1.5}>
          <Typography variant="h6" fontWeight={700}>감지 로그</Typography>
          <Typography variant="caption" color="#64748b">권한 회수 대상이 생성되거나 갱신된 원인</Typography>
        </Box>
        {alerts.length === 0 ? (
          <Alert severity="success" icon={<CheckIcon />}>현재 표시할 감지 로그가 없습니다.</Alert>
        ) : (
          <Stack divider={<Divider flexItem />} spacing={0}>
            {alerts.map((alert) => (
              <Box
                key={alert.id}
                py={1.5}
                onClick={onOpenTargets}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {alert.saasType} · {saasAlertReasonLabel(alert.reason)}
                  </Typography>
                  <Chip label="확인 필요" size="small" color={chipColor(alert.reason)} variant="outlined" />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const [statsData, alertData, offboardingData] = await Promise.all([
          dashboardApi.getStats(),
          dashboardApi.getSaasSyncAlerts(8),
          offboardingApi.getAll(),
        ]);

        if (!active) return;

        const targets = offboardingData
          .filter((item) => !item.revokedAll && !item.falsePositive)
          .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

        setStats(statsData);
        setSaasAlerts(alertData);
        setOffboardingTargets(targets);
        setError(null);
      } catch {
        if (active) setError('대시보드 정보를 불러오지 못했습니다.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <LinearProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!stats) return null;

  const actionCount = offboardingTargets.length;
  const urgentTargets = offboardingTargets.filter((item) => item.riskLevel === 'CRITICAL' || item.riskLevel === 'HIGH').length;

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }} gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight={700} color="#0f172a">대시보드</Typography>
          <Typography variant="body2" color="#64748b" mt={0.75}>
            퇴사/비활성 계정 감지와 권한 회수 진행 상황을 확인합니다.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<ReportIcon />}
          onClick={() => downloadDashboardReport(stats, saasAlerts, offboardingTargets)}
          sx={{ borderRadius: 2, whiteSpace: 'nowrap' }}
        >
          점검 보고서 다운로드
        </Button>
      </Stack>

      {offboardingTargets.length > 0 && (
        <Alert
          severity="error"
          sx={{ mb: 2.5, borderRadius: 2, alignItems: 'center' }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/offboarding')}>
              회수 대상 보기
            </Button>
          }
        >
          권한 회수 대상 {offboardingTargets.length}명이 있습니다.
          {' '}권한 회수 대상에서 회수 또는 수동 조치 여부를 확인해야 합니다.
        </Alert>
      )}

      <Grid container spacing={2} mb={2.5}>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="전체 직원" value={stats.totalEmployees} description="등록/동기화된 인원" icon={<PeopleIcon />} tone="info" onClick={() => navigate('/employees')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="조치 필요" value={actionCount} description="권한 회수 대상 인원" icon={<WarningIcon />} tone={actionCount > 0 ? 'error' : 'success'} onClick={() => navigate('/offboarding')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="긴급 조치" value={urgentTargets} description="HIGH 이상 위험 대상" icon={<SecurityIcon />} tone={urgentTargets > 0 ? 'warning' : 'success'} onClick={() => navigate('/offboarding')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="연결 SaaS" value={stats.connectedSaasCount} description="현재 연동된 서비스" icon={<CloudIcon />} tone="info" onClick={() => navigate('/saas-connections')} />
        </Grid>
        <Grid item xs={12} sm={6} lg={2.4}>
          <StatCard title="퇴사자" value={stats.resignedEmployees} description="퇴사 상태 직원" icon={<GroupsIcon />} tone="warning" onClick={() => navigate('/employees?status=RESIGNED')} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5} alignItems="stretch">
        <Grid item xs={12} lg={8}>
          <RevocationTargets items={offboardingTargets} />
        </Grid>
        <Grid item xs={12} lg={4}>
          <DetectionLog alerts={saasAlerts} onOpenTargets={() => navigate('/offboarding')} />
        </Grid>
      </Grid>
    </Box>
  );
}
