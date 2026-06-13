// ============================================================
// ORAM Frontend Types
// ============================================================

export type UserRole = 'ADMIN' | 'SECURITY_MANAGER' | 'AUDITOR';
export type EmployeeStatus = 'ACTIVE' | 'RESIGNED';
export type SaasType = 'SLACK' | 'GITHUB' | 'NOTION';
export type OffboardingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Auth
export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresIn: number;
  user: UserInfo;
}

// Dashboard
export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  resignedEmployees: number;
  connectedSaasCount: number;
  criticalRiskCount: number;
  pendingOffboardings: number;
}

// Employee
export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  status: EmployeeStatus;
  createdAt: string;
}

export interface EmployeePageResponse {
  content: Employee[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface CreateEmployeeRequest {
  employeeId: string;
  name: string;
  email: string;
  department: string;
}

// SaaS Connection
export interface SaasConnection {
  id?: string;
  saasType: SaasType;
  workspaceName?: string;
  isConnected: boolean;
  connectedAt?: string;
  connectedBy?: string;
}

// Offboarding
export interface OffboardingSummary {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  status: OffboardingStatus;
  riskScore?: number;
  riskLevel?: RiskLevel;
  startedAt?: string;
  revokedAll: boolean;
}

export interface PermissionInfo {
  saasType: SaasType;
  permissionType: string;
  resourceName?: string;
  isAdmin: boolean;
  isOwner: boolean;
  hasApiToken: boolean;
  recentLogin: boolean;
  repoCount: number;
  workspaceCount: number;
}

export interface OffboardingDetail extends OffboardingSummary {
  permissions: PermissionInfo[];
  recommendedActions: string[];
  completedAt?: string;
}

// Risk
export interface RiskScoreRequest {
  isAdmin: boolean;
  isOwner: boolean;
  hasApiToken: boolean;
  recentLogin: boolean;
  repoCount: number;
  workspaceCount: number;
}

export interface RiskScoreResponse {
  score: number;
  level: RiskLevel;
  breakdown: {
    adminWeight: number;
    ownerWeight: number;
    apiTokenWeight: number;
    recentLoginWeight: number;
    repoWeight: number;
    workspaceWeight: number;
  };
}
