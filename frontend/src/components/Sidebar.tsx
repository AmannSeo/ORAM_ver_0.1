import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
} from '@mui/material';
import {
  Dashboard,
  People,
  Cloud,
  Security,
  Assignment,
  Shield,
} from '@mui/icons-material';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <Dashboard /> },
  { label: 'Employees', path: '/employees', icon: <People /> },
  { label: 'SaaS Connections', path: '/saas', icon: <Cloud /> },
  { label: 'Risk Analysis', path: '/risk', icon: <Security /> },
  { label: 'Offboarding', path: '/offboarding', icon: <Assignment /> },
];

interface SidebarProps {
  width: number;
}

const Sidebar: React.FC<SidebarProps> = ({ width }) => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width,
          boxSizing: 'border-box',
          bgcolor: '#1e2a3a',
          color: 'white',
        },
      }}
    >
      {/* Logo */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Shield sx={{ color: '#4fc3f7', fontSize: 32 }} />
        <Box>
          <Typography variant="h6" fontWeight={800} color="white" lineHeight={1}>
            ORAM
          </Typography>
          <Typography variant="caption" sx={{ color: '#90caf9' }}>
            Access Management
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)' }} />

      {/* Navigation */}
      <List sx={{ pt: 2 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path));

          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 1,
                  borderRadius: 2,
                  bgcolor: isActive ? 'rgba(79, 195, 247, 0.15)' : 'transparent',
                  borderLeft: isActive ? '3px solid #4fc3f7' : '3px solid transparent',
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.08)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isActive ? '#4fc3f7' : 'rgba(255,255,255,0.6)',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? '#4fc3f7' : 'rgba(255,255,255,0.8)',
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer */}
      <Box sx={{ mt: 'auto', p: 2 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)' }}>
          ORAM v0.1.0 PoC
        </Typography>
      </Box>
    </Drawer>
  );
};

export default Sidebar;
