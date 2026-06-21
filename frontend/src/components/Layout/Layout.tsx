import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Assignment as AssignmentIcon,
  Cloud as CloudIcon,
  Dashboard as DashboardIcon,
  Help as HelpIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  Shield as ShieldIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../../store/authStore';

const DRAWER_WIDTH = 248;

const NAV_ITEMS = [
  { label: '대시보드', path: '/', icon: <DashboardIcon /> },
  { label: '직원 권한 관리', path: '/employees', icon: <PeopleIcon /> },
  { label: 'AI 리스크 분석', path: '/risk-analysis', icon: <SecurityIcon /> },
  { label: '권한 회수 대상', path: '/offboarding', icon: <AssignmentIcon /> },
  { label: 'SaaS 연결 관리', path: '/saas-connections', icon: <CloudIcon /> },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '관리자',
  SECURITY_MANAGER: '보안 관리자',
  AUDITOR: '감사자',
};

const formatLoginAt = (loginAt?: string | null) => {
  if (!loginAt) return '-';
  return new Date(loginAt).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loginAt, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f172a', color: '#e5e7eb' }}>
      <Toolbar sx={{ minHeight: 64 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: '#334155',
            border: '1px solid rgba(255,255,255,0.1)',
            mr: 1.5,
          }}
        >
          <ShieldIcon sx={{ color: 'white', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight={700} color="white" lineHeight={1.1}>
            ORAM
          </Typography>
          <Typography variant="caption" color="#94a3b8">
            Security Offboarding
          </Typography>
        </Box>
      </Toolbar>

      <List sx={{ px: 1.5, py: 1 }}>
        {NAV_ITEMS.map((item) => {
          const selected = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={selected}
                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                sx={{
                  borderRadius: 1.5,
                  color: selected ? '#ffffff' : '#cbd5e1',
                  '& .MuiListItemIcon-root': { color: selected ? '#ffffff' : '#94a3b8', minWidth: 38 },
                  '&.Mui-selected': {
                    bgcolor: '#1e293b',
                    boxShadow: 'none',
                  },
                  '&.Mui-selected:hover': { bgcolor: '#1e293b' },
                  '&:hover': { bgcolor: selected ? '#1e293b' : 'rgba(148, 163, 184, 0.12)' },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: selected ? 600 : 500, fontSize: 14 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ mt: 'auto', p: 2 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(148, 163, 184, 0.18)' }}>
          <Typography variant="caption" color="#94a3b8">
            Signed in as
          </Typography>
          <Typography variant="body2" fontWeight={600} color="white" noWrap>
            {user?.name || '-'}
          </Typography>
          <Typography variant="caption" color="#94a3b8">
            {ROLE_LABELS[user?.role || ''] || user?.role || '-'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f1f5f9' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer - 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: '#ffffff',
          color: '#0f172a',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 }, px: { xs: 2, sm: 3 } }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="body2"
            component="div"
            sx={{ flexGrow: 1, fontWeight: 500, color: '#64748b', display: { xs: 'none', md: 'block' } }}
          >
            오프보딩 / <Box component="span" sx={{ color: '#334155' }}>직원 권한 관리</Box>
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'block', md: 'none' } }}>
            <Typography variant="subtitle2" fontWeight={700}>ORAM</Typography>
          </Box>
          <Tooltip title="도움말 & 가이드">
            <IconButton onClick={() => navigate('/help')} color="inherit" sx={{ mr: 0.5 }}>
              <HelpIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="계정 정보">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#0f172a', fontSize: '0.85rem', fontWeight: 600 }}>
                {user?.name?.charAt(0)}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ sx: { width: 292, borderRadius: 2 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Avatar sx={{ width: 42, height: 42, bgcolor: '#2563eb', fontWeight: 600 }}>
                  {user?.name?.charAt(0)}
                </Avatar>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight={600} noWrap>
                    {user?.name || '-'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {user?.email || '-'}
                  </Typography>
                </Box>
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="caption" color="text.secondary">권한</Typography>
                <Chip
                  label={ROLE_LABELS[user?.role || ''] || user?.role || '-'}
                  size="small"
                  color={user?.role === 'ADMIN' ? 'primary' : 'default'}
                />
              </Box>
              <Box display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="caption" color="text.secondary" flexShrink={0}>로그인 시간</Typography>
                <Typography variant="caption" textAlign="right">
                  {formatLoginAt(loginAt)}
                </Typography>
              </Box>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
              로그아웃
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 0 } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, md: 3 },
          pt: 3,
          pb: 3,
          mt: { xs: '56px', sm: '64px' },
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minWidth: 0,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
