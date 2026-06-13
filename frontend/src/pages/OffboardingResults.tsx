import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  LinearProgress,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  LockOpen,
  Lock,
  Lightbulb,
} from '@mui/icons-material';
import { OffboardingResult, Permission, RiskLevel } from '../types';
import { offboardingApi } from '../services/api';

const RISK_COLORS: Record<RiskLevel, string> = {
  CRITICAL: '#c62828',
  HIGH: '#e65100',
  MEDIUM: '#f57c00',
  LOW: '#388e3c',
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
    permissions: [
      {
        id: 1, platform: 'SLACK', permissionType: 'MEMBER', permissionDetail: 'Slack Workspace Member',
        isAdmin: false, isOwner: false, hasApiToken: false, revokeStatus: 'REVOKED',
        revokedAt: '2025-06-01T10:05:00', discoveredAt: '2025-06-01T10:00:00',
      },
      {
        id: 2, platform: 'SLACK', permissionType: 'ADMIN', permissionDetail: 'Slack Workspace Admin',
        isAdmin: true, isOwner: false, hasApiToken: false, revokeStatus: 'REVOKED',
        revokedAt: '2025-06-01T10:05:00', discoveredAt: '2025-06-01T10:00:00',
      },
      {
        id: 3, platform: 'GITHUB', permissionType: 'REPOSITORY_ACCESS', permissionDetail: 'Access to 5 private repos',
        isAdmin: false, isOwner: false, hasApiToken: true, revokeStatus: 'REVOKED',
        revokedAt: '2025-06-01T10:05:00', discoveredAt: '2025-06-01T10:00:00',
      },
      {
        id: 4, platform: 'GITHUB', permissionType: 'ORGANIZATION_OWNER', permissionDetail: 'GitHub Org Owner',
        isAdmin: true, isOwner: true, hasApiToken: true, revokeStatus: 'REVOKED',
        revokedAt: '2025-06-01T10:05:00', discoveredAt: '2025-06-01T10:00:00',
      },
      {
        id: 5, platform: 'NOTION', permissionType: 'WORKSPACE_MEMBER', permissionDetail: 'Notion Workspace Member',
        isAdmin: false, isOwner: false, hasApiToken: false, revokeStatus: 'REVOKED',
        revokedAt: '2025-06-01T10:05:00', discoveredAt: '2025-06-01T10:00:00',
      },
    ],
    recommendedActions: [
      'Transfer GitHub Organization ownership before revoking access',
      'Remove admin privileges before deactivating account',
      'Revoke all Personal Access Tokens (PATs) and API keys',
      'Verify all shared credentials have been rotated',
      'Archive employee\'s data according to retention policy',
    ],
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
    permissions: [
      {
        id: 6, platform: 'GITHUB', permissionType: 'REPOSITORY_ACCESS', permissionDetail: 'Access to 5 private repos',
        isAdmin: false, isOwner: false, hasApiToken: true, revokeStatus: 'PENDING',
        revokedAt: null, discoveredAt: '2025-05-20T11:00:00',
      },
      {
        id: 7, platform: 'NOTION', permissionType: 'WORKSPACE_MEMBER', permissionDetail: 'Notion Workspace Member',
        isAdmin: false, isOwner: false, hasApiToken: false, revokeStatus: 'PENDING',
        revokedAt: null, discoveredAt: '2025-05-20T11:00:00',
      },
    ],
    recommendedActions: [
      'Revoke all Personal Access Tokens (PATs) and API keys',
      'Verify all shared credentials have been rotated',
      'Archive employee\'s data according to retention policy',
    ],
  },
];

