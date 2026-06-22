package com.oram.connector;

import com.oram.enums.SaasType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

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
                    team != null ? stringValue(team.get("id")) : "unknown",
                    team != null ? stringValue(team.get("name")) : "Slack Workspace",
                    86400L
            );
        }

        throw new IllegalArgumentException("Slack OAuth token exchange failed.");
    }

    @Override
    public void disconnect(String accessToken) {
        try {
            webClient.post()
                    .uri("/auth.revoke")
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
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
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (isOk(userResponse)) {
                Map<?, ?> user = (Map<?, ?>) userResponse.get("user");
                boolean isAdmin = user != null && Boolean.TRUE.equals(user.get("is_admin"));
                boolean isOwner = user != null && Boolean.TRUE.equals(user.get("is_owner"));
                boolean isDeleted = user != null && Boolean.TRUE.equals(user.get("deleted"));

                if (!isDeleted) {
                    permissions.add(new DiscoveredPermission(
                            isOwner ? "OWNER" : isAdmin ? "ADMIN" : "MEMBER",
                            "Slack Workspace",
                            isAdmin,
                            isOwner,
                            false,
                            true,
                            0,
                            1
                    ));
                }
            }
        } catch (Exception e) {
            log.warn("Slack getPermissions failed: {}", e.getMessage());
        }
        return permissions;
    }

    @Override
    public List<SyncedUser> listUsers(String accessToken) {
        List<SyncedUser> users = new ArrayList<>();
        String cursor = null;

        do {
            Map<?, ?> response = fetchUserPage(accessToken, cursor);
            if (!isOk(response)) break;

            List<?> members = (List<?>) response.get("members");
            if (members != null) {
                for (Object row : members) {
                    Map<?, ?> member = (Map<?, ?>) row;
                    if (Boolean.TRUE.equals(member.get("is_bot")) || Boolean.TRUE.equals(member.get("deleted"))) {
                        continue;
                    }
                    Map<?, ?> profile = (Map<?, ?>) member.get("profile");
                    String email = profile != null ? stringValue(profile.get("email")) : null;
                    String id = stringValue(member.get("id"));
                    if (email == null || email.isBlank() || id == null || id.isBlank()) continue;

                    String name = firstNonBlank(
                            profile != null ? stringValue(profile.get("real_name")) : null,
                            stringValue(member.get("real_name")),
                            stringValue(member.get("name")),
                            email
                    );

                    users.add(new SyncedUser(
                            "slack:" + id,
                            name,
                            email.toLowerCase(),
                            "Slack",
                            true
                    ));
                }
            }

            Map<?, ?> metadata = (Map<?, ?>) response.get("response_metadata");
            cursor = metadata != null ? stringValue(metadata.get("next_cursor")) : null;
        } while (cursor != null && !cursor.isBlank());

        return users;
    }

    @Override
    public RevokeResult revokeAccess(String email, String accessToken) {
        log.info("[SLACK] Revoking access for: {}", email);

        String token = sanitizeToken(accessToken);
        if (token.startsWith("xoxb-")) {
            return new RevokeResult(false,
                    "Slack workspace removal requires an Enterprise Grid user token (xoxp-) with admin.users:write. Bot tokens can collect users but cannot remove workspace access.",
                    List.of("Manual action: remove or deactivate the user in Slack Admin, or connect an xoxp- user token with admin.users:write."));
        }

        Map<?, ?> auth = authTest(accessToken);
        String teamId = auth != null ? stringValue(auth.get("team_id")) : null;
        String userId = lookupUserId(email, accessToken);

        if (teamId == null || teamId.isBlank() || userId == null || userId.isBlank()) {
            return new RevokeResult(false,
                    "Slack user or workspace could not be resolved. Confirm the user email exists in Slack and the token can read workspace users.",
                    List.of());
        }

        try {
            Map<?, ?> response = webClient.post()
                    .uri("/admin.users.remove")
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(BodyInserters.fromFormData("team_id", teamId)
                            .with("user_id", userId))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (isOk(response)) {
                return new RevokeResult(true, "Slack user removed from workspace.", List.of("Slack user: " + userId));
            }

            return new RevokeResult(false,
                    "Slack revoke failed: " + slackError(response),
                    List.of());
        } catch (Exception e) {
            log.warn("Slack revoke failed: {}", e.getMessage());
            return new RevokeResult(false,
                    "Slack revoke failed: " + e.getMessage()
                            + ". Slack removal requires Enterprise Grid and a user token with admin.users:write.",
                    List.of());
        }
    }

    @Override
    public boolean validateToken(String accessToken) {
        return isOk(authTest(accessToken));
    }

    public String getWorkspaceName(String accessToken) {
        Map<?, ?> response = authTest(accessToken);
        if (isOk(response)) {
            String team = stringValue(response.get("team"));
            return team != null && !team.isBlank() ? team : "Slack Workspace";
        }
        return "Slack Workspace";
    }

    private Map<?, ?> fetchUserPage(String accessToken, String cursor) {
        try {
            return webClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path("/users.list").queryParam("limit", 200);
                        if (cursor != null && !cursor.isBlank()) builder.queryParam("cursor", cursor);
                        return builder.build();
                    })
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("Slack users.list failed: {}", e.getMessage());
            return null;
        }
    }

    private Map<?, ?> authTest(String accessToken) {
        try {
            return webClient.get()
                    .uri("/auth.test")
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("Slack auth.test failed: {}", e.getMessage());
            return null;
        }
    }

    private String lookupUserId(String email, String accessToken) {
        try {
            Map<?, ?> response = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/users.lookupByEmail")
                            .queryParam("email", email)
                            .build())
                    .header("Authorization", "Bearer " + sanitizeToken(accessToken))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            if (!isOk(response)) return null;
            Map<?, ?> user = (Map<?, ?>) response.get("user");
            return user != null ? stringValue(user.get("id")) : null;
        } catch (Exception e) {
            log.warn("Slack users.lookupByEmail failed: {}", e.getMessage());
            return null;
        }
    }

    private boolean isOk(Map<?, ?> response) {
        return response != null && Boolean.TRUE.equals(response.get("ok"));
    }

    private String slackError(Map<?, ?> response) {
        if (response == null) return "no_response";
        Object error = response.get("error");
        return error != null ? error.toString() : "unknown_error";
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
