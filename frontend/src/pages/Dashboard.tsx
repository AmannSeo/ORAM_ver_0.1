import React, { useEffect, useState } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  People,
  PersonOff,
  CheckCircle,
  Cloud,
  Warning,
  Error as ErrorIcon,
  Info,
  HourglassEmpty,
} from '@mui/icons-material';
import { DashboardStats } from '../types';
import { dashboardApi } from '../services/api';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }) => (
  <Card elevation={2} sx={{ height: '100%', borderTop: `4px solid ${color}` }}>
    <CardContent>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h3" fontWeight={700} color={color}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            bgcolor: `${color}22`,
            p: 1.5,
            borderRadius: 2,
            color,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {icon}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

// Mock data for demo when API is unavailable
const MOCK_STATS: DashboardStats = {
  totalEmployees: 42,
  activeEmployees: 38,
  resignedEmployees: 4,
  connectedSaasCount: 3,
  criticalRiskAccounts: 2,
  highRiskAccounts: 5,
  mediumRiskAccounts: 8,
  lowRiskAccounts: 3,
  pendingOffboardings: 2,
  completedOffboardings: 2,
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardApi
      .getStats()
      .then((res) => setStats(res.data))
      .catch(() => {
        // Fall back to mock data for demo
        setStats(MOCK_STATS);
        setError('Using demo data — API not reachable');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const s = stats!;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Overview of your organization's SaaS access posture
      </Typography>

      {error && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Employee stats */}
      <Typography variant="h6" fontWeight={600} mb={2} color="text.secondary">
        EMPLOYEE STATUS
      </Typography>
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Employees"
            value={s.totalEmployees}
            icon={<People fontSize="large" />}
            color="#1976d2"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Employees"
            value={s.activeEmployees}
            icon={<CheckCircle fontSize="large" />}
            color="#2e7d32"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Resigned Employees"
            value={s.resignedEmployees}
            icon={<PersonOff fontSize="large" />}
            color="#d32f2f"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Connected SaaS"
            value={`${s.connectedSaasCount}/3`}
            icon={<Cloud fontSize="large" />}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Risk stats */}
      <Typography variant="h6" fontWeight={600} mb={2} color="text.secondary">
        RISK POSTURE
      </Typography>
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Critical Risk"
            value={s.criticalRiskAccounts}
            icon={<ErrorIcon fontSize="large" />}
            color="#c62828"
            subtitle="Immediate action required"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="High Risk"
            value={s.highRiskAccounts}
            icon={<Warning fontSize="large" />}
            color="#e65100"
            subtitle="Review within 24h"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Medium Risk"
            value={s.mediumRiskAccounts}
            icon={<Info fontSize="large" />}
            color="#f57c00"
            subtitle="Monitor and review"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Low Risk"
            value={s.lowRiskAccounts}
            icon={<CheckCircle fontSize="large" />}
            color="#388e3c"
            subtitle="Standard offboarding"
          />
        </Grid>
      </Grid>

      <Divider sx={{ mb: 3 }} />

      {/* Offboarding stats */}
      <Typography variant="h6" fontWeight={600} mb={2} color="text.secondary">
        OFFBOARDING STATUS
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pending Offboardings"
            value={s.pendingOffboardings}
            icon={<HourglassEmpty fontSize="large" />}
            color="#0288d1"
            subtitle="Awaiting revocation"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completed Offboardings"
            value={s.completedOffboardings}
            icon={<CheckCircle fontSize="large" />}
            color="#388e3c"
            subtitle="Access fully revoked"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;
