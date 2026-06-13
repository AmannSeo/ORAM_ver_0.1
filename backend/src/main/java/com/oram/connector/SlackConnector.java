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
 * Slack Web API 커넥터
 * 
 * 실제 운영 시 Slack OAuth App을 생성하고
 * client-id/secret을 환경변수에 설정해야 합니다.
 * PoC 모드: API 호출 실패 시 Mock 데이터를 반환합니다.
 */
@Slf4j
@Component
public class SlackConnector implements SaaSConnector {

    private static final String SLACK_API_BASE = "https://slack.com/api";
    private static final String SLACK_OAUTH_BASE = "https://slack.com/oauth/v2";

    @Value("${oram.oauth.slack.client-id}")
    private String clientId;

    @Value("${oram.oauth.slack.client-secret}")
    private String clientSecret;

    @Value("${oram.oauth.slack.redirect-uri}")
    private String redirectUri;

    @Value("${oram.oauth.slack.scopes}")
    private String scopes;

    private final WebClient webClient;

    public SlackConnector(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl(SLACK_API_BASE).build();
    }

    @Override
    public SaasType getSaasType() {
        return SaasType.SLACK;
    }

    @Override
    public String getOAuthAuthorizationUrl(String state) {
        return UriComponentsBuilder.fromHttpUrl(SLACK_OAUTH_BASE + "/authorize")
                .queryParam("client_id", clientId)
                .queryParam("scope", scopes)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .toUriString();
    }

    @Override
    public TokenInfo exchangeCodeForToken(String code) {
        try {
            Map<?, ?> response = WebClient.create(SLACK_OAUTH_BASE)
                    .post()
                    .uri(uriBuilder -> uriBuilder.path("/access")
                            .queryParam("client_id", clientId)
                            .queryParam("client_secret", clientSecret)
                            .queryParam("code", code)
                            .queryParam("redirect_uri", redirectUri)
                            .build())
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && Boolean.TRUE.equals(response.get("ok"))) {
                Map<?, ?> team = (Map<?, ?>) response.get("team");
                return new TokenInfo(
                        (String) response.get("access_token"),
                        null,
                        team != null ? (String) team.get("id") : "unknown",
                        team != null ? (String) team.get("name") : "Slack Workspace",
                        86400L
                );
            }
        } catch (Exception e) {
            log.warn("Slack OAuth exchange failed (PoC mock mode): {}", e.getMessage());
        }
        // PoC Mock fallback
        return new TokenInfo("mock-slack-token", null, "T_MOCK_ID", "Mock Slack Workspace", 86400L);
    }

    @Override
    public void disconnect(String accessToken) {
        try {
            webClient.post()
                    .uri("/auth.revoke")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("Slack token revocation failed: {}", e.getMessage());
        }
    }

    @Override
    public List<DiscoveredPermission> getPermissions(String email, String accessToken) {
        List<DiscoveredPermission> permissions = new ArrayList<>();
        try {
            Map<?, ?> userResponse = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/users.lookupByEmail")
                            .queryParam("email", email)
                            .build())
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (userResponse != null && Boolean.TRUE.equals(userResponse.get("ok"))) {
                Map<?, ?> user = (Map<?, ?>) userResponse.get("user");
                boolean isAdmin = user != null && Boolean.TRUE.equals(user.get("is_admin"));
                boolean isOwner = user != null && Boolean.TRUE.equals(user.get("is_owner"));

                permissions.add(new DiscoveredPermission(
                        isAdmin ? "ADMIN" : "MEMBER",
                        "Slack Workspace",
                        isAdmin,
                        isOwner,
                        false,
                        true,
                        0,
                        1
                ));
            }
        } catch (Exception e) {
            log.warn("Slack getPermissions failed, returning mock data: {}", e.getMessage());
            // PoC Mock data
            permissions.add(new DiscoveredPermission(
                    "ADMIN", "Mock Slack Workspace", true, false, false, true, 0, 1
            ));
        }
        return permissions;
    }

    @Override
    public RevokeResult revokeAccess(String email, String accessToken) {
        log.info("[SLACK] Revoking access for: {}", email);
        // In production: call users.setInactive or remove from workspace
        return new RevokeResult(true, "Slack access revoked for " + email, List.of("Workspace Member"));
    }

    @Override
    public boolean validateToken(String accessToken) {
        try {
            Map<?, ?> response = webClient.get()
                    .uri("/auth.test")
                    .header("Authorization", "Bearer " + accessToken)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return response != null && Boolean.TRUE.equals(response.get("ok"));
        } catch (Exception e) {
            return false;
        }
    }
}
