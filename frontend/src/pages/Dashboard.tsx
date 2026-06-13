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

      {stats.criticalRiskCount > 0 && (
        <Alert severity="error" sx={{ mt: 3 }}>
          <strong>{stats.criticalRiskCount}개의 최고 위험(CRITICAL) 계정이 발견되었습니다.</strong>{' '}
          오프보딩 결과 페이지에서 즉시 접근 권한을 해제하세요.
        </Alert>
      )}

      {stats.pendingOffboardings > 0 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          <strong>{stats.pendingOffboardings}개의 오프보딩이 진행 중입니다.</strong>{' '}
          오프보딩 마랤지 페이지에서 확인하세요.
        </Alert>
      )}
    </Box>
  );
}
