package com.oram.connector;

import com.oram.enums.SaasType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Notion API 커넥터
 * 
 * Notion OAuth Integration을 설정하고
 * client-id/secret을 환경변수에 설정해야 합니다.
 * PoC 모드: API 호출 실패 시 Mock 데이터를 반환합니다.
 */
@Slf4j
@Component
public class NotionConnector implements SaaSConnector {

    private static final String NOTION_API_BASE = "https://api.notion.com/v1";
    private static final String NOTION_OAUTH_URL = "https://api.notion.com/v1/oauth/authorize";
    private static final String NOTION_TOKEN_URL = "https://api.notion.com/v1/oauth/token";
    private static final String NOTION_API_VERSION = "2022-06-28";

    @Value("${oram.oauth.notion.client-id}")
    private String clientId;

    @Value("${oram.oauth.notion.client-secret}")
    private String clientSecret;

    @Value("${oram.oauth.notion.redirect-uri}")
    private String redirectUri;

    private final WebClient webClient;

    public NotionConnector(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl(NOTION_API_BASE).build();
    }

    @Override
    public SaasType getSaasType() {
        return SaasType.NOTION;
    }

    @Override
    public String getOAuthAuthorizationUrl(String state) {
        return UriComponentsBuilder.fromHttpUrl(NOTION_OAUTH_URL)
                .queryParam("client_id", clientId)
                .queryParam("response_type", "code")
                .queryParam("owner", "user")
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .toUriString();
    }

    @Override
    public TokenInfo exchangeCodeForToken(String code) {
        try {
            String credentials = java.util.Base64.getEncoder()
                    .encodeToString((clientId + ":" + clientSecret).getBytes());

            Map<?, ?> response = WebClient.create(NOTION_TOKEN_URL)
                    .post()
                    .header("Authorization", "Basic " + credentials)
                    .header("Content-Type", "application/json")
                    .header("Notion-Version", NOTION_API_VERSION)
                    .bodyValue(Map.of(
                            "grant_type", "authorization_code",
                            "code", code,
                            "redirect_uri", redirectUri
                    ))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.get("access_token") != null) {
                Map<?, ?> workspace = (Map<?, ?>) response.get("workspace_icon");
                String workspaceId = (String) response.get("workspace_id");
                String workspaceName = (String) response.get("workspace_name");
                return new TokenInfo(
                        (String) response.get("access_token"),
                        null,
                        workspaceId != null ? workspaceId : "notion-workspace",
                        workspaceName != null ? workspaceName : "Notion Workspace",
                        0L
                );
            }
        } catch (Exception e) {
            log.warn("Notion OAuth exchange failed (PoC mock mode): {}", e.getMessage());
        }
        // PoC Mock fallback
        return new TokenInfo("mock-notion-token", null, "mock-ws-id", "Mock Notion Workspace", 0L);
    }

    @Override
    public void disconnect(String accessToken) {
        log.info("[NOTION] Token disconnect requested");
    }

    @Override
    public List<DiscoveredPermission> getPermissions(String email, String accessToken) {
        List<DiscoveredPermission> permissions = new ArrayList<>();
        try {
            // Search users in workspace
            Map<?, ?> response = webClient.post()
                    .uri("/users/list")
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Notion-Version", NOTION_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null) {
                List<?> results = (List<?>) response.get("results");
                if (results != null) {
                    for (Object obj : results) {
                        Map<?, ?> user = (Map<?, ?>) obj;
                        Map<?, ?> person = (Map<?, ?>) user.get("person");
                        if (person != null && email.equalsIgnoreCase((String) person.get("email"))) {
                            String role = (String) user.get("type");
                            permissions.add(new DiscoveredPermission(
                                    "person".equals(role) ? "MEMBER" : "BOT",
                                    "Notion Workspace",
                                    false, false, false, true, 0, 1
                            ));
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Notion getPermissions failed, returning mock data: {}", e.getMessage());
            // PoC Mock data
            permissions.add(new DiscoveredPermission(
                    "MEMBER", "Mock Notion Workspace", false, false, false, true, 0, 1
            ));
        }
        return permissions;
    }

    @Override
    public RevokeResult revokeAccess(String email, String accessToken) {
        log.info("[NOTION] Revoking access for: {}", email);
        // In production: remove user from workspace via Notion API
        return new RevokeResult(true, "Notion access revoked for " + email,
                List.of("Workspace Member"));
    }

    @Override
    public boolean validateToken(String accessToken) {
        try {
            Map<?, ?> resp = webClient.get()
                    .uri("/users/me")
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Notion-Version", NOTION_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return resp != null && resp.get("id") != null;
        } catch (Exception e) {
            log.warn("Notion validateToken failed: {}", e.getMessage());
            return false;
        }
    }

    /**
     * 토큰으로 워크스페이스 이름 조회
     * Notion Internal Integration Token: /users/me API 사용
     */
    public String getWorkspaceName(String accessToken) {
        try {
            // Notion은 bot 정보에서 workspace_name을 가져올 수 있음
            Map<?, ?> resp = webClient.get()
                    .uri("/users/me")
                    .header("Authorization", "Bearer " + accessToken)
                    .header("Notion-Version", NOTION_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            if (resp != null) {
                // bot 타입이면 workspace_name 포함
                Object bot = resp.get("bot");
                if (bot instanceof java.util.Map<?,?> botMap) {
                    Object ws = botMap.get("workspace_name");
                    if (ws != null) return ws.toString();
                }
                Object name = resp.get("name");
                if (name != null) return name.toString() + " (Notion)";
            }
        } catch (Exception e) {
            log.warn("Notion getWorkspaceName failed: {}", e.getMessage());
        }
        return "Notion Workspace";
    }
}
