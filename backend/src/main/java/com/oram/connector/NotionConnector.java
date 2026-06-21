package com.oram.connector;

import com.oram.enums.SaasType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

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
        String credentials = Base64.getEncoder().encodeToString((clientId + ":" + clientSecret).getBytes());

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
            String workspaceId = stringValue(response.get("workspace_id"));
            String workspaceName = stringValue(response.get("workspace_name"));
            return new TokenInfo(
                    stringValue(response.get("access_token")),
                    null,
                    workspaceId != null ? workspaceId : "notion-workspace",
                    workspaceName != null ? workspaceName : "Notion Workspace",
                    0L
            );
        }

        throw new IllegalArgumentException("Notion OAuth token exchange failed.");
    }

    @Override
    public void disconnect(String accessToken) {
        log.info("[NOTION] Token disconnect requested");
    }

    @Override
    public List<DiscoveredPermission> getPermissions(String email, String accessToken) {
        List<DiscoveredPermission> permissions = new ArrayList<>();
        for (Map<?, ?> user : fetchUsers(accessToken)) {
            Map<?, ?> person = (Map<?, ?>) user.get("person");
            String userEmail = person != null ? stringValue(person.get("email")) : null;
            if (userEmail != null && email.equalsIgnoreCase(userEmail)) {
                permissions.add(new DiscoveredPermission(
                        "MEMBER",
                        "Notion Workspace",
                        false,
                        false,
                        false,
                        true,
                        0,
                        1
                ));
            }
        }
        return permissions;
    }

    @Override
    public List<SyncedUser> listUsers(String accessToken) {
        List<SyncedUser> users = new ArrayList<>();
        for (Map<?, ?> user : fetchUsers(accessToken)) {
            Map<?, ?> person = (Map<?, ?>) user.get("person");
            String email = person != null ? stringValue(person.get("email")) : null;
            String id = stringValue(user.get("id"));
            if (email == null || email.isBlank() || id == null || id.isBlank()) continue;

            users.add(new SyncedUser(
                    "notion:" + id,
                    firstNonBlank(stringValue(user.get("name")), email),
                    email.toLowerCase(),
                    "Notion",
                    true
            ));
        }
        return users;
    }

    @Override
    public RevokeResult revokeAccess(String email, String accessToken) {
        log.info("[NOTION] Revoke requested for: {}", email);
        return new RevokeResult(false,
                "Notion API does not provide workspace member removal. Remove this user manually in Notion.",
                List.of());
    }

    @Override
    public boolean validateToken(String accessToken) {
        try {
            Map<?, ?> resp = webClient.get()
                    .uri("/users/me")
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
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

    public String getWorkspaceName(String accessToken) {
        try {
            Map<?, ?> resp = webClient.get()
                    .uri("/users/me")
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
                    .header("Notion-Version", NOTION_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            if (resp != null) {
                Object bot = resp.get("bot");
                if (bot instanceof Map<?, ?> botMap) {
                    Object ws = botMap.get("workspace_name");
                    if (ws != null) return ws.toString();
                }
                Object name = resp.get("name");
                if (name != null) return name + " (Notion)";
            }
        } catch (Exception e) {
            log.warn("Notion getWorkspaceName failed: {}", e.getMessage());
        }
        return "Notion Workspace";
    }

    private List<Map<?, ?>> fetchUsers(String accessToken) {
        List<Map<?, ?>> users = new ArrayList<>();
        String cursor = null;

        do {
            try {
                String pageCursor = cursor;
                Map<?, ?> response = webClient.get()
                        .uri(uriBuilder -> {
                            var builder = uriBuilder.path("/users").queryParam("page_size", 100);
                            if (pageCursor != null && !pageCursor.isBlank()) {
                                builder.queryParam("start_cursor", pageCursor);
                            }
                            return builder.build();
                        })
                        .header("Authorization", "Bearer " + sanitizeToken(accessToken))
                        .header("Notion-Version", NOTION_API_VERSION)
                        .retrieve()
                        .bodyToMono(Map.class)
                        .block();

                if (response == null) break;
                List<?> results = (List<?>) response.get("results");
                if (results != null) {
                    for (Object row : results) {
                        users.add((Map<?, ?>) row);
                    }
                }

                Boolean hasMore = (Boolean) response.get("has_more");
                cursor = Boolean.TRUE.equals(hasMore) ? stringValue(response.get("next_cursor")) : null;
            } catch (Exception e) {
                log.warn("Notion user listing failed: {}", e.getMessage());
                break;
            }
        } while (cursor != null && !cursor.isBlank());

        return users;
    }

    private String sanitizeToken(String accessToken) {
        return accessToken == null ? "" : accessToken.replaceAll("\\s+", "");
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) return value;
        }
        return "-";
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }
}
