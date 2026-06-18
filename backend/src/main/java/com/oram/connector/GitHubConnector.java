package com.oram.connector;

import com.oram.enums.SaasType;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Mono;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
public class GitHubConnector implements SaaSConnector {

    private static final String GITHUB_API_BASE = "https://api.github.com";
    private static final String GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize";
    private static final String GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
    private static final String GITHUB_API_VERSION = "2022-11-28";

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
            log.warn("GitHub OAuth exchange failed: {}", e.getMessage());
        }

        return new TokenInfo("mock-github-token", null, "mock-org", "Mock GitHub Org", 0L);
    }

    @Override
    public void disconnect(String accessToken) {
        log.info("[GITHUB] Token disconnect requested");
    }

    @Override
    public List<DiscoveredPermission> getPermissions(String email, String accessToken) {
        List<DiscoveredPermission> permissions = new ArrayList<>();
        try {
            String login = resolveLogin(email, accessToken);
            if (login == null) return permissions;

            List<Map<?, ?>> orgs = getUserOrgs(login, accessToken);
            int repoCount = countReposForUser(login, accessToken);

            permissions.add(new DiscoveredPermission(
                    orgs.isEmpty() ? "COLLABORATOR" : "MEMBER",
                    orgs.isEmpty() ? "GitHub Repository" : "GitHub Organization",
                    false,
                    false,
                    false,
                    true,
                    repoCount,
                    orgs.size()
            ));
        } catch (Exception e) {
            log.warn("GitHub getPermissions failed: {}", e.getMessage());
        }
        return permissions;
    }

    @Override
    public RevokeResult revokeAccess(String email, String accessToken) {
        log.info("[GITHUB] Revoking access for: {}", email);

        String login = resolveLogin(email, accessToken);
        if (login == null || login.isBlank()) {
            return new RevokeResult(false,
                    "GitHub user could not be matched from email. Store the GitHub login or use a public GitHub email.",
                    List.of());
        }

        List<String> revokedResources = new ArrayList<>();
        List<String> blockedResources = new ArrayList<>();

        for (Map<?, ?> repo : getAccessibleRepos(accessToken)) {
            String fullName = stringValue(repo.get("full_name"));
            if (fullName == null || !fullName.contains("/")) continue;

            String[] parts = fullName.split("/", 2);
            int status = deleteRepoCollaborator(parts[0], parts[1], login, accessToken);
            if (status == 204) {
                revokedResources.add("Repository collaborator: " + fullName);
            } else if (status == 403) {
                blockedResources.add("Repository permission denied: " + fullName);
            }
        }

        for (Map<?, ?> org : getAuthenticatedUserOrgs(accessToken)) {
            String orgLogin = stringValue(org.get("login"));
            if (orgLogin == null || orgLogin.isBlank()) continue;

            int status = deleteOrgMember(orgLogin, login, accessToken);
            if (status == 204) {
                revokedResources.add("Organization member: " + orgLogin);
            } else if (status == 403) {
                blockedResources.add("Organization permission denied: " + orgLogin);
            }
        }

        if (revokedResources.isEmpty()) {
            String message = blockedResources.isEmpty()
                    ? "No removable GitHub access found. Access may be inherited through a team/org role, or the token cannot see that account."
                    : "GitHub access was found, but the token does not have permission to remove it.";
            return new RevokeResult(false, message, blockedResources);
        }

        revokedResources.addAll(blockedResources);
        return new RevokeResult(true, "GitHub access revoked for " + login, revokedResources);
    }

    @Override
    public List<SyncedUser> listUsers(String accessToken) {
        Map<String, SyncedUser> users = new LinkedHashMap<>();

        for (Map<?, ?> org : getAuthenticatedUserOrgs(accessToken)) {
            String orgLogin = stringValue(org.get("login"));
            if (orgLogin == null || orgLogin.isBlank()) continue;

            for (Map<?, ?> member : getOrgMembers(orgLogin, accessToken)) {
                String login = stringValue(member.get("login"));
                if (login == null || login.isBlank()) continue;
                users.putIfAbsent(login, toSyncedUser(login, "GitHub: " + orgLogin, accessToken));
            }
        }

        for (Map<?, ?> repo : getAccessibleRepos(accessToken)) {
            String fullName = stringValue(repo.get("full_name"));
            if (fullName == null || !fullName.contains("/")) continue;

            String[] parts = fullName.split("/", 2);
            for (Map<?, ?> collaborator : getRepoCollaborators(parts[0], parts[1], accessToken)) {
                String login = stringValue(collaborator.get("login"));
                if (login == null || login.isBlank()) continue;
                users.putIfAbsent(login, toSyncedUser(login, "GitHub Repo: " + fullName, accessToken));
            }
        }

        if (users.isEmpty()) {
            Map<?, ?> currentUser = getCurrentUser(accessToken);
            String login = currentUser != null ? stringValue(currentUser.get("login")) : null;
            if (login != null && !login.isBlank()) {
                users.put(login, toSyncedUser(login, "GitHub", accessToken));
            }
        }

        return new ArrayList<>(users.values());
    }

    @Override
    public boolean validateToken(String accessToken) {
        String token = sanitizeToken(accessToken);
        if (token.isBlank()) return false;

        if (validateTokenWithHeader("Bearer " + token)) return true;
        return validateTokenWithHeader("token " + token);
    }

    public String getWorkspaceName(String accessToken) {
        try {
            Map<?, ?> resp = webClient.get()
                    .uri("/user")
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            if (resp != null && resp.get("login") != null) {
                return resp.get("name") != null
                        ? resp.get("name").toString()
                        : resp.get("login").toString() + " (GitHub)";
            }
        } catch (Exception e) {
            log.warn("GitHub getWorkspaceName failed: {}", e.getMessage());
        }
        return "GitHub";
    }

    private String resolveLogin(String email, String accessToken) {
        if (email == null || email.isBlank()) return null;
        String value = email.trim();
        if (!value.contains("@")) return value;
        if (value.endsWith("@github.local")) {
            return value.substring(0, value.indexOf('@')).trim();
        }

        try {
            Map<?, ?> searchResponse = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/search/users")
                            .queryParam("q", value + " in:email")
                            .build())
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();

            if (searchResponse == null) return null;
            List<?> items = (List<?>) searchResponse.get("items");
            if (items == null || items.isEmpty()) return null;
            Map<?, ?> user = (Map<?, ?>) items.getFirst();
            return stringValue(user.get("login"));
        } catch (Exception e) {
            log.warn("GitHub user lookup failed for {}: {}", email, e.getMessage());
            return null;
        }
    }

    private int countReposForUser(String login, String accessToken) {
        int count = 0;
        for (Map<?, ?> repo : getAccessibleRepos(accessToken)) {
            String fullName = stringValue(repo.get("full_name"));
            if (fullName == null || !fullName.contains("/")) continue;

            String[] parts = fullName.split("/", 2);
            int status = checkRepoCollaborator(parts[0], parts[1], login, accessToken);
            if (status == 204) count++;
        }
        return count;
    }

    private List<Map<?, ?>> getUserOrgs(String login, String accessToken) {
        try {
            List<Map> orgs = webClient.get()
                    .uri("/users/{login}/orgs", login)
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToFlux(Map.class)
                    .collectList()
                    .block();
            return toWildcardMaps(orgs);
        } catch (Exception e) {
            log.warn("GitHub user org listing failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<?, ?>> getAccessibleRepos(String accessToken) {
        try {
            List<Map> repos = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/user/repos")
                            .queryParam("affiliation", "owner,collaborator,organization_member")
                            .queryParam("per_page", 100)
                            .build())
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToFlux(Map.class)
                    .collectList()
                    .block();
            return toWildcardMaps(repos);
        } catch (Exception e) {
            log.warn("GitHub repository listing failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<?, ?>> getAuthenticatedUserOrgs(String accessToken) {
        try {
            List<Map> orgs = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/user/orgs")
                            .queryParam("per_page", 100)
                            .build())
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToFlux(Map.class)
                    .collectList()
                    .block();
            return toWildcardMaps(orgs);
        } catch (Exception e) {
            log.warn("GitHub organization listing failed: {}", e.getMessage());
            return List.of();
        }
    }

    private List<Map<?, ?>> getOrgMembers(String org, String accessToken) {
        try {
            List<Map> members = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/orgs/{org}/members")
                            .queryParam("per_page", 100)
                            .build(org))
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToFlux(Map.class)
                    .collectList()
                    .block();
            return toWildcardMaps(members);
        } catch (Exception e) {
            log.warn("GitHub org member listing failed for {}: {}", org, e.getMessage());
            return List.of();
        }
    }

    private List<Map<?, ?>> getRepoCollaborators(String owner, String repo, String accessToken) {
        try {
            List<Map> collaborators = webClient.get()
                    .uri(uriBuilder -> uriBuilder.path("/repos/{owner}/{repo}/collaborators")
                            .queryParam("affiliation", "all")
                            .queryParam("per_page", 100)
                            .build(owner, repo))
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToFlux(Map.class)
                    .collectList()
                    .block();
            return toWildcardMaps(collaborators);
        } catch (Exception e) {
            log.warn("GitHub repo collaborator listing failed for {}/{}: {}", owner, repo, e.getMessage());
            return List.of();
        }
    }

    private SyncedUser toSyncedUser(String login, String department, String accessToken) {
        Map<?, ?> profile = getUserProfile(login, accessToken);
        String name = profile != null && profile.get("name") != null
                ? profile.get("name").toString()
                : login;
        String email = profile != null && profile.get("email") != null
                ? profile.get("email").toString()
                : login + "@github.local";

        return new SyncedUser(
                "github:" + login,
                name,
                email.toLowerCase(),
                department,
                true
        );
    }

    private Map<?, ?> getCurrentUser(String accessToken) {
        try {
            return webClient.get()
                    .uri("/user")
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("GitHub current user lookup failed: {}", e.getMessage());
            return null;
        }
    }

    private Map<?, ?> getUserProfile(String login, String accessToken) {
        try {
            return webClient.get()
                    .uri("/users/{login}", login)
                    .header("Authorization", authHeader(accessToken))
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
        } catch (Exception e) {
            log.warn("GitHub user profile lookup failed for {}: {}", login, e.getMessage());
            return null;
        }
    }

    private int checkRepoCollaborator(String owner, String repo, String login, String accessToken) {
        return webClient.get()
                .uri("/repos/{owner}/{repo}/collaborators/{login}", owner, repo, login)
                .header("Authorization", authHeader(accessToken))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                .exchangeToMono(response -> Mono.just(response.statusCode().value()))
                .block();
    }

    private int deleteRepoCollaborator(String owner, String repo, String login, String accessToken) {
        return webClient.delete()
                .uri("/repos/{owner}/{repo}/collaborators/{login}", owner, repo, login)
                .header("Authorization", authHeader(accessToken))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                .exchangeToMono(response -> Mono.just(response.statusCode().value()))
                .block();
    }

    private int deleteOrgMember(String org, String login, String accessToken) {
        return webClient.delete()
                .uri("/orgs/{org}/members/{login}", org, login)
                .header("Authorization", authHeader(accessToken))
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                .exchangeToMono(response -> Mono.just(response.statusCode().value()))
                .block();
    }

    private String authHeader(String accessToken) {
        String token = sanitizeToken(accessToken);
        return token.startsWith("ghp_") || token.startsWith("github_pat_")
                ? "Bearer " + token
                : "token " + token;
    }

    private boolean validateTokenWithHeader(String authHeader) {
        try {
            Map<?, ?> resp = webClient.get()
                    .uri("/user")
                    .header("Authorization", authHeader)
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block();
            return resp != null && resp.get("login") != null;
        } catch (Exception e) {
            log.warn("GitHub validateToken failed with {} auth: {}",
                    authHeader.startsWith("Bearer ") ? "Bearer" : "token",
                    e.getMessage());
            return false;
        }
    }

    private String sanitizeToken(String accessToken) {
        return accessToken == null
                ? ""
                : accessToken.replaceAll("\\s+", "");
    }

    private String stringValue(Object value) {
        return value == null ? null : value.toString();
    }

    private List<Map<?, ?>> toWildcardMaps(List<Map> rows) {
        if (rows == null) return List.of();
        List<Map<?, ?>> result = new ArrayList<>();
        for (Map row : rows) {
            result.add(row);
        }
        return result;
    }
}
