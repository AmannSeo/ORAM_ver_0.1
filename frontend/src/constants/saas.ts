import type { SaasConnection, SaasType } from '../types';

export const SAAS_INFO: Record<SaasType, {
  label: string; color: string; emoji: string;
  tokenLabel: string; tokenPlaceholder: string; tokenPrefix: string;
  steps: string[]; docsUrl: string; appUrl: string;
  quickLinks: { label: string; url: string }[];
  detectItems: string[]; revokeNote: string;
}> = {
  SLACK: {
    label: 'Slack', color: '#4A154B', emoji: '💬',
    tokenLabel: 'Slack Token (xoxb- 또는 xoxp-...)',
    tokenPlaceholder: 'xoxb- 또는 xoxp- 로 시작하는 Slack token',
    tokenPrefix: 'xoxb- 또는 xoxp-',
    steps: [
      'Slack API Apps 페이지 접속 → "Create New App" 클릭',
      '생성 방식 선택에서 "From scratch" 선택\n  ※ Manifest를 이미 준비한 경우가 아니라면 From scratch가 가장 쉽습니다.',
      'App Name에 ORAM 같은 이름 입력 → 대상 Workspace 선택 → "Create App" 클릭',
      '왼쪽 메뉴에서 "OAuth & Permissions" 이동',
      '계정 수집만 할 경우 "Bot Token Scopes"에 users:read, users:read.email 추가',
      '퇴사자 접근 차단까지 하려면 "User Token Scopes"에 admin.users:write 추가\n  ※ 이 scope는 Enterprise Grid에서만 동작하며 일반 워크스페이스에서는 승인/실행이 제한될 수 있습니다.',
      '"Install to Workspace" 또는 "Reinstall to Workspace" 클릭 → Slack 관리자 계정으로 승인',
      '"OAuth Tokens for Your Workspace" 섹션에서 토큰 복사\n  - Bot User OAuth Token(xoxb-): 사용자 수집 가능, 접근 차단 불가\n  - User OAuth Token(xoxp-): Enterprise + admin.users:write일 때 접근 차단 가능',
      '채널에서만 내보내는 것은 오프보딩 차단이 아닙니다. 워크스페이스 제거 또는 비활성 처리가 필요합니다.',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://api.slack.com/authentication/basics',
    appUrl: 'https://api.slack.com/apps',
    quickLinks: [
      { label: 'Slack Apps', url: 'https://api.slack.com/apps' },
      { label: 'OAuth 문서', url: 'https://api.slack.com/authentication/oauth-v2' },
      { label: 'admin.users API', url: 'https://api.slack.com/methods/admin.users.remove' },
    ],
    detectItems: ['워크스페이스 멤버', '관리자(Admin)', '소유자(Owner)', '비활성 계정'],
    revokeNote: 'xoxb는 수집 전용, 자동 차단은 Enterprise + xoxp User Token(admin.users:write) 필요',
  },
  GITHUB: {
    label: 'GitHub', color: '#181717', emoji: '🐙',
    tokenLabel: 'Personal Access Token (ghp_...)',
    tokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenPrefix: 'ghp_',
    steps: [
      'GitHub.com → Settings → Developer settings → Personal access tokens → Tokens (classic)',
      '"Generate new token (classic)" 클릭',
      '토큰을 만드는 GitHub 계정이 대상 Organization의 Owner 또는 관리자 권한을 가지고 있어야 함',
      'Scopes 선택: read:org, admin:org, repo (조직 멤버와 저장소 collaborator 조회/제거용)',
      '조직에서 SSO/SAML을 사용한다면 생성한 토큰을 해당 Organization에 Authorize 해야 함',
      '"Generate token" 클릭 → 토큰 복사 (한 번만 표시됨)',
      'GitHub 계정 범위에서 개인/조직/기업 계정 중 실제 관리 범위를 선택',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://docs.github.com/ko/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    appUrl: 'https://github.com/settings/tokens',
    quickLinks: [
      { label: '토큰 만들기', url: 'https://github.com/settings/tokens' },
      { label: 'GitHub 토큰 문서', url: 'https://docs.github.com/ko/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens' },
      { label: '조직 설정', url: 'https://github.com/settings/organizations' },
    ],
    detectItems: ['Organization 멤버십', '저장소 Collaborator', '저장소 접근 권한'],
    revokeNote: '조직 관리자 권한이 있는 토큰에서 조직 멤버 또는 저장소 collaborator 제거 가능',
  },
  NOTION: {
    label: 'Notion', color: '#000000', emoji: '📝',
    tokenLabel: 'Internal Integration Token (secret_...)',
    tokenPlaceholder: 'secret_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    tokenPrefix: 'secret_',
    steps: [
      'https://www.notion.so/my-integrations 접속',
      '"New integration" 클릭 → 이름 입력 (예: ORAM)',
      '"Associated workspace" 선택 → "Submit"',
      '"Secrets" 탭에서 "Internal Integration Token" 복사',
      '연동 토큰은 사용자/페이지 조회용입니다. Notion 공식 API는 워크스페이스 멤버 제거를 제공하지 않습니다.',
      '퇴사자 차단은 Notion Settings > Members에서 수동 제거하거나, Enterprise 환경이면 IdP/SCIM으로 비활성 처리합니다.',
      '복사한 토큰을 아래에 붙여넣기',
    ],
    docsUrl: 'https://developers.notion.com/docs/create-a-notion-integration',
    appUrl: 'https://www.notion.so/my-integrations',
    quickLinks: [
      { label: 'Notion Integrations', url: 'https://www.notion.so/my-integrations' },
      { label: 'Integration 문서', url: 'https://developers.notion.com/docs/create-a-notion-integration' },
      { label: 'Notion API 참조', url: 'https://developers.notion.com/reference/intro' },
    ],
    detectItems: ['워크스페이스 멤버', '페이지 접근 권한', '수동 제거 대상'],
    revokeNote: '⚠️ 사용자 목록 조회 가능, 멤버 제거는 Notion API 제한으로 관리자 수동 처리 또는 IdP/SCIM 처리',
  },
};

export const DEFAULT_CONNECTIONS: SaasConnection[] = (Object.keys(SAAS_INFO) as SaasType[]).map((saasType) => ({
  saasType,
  isConnected: false,
}));

export const GITHUB_ACCOUNT_SCOPES = [
  { value: 'PERSONAL', label: '개인 계정', description: '개인 저장소와 본인이 접근 가능한 저장소 중심으로 수집합니다.' },
  { value: 'ORGANIZATION', label: '조직 계정', description: 'GitHub Organization 멤버와 저장소 collaborator를 수집합니다.' },
  { value: 'ENTERPRISE', label: '기업 계정', description: 'Enterprise 소속 조직으로 관리되는 GitHub 계정으로 표시합니다. Enterprise API 직접 연동은 확장 범위입니다.' },
];

export function accountScopeLabel(saasType: SaasType, scope?: string, enterpriseAccount?: boolean) {
  if (saasType !== 'GITHUB') return '워크스페이스';
  if (enterpriseAccount || scope === 'ENTERPRISE') return '기업 계정';
  if (scope === 'PERSONAL') return '개인 계정';
  return '조직 계정';
}
