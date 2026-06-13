import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { CheckCircle, Cancel, LinkOff, Link as LinkIcon } from '@mui/icons-material';
import { SaaSConnection, SaaSPlatform } from '../types';
import { saasApi } from '../services/api';

const PLATFORM_INFO: Record<SaaSPlatform, { color: string; description: string; icon: string }> = {
  SLACK: { color: '#4A154B', description: 'Team messaging and collaboration platform', icon: '💬' },
  GITHUB: { color: '#24292e', description: 'Code hosting and version control platform', icon: '🐙' },
  NOTION: { color: '#000000', description: 'All-in-one workspace and documentation', icon: '📝' },
};

const MOCK_CONNECTIONS: SaaSConnection[] = [
  { id: 1, platform: 'SLACK', connected: false, workspaceId: null, workspaceName: null, connectedBy: null, lastSyncedAt: null, updatedAt: '2025-06-13T00:00:00' },
  { id: 2, platform: 'GITHUB', connected: true, workspaceId: 'my-org', workspaceName: 'My Organization', connectedBy: 'admin', lastSyncedAt: '2025-06-12T10:00:00', updatedAt: '2025-06-12T10:00:00' },
  { id: 3, platform: 'NOTION', connected: false, workspaceId: null, workspaceName: null, connectedBy: null, lastSyncedAt: null, updatedAt: '2025-06-13T00:00:00' },
];

const SaaSConnections: React.FC = () => {
  const [connections, setConnections] = useState<SaaSConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectDialog, setConnectDialog] = useState<{ open: boolean; platform: SaaSPlatform | null }>({
    open: false, platform: null,
  });
  const [tokenInput, setTokenInput] = useState('');
  const [workspaceInput, setWorkspaceInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchConnections = () => {
    setLoading(true);
    saasApi
      .getAll()
      .then((res) => setConnections(res.data))
      .catch(() => setConnections(MOCK_CONNECTIONS))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchConnections(); }, []);

  const openConnect = (platform: SaaSPlatform) => {
    setConnectDialog({ open: true, platform });
    setTokenInput('');
    setWorkspaceInput('');
    setError(null);
  };

  const handleConnect = async () => {
    if (!connectDialog.platform) return;
    setSaving(true);
    setError(null);
    try {
      await saasApi.connect(connectDialog.platform, {
        accessToken: tokenInput || `demo-token-${connectDialog.platform.toLowerCase()}`,
        workspaceId: workspaceInput,
        workspaceName: workspaceInput,
      });
      setConnectDialog({ open: false, platform: null });
      fetchConnections();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Connection failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async (platform: SaaSPlatform) => {
    try {
      await saasApi.disconnect(platform);
      fetchConnections();
    } catch {
      alert('Failed to disconnect');
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>SaaS Connections</Typography>
      <Typography variant="body1" color="text.secondary" mb={4}>
        Connect your SaaS platforms to enable automated access discovery and revocation
      </Typography>

      <Grid container spacing={3}>
        {connections.map((conn) => {
          const info = PLATFORM_INFO[conn.platform];
          return (
            <Grid item xs={12} sm={6} md={4} key={conn.platform}>
              <Card
                elevation={3}
                sx={{
                  height: '100%',
                  borderTop: `5px solid ${info.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Typography variant="h2" component="span">{info.icon}</Typography>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>{conn.platform}</Typography>
                      <Chip
                        label={conn.connected ? 'Connected' : 'Not Connected'}
                        color={conn.connected ? 'success' : 'default'}
                        size="small"
                        icon={conn.connected ? <CheckCircle /> : <Cancel />}
                      />
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary" mb={2}>
                    {info.description}
                  </Typography>

                  {conn.connected && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      {conn.workspaceName && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          <strong>Workspace:</strong> {conn.workspaceName}
                        </Typography>
                      )}
                      {conn.connectedBy && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          <strong>Connected by:</strong> {conn.connectedBy}
                        </Typography>
                      )}
                      {conn.lastSyncedAt && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          <strong>Last synced:</strong> {new Date(conn.lastSyncedAt).toLocaleString()}
                        </Typography>
                      )}
                    </>
                  )}
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0 }}>
                  {conn.connected ? (
                    <Button
                      startIcon={<LinkOff />}
                      color="error"
                      variant="outlined"
                      fullWidth
                      onClick={() => handleDisconnect(conn.platform)}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      startIcon={<LinkIcon />}
                      variant="contained"
                      fullWidth
                      sx={{ bgcolor: info.color, '&:hover': { bgcolor: `${info.color}cc` } }}
                      onClick={() => openConnect(conn.platform)}
                    >
                      Connect
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Connect Dialog */}
      <Dialog
        open={connectDialog.open}
        onClose={() => setConnectDialog({ open: false, platform: null })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Connect {connectDialog.platform}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Alert severity="info">
            In production, clicking Connect would redirect you to {connectDialog.platform}'s OAuth
            authorization page. For this demo, enter a mock access token.
          </Alert>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Access Token (OAuth)"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Paste your OAuth access token"
            helperText="Leave blank to use a demo token"
            multiline
            rows={2}
          />
          <TextField
            label="Workspace / Organization ID"
            value={workspaceInput}
            onChange={(e) => setWorkspaceInput(e.target.value)}
            placeholder="e.g. my-org or T1234ABCD"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectDialog({ open: false, platform: null })}>Cancel</Button>
          <Button onClick={handleConnect} variant="contained" disabled={saving}>
            {saving ? <CircularProgress size={18} /> : 'Connect'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SaaSConnections;
