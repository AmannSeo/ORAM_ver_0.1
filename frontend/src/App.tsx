import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { useAuthStore } from './store/authStore';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import SaasConnections from './pages/SaasConnections';
import RiskAnalysis from './pages/RiskAnalysis';
import Offboarding from './pages/Offboarding';
import OffboardingDetail from './pages/OffboardingDetail';
import HelpGuide from './pages/HelpGuide';

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0' },
    secondary: { main: '#7b1fa2' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
  },
  shape: { borderRadius: 8 },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={<RequireAuth><Layout /></RequireAuth>}
          >
            <Route index element={<Dashboard />} />
            <Route path="employees" element={<Employees />} />
            <Route path="employees/:id" element={<Employees />} />
            <Route path="saas-connections" element={<SaasConnections />} />
            <Route path="risk-analysis" element={<RiskAnalysis />} />
            <Route path="offboarding" element={<Offboarding />} />
            <Route path="offboarding/:resultId" element={<OffboardingDetail />} />
            <Route path="help" element={<HelpGuide />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
