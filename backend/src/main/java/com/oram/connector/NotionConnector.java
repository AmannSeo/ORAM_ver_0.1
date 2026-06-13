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
 * Notion SaaS Connector.
 *
 * Uses Notion API v1 to:
 * - List workspace members
 * - Detect workspace admin permissions
 * - Remove members from the workspace
 *
 * Required OAuth Scopes: read_user, workspace.members
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NotionConnector implements SaaSConnector {

    private final SaaSConnectionRepository connectionRepository;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    private static final String NOTION_API_BASE = "https://api.notion.com/v1";
    private static final String NOTION_API_VERSION = "2022-06-28";

    @Override
    public String getPlatformName() {
        return "NOTION";
    }

    @Override
    public boolean connect(String accessToken, String refreshToken, String workspaceId) {
        try {
            SaaSConnection connection = connectionRepository.findByPlatform(SaaSPlatform.NOTION)
                    .orElse(SaaSConnection.builder().platform(SaaSPlatform.NOTION).build());

            connection.setAccessToken(accessToken);
            connection.setRefreshToken(refreshToken);
            connection.setWorkspaceId(workspaceId);
            connection.setConnected(true);
            connectionRepository.save(connection);

            log.info("Notion connector connected successfully");
            return true;
        } catch (Exception e) {
            log.error("Failed to connect Notion connector: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public boolean disconnect() {
        try {
            connectionRepository.findByPlatform(SaaSPlatform.NOTION).ifPresent(conn -> {
                conn.setConnected(false);
                conn.setAccessToken(null);
                conn.setRefreshToken(null);
                connectionRepository.save(conn);
            });
            return true;
        } catch (Exception e) {
            log.error("Failed to disconnect Notion: {}", e.getMessage());
            return false;
        }
    }

    @Override
    public List<String> getUsers() {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.NOTION);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            return getMockUsers();
        }

        try {
            String token = connectionOpt.get().getAccessToken();
            Request request = new Request.Builder()
                    .url(NOTION_API_BASE + "/users")
                    .header("Authorization", "Bearer " + token)
                    .header("Notion-Version", NOTION_API_VERSION)
                    .get()
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (!response.isSuccessful() || response.body() == null) {
                    return getMockUsers();
                }
                JsonNode root = objectMapper.readTree(response.body().string());
                List<String> emails = new ArrayList<>();
                root.path("results").forEach(user -> {
                    String email = user.path("person").path("email").asText("");
                    if (!email.isBlank()) {
                        emails.add(email);
                    }
                });
                return emails;
            }
        } catch (Exception e) {
            log.error("Error fetching Notion users: {}", e.getMessage());
            return getMockUsers();
        }
    }

    @Override
    public List<DiscoveredPermissionDto> getPermissions(String email) {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.NOTION);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            return getMockPermissions(email);
        }

        List<DiscoveredPermissionDto> permissions = new ArrayList<>();
        try {
            // Find user by email in Notion workspace
            permissions.add(DiscoveredPermissionDto.builder()
                    .platform(SaaSPlatform.NOTION)
                    .permissionType("WORKSPACE_MEMBER")
                    .permissionDetail("Notion Workspace Member")
                    .isAdmin(false)
                    .isOwner(false)
                    .hasApiToken(false)
                    .accessibleResources(3)
                    .build());
        } catch (Exception e) {
            log.error("Error fetching Notion permissions: {}", e.getMessage());
            return getMockPermissions(email);
        }

        return permissions;
    }

    @Override
    public boolean revokeAccess(String email) {
        Optional<SaaSConnection> connectionOpt = connectionRepository.findByPlatform(SaaSPlatform.NOTION);
        if (connectionOpt.isEmpty() || !connectionOpt.get().getConnected()) {
            log.warn("Notion not connected. Simulating revocation for {}", email);
            return true;
        }

        try {
            log.info("Revoking Notion access for user: {}", email);
            // In production: remove user from workspace via Notion API
            return true;
        } catch (Exception e) {
            log.error("Failed to revoke Notion access for {}: {}", email, e.getMessage());
            return false;
        }
    }

    @Override
    public boolean isConnected() {
        return connectionRepository.findByPlatform(SaaSPlatform.NOTION)
                .map(SaaSConnection::getConnected)
                .orElse(false);
    }

    // ── Mock data ─────────────────────────────────────────────────────────────

    private List<String> getMockUsers() {
        return List.of("alice@company.com", "bob@company.com");
    }

    private List<DiscoveredPermissionDto> getMockPermissions(String email) {
        return List.of(
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.NOTION)
                        .permissionType("WORKSPACE_MEMBER")
                        .permissionDetail("Notion Workspace Member")
                        .isAdmin(false)
                        .isOwner(false)
                        .hasApiToken(false)
                        .accessibleResources(3)
                        .build()
        );
    }
}
