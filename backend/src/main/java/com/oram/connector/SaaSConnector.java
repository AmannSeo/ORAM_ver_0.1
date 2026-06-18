package com.oram.connector;

import com.oram.enums.SaasType;

import java.util.List;

/**
 * Plugin Architecture: SaaS 커넥터 인터페이스
 * 
 * 새로운 SaaS 플랫폼 추가 시 이 인터페이스를 구현하고
 * @Component 애노테이션을 추가하면 자동으로 ConnectorRegistry에 등록됩니다.
 */
public interface SaaSConnector {

    /**
     * 이 커넥터가 지원하는 SaaS 플랫폼 타입 반환
     */
    SaasType getSaasType();

    /**
     * OAuth 인증 URL 생성
     */
    String getOAuthAuthorizationUrl(String state);

    /**
     * OAuth 콜백으로 받은 code로 액세스 토큰 교환
     */
    TokenInfo exchangeCodeForToken(String code);

    /**
     * 연결 해제 (토큰 무효화)
     */
    void disconnect(String accessToken);

    /**
     * 이메일로 사용자 조회
     */
    List<DiscoveredPermission> getPermissions(String email, String accessToken);

    default List<SyncedUser> listUsers(String accessToken) {
        return List.of();
    }

    /**
     * 사용자의 모든 접근 권한 해제
     */
    RevokeResult revokeAccess(String email, String accessToken);

    /**
     * 토큰 유효성 검사
     */
    boolean validateToken(String accessToken);

    record TokenInfo(
        String accessToken,
        String refreshToken,
        String workspaceId,
        String workspaceName,
        long expiresInSeconds
    ) {}

    record DiscoveredPermission(
        String permissionType,
        String resourceName,
        boolean isAdmin,
        boolean isOwner,
        boolean hasApiToken,
        boolean recentLogin,
        int repoCount,
        int workspaceCount
    ) {}

    record SyncedUser(
        String externalId,
        String name,
        String email,
        String department,
        boolean active
    ) {}

    record RevokeResult(
        boolean success,
        String message,
        List<String> revokedResources
    ) {}
}
