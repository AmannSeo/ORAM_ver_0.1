// ── Employee ─────────────────────────────────────────────────────────────────

export type EmployeeStatus = 'ACTIVE' | 'RESIGNED';

export interface Employee {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  status: EmployeeStatus;
  offboardingTriggered: boolean;
  createdAt: string;
  updatedAt: string;
  resignedAt: string | null;
}

export interface EmployeeRequest {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  status: EmployeeStatus;
}

// ── SaaS Connections ─────────────────────────────────────────────────────────

export type SaaSPlatform = 'SLACK' | 'GITHUB' | 'NOTION';

export interface SaaSConnection {
  id: number;
  platform: SaaSPlatform;
  connected: boolean;
  workspaceId: string | null;
  workspaceName: string | null;
  connectedBy: string | null;
  lastSyncedAt: string | null;
  updatedAt: string;
}

// ── Permissions ───────────────────────────────────────────────────────────────

export type RevokeStatus = 'PENDING' | 'REVOKED' | 'FAILED' | 'SKIPPED';

export interface Permission {
  id: number;
  platform: SaaSPlatform;
  permissionType: string;
  permissionDetail: string;
  isAdmin: boolean;
  isOwner: boolean;
  hasApiToken: boolean;
  revokeStatus: RevokeStatus;
  revokedAt: string | null;
  discoveredAt: string;
}

// ── Offboarding ───────────────────────────────────────────────────────────────

export type OffboardingStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface OffboardingResult {
  id: number;
  employee: Employee;
  status: OffboardingStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  totalPermissions: number;
  revokedPermissions: number;
  initiatedAt: string;
  completedAt: string | null;
  permissions: Permission[];
  recommendedActions: string[];
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  resignedEmployees: number;
  connectedSaasCount: number;
  criticalRiskAccounts: number;
  highRiskAccounts: number;
  mediumRiskAccounts: number;
  lowRiskAccounts: number;
  pendingOffboardings: number;
  completedOffboardings: number;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export type UserRole = 'ADMIN' | 'SECURITY_MANAGER' | 'AUDITOR';

export interface AuthUser {
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  token: string;
}
