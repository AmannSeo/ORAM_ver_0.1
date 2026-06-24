import type { OffboardingSummary, RiskLevel, SaasSyncAlert } from '../types';

export const RISK_ORDER: Record<RiskLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const RISK_ACTION_LABEL: Record<RiskLevel, string> = {
  LOW: '표준 회수 절차',
  MEDIUM: '관리자 검토 후 회수',
  HIGH: '24시간 내 회수 승인',
  CRITICAL: '즉시 회수 승인',
};

export const OFFBOARDING_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  IN_PROGRESS: '진행 중',
  COMPLETED: '분석 완료',
  FAILED: '실패',
};

export const OFFBOARDING_STATUS_COLOR: Record<string, 'warning' | 'info' | 'success' | 'error' | 'default'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  FAILED: 'error',
};

export function analysisSourceLabel(source?: string) {
  if (source === 'AUTOMATIC') return '자동 분석';
  if (source === 'MANUAL') return '수동 재분석';
  return source || '-';
}

export function analysisTriggerLabel(trigger?: string, detail = false) {
  if (!trigger) return '-';
  if (trigger.includes('SYNC_RESIGNED_ACCOUNT_STILL_ACTIVE')) {
    return detail ? '퇴사 상태 직원의 활성 SaaS 계정이 감지되었습니다.' : '퇴사자 활성 SaaS 계정 감지';
  }
  if (trigger.includes('SYNC_INACTIVE_ACCOUNT')) {
    return detail ? 'SaaS 동기화에서 비활성 계정이 감지되었습니다.' : 'SaaS 비활성 계정 감지';
  }
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) {
    return detail ? '이전 동기화에 있던 SaaS 계정이 최신 동기화에서 사라졌습니다.' : 'SaaS 계정 누락 감지';
  }
  if (trigger === 'MANUAL_TRIGGER') return detail ? '퇴사 처리 후 자동으로 잔여 접근 권한 분석이 실행되었습니다.' : '퇴사 처리 기반 자동 분석';
  if (trigger === 'MANUAL_ANALYSIS_REQUEST') return detail ? '관리자가 기존 권한 회수 대상을 재분석했습니다.' : '관리자 재분석';
  return trigger;
}

export function offboardingActionGuide(result: OffboardingSummary) {
  if (result.revokedAll) return '조치 완료';
  if (result.riskLevel === 'CRITICAL') return '즉시 권한 회수';
  if (result.riskLevel === 'HIGH') return '24시간 내 회수';
  if (result.riskLevel === 'MEDIUM') return '검토 후 회수';
  return '표준 회수 절차';
}

export function saasAlertReasonLabel(reason: string) {
  if (reason === 'RESIGNED_ACCOUNT_STILL_ACTIVE') return '퇴사자 활성 계정';
  if (reason === 'MISSING_FROM_LATEST_SYNC') return '최근 동기화에서 누락';
  if (reason === 'INACTIVE_FROM_LATEST_SYNC') return '비활성 계정 감지';
  return '계정 상태 확인';
}

export function saasAlertDescription(alert: SaasSyncAlert) {
  const account = alert.employeeName || alert.displayName || alert.externalUsername || alert.externalEmail || '매핑되지 않은 계정';
  if (alert.reason === 'RESIGNED_ACCOUNT_STILL_ACTIVE') {
    return `${account} 계정이 퇴사 상태인데도 최근 ${alert.saasType} 동기화에서 활성 계정으로 확인되었습니다. 즉시 권한 회수 또는 수동 제거가 필요합니다.`;
  }
  if (alert.reason === 'INACTIVE_FROM_LATEST_SYNC') {
    return `${account} 계정이 최근 ${alert.saasType} 동기화에서 비활성 상태로 확인되었습니다.`;
  }
  if (alert.reason === 'MISSING_FROM_LATEST_SYNC') {
    return `${account} 계정이 이전 동기화에는 있었지만 최근 ${alert.saasType} 결과에서 누락되었습니다.`;
  }
  return alert.detail || `${account} 계정 상태 확인이 필요합니다.`;
}
