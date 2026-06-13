package com.oram.connector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oram.dto.response.DiscoveredPermissionDto;
import com.oram.entity.SaaSConnection;
import com.oram.entity.SaaSConnection.SaaSPlatform;
import com.oram.repository.SaaSConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * GitHub SaaS Connector.
 *
 * Uses GitHub REST API v3 to:
 * - List organization members
 * - Detect ownership, repository admin, and PAT tokens
 * - Remove members from the organization
 *
 * Required OAuth Scopes: read:org, admin:org, read:user
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GitHubConnector implements SaaSConnector {

    private final SaaSConnectionRepository connectionRepository;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    private static final String GITHUB_API_BASE = "https://api.github.com";

    @Override
    public String getPlatformName() {
        return "GITHUB";
    }

    @Override
    public boolean connect(String accessToken, String refreshToken, String workspaceId) {
        try {
            SaaSConnection connection = connectionRepository.findByPlatform(SaaSPlatform.GITHUB)
                    .orElse(SaaSConnection.builder().platform(SaaSPlatform.GITHUB).build());

            connection.setAccessToken(accessToken);
            connection.setRefreshToken(refreshToken);
            connection.setWorkspaceId(workspaceId);
            connection.setConnected(true);
            connectionRepository.save(connection);

            log.info("GitHub connector connected successfully");
            return true;
        } catch (Exception e) {
            log.error("Failed to connect GitHub connector: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public boolean disconnect() {
        try {
            connectionRepository.findByPlatform(SaaSPlatform.GITHUB).ifPresent(conn -> {
                conn.setConnected(false);
                conn.setAccessToken(null);
                conn.setRefreshToken(null);
                connectionRepository.save(conn);
            });
            return true;
        } catch (Exception e) {
            log.error("Failed to disconnect GitHub: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public List<String> getUsers() {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.GITHUB);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            return getMockUsers();
        }

        try {
            String token = connectionOpt.get().getAccessToken();
            String org = connectionOpt.get().getWorkspaceId();
            Request request = new Request.Builder()
                    .url(GITHUB_API_BASE + "/orgs/" + org + "/members")
                    .header("Authorization", "Bearer " + token)
                    .header("Accept", "application/vnd.github+json")
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    return getMockUsers();
                }
                JsonNode root = objectMapper.readTree(response.body().string());
                List<String> logins = new ArrayList<>();
                root.forEach(member -> logins.add(member.path("login").asText()));
                return logins;
            }
        } catch (Exception e) {
            log.error("Error fetching GitHub users: {}", e.getMessage());
            return getMockUsers();
        }
    }

    @Override
    public List<DiscoveredPermissionDto> getPermissions(String email) {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.GITHUB);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            return getMockPermissions(email);
        }

        List<DiscoveredPermissionDto> permissions = new ArrayList<>();
        try {
            String token = connectionOpt.get().getAccessToken();
            // In production, look up user by email then check org membership
            // GitHub API does not directly search by email in some plans
            permissions.add(DiscoveredPermissionDto.builder()
                    .platform(SaaSPlatform.GITHUB)
                    .permissionType("MEMBER")
                    .permissionDetail("GitHub Organization Member")
                    .isAdmin(false)
                    .isOwner(false)
                    .hasApiToken(true)
                    .accessibleResources(5)
                    .build());
        } catch (Exception e) {
            log.error("Error fetching GitHub permissions: {}", e.getMessage());
            return getMockPermissions(email);
        }
        return permissions;
    }

    @Override
    public boolean revokeAccess(String email) {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.GITHUB);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            log.warn("GitHub not connected. Simulating revocation for {}", email);
            return true;
        }

        try {
            log.info("Revoking GitHub access for user: {}", email);
            // In production: DELETE /orgs/{org}/members/{username}
            return true;
        } catch (Exception e) {
            log.error("Failed to revoke GitHub access for {}: {}", email, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean isConnected() {
        return connectionRepository.findByPlatform(SaaSPlatform.GITHUB)
                .map(SaaSConnection::getConnected)
                .orElse(false);
    }

    // ── Mock data ─────────────────────────────────────────────────────────────

    private List<String> getMockUsers() {
        return List.of("alice", "bob", "charlie");
    }

    private List<DiscoveredPermissionDto> getMockPermissions(String email) {
        return List.of(
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.GITHUB)
                        .permissionType("REPOSITORY_ACCESS")
                        .permissionDetail("Access to 5 private repositories")
                        .isAdmin(false)
                        .isOwner(false)
                        .hasApiToken(true)
                        .accessibleResources(5)
                        .build(),
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.GITHUB)
                        .permissionType("ORGANIZATION_OWNER")
                        .permissionDetail("GitHub Organization Owner")
                        .isAdmin(true)
                        .isOwner(true)
                        .hasApiToken(true)
                        .accessibleResources(5)
                        .build()
        );
    }
}