const PermissionRow: React.FC<{ permission: Permission }> = ({ permission: p }) => (
  <TableRow>
    <TableCell>
      <Chip label={p.platform} size="small" variant="outlined" />
    </TableCell>
    <TableCell>{p.permissionType}</TableCell>
    <TableCell>{p.permissionDetail}</TableCell>
    <TableCell>
      {p.isAdmin && <Chip label="Admin" size="small" color="warning" sx={{ mr: 0.5 }} />}
      {p.isOwner && <Chip label="Owner" size="small" color="error" sx={{ mr: 0.5 }} />}
      {p.hasApiToken && <Chip label="API Token" size="small" color="info" />}
    </TableCell>
    <TableCell>
      <Chip
        label={p.revokeStatus}
        size="small"
        color={
          p.revokeStatus === 'REVOKED' ? 'success' :
          p.revokeStatus === 'FAILED' ? 'error' :
          p.revokeStatus === 'PENDING' ? 'default' : 'warning'
        }
        icon={p.revokeStatus === 'REVOKED' ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
      />
    </TableCell>
  </TableRow>
);

const OffboardingResults: React.FC = () => {
  const [results, setResults] = useState<OffboardingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState<OffboardingResult | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchResults = () => {
    setLoading(true);
    offboardingApi
      .getAll()
      .then((res) => setResults(res.data))
      .catch(() => setResults(MOCK_RESULTS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchResults(); }, []);

  const handleRevokeAll = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await offboardingApi.revokeAll(revokeTarget.id);
      setResults((prev) => prev.map((r) => r.id === revokeTarget.id ? res.data : r));
    } catch {
      alert('Revocation failed');
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Offboarding Results</Typography>
      <Typography variant="body1" color="text.secondary" mb={3}>
        Review discovered permissions and revoke access for resigned employees
      </Typography>

      {results.length === 0 ? (
        <Alert severity="info">
          No offboarding results yet. Go to the <strong>Employees</strong> page to initiate offboarding
          for a resigned employee.
        </Alert>
      ) : (
        results.map((result) => {
          const riskColor = RISK_COLORS[result.riskLevel] ?? '#757575';
          const isCompleted = result.status === 'COMPLETED';
          const progress = result.totalPermissions > 0
            ? (result.revokedPermissions / result.totalPermissions) * 100
            : 0;

          return (
            <Card key={result.id} elevation={3} sx={{ mb: 3, borderLeft: `6px solid ${riskColor}` }}>
              <CardContent>
                {/* Employee info */}
                <Grid container spacing={2} alignItems="center" mb={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" fontWeight={700}>{result.employee.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {result.employee.employeeId} · {result.employee.email} · {result.employee.department}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6} sx={{ display: 'flex', gap: 1, justifyContent: { md: 'flex-end' } }}>
                    <Chip
                      label={`Risk: ${result.riskLevel} (${result.riskScore})`}
                      sx={{ bgcolor: riskColor, color: 'white', fontWeight: 700 }}
                    />
                    <Chip
                      label={result.status}
                      color={
                        isCompleted ? 'success' :
                        result.status === 'IN_PROGRESS' ? 'warning' :
                        result.status === 'FAILED' ? 'error' : 'default'
                      }
                    />
                  </Grid>
                </Grid>

                {/* Progress bar */}
                <Box mb={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">Revocation Progress</Typography>
                    <Typography variant="body2" fontWeight={600}>
                      {result.revokedPermissions}/{result.totalPermissions} permissions revoked
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    color={isCompleted ? 'success' : 'primary'}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>

                {/* Permissions accordion */}
                <Accordion elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Typography fontWeight={600}>
                      Discovered Permissions ({result.permissions.length})
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 0 }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: 'grey.50' }}>
                            <TableCell>Platform</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Detail</TableCell>
                            <TableCell>Flags</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.permissions.map((p) => <PermissionRow key={p.id} permission={p} />)}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </AccordionDetails>
                </Accordion>

                {/* Recommended actions */}
                {result.recommendedActions?.length > 0 && (
                  <Box mt={2}>
                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                      <Lightbulb fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5, color: 'warning.main' }} />
                      Recommended Actions
                    </Typography>
                    <List dense>
                      {result.recommendedActions.map((action, i) => (
                        <ListItem key={i} disablePadding>
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <Warning fontSize="small" color="warning" />
                          </ListItemIcon>
                          <ListItemText primary={action} primaryTypographyProps={{ variant: 'body2' }} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                )}
              </CardContent>

              <Divider />

              <CardActions sx={{ p: 2, justifyContent: 'flex-end' }}>
                {isCompleted ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircle color="success" />
                    <Typography color="success.main" fontWeight={600}>
                      All access revoked on {result.completedAt ? new Date(result.completedAt).toLocaleString() : ''}
                    </Typography>
                  </Box>
                ) : (
                  <Button
                    variant="contained"
                    color="error"
                    startIcon={<Lock />}
                    onClick={() => setRevokeTarget(result)}
                    size="large"
                  >
                    Revoke All Access
                  </Button>
                )}
              </CardActions>
            </Card>
          );
        })
      )}

      {/* Revoke confirmation dialog */}
      <Dialog open={!!revokeTarget} onClose={() => !revoking && setRevokeTarget(null)}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ErrorIcon color="error" />
            Confirm Revocation
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to revoke <strong>ALL</strong> SaaS access for{' '}
            <strong>{revokeTarget?.employee.name}</strong> ({revokeTarget?.employee.email}).
          </DialogContentText>
          <DialogContentText sx={{ mt: 1 }}>
            This will remove {revokeTarget?.totalPermissions} permission(s) across all connected platforms.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)} disabled={revoking}>Cancel</Button>
          <Button onClick={handleRevokeAll} variant="contained" color="error" disabled={revoking}>
            {revoking ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            Revoke All Access
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OffboardingResults;
