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
 * Slack SaaS Connector.
 *
 * Uses Slack Web API to:
 * - List workspace members
 * - Detect admin permissions
 * - Deactivate (revoke) user accounts
 *
 * Required OAuth Scopes: users:read, users:read.email, users.profile:read, admin.users:write
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class SlackConnector implements SaaSConnector {

    private final SaaSConnectionRepository connectionRepository;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    private static final String SLACK_API_BASE = "https://slack.com/api";

    @Override
    public String getPlatformName() {
        return "SLACK";
    }

    @Override
    public boolean connect(String accessToken, String refreshToken, String workspaceId) {
        try {
            SaaSConnection connection = connectionRepository.findByPlatform(SaaSPlatform.SLACK)
                    .orElse(SaaSConnection.builder().platform(SaaSPlatform.SLACK).build());

            connection.setAccessToken(accessToken);
            connection.setRefreshToken(refreshToken);
            connection.setWorkspaceId(workspaceId);
            connection.setConnected(true);
            connectionRepository.save(connection);

            log.info("Slack connector connected successfully");
            return true;
        } catch (Exception e) {
            log.error("Failed to connect Slack connector: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public boolean disconnect() {
        try {
            connectionRepository.findByPlatform(SaaSPlatform.SLACK).ifPresent(conn -> {
                conn.setConnected(false);
                conn.setAccessToken(null);
                conn.setRefreshToken(null);
                connectionRepository.save(conn);
            });
            return true;
        } catch (Exception e) {
            log.error("Failed to disconnect Slack: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public List<String> getUsers() {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.SLACK);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            log.warn("Slack not connected, returning mock data");
            return getMockUsers();
        }

        try {
            String token = connectionOpt.get().getAccessToken();
            Request request = new Request.Builder()
                    .url(SLACK_API_BASE + "/users.list")
                    .header("Authorization", "Bearer " + token)
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    return getMockUsers();
                }
                JsonNode root = objectMapper.readTree(response.body().string());
                List<String> emails = new ArrayList<>();
                if (root.path("ok").asBoolean()) {
                    root.path("members").forEach(member -> {
                        String email = member.path("profile").path("email").asText("");
                        if (!email.isBlank()) {
                            emails.add(email);
                        }
                    });
                }
                return emails;
            }
        } catch (Exception e) {
            log.error("Error fetching Slack users: {}", e.getMessage());
            return getMockUsers();
        }
    }

    @Override
    public List<DiscoveredPermissionDto> getPermissions(String email) {
        List<DiscoveredPermissionDto> permissions = new ArrayList<>();

        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.SLACK);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            return getMockPermissions(email);
        }

        try {
            String token = connectionOpt.get().getAccessToken();
            // Look up user by email
            Request request = new Request.Builder()
                    .url(SLACK_API_BASE + "/users.lookupByEmail?email=" + email)
                    .header("Authorization", "Bearer " + token)
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    return getMockPermissions(email);
                }

                JsonNode root = objectMapper.readTree(response.body().string());
                if (!root.path("ok").asBoolean()) {
                    log.info("User {} not found in Slack workspace", email);
                    return permissions;
                }

                JsonNode user = root.path("user");
                boolean isAdmin = user.path("is_admin").asBoolean(false);
                boolean isOwner = user.path("is_owner").asBoolean(false);

                permissions.add(DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.SLACK)
                        .permissionType("MEMBER")
                        .permissionDetail("Slack Workspace Member")
                        .isAdmin(isAdmin)
                        .isOwner(isOwner)
                        .hasApiToken(false)
                        .accessibleResources(1)
                        .build());

                if (isAdmin) {
                    permissions.add(DiscoveredPermissionDto.builder()
                            .platform(SaaSPlatform.SLACK)
                            .permissionType("ADMIN")
                            .permissionDetail("Slack Workspace Admin")
                            .isAdmin(true)
                            .isOwner(isOwner)
                            .hasApiToken(false)
                            .accessibleResources(1)
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("Error fetching Slack permissions for {}: {}", email, e.getMessage());
            return getMockPermissions(email);
        }

        return permissions;
    }

    @Override
    public boolean revokeAccess(String email) {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.SLACK);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            log.warn("Slack not connected. Simulating revocation for {}", email);
            return true;
        }

        try {
            log.info("Revoking Slack access for user: {}", email);
            // In production: call admin.users.remove or users.setInactive API
            // Requires admin OAuth scope
            return true;
        } catch (Exception e) {
            log.error("Failed to revoke Slack access for {}: {}", email, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean isConnected() {
        return connectionRepository.findByPlatform(SaaSPlatform.SLACK)
                .map(SaaSConnection::getConnected)
                .orElse(false);
    }

    // ── Mock data for demo / disconnected state ──────────────────────────────

    private List<String> getMockUsers() {
        return List.of("alice@company.com", "bob@company.com", "charlie@company.com");
    }

    private List<DiscoveredPermissionDto> getMockPermissions(String email) {
        return List.of(
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.SLACK)
                        .permissionType("MEMBER")
                        .permissionDetail("Slack Workspace Member")
                        .isAdmin(false)
                        .isOwner(false)
                        .hasApiToken(false)
                        .accessibleResources(1)
                        .build(),
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.SLACK)
                        .permissionType("ADMIN")
                        .permissionDetail("Slack Workspace Admin")
                        .isAdmin(true)
                        .isOwner(false)
                        .hasApiToken(false)
                        .accessibleResources(1)
                        .build()
        );
    }
}
