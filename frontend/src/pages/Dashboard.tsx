import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CardActionArea,
  Alert, LinearProgress, Tooltip, Chip, Stack, Divider,
} from '@mui/material';
import {
  People as PeopleIcon,
  CheckCircle as CheckIcon,
  PersonOff as ResignedIcon,
  Cloud as CloudIcon,
  Warning as WarningIcon,
  Pending as PendingIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip as ChartTooltip,
  XAxis, YAxis,
} from 'recharts';
import { dashboardApi } from '../api';
import type { DashboardStats, SaasSyncAlert } from '../types';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  subtitle?: string;
  onClick?: () => void;
  hint?: string;
}

function StatCard({ title, value, icon, color, bgColor, subtitle, onClick, hint }: StatCardProps) {
  const inner = (
    <CardContent
      sx={{
        width: '100%',
        minHeight: 178,
        p: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        '&:last-child': { pb: 2 },
      }}
    >
      <Stack alignItems="center" spacing={1.25} textAlign="center" minWidth={0} width="100%">
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            bgcolor: color,
            boxShadow: '0 10px 22px rgba(15, 23, 42, 0.14)',
            '& .MuiSvgIcon-root': { fontSize: 26 },
          }}
        >
          {icon}
        </Box>
        <Box minWidth={0} width="100%">
          <Typography variant="body2" color="text.secondary" fontWeight={700} noWrap>
            {title}
          </Typography>
          <Typography
            fontWeight={800}
            color="text.primary"
            lineHeight={1.05}
            mt={0.75}
            sx={{ fontSize: { xs: 30, lg: 27, xl: 32 } }}
          >
            {value.toLocaleString()}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap display="block" mt={0.5}>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            px: 1.5,
            py: 0.75,
            borderRadius: 1,
            bgcolor: '#fff',
            color: 'text.secondary',
            fontSize: 12,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          }}
        >
          蹂닿린
        </Box>
      </Stack>
    </CardContent>
  );

  const cardSx = {
    height: '100%',
    bgcolor: bgColor,
    border: '1px solid rgba(255, 255, 255, 0.72)',
    borderRadius: 3,
    cursor: onClick ? 'pointer' : 'default',
    minHeight: 178,
    boxShadow: '0 10px 28px rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
    '&:hover': onClick ? { transform: 'translateY(-3px)', transition: 'all 0.2s' } : undefined,
  };

  if (onClick) {
    return (
      <Tooltip title={hint || '紐⑸줉 蹂닿린'} placement="top">
        <Card elevation={1} sx={cardSx}>
          <CardActionArea
            onClick={onClick}
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'stretch',
            }}
          >
            {inner}
          </CardActionArea>
        </Card>
      </Tooltip>
    );
  }

  return <Card elevation={1} sx={cardSx}>{inner}</Card>;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}

