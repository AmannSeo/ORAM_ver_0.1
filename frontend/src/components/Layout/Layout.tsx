import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Box, Drawer, AppBar, Toolbar, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, Typography, IconButton, Avatar,
  Divider, Tooltip, Menu, MenuItem, Chip,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Cloud as CloudIcon,
  Security as SecurityIcon,
  Assignment as AssignmentIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Shield as ShieldIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { useAuthStore } from '../../store/authStore';

const DRAWER_WIDTH = 240;

const NAV_ITEMS = [
  { label: '대시보드', path: '/', icon: <DashboardIcon /> },
  { label: '직원 관리', path: '/employees', icon: <PeopleIcon /> },
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
    <Box>
      <Toolbar sx={{ bgcolor: 'primary.main' }}>
        <ShieldIcon sx={{ color: 'white', mr: 1 }} />
        <Typography variant="h6" fontWeight="bold" color="white">
          ORAM
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  '& .MuiListItemIcon-root': { color: 'common.white' },
                  '& .MuiListItemText-primary': { color: 'common.white', fontWeight: 700 },
                },
                '&.Mui-selected:hover': {
                  bgcolor: 'primary.dark',
                  color: 'common.white',
                  '& .MuiListItemIcon-root': { color: 'common.white' },
                  '& .MuiListItemText-primary': { color: 'common.white' },
                },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Signed in as
        </Typography>
        <Typography variant="body2" fontWeight="bold">
          {user?.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {user?.role?.replace('_', ' ')}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
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
          <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            ORAM — 퇴사자 접근 권한 관리
          </Typography>
          <Tooltip title="Account">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} color="inherit">
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: '0.8rem' }}>
                {user?.name?.charAt(0)}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{ sx: { width: 280 } }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Box display="flex" alignItems="center" gap={1.5} mb={1.5}>
                <Avatar sx={{ width: 40, height: 40, bgcolor: 'secondary.main' }}>
                  {user?.name?.charAt(0)}
                </Avatar>
                <Box minWidth={0}>
                  <Typography variant="subtitle2" fontWeight={700} noWrap>
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
          sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: 3,
          pt: 2,
          pb: 3,
          mt: { xs: '56px', sm: '64px' },
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
