import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import { OffboardingResult, RiskLevel } from '../types';
import { offboardingApi } from '../services/api';

const RISK_CONFIG: Record<RiskLevel, { color: string; chipColor: 'error' | 'warning' | 'info' | 'success'; barColor: string }> = {
  CRITICAL: { color: '#c62828', chipColor: 'error', barColor: '#ef5350' },
  HIGH: { color: '#e65100', chipColor: 'warning', barColor: '#ff9800' },
  MEDIUM: { color: '#f57c00', chipColor: 'info', barColor: '#ffb74d' },
  LOW: { color: '#388e3c', chipColor: 'success', barColor: '#66bb6a' },
};

const MOCK_RESULTS: OffboardingResult[] = [
  {
    id: 1,
    employee: {
      id: 2, employeeId: 'EMP002', name: 'Bob Smith', email: 'bob@company.com',
      department: 'Sales', status: 'RESIGNED', offboardingTriggered: true,
      createdAt: '2024-02-01T09:00:00', updatedAt: '2025-06-01T09:00:00', resignedAt: '2025-06-01T09:00:00',
    },
    status: 'COMPLETED',
    riskScore: 95,
    riskLevel: 'CRITICAL',
    totalPermissions: 5,
    revokedPermissions: 5,
    initiatedAt: '2025-06-01T10:00:00',
    completedAt: '2025-06-01T10:05:00',
    permissions: [],
    recommendedActions: [],
  },
  {
    id: 2,
    employee: {
      id: 4, employeeId: 'EMP004', name: 'Diana Prince', email: 'diana@company.com',
      department: 'Engineering', status: 'RESIGNED', offboardingTriggered: false,
      createdAt: '2023-11-20T09:00:00', updatedAt: '2025-05-20T09:00:00', resignedAt: '2025-05-20T09:00:00',
    },
    status: 'PENDING',
    riskScore: 62,
    riskLevel: 'HIGH',
    totalPermissions: 3,
    revokedPermissions: 0,
    initiatedAt: '2025-05-20T11:00:00',
    completedAt: null,
    permissions: [],
    recommendedActions: [],
  },
];

const RiskBadge: React.FC<{ level: RiskLevel; score: number }> = ({ level, score }) => {
  const cfg = RISK_CONFIG[level];
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Chip label={level} color={cfg.chipColor} size="small" />
        <Typography variant="body2" fontWeight={700} color={cfg.color}>
          {score}/100
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          height: 8,
          borderRadius: 4,
          bgcolor: '#e0e0e0',
          '& .MuiLinearProgress-bar': { bgcolor: cfg.barColor, borderRadius: 4 },
        }}
      />
    </Box>
  );
};

const RiskAnalysis: React.FC = () => {
  const [results, setResults] = useState<OffboardingResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    offboardingApi
      .getAll()
      .then((res) => setResults(res.data))
      .catch(() => setResults(MOCK_RESULTS))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const criticalCount = results.filter((r) => r.riskLevel === 'CRITICAL').length;
  const highCount = results.filter((r) => r.riskLevel === 'HIGH').length;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Risk Analysis</Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        AI-powered risk scores for resigned employees based on their SaaS access profile
      </Typography>

      {criticalCount > 0 && (
        <Alert severity="error" sx={{ mb: 3 }}>
          ⚠️ {criticalCount} CRITICAL risk account{criticalCount > 1 ? 's' : ''} require immediate attention!
        </Alert>
      )}

      {/* Summary cards */}
      <Grid container spacing={2} mb={4}>
        {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as RiskLevel[]).map((level) => {
          const count = results.filter((r) => r.riskLevel === level).length;
          const cfg = RISK_CONFIG[level];
          return (
            <Grid item xs={6} sm={3} key={level}>
              <Card elevation={2} sx={{ textAlign: 'center', borderTop: `4px solid ${cfg.color}` }}>
                <CardContent>
                  <Typography variant="h4" fontWeight={700} color={cfg.color}>{count}</Typography>
                  <Chip label={level} color={cfg.chipColor} size="small" />
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Risk table */}
      <Typography variant="h6" fontWeight={600} mb={2}>Risk Score Details</Typography>
      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>Employee</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Department</strong></TableCell>
              <TableCell><strong>Permissions Found</strong></TableCell>
              <TableCell><strong>Risk Score</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" py={3}>
                    No offboarding analyses yet. Initiate offboarding for a resigned employee to see results.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              results.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{r.employee.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.employee.employeeId}</Typography>
                  </TableCell>
                  <TableCell>{r.employee.email}</TableCell>
                  <TableCell>{r.employee.department}</TableCell>
                  <TableCell>
                    <Typography>
                      {r.revokedPermissions}/{r.totalPermissions} revoked
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 200 }}>
                    {r.riskScore != null ? (
                      <RiskBadge level={r.riskLevel} score={r.riskScore} />
                    ) : (
                      <Typography color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={r.status}
                      color={
                        r.status === 'COMPLETED' ? 'success' :
                        r.status === 'IN_PROGRESS' ? 'warning' :
                        r.status === 'FAILED' ? 'error' : 'default'
                      }
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Risk model explanation */}
      <Box mt={4}>
        <Typography variant="h6" fontWeight={600} mb={2}>About the Risk Model</Typography>
        <Paper elevation={1} sx={{ p: 3, bgcolor: '#f8f9fa' }}>
          <Typography variant="body2" paragraph>
            ORAM uses an <strong>XGBoost-inspired gradient-boosted decision tree ensemble</strong> to
            calculate risk scores. The model is trained on simulated offboarding scenarios and uses the
            following feature set:
          </Typography>
          <Grid container spacing={2}>
            {[
              { feature: 'Is Admin (40%)', desc: 'Whether the user holds admin privileges on any platform' },
              { feature: 'Is Owner (40%)', desc: 'Whether the user is an organization owner' },
              { feature: 'Has API Token (20%)', desc: 'Presence of active Personal Access Tokens or API keys' },
              { feature: 'Recent Login (15%)', desc: 'Account activity within the past 30 days' },
              { feature: 'Repository Access (15%)', desc: 'Number of repositories the user can access' },
              { feature: 'Multi-platform (10%)', desc: 'Number of connected SaaS platforms with access' },
            ].map((item) => (
              <Grid item xs={12} sm={6} key={item.feature}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>{item.feature}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Box>
    </Box>
  );
};

export default RiskAnalysis;
