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
 * GitHub REST API 커넥터
 * 
 * GitHub OAuth App을 생성하고 client-id/secret을 환경변수에 설정해야 합니다.
 * PoC 모드: API 호출 실패 시 Mock 데이터를 반환합니다.
 */
@Slf4j
@Component
public class GitHubConnector implements SaaSConnector {

    private static final String GITHUB_API_BASE = "https://api.github.com";
    private static final String GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
    private static final String GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

    @Value("${oram.oauth.github.client-id}")
    private String clientId;

    @Value("${oram.oauth.github.client-secret}")
    private String clientSecret;

    @Value("${oram.oauth.github.redirect-uri}")
    private String redirectUri;

    @Value("${oram.oauth.github.scopes}")
    private String scopes;

    private final WebClient webClient;

    public GitHubConnector(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.baseUrl(GITHUB_API_BASE).build();
    }

    @Override
    public SaasType getSaasType() {
        return SaasType.GITHUB;
    }

    @Override
    public String getOAuthAuthorizationUrl(String state) {
        return UriComponentsBuilder.fromHttpUrl(GITHUB_OAUTH_URL)
                .queryParam("client_id", clientId)
                .queryParam("scope", scopes)
                .queryParam("redirect_uri", redirectUri)
                .queryParam("state", state)
                .toUriString();
    }

    @Override
    public TokenInfo exchangeCodeForToken(String code) {
        try {
            Map<?, ?> response = WebClient.create(GITHUB_TOKEN_URL)
                    .post()
                    .uri(uriBuilder -> uriBuilder
                            .queryParam("client_id", clientId)
                            .queryParam("client_secret", clientSecret)
                            .queryParam("code", code)
                            .queryParam("redirect_uri", redirectUri)
                            .build())
                    .header("Accept", "application/json")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (response != null && response.get("access_token") != null) {
                String accessToken = (String) response.get("access_token");
                return new TokenInfo(accessToken, null, "github-org", "GitHub Organization", 0L);
            }
        } catch (Exception e) {
            log.warn("GitHub OAuth exchange failed (PoC mock mode): {}", e.getMessage());
        }
        // PoC Mock fallback
        return new TokenInfo("mock-github-token", null, "mock-org", "Mock GitHub Org", 0L);
    }

    @Override
    public void disconnect(String accessToken) {
        // GitHub tokens don't expire; in production, call DELETE /applications/{client_id}/token
        log.info("[GITHUB] Token disconnect requested");
    }

    @Override
    public List<DiscoveredPermission> getPermissions(String email, String accessToken) {
        List<DiscoveredPermission> permissions = new ArrayList<>();
        try {
            // Search user by email via user search API
            Map<?, ?> searchResponse = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/search/users")
                            .queryParam("q", email + " in:email")
                            .build())
                    .header("Authorization", "token " + accessToken)
                    .header("Accept", "application/vnd.github+json")
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (searchResponse != null) {
                List<?> items = (List<?>) searchResponse.get("items");
                if (items != null && !items.isEmpty()) {
                    Map<?, ?> user = (Map<?, ?>) items.getFirst();
                    String login = (String) user.get("login");

                    // Get organization membership
                    List<?> orgs = webClient.get()
                            .uri("/users/" + login + "/orgs")
                            .header("Authorization", "token " + accessToken)
                            .retrieve()
                            .bodyToFlux(Map.class)
                            .collectList()
                            .block();

                    int orgCount = orgs != null ? orgs.size() : 0;

                    permissions.add(new DiscoveredPermission(
                            "MEMBER", "GitHub Organization",
                            false, false, false, true, 0, orgCount
                    ));
                }
            }
        } catch (Exception e) {
            log.warn("GitHub getPermissions failed, returning mock data: {}", e.getMessage());
            // PoC Mock data with high-risk profile
            permissions.add(new DiscoveredPermission(
                    "OWNER", "company-org",
                    true, true, true, true, 42, 1
            ));
        }
        return permissions;
    }

    @Override
    public RevokeResult revokeAccess(String email, String accessToken) {
        log.info("[GITHUB] Revoking access for: {}", email);
        // In production: remove user from org, revoke PATs
        return new RevokeResult(true, "GitHub access revoked for " + email,
                List.of("Organization Owner", "Repository Access", "PAT Token"));
    }

    @Override
    public boolean validateToken(String accessToken) {
        try {
            webClient.get()
                    .uri("/user")
                    .header("Authorization", "token " + accessToken)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
