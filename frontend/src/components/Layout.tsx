import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  Chip,
} from '@mui/material';
import { Logout, AccountCircle } from '@mui/icons-material';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const SIDEBAR_WIDTH = 240;

interface LayoutProps {
  children: React.ReactNode;
}

const roleColor: Record<string, 'error' | 'warning' | 'info'> = {
  ADMIN: 'error',
  SECURITY_MANAGER: 'warning',
  AUDITOR: 'info',
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <Sidebar width={SIDEBAR_WIDTH} />

      {/* Main content area */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <AppBar
          position="fixed"
          sx={{ ml: `${SIDEBAR_WIDTH}px`, width: `calc(100% - ${SIDEBAR_WIDTH}px)`, zIndex: 1200 }}
          elevation={1}
        >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 700 }}>
              ORAM
            </Typography>

            {user && (
              <Chip
                label={user.role.replace('_', ' ')}
                color={roleColor[user.role] ?? 'default'}
                size="small"
                sx={{ mr: 2 }}
              />
            )}

            <Tooltip title={user?.fullName ?? user?.username ?? 'Account'}>
              <IconButton onClick={handleMenuOpen} color="inherit">
                <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: '0.875rem' }}>
                  {user?.fullName?.[0]?.toUpperCase() ?? 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>

            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
              <MenuItem disabled>
                <AccountCircle sx={{ mr: 1 }} />
                {user?.email}
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleMenuClose();
                  logout();
                }}
              >
                <Logout sx={{ mr: 1 }} fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        {/* Page content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            mt: 8,
            ml: `${SIDEBAR_WIDTH}px`,
            bgcolor: 'grey.50',
            minHeight: '100vh',
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
