import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Card, CardContent, Typography, CardActionArea,
  Alert, LinearProgress, Tooltip,
} from '@mui/material';
import {
  People as PeopleIcon,
  CheckCircle as CheckIcon,
  PersonOff as ResignedIcon,
  Cloud as CloudIcon,
  Warning as WarningIcon,
  Pending as PendingIcon,
  ArrowForward as ArrowIcon,
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
    <CardContent>
      <Box display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h3" fontWeight="bold" color={color}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
          <Box sx={{ color, opacity: 0.7 }}>{icon}</Box>
          {onClick && <ArrowIcon fontSize="small" sx={{ color, opacity: 0.4 }} />}
        </Box>
      </Box>
    </CardContent>
  );

  if (onClick) {
    return (
      <Tooltip title={hint || '클릭하여 목록 보기'} placement="top">
        <Card elevation={2} sx={{ cursor: 'pointer', '&:hover': { elevation: 4, transform: 'translateY(-2px)', transition: 'all 0.2s' } }}>
          <CardActionArea onClick={onClick}>
            {inner}
          </CardActionArea>
        </Card>
      </Tooltip>
    );
  }
  return <Card elevation={2}>{inner}</Card>;
}

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, children }: ChartCardProps) {
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
        <Box sx={{ width: '100%', height: 280 }}>
          {children}
        </Box>
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

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        대시보드
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        직원 접근 권한 관리 현황
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="전체 직원"
            value={stats.totalEmployees}
            icon={<PeopleIcon sx={{ fontSize: 48 }} />}
            color="primary.main"
            onClick={() => navigate('/employees')}
            hint="클릭 → 전체 직원 목록"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="재직 중"
            value={stats.activeEmployees}
            icon={<CheckIcon sx={{ fontSize: 48 }} />}
            color="success.main"
            subtitle={`전체 직원의 ${activeRate}%`}
            onClick={() => navigate('/employees?status=ACTIVE')}
            hint="클릭 → 재직 중 직원 목록"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="퇴사자"
            value={stats.resignedEmployees}
            icon={<ResignedIcon sx={{ fontSize: 48 }} />}
            color="text.secondary"
            onClick={() => navigate('/employees?status=RESIGNED')}
            hint="클릭 → 퇴사자 목록"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="연결된 SaaS"
            value={stats.connectedSaasCount}
            icon={<CloudIcon sx={{ fontSize: 48 }} />}
            color="info.main"
            subtitle="3개 플랫폼 중"
            onClick={() => navigate('/saas-connections')}
            hint="클릭 → SaaS 연결 관리"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="최고 위험 계정"
            value={stats.criticalRiskCount}
            icon={<WarningIcon sx={{ fontSize: 48 }} />}
            color="error.main"
            subtitle="즉시 조치 필요"
            onClick={() => navigate('/offboarding')}
            hint="클릭 → 오프보딩 결과 (CRITICAL 확인)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="진행 중 오프보딩"
            value={stats.pendingOffboardings}
            icon={<PendingIcon sx={{ fontSize: 48 }} />}
            color="warning.main"
            onClick={() => navigate('/offboarding')}
            hint="클릭 → 오프보딩 목록"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid item xs={12} md={4}>
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

        <Grid item xs={12} md={4}>
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

        <Grid item xs={12} md={4}>
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

        <Grid item xs={12}>
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

      {stats.criticalRiskCount > 0 && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <strong>{stats.criticalRiskCount}개의 최고 위험(CRITICAL) 계정이 발견되었습니다.</strong>{' '}
          오프보딩 결과 페이지에서 즉시 접근 권한을 해제하세요.
        </Alert>
      )}

      {stats.pendingOffboardings > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>{stats.pendingOffboardings}개의 오프보딩이 진행 중입니다.</strong>{' '}
          오프보딩 관리 페이지에서 확인하세요.
        </Alert>
      )}
    </Box>
  );
}
