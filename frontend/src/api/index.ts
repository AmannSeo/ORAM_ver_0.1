import api from './axios';
import type {
  DashboardStats,
  Employee,
  EmployeePageResponse,
  CreateEmployeeRequest,
  SaasConnection,
  SaasType,
  OffboardingSummary,
  OffboardingDetail,
  RiskScoreRequest,
  RiskScoreResponse,
} from '../types';

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats').then((r) => r.data),
};

export const employeeApi = {
  getAll: (params?: { status?: string; department?: string; page?: number; size?: number }) =>
    api.get<EmployeePageResponse>('/employees', { params }).then((r) => r.data),
  getById: (id: string) => api.get<Employee>(`/employees/${id}`).then((r) => r.data),
  create: (data: CreateEmployeeRequest) =>
    api.post<Employee>('/employees', data).then((r) => r.data),
  update: (id: string, data: Partial<Employee>) =>
    api.put<Employee>(`/employees/${id}`, data).then((r) => r.data),
  resign: (id: string) =>
    api.put<{ message: string; offboardingResultId: string }>(`/employees/${id}/resign`).then((r) => r.data),
  delete: (id: string) => api.delete(`/employees/${id}`),
  csvImport: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{
      importedCount: number;
      skippedCount: number;
      errorCount: number;
      imported: string[];
      skipped: string[];
      errors: string[];
    }>('/employees/csv-import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

export const saasApi = {
  getAll: () => api.get<SaasConnection[]>('/saas-connections').then((r) => r.data),
  getOAuthUrl: (saasType: SaasType) =>
    api.get<{ authorizationUrl: string }>(`/saas-connections/oauth/authorize/${saasType}`).then((r) => r.data),
  demoConnect: (saasType: SaasType) =>
    api.post<SaasConnection>(`/saas-connections/demo-connect/${saasType}`).then((r) => r.data),
  disconnect: (saasType: SaasType) => api.delete(`/saas-connections/${saasType}`),
};

export const offboardingApi = {
  getAll: () => api.get<OffboardingSummary[]>('/offboarding').then((r) => r.data),
  getById: (id: string) => api.get<OffboardingDetail>(`/offboarding/${id}`).then((r) => r.data),
  revokeAll: (id: string) =>
    api.post<{ message: string; revokedAt: string; revokedSaas: SaasType[] }>(`/offboarding/${id}/revoke-all`).then((r) => r.data),
};

export const riskApi = {
  calculateScore: (data: RiskScoreRequest) =>
    api.post<RiskScoreResponse>('/risk-analysis/score', data).then((r) => r.data),
};
