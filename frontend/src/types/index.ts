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
  openSaasSyncAlerts: number;
}

export interface SaasSyncAlert {
  id: string;
  saasType: SaasType;
  status: 'OPEN' | 'RESOLVED';
  reason: string;
  detail: string;
  externalUsername?: string;
  externalEmail?: string;
  displayName?: string;
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  createdAt: string;
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
  resignedAt?: string;
  connectedSaas?: EmployeeSaasAccount[];
}

export interface EmployeeSaasAccount {
  id: string;
  saasType: SaasType;
  externalUsername?: string;
  externalEmail?: string;
  displayName?: string;
  status?: EmployeeStatus;
  accessRevoked: boolean;
  hasRevokePermission: boolean;
  lastSyncedAt?: string;
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
  status?: EmployeeStatus;
}

// SaaS Connection
export interface SaasConnection {
  id?: string;
  saasType: SaasType;
  workspaceName?: string;
  accountScope?: 'PERSONAL' | 'ORGANIZATION' | 'ENTERPRISE' | 'WORKSPACE' | string;
  enterpriseAccount?: boolean;
  isConnected: boolean;
  connectedAt?: string;
  connectedBy?: string;
  identityCount?: number;
  lastSyncedAt?: string;
  openAlertCount?: number;
}

export interface SaasSyncUsersResponse {
  message: string;
  syncedCount: number;
  totalFound: number;
  missingCount: number;
  inactiveCount: number;
  resolvedAlertCount: number;
  warnings: string[];
}

export interface SaasIdentity {
  id: string;
  saasType: SaasType;
  externalUserId: string;
  externalUsername?: string;
  externalEmail?: string;
  displayName?: string;
  department?: string;
  status?: EmployeeStatus;
  accessRevoked: boolean;
  lastSyncedAt?: string;
  employeeId?: string;
  employeeName?: string;
  employeeEmail?: string;
  employeeStatus?: EmployeeStatus;
}

// Offboarding
export interface OffboardingSummary {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string;
    resignedAt?: string;
  };
  status: OffboardingStatus;
  riskScore?: number;
  riskLevel?: RiskLevel;
  analysisSource?: 'MANUAL' | 'AUTOMATIC' | string;
  analysisTrigger?: string;
  analysisEngine?: string;
  startedAt?: string;
  revokedAll: boolean;
  falsePositive: boolean;
  falsePositiveReason?: string;
  falsePositiveAt?: string;
  completedAt?: string;
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
  anomalyScore?: number;
  riskBreakdown?: RiskScoreResponse['breakdown'];
  riskExplanations?: RiskScoreResponse['explanations'];
  permissions: PermissionInfo[];
  recommendedActions: string[];
  completedAt?: string;
}

export interface RevokePlanItem {
  saasType: SaasType;
  status: 'READY' | 'MANUAL' | 'NO_ACCOUNT' | 'REVOKED' | 'FAILED' | string;
  canRevoke: boolean;
  accountMatched: boolean;
  resourceCount: number;
  action: string;
  reason: string;
  resources?: string[];
}

export interface RevokePlanResponse {
  resultId: string;
  employee: OffboardingSummary['employee'];
  readyCount: number;
  manualCount: number;
  blockedCount: number;
  items: RevokePlanItem[];
}

// Audit Log
export interface AuditLog {
  id: string;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel?: string;
  detail: string;
}

export interface AuditLogPageResponse {
  content: AuditLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
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
  engine?: string;
  anomalyScore?: number;
  breakdown: {
    adminWeight: number;
    ownerWeight: number;
    apiTokenWeight: number;
    recentLoginWeight: number;
    repoWeight: number;
    workspaceWeight: number;
  };
  explanations?: {
    feature: string;
    contribution: number;
    description: string;
  }[];
}
