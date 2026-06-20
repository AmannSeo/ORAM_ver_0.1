import api from './axios';
import { useAuthStore } from '../store/authStore';
import type {
  DashboardStats,
  SaasSyncAlert,
  Employee,
  EmployeePageResponse,
  CreateEmployeeRequest,
  SaasConnection,
  SaasIdentity,
  SaasSyncUsersResponse,
  SaasType,
  OffboardingSummary,
  OffboardingDetail,
  RevokePlanResponse,
  RevokePlanItem,
  RiskScoreRequest,
  RiskScoreResponse,
} from '../types';

export const dashboardApi = {
  getStats: () => api.get<DashboardStats>('/dashboard/stats').then((r) => r.data),
  getSaasSyncAlerts: (limit = 5) =>
    api.get<SaasSyncAlert[]>('/dashboard/saas-sync-alerts', { params: { limit } }).then((r) => r.data),
};

export const employeeApi = {
  getAll: (params?: { status?: string; department?: string; saasType?: SaasType; q?: string; page?: number; size?: number }) =>
    api.get<EmployeePageResponse>('/employees', { params }).then((r) => r.data),
  getById: (id: string) => api.get<Employee>(`/employees/${id}`).then((r) => r.data),
  create: (data: CreateEmployeeRequest) =>
    api.post<Employee>('/employees', data).then((r) => r.data),
  update: (id: string, data: Partial<Employee>) =>
    api.put<Employee>(`/employees/${id}`, data).then((r) => r.data),
  resign: (id: string) =>
    api.put<{ message: string; offboardingResultId: string }>(`/employees/${id}/resign`).then((r) => r.data),
  analyze: (id: string) => {
    const token = useAuthStore.getState().token;
    return api.post<{ message: string; offboardingResultId: string }>(
      `/employees/${id}/analyze`,
      {},
      token
        ? {
            headers: {
              Authorization: `Bearer ${token}`,
              'X-ORAM-Auth-Token': token,
            },
          }
        : undefined
    ).then((r) => r.data);
  },
  delete: (id: string) => api.delete(`/employees/${id}`),
  deleteAll: () => api.post<{ message: string; deletedCount: number }>('/employees/delete-all').then((r) => r.data),
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
  tokenConnect: (saasType: SaasType, token: string, workspaceName?: string) =>
    api.post<SaasConnection>(`/saas-connections/token-connect/${saasType}`, { token, workspaceName }).then((r) => r.data),
  demoConnect: (saasType: SaasType) =>
    api.post<SaasConnection>(`/saas-connections/demo-connect/${saasType}`).then((r) => r.data),
  syncUsers: (saasType: SaasType) =>
    api.post<SaasSyncUsersResponse>(`/saas-connections/${saasType}/sync`).then((r) => r.data),
  getIdentities: (saasType: SaasType) =>
    api.get<SaasIdentity[]>(`/saas-connections/${saasType}/identities`).then((r) => r.data),
  disconnect: (saasType: SaasType) => api.delete(`/saas-connections/${saasType}`),
};

export const offboardingApi = {
  getAll: () => api.get<OffboardingSummary[]>('/offboarding').then((r) => r.data),
  getById: (id: string) => api.get<OffboardingDetail>(`/offboarding/${id}`).then((r) => r.data),
  getRevokePlan: (id: string) =>
    api.get<RevokePlanResponse>(`/offboarding/${id}/revoke-plan`).then((r) => r.data),
  revokeAll: (id: string) =>
    api.post<{ message: string; revokedAt: string; revokedSaas: SaasType[]; items: RevokePlanItem[] }>(`/offboarding/${id}/revoke-all`).then((r) => r.data),
};

export const riskApi = {
  calculateScore: (data: RiskScoreRequest) =>
    api.post<RiskScoreResponse>('/risk-analysis/score', data).then((r) => r.data),
};
