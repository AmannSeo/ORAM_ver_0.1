import axios, { AxiosHeaders } from 'axios';
import { useAuthStore } from '../store/authStore';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: JWT 토큰 자동 첨부
api.interceptors.request.use((config) => {
  const requestUrl = typeof config.url === 'string' ? config.url : '';
  const isAuthLoginRequest = requestUrl.includes('/auth/login');
  if (isAuthLoginRequest) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Authorization');
      config.headers.delete('X-ORAM-Auth-Token');
    }
    return config;
  }

  const token = useAuthStore.getState().token;
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
      config.headers.set('X-ORAM-Auth-Token', token);
    } else {
      const headers = AxiosHeaders.from(config.headers);
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('X-ORAM-Auth-Token', token);
      config.headers = headers;
    }
  }
  return config;
});

// Response interceptor: 401 시 자동 로그아웃
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