function ChartCard({ title, subtitle, children, height = 270 }: ChartCardProps) {
  return (
    <Card
      elevation={1}
      sx={{
        height: '100%',
        borderRadius: 3,
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography variant="h6" fontWeight={700}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ width: '100%', height }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
}

type ActivitySeverity = 'error' | 'warning' | 'info' | 'success';

interface ActivityLogItem {
  severity: ActivitySeverity;
  title: string;
  status: string;
  meta: string;
  description: string;
  icon: React.ReactNode;
}

const LOG_STYLE: Record<ActivitySeverity, { color: 'error' | 'warning' | 'info' | 'success'; bg: string }> = {
  error: { color: 'error', bg: '#ffebee' },
  warning: { color: 'warning', bg: '#fff3e0' },
  info: { color: 'info', bg: '#e3f2fd' },
  success: { color: 'success', bg: '#e8f5e9' },
};

function ActivityLog({ logs }: { logs: ActivityLogItem[] }) {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: { lg: 'calc(100vh - 128px)' },
        bgcolor: '#fafafa',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        p: 3.5,
        position: { lg: 'sticky' },
        top: { lg: 88 },
      }}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <HistoryIcon color="primary" />
          <Typography variant="h6" fontWeight={800}>
            Activity Log
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">
          Today
        </Typography>
      </Box>

      <Stack divider={<Divider flexItem sx={{ borderStyle: 'dashed' }} />} spacing={0}>
        {logs.map((log) => {
          const style = LOG_STYLE[log.severity];
          return (
            <Box key={log.title} display="flex" gap={1.5} py={1.75}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: 1.5,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  bgcolor: style.bg,
                  color: `${style.color}.main`,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                {log.icon}
              </Box>
              <Box minWidth={0} flex={1}>
                <Box display="flex" alignItems="center" justifyContent="space-between" gap={1}>
                  <Typography variant="body2" fontWeight={800} noWrap>
                    {log.title}
                  </Typography>
                  <Chip label={log.status} size="small" color={style.color} variant="outlined" />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
                  {log.meta}
                </Typography>
                <Typography variant="body2" color="text.secondary" mt={0.75}>
                  {log.description}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [saasAlerts, setSaasAlerts] = useState<SaasSyncAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getSaasSyncAlerts(5),
    ])
      .then(([statsData, alertData]) => {
        setStats(statsData);
        setSaasAlerts(alertData);
      })
      .catch(() => setError('대시보드 정보를 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!stats) return null;

  const activeRate = stats.totalEmployees > 0
    ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100)
    : 0;
  const resignedRate = stats.totalEmployees > 0
    ? Math.round((stats.resignedEmployees / stats.totalEmployees) * 100)
    : 0;
  const saasRate = Math.round((stats.connectedSaasCount / 3) * 100);
  const openActionCount = stats.criticalRiskCount + stats.pendingOffboardings + (stats.openSaasSyncAlerts || 0);

  const employeeStatusData = [
    { name: '재직 중', value: stats.activeEmployees, color: '#2e7d32' },
    { name: '퇴사자', value: stats.resignedEmployees, color: '#546e7a' },
  ].filter((item) => item.value > 0);

  const saasConnectionData = [
    { name: '연결됨', value: stats.connectedSaasCount, fill: '#0288d1' },
    { name: '미연결', value: Math.max(3 - stats.connectedSaasCount, 0), fill: '#cfd8dc' },
  ].filter((item) => item.value > 0);

  const actionData = [
    { name: '최고 위험', value: stats.criticalRiskCount, fill: '#d32f2f' },
    { name: '진행 중', value: stats.pendingOffboardings, fill: '#ed6c02' },
  ];

  const overviewData = [
    { name: '전체 직원', value: stats.totalEmployees, fill: '#1565c0' },
    { name: '재직 중', value: stats.activeEmployees, fill: '#2e7d32' },
    { name: '퇴사자', value: stats.resignedEmployees, fill: '#546e7a' },
    { name: '연결 SaaS', value: stats.connectedSaasCount, fill: '#0288d1' },
  ];

  const saasAlertLogs: ActivityLogItem[] = saasAlerts.map(alert => ({
    severity: 'warning',
    title: `${alert.saasType} 계정 이탈 감지`,
    status: '확인 필요',
    meta: alert.employeeName || alert.displayName || alert.externalUsername || alert.externalEmail || '미매핑 계정',
    description: `${alert.displayName || alert.externalUsername || alert.externalEmail || '계정'}이 최근 ${alert.saasType} 동기화 결과에서 사라졌습니다. 퇴사 또는 권한 변경 여부를 확인하세요.`,
    icon: <WarningIcon fontSize="small" />,
  }));

  const activityLogs: ActivityLogItem[] = [
    ...saasAlertLogs,
    stats.criticalRiskCount > 0
      ? {
          severity: 'error',
          title: 'Critical accounts',
          status: `${stats.criticalRiskCount} risk`,
          meta: 'Risk analysis',
          description: '?ㅽ봽蹂대뵫 寃곌낵?먯꽌 ?묎렐 沅뚰븳 ?댁젣 ?щ?瑜??곗꽑 ?뺤씤?섏꽭??',
          icon: <WarningIcon fontSize="small" />,
        }
      : {
          severity: 'success',
          title: 'Critical accounts',
          status: 'Clear',
          meta: 'Risk analysis',
          description: '?꾩옱 CRITICAL ?꾪뿕 怨꾩젙? 媛먯??섏? ?딆븯?듬땲??',
          icon: <CheckIcon fontSize="small" />,
        },
    stats.pendingOffboardings > 0
      ? {
          severity: 'warning',
          title: 'Offboarding queue',
          status: `${stats.pendingOffboardings} active`,
          meta: 'Workflow status',
          description: '?ㅽ봽蹂대뵫 愿由??섏씠吏?먯꽌 泥섎━ ?곹깭瑜??뺤씤?섏꽭??',
          icon: <PendingIcon fontSize="small" />,
        }
      : {
          severity: 'success',
          title: 'Offboarding queue',
          status: 'Idle',
          meta: 'Workflow status',
          description: '?湲?以묒씠嫄곕굹 泥섎━ 以묒씤 ?ㅽ봽蹂대뵫 ?묒뾽???놁뒿?덈떎.',
          icon: <CheckIcon fontSize="small" />,
        },
    stats.connectedSaasCount < 3
      ? {
          severity: 'info',
          title: 'SaaS connections',
          status: `${3 - stats.connectedSaasCount} left`,
          meta: 'Slack 쨌 GitHub 쨌 Notion',
          description: '?곌껐 愿由ъ뿉??媛?SaaS ?곕룞 ?곹깭瑜??뺤씤?섏꽭??',
          icon: <CloudIcon fontSize="small" />,
        }
      : {
          severity: 'success',
          title: 'SaaS connections',
          status: 'Complete',
          meta: 'Slack 쨌 GitHub 쨌 Notion',
          description: '吏???뚮옯??3媛쒓? 紐⑤몢 ?곌껐???곹깭?낅땲??',
          icon: <CloudIcon fontSize="small" />,
        },
  ];

  return (
    <Box sx={{ pb: 4 }}>
      <Grid container columnSpacing={{ xs: 3, lg: 5 }} rowSpacing={4} alignItems="stretch">
        <Grid item xs={12} lg={9}>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h4" fontWeight="bold" gutterBottom>
                ??쒕낫??
              </Typography>
              <Typography variant="body2" color="text.secondary">
                吏곸썝 ?묎렐 沅뚰븳, SaaS ?곌껐, ?ㅽ봽蹂대뵫 ?꾪뿕 吏?쒕? ?쒕늿???뺤씤?⑸땲??
              </Typography>
            </Box>

            <Grid
              container
              spacing={3}
              sx={{ '& > .MuiGrid-item:first-of-type': { pl: 0 } }}
            >
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <StatCard
                  title="?꾩껜 吏곸썝"
                  value={stats.totalEmployees}
                  icon={<PeopleIcon />}
                  color="#4d63e6"
                  bgColor="#f0f3ff"
                  onClick={() => navigate('/employees')}
                  hint="전체 직원 목록"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <StatCard
                  title="재직 중"
                  value={stats.activeEmployees}
                  icon={<CheckIcon />}
                  color="#4b9b4f"
                  bgColor="#eef8ef"
                  subtitle={`${activeRate}% active`}
                  onClick={() => navigate('/employees?status=ACTIVE')}
                  hint="재직 중 직원 목록"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <StatCard
                  title="퇴사자"
                  value={stats.resignedEmployees}
                  icon={<ResignedIcon />}
                  color="#6b7280"
                  bgColor="#f4f5f7"
                  subtitle={`${resignedRate}% resigned`}
                  onClick={() => navigate('/employees?status=RESIGNED')}
                  hint="퇴사자 목록"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <StatCard
                  title="?곌껐 SaaS"
                  value={stats.connectedSaasCount}
                  icon={<CloudIcon />}
                  color="#3f8cd6"
                  bgColor="#edf7ff"
                  subtitle={`${saasRate}% connected`}
                  onClick={() => navigate('/saas-connections')}
                  hint="SaaS 연결 관리"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <StatCard
                  title="최고 위험"
                  value={stats.criticalRiskCount}
                  icon={<WarningIcon />}
                  color="#d34a4a"
                  bgColor="#fff0f0"
                  subtitle="즉시 확인"
                  onClick={() => navigate('/offboarding')}
                  hint="CRITICAL 위험 확인"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={4} lg={2}>
                <StatCard
                  title="진행 중"
                  value={stats.pendingOffboardings}
                  icon={<PendingIcon />}
                  color="#d9782d"
                  bgColor="#fff4e8"
                  subtitle="오프보딩"
                  onClick={() => navigate('/offboarding')}
                  hint="오프보딩 목록"
                />
              </Grid>
            </Grid>

            <Grid
              container
              spacing={2.5}
              sx={{ '& > .MuiGrid-item:first-of-type': { pl: 0 } }}
            >
              <Grid item xs={12} md={6}>
                <ChartCard title="吏곸썝 ?곹깭 鍮꾩쑉" subtitle={`?ъ쭅 ${activeRate}% 쨌 ?댁궗 ${resignedRate}%`}>
                  {employeeStatusData.length > 0 ? (
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={employeeStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={58}
                          outerRadius={92}
                          paddingAngle={4}
                          label
                        >
                          {employeeStatusData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <ChartTooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <Box height="100%" display="flex" alignItems="center" justifyContent="center">
                      <Typography color="text.secondary">吏곸썝 ?곗씠?곌? ?놁뒿?덈떎</Typography>
                    </Box>
                  )}
                </ChartCard>
              </Grid>

              <Grid item xs={12} md={6}>
                <ChartCard title="SaaS ?곌껐 ?꾪솴" subtitle={`${stats.connectedSaasCount}/3媛??뚮옯???곌껐`}>
                  <ResponsiveContainer>
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="62%"
                      outerRadius="92%"
                      barSize={18}
                      data={saasConnectionData}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <RadialBar dataKey="value" background cornerRadius={10} />
                      <ChartTooltip />
                      <Legend />
                      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" fontSize={32} fontWeight={700} fill="#263238">
                        {saasRate}%
                      </text>
                      <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" fontSize={13} fill="#607d8b">
                        ?곌껐瑜?
                      </text>
                    </RadialBarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </Grid>

              <Grid item xs={12} md={5}>
                <ChartCard title="議곗튂 ?꾩슂 ??ぉ" subtitle={`${openActionCount}媛???ぉ ?뺤씤 ?꾩슂`}>
                  <ResponsiveContainer>
                    <BarChart data={actionData} margin={{ top: 16, right: 12, left: -20, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {actionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </Grid>

              <Grid item xs={12} md={7}>
                <ChartCard title="운영 지표 비교" subtitle="직원, SaaS, 오프보딩 지표를 한눈에 비교합니다.">
                  <ResponsiveContainer>
                    <BarChart data={overviewData} margin={{ top: 16, right: 24, left: 0, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {overviewData.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </Grid>
            </Grid>
          </Stack>
        </Grid>

        <Grid item xs={12} lg={3}>
          <ActivityLog logs={activityLogs} />
        </Grid>
      </Grid>
    </Box>
  );
}
