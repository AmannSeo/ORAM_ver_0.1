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
  { label: 'SaaS 연결 관리', path: '/saas-connections', icon: <CloudIcon /> },
  { label: 'AI 리스크 분석', path: '/risk-analysis', icon: <SecurityIcon /> },
  { label: '오프보딩 결과', path: '/offboarding', icon: <AssignmentIcon /> },
  { label: '도움말 & 가이드', path: '/help', icon: <HelpIcon /> },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '관리자',
  SECURITY_MANAGER: '보안 담당자',
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
            bgcolor: '#2563eb',
            mr: 1.5,
          }}
        >
          <ShieldIcon sx={{ color: 'white', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" fontWeight="bold" color="white" lineHeight={1.1}>
            ORAM
          </Typography>
          <Typography variant="caption" color="#94a3b8">
            Access Control
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
                    bgcolor: '#2563eb',
                    boxShadow: '0 10px 24px rgba(37, 99, 235, 0.28)',
                  },
                  '&.Mui-selected:hover': { bgcolor: '#1d4ed8' },
                  '&:hover': { bgcolor: selected ? '#1d4ed8' : 'rgba(148, 163, 184, 0.12)' },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontWeight: selected ? 800 : 600, fontSize: 14 }}
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
          <Typography variant="body2" fontWeight="bold" color="white" noWrap>
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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      <AppBar position="fixed" elevation={0} sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#2563eb' }}>
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setMobileOpen(!mobileOpen)}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <ShieldIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 800 }}>
            ORAM 퇴사자 접근 권한 관리
          </Typography>
          <Tooltip title="계정 정보">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
              <Avatar sx={{ width: 32, height: 32, bgcolor: '#0f172a', fontSize: '0.85rem', fontWeight: 800 }}>
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
                <Avatar sx={{ width: 42, height: 42, bgcolor: '#2563eb', fontWeight: 800 }}>
                  {user?.name?.charAt(0)}
                </Avatar>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight={800} noWrap>
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
