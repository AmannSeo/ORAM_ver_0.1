import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Lock, Visibility, VisibilityOff, Shield } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ?? 'Invalid credentials. Try admin / Admin1234!'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#1e2a3a',
      }}
    >
      <Card elevation={8} sx={{ width: 400, borderRadius: 3 }}>
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Shield sx={{ fontSize: 56, color: '#1976d2' }} />
            <Typography variant="h4" fontWeight={800} color="primary">
              ORAM
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Agentless SaaS Access Management
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Alert severity="info" sx={{ mb: 3 }} icon={<Lock fontSize="small" />}>
            <Typography variant="caption">
              Demo credentials: <strong>admin</strong> / <strong>Admin1234!</strong>
            </Typography>
          </Alert>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
              autoFocus
              autoComplete="username"
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="current-password"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 2, py: 1.5, fontWeight: 700 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </form>

          <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
              <strong>Available accounts:</strong>
            </Typography>
            {[
              { user: 'admin', pass: 'Admin1234!', role: 'ADMIN' },
              { user: 'security_mgr', pass: 'Security1234!', role: 'SECURITY_MANAGER' },
              { user: 'auditor', pass: 'Auditor1234!', role: 'AUDITOR' },
            ].map((a) => (
              <Typography key={a.user} variant="caption" color="text.secondary" display="block">
                {a.user} / {a.pass} ({a.role})
              </Typography>
            ))}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default Login;
