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
  ArrowForward as ArrowIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip as ChartTooltip,
  XAxis, YAxis,
} from 'recharts';
import { dashboardApi } from '../api';
import type { DashboardStats } from '../types';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
  onClick?: () => void;
  hint?: string;
}

function StatCard({ title, value, icon, color, subtitle, onClick, hint }: StatCardProps) {
  const inner = (
    <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
        <Box minWidth={0}>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={800} color={color} lineHeight={1.15} mt={0.5}>
            {value.toLocaleString()}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box display="flex" flexDirection="column" alignItems="center" gap={0.5}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 1.5,
              display: 'grid',
              placeItems: 'center',
              color,
              bgcolor: 'action.hover',
            }}
          >
            {icon}
          </Box>
          {onClick && <ArrowIcon fontSize="small" sx={{ color, opacity: 0.45 }} />}
        </Box>
      </Box>
    </CardContent>
  );

  const cardSx = {
    height: '100%',
    borderLeft: 4,
    borderColor: color,
    cursor: onClick ? 'pointer' : 'default',
    '&:hover': onClick ? { transform: 'translateY(-2px)', transition: 'all 0.2s' } : undefined,
  };

  if (onClick) {
    return (
      <Tooltip title={hint || '목록 보기'} placement="top">
        <Card elevation={2} sx={cardSx}>
          <CardActionArea onClick={onClick}>{inner}</CardActionArea>
        </Card>
      </Tooltip>
    );
  }

  return <Card elevation={2} sx={cardSx}>{inner}</Card>;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
}

function ChartCard({ title, subtitle, children, height = 280 }: ChartCardProps) {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
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

interface ActivityLogProps {
  logs: Array<{
    severity: 'error' | 'warning' | 'info' | 'success';
    title: string;
    description: string;
  }>;
}

function ActivityLog({ logs }: ActivityLogProps) {
  return (
    <Card elevation={2} sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Box display="flex" alignItems="center" gap={1}>
            <HistoryIcon color="primary" />
            <Typography variant="h6" fontWeight={700}>
              운영 로그
            </Typography>
          </Box>
          <Chip label={`${logs.length}건`} size="small" color="primary" variant="outlined" />
        </Box>
        <Typography variant="body2" color="text.secondary" mb={2}>
          현재 대시보드 지표를 기준으로 확인할 작업입니다.
        </Typography>
        <Stack spacing={1.5}>
          {logs.map((log, index) => (
            <Box key={`${log.title}-${index}`}>
              {index > 0 && <Divider sx={{ mb: 1.5 }} />}
              <Alert severity={log.severity} variant="outlined" sx={{ alignItems: 'center' }}>
                <Typography variant="body2" fontWeight={700}>
                  {log.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {log.description}
                </Typography>
              </Alert>
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    dashboardApi.getStats()
      .then(setStats)
      .catch(() => setError('대시보드 통계를 불러오지 못했습니다'))
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
  const openActionCount = stats.criticalRiskCount + stats.pendingOffboardings;

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

  const activityLogs = [
    ...(stats.criticalRiskCount > 0
      ? [{
          severity: 'error' as const,
          title: `최고 위험 계정 ${stats.criticalRiskCount}건 발견`,
          description: '오프보딩 결과에서 접근 권한 해제 여부를 우선 확인하세요.',
        }]
      : [{
          severity: 'success' as const,
          title: '최고 위험 계정 없음',
          description: '현재 CRITICAL 위험 계정은 감지되지 않았습니다.',
        }]),
    ...(stats.pendingOffboardings > 0
      ? [{
          severity: 'warning' as const,
          title: `진행 중 오프보딩 ${stats.pendingOffboardings}건`,
          description: '오프보딩 관리 페이지에서 처리 상태를 확인하세요.',
        }]
      : [{
          severity: 'success' as const,
          title: '진행 중 오프보딩 없음',
          description: '대기 중이거나 처리 중인 오프보딩 작업이 없습니다.',
        }]),
    ...(stats.connectedSaasCount < 3
      ? [{
          severity: 'info' as const,
          title: `SaaS ${3 - stats.connectedSaasCount}개 미연결`,
          description: '연결 관리에서 Slack, GitHub, Notion 연동 상태를 확인하세요.',
        }]
      : [{
          severity: 'success' as const,
          title: '모든 SaaS 연결 완료',
          description: '지원 플랫폼 3개가 모두 연결된 상태입니다.',
        }]),
  ];

  return (
    <Box>
      <Box display="flex" alignItems="flex-end" justifyContent="space-between" gap={2} mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            대시보드
          </Typography>
          <Typography variant="body2" color="text.secondary">
            직원 접근 권한, SaaS 연결, 오프보딩 위험 지표를 한눈에 확인합니다.
          </Typography>
        </Box>
        <Chip
          label={openActionCount > 0 ? `${openActionCount}개 조치 필요` : '정상 운영'}
          color={openActionCount > 0 ? 'warning' : 'success'}
          variant="filled"
        />
      </Box>

      <Grid container spacing={2.25}>
        <Grid item xs={12} sm={6} lg={2}>
          <StatCard
            title="전체 직원"
            value={stats.totalEmployees}
            icon={<PeopleIcon />}
            color="primary.main"
            onClick={() => navigate('/employees')}
            hint="전체 직원 목록"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <StatCard
            title="재직 중"
            value={stats.activeEmployees}
            icon={<CheckIcon />}
            color="success.main"
            subtitle={`${activeRate}% active`}
            onClick={() => navigate('/employees?status=ACTIVE')}
            hint="재직 중 직원 목록"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <StatCard
            title="퇴사자"
            value={stats.resignedEmployees}
            icon={<ResignedIcon />}
            color="text.secondary"
            subtitle={`${resignedRate}% resigned`}
            onClick={() => navigate('/employees?status=RESIGNED')}
            hint="퇴사자 목록"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <StatCard
            title="연결 SaaS"
            value={stats.connectedSaasCount}
            icon={<CloudIcon />}
            color="info.main"
            subtitle={`${saasRate}% connected`}
            onClick={() => navigate('/saas-connections')}
            hint="SaaS 연결 관리"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <StatCard
            title="최고 위험"
            value={stats.criticalRiskCount}
            icon={<WarningIcon />}
            color="error.main"
            subtitle="즉시 확인"
            onClick={() => navigate('/offboarding')}
            hint="CRITICAL 위험 확인"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={2}>
          <StatCard
            title="진행 중"
            value={stats.pendingOffboardings}
            icon={<PendingIcon />}
            color="warning.main"
            subtitle="오프보딩"
            onClick={() => navigate('/offboarding')}
            hint="오프보딩 목록"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} lg={4}>
          <ActivityLog logs={activityLogs} />
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ChartCard title="직원 상태 비율" subtitle={`재직 ${activeRate}% · 퇴사 ${resignedRate}%`}>
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
                <Typography color="text.secondary">직원 데이터가 없습니다</Typography>
              </Box>
            )}
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <ChartCard title="SaaS 연결 현황" subtitle={`${stats.connectedSaasCount}/3개 플랫폼 연결`}>
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
                  연결률
                </text>
              </RadialBarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <ChartCard title="조치 필요 항목" subtitle={`${openActionCount}개 항목 확인 필요`}>
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
          <ChartCard title="운영 지표 비교" subtitle="직원, SaaS, 오프보딩 지표를 한눈에 비교합니다">
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
    </Box>
  );
}
