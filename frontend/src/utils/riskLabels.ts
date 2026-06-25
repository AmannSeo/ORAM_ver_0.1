import type { OffboardingSummary, RiskLevel, SaasSyncAlert } from '../types';

export const RISK_ORDER: Record<RiskLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export const RISK_ACTION_LABEL: Record<RiskLevel, string> = {
  LOW: '상시 모니터링',
  MEDIUM: '관리자 검토',
  HIGH: '우선 회수 검토',
  CRITICAL: '즉시 회수 필요',
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
  if (source === 'AUTOMATIC') return '시스템 감지';
  if (source === 'MANUAL') return '관리자 실행';
  return source || '-';
}

export function analysisSourceHelp(source?: string) {
  if (source === 'AUTOMATIC') {
    return 'SaaS 동기화나 퇴사자 활성 계정 감지처럼 시스템 이벤트로 생성된 분석입니다.';
  }
  if (source === 'MANUAL') {
    return '관리자가 퇴사 처리, 분석 버튼, 재점검 버튼을 눌러 생성한 분석입니다.';
  }
  return '분석 생성 경로를 확인할 수 없습니다.';
}

export function analysisTriggerLabel(trigger?: string, detail = false) {
  if (!trigger) return '-';
  if (trigger.includes('SYNC_RESIGNED_ACCOUNT_STILL_ACTIVE')) {
    return detail
      ? '퇴사자로 표시된 직원의 SaaS 계정이 최근 동기화에서 아직 활성 상태로 확인되었습니다.'
      : '퇴사자 활성 계정 감지';
  }
  if (trigger.includes('SYNC_INACTIVE_ACCOUNT')) {
    return detail
      ? 'SaaS 동기화 결과에서 비활성 계정이 확인되어 점검 대상으로 등록되었습니다.'
      : '비활성 계정 감지';
  }
  if (trigger.includes('SYNC_MISSING_ACCOUNT')) {
    return detail
      ? '이전 동기화에 있던 SaaS 계정이 최신 동기화 결과에서 사라졌습니다.'
      : 'SaaS 계정 누락 감지';
  }
  if (trigger === 'MANUAL_TRIGGER') {
    return detail
      ? '관리자가 직원을 퇴사 처리하면서 권한 회수 대상이 생성되었습니다.'
      : '퇴사 처리로 생성';
  }
  if (trigger === 'MANUAL_ANALYSIS_REQUEST') {
    return detail
      ? '관리자가 기존 권한 회수 대상을 다시 점검했습니다.'
      : '관리자 점검 실행';
  }
  return trigger;
}

export function offboardingActionGuide(result: OffboardingSummary) {
  if (result.revokedAll) return '조치 완료';
  if (result.riskLevel === 'CRITICAL') return '즉시 권한 회수';
  if (result.riskLevel === 'HIGH') return '우선 회수 검토';
  if (result.riskLevel === 'MEDIUM') return '관리자 검토';
  return '상시 모니터링';
}

export function saasAlertReasonLabel(reason: string) {
  if (reason === 'RESIGNED_ACCOUNT_STILL_ACTIVE') return '퇴사자 활성 계정';
  if (reason === 'MISSING_FROM_LATEST_SYNC') return '최근 동기화 누락';
  if (reason === 'INACTIVE_FROM_LATEST_SYNC') return '비활성 계정 감지';
  return '계정 상태 확인';
}

export function saasAlertDescription(alert: SaasSyncAlert) {
  const account = alert.employeeName || alert.displayName || alert.externalUsername || alert.externalEmail || '매핑되지 않은 계정';
  if (alert.reason === 'RESIGNED_ACCOUNT_STILL_ACTIVE') {
    return `${account} 계정이 퇴사 상태인데도 최근 ${alert.saasType} 동기화에서 활성 계정으로 확인되었습니다. 권한 회수 여부를 확인해야 합니다.`;
  }
  if (alert.reason === 'INACTIVE_FROM_LATEST_SYNC') {
    return `${account} 계정이 최근 ${alert.saasType} 동기화에서 비활성 상태로 확인되었습니다.`;
  }
  if (alert.reason === 'MISSING_FROM_LATEST_SYNC') {
    return `${account} 계정이 이전 동기화에는 있었지만 최근 ${alert.saasType} 결과에서 누락되었습니다.`;
  }
  return alert.detail || `${account} 계정 상태 확인이 필요합니다.`;
}
