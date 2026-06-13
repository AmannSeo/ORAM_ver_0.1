package com.oram.service;

import com.oram.dto.response.SaaSConnectionResponse;
import com.oram.entity.SaaSConnection;
import com.oram.entity.SaaSConnection.SaaSPlatform;
import com.oram.repository.SaaSConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class SaaSConnectionService {

    private final SaaSConnectionRepository connectionRepository;

    @Transactional(readOnly = true)
    public List<SaaSConnectionResponse> getAllConnections() {
        return connectionRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public SaaSConnectionResponse getConnection(SaaSPlatform platform) {
        return connectionRepository.findByPlatform(platform)
                .map(this::toResponse)
                .orElseThrow(() -> new NoSuchElementException("Connection not found for platform: " + platform));
    }

    /**
     * Store OAuth tokens after successful OAuth callback.
     * Tokens should be encrypted before storage in production.
     */
    public SaaSConnectionResponse saveOAuthTokens(
            SaaSPlatform platform,
            String accessToken,
            String refreshToken,
            String workspaceId,
            String workspaceName,
            String connectedBy
    ) {
        SaaSConnection connection = connectionRepository.findByPlatform(platform)
                .orElse(SaaSConnection.builder().platform(platform).build());

        // TODO: Encrypt tokens using AES-256 before storing
        connection.setAccessToken(accessToken);
        connection.setRefreshToken(refreshToken);
        connection.setWorkspaceId(workspaceId);
        connection.setWorkspaceName(workspaceName);
        connection.setConnectedBy(connectedBy);
        connection.setConnected(true);
        connection.setLastSyncedAt(LocalDateTime.now());

        SaaSConnection saved = connectionRepository.save(connection);
        log.info("OAuth tokens saved for platform: {}", platform);
        return toResponse(saved);
    }

    public SaaSConnectionResponse disconnect(SaaSPlatform platform) {
        SaaSConnection connection = connectionRepository.findByPlatform(platform)
                .orElseThrow(() -> new NoSuchElementException("Connection not found: " + platform));

        connection.setConnected(false);
        connection.setAccessToken(null);
        connection.setRefreshToken(null);
        connection.setWorkspaceId(null);
        connection.setWorkspaceName(null);
        connection.setConnectedBy(null);

        SaaSConnection saved = connectionRepository.save(connection);
        log.info("Disconnected platform: {}", platform);
        return toResponse(saved);
    }

    public long countConnected() {
        return connectionRepository.countByConnected(true);
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    public SaaSConnectionResponse toResponse(SaaSConnection connection) {
        return SaaSConnectionResponse.builder()
                .id(connection.getId())
                .platform(connection.getPlatform())
                .connected(connection.getConnected())
                .workspaceId(connection.getWorkspaceId())
                .workspaceName(connection.getWorkspaceName())
                .connectedBy(connection.getConnectedBy())
                .lastSyncedAt(connection.getLastSyncedAt())
                .updatedAt(connection.getUpdatedAt())
                .build();
    }
}
