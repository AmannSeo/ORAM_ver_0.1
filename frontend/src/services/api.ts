import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('oram_token');
  if (token) {
    config.headers.Authorization = 'Bearer ' + token;
  }
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('oram_token');
      localStorage.removeItem('oram_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getStats: () => api.get('/dashboard/stats'),
};

// ── Employees ─────────────────────────────────────────────────────────────────

export const employeesApi = {
  getAll: () => api.get('/employees'),
  getById: (id: number) => api.get(`/employees/${id}`),
  create: (data: any) => api.post('/employees', data),
  update: (id: number, data: any) => api.put(`/employees/${id}`, data),
  delete: (id: number) => api.delete(`/employees/${id}`),
};

// ── SaaS Connections ─────────────────────────────────────────────────────────

export const saasApi = {
  getAll: () => api.get('/saas/connections'),
  getOne: (platform: string) => api.get(`/saas/connections/${platform}`),
  connect: (platform: string, payload: any) =>
    api.post(`/saas/connections/${platform}/connect`, payload),
  disconnect: (platform: string) =>
    api.post(`/saas/connections/${platform}/disconnect`),
  getOAuthUrl: (platform: string) =>
    api.get(`/saas/oauth2/authorize/${platform}`),
};

// ── Offboarding ───────────────────────────────────────────────────────────────

export const offboardingApi = {
  getAll: () => api.get('/offboarding'),
  getById: (id: number) => api.get(`/offboarding/${id}`),
  getForEmployee: (employeeId: number) =>
    api.get(`/offboarding/employee/${employeeId}`),
  initiate: (employeeId: number) =>
    api.post(`/offboarding/initiate/${employeeId}`),
  revokeAll: (id: number) => api.post(`/offboarding/${id}/revoke-all`),
};

export default api;
