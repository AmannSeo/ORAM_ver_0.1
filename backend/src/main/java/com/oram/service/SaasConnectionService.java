package com.oram.service;

import com.oram.config.EncryptionConfig;
import com.oram.connector.ConnectorRegistry;
import com.oram.connector.SaaSConnector;
import com.oram.dto.SaasConnectionDto;
import com.oram.entity.SaasConnection;
import com.oram.entity.User;
import com.oram.enums.SaasType;
import com.oram.repository.SaasConnectionRepository;
import com.oram.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaasConnectionService {

    private final SaasConnectionRepository connectionRepository;
    private final ConnectorRegistry connectorRegistry;
    private final EncryptionConfig.TokenEncryptor tokenEncryptor;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<SaasConnectionDto.Response> getAllConnections() {
        // 모든 SaaS 타입에 대해 연결 상태 반환
        return Arrays.stream(SaasType.values())
                .map(type -> {
                    Optional<SaasConnection> conn = connectionRepository.findBySaasType(type);
                    return conn.map(c -> SaasConnectionDto.Response.builder()
                            .id(c.getId())
                            .saasType(c.getSaasType())
                            .workspaceName(c.getWorkspaceName())
                            .isConnected(c.isConnected())
                            .connectedAt(c.getConnectedAt())
                            .connectedBy(c.getConnectedBy() != null ? c.getConnectedBy().getEmail() : null)
                            .build()
                    ).orElse(SaasConnectionDto.Response.builder()
                            .saasType(type)
                            .isConnected(false)
                            .build());
                })
                .toList();
    }

    public SaasConnectionDto.OAuthUrlResponse getOAuthUrl(SaasType saasType) {
        SaaSConnector connector = connectorRegistry.getConnector(saasType)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported SaaS: " + saasType));
        String state = UUID.randomUUID().toString();
        String url = connector.getOAuthAuthorizationUrl(state);
        return SaasConnectionDto.OAuthUrlResponse.builder().authorizationUrl(url).build();
    }

    @Transactional
    public void handleOAuthCallback(SaasType saasType, String code) {
        SaaSConnector connector = connectorRegistry.getConnector(saasType)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported SaaS: " + saasType));

        SaaSConnector.TokenInfo tokenInfo = connector.exchangeCodeForToken(code);

        // 기존 연결 업데이트 또는 새로 생성
        SaasConnection connection = connectionRepository.findBySaasType(saasType)
                .orElse(SaasConnection.builder().saasType(saasType).build());

        connection.setAccessTokenEncrypted(tokenEncryptor.encrypt(tokenInfo.accessToken()));
        if (tokenInfo.refreshToken() != null) {
            connection.setRefreshTokenEncrypted(tokenEncryptor.encrypt(tokenInfo.refreshToken()));
        }
        connection.setWorkspaceId(tokenInfo.workspaceId());
        connection.setWorkspaceName(tokenInfo.workspaceName());
        connection.setConnected(true);
        connection.setConnectedAt(LocalDateTime.now());

        if (tokenInfo.expiresInSeconds() > 0) {
            connection.setExpiresAt(LocalDateTime.now().plusSeconds(tokenInfo.expiresInSeconds()));
        }

        // 현재 로그인 사용자 설정
        getCurrentUser().ifPresent(connection::setConnectedBy);
        connectionRepository.save(connection);

        auditService.log(null, "CONNECT_SAAS", "SAAS_CONNECTION", saasType.name(),
                "Connected to " + saasType + " workspace: " + tokenInfo.workspaceName());
        log.info("SaaS connection established: {}, workspace: {}", saasType, tokenInfo.workspaceName());
    }

    /**
     * OAuth 자격증명 없이 데모 연결을 생성합니다 (PoC 시연용)
     */
    @Transactional
    public SaasConnectionDto.Response demoConnect(SaasType saasType) {
        SaasConnection connection = connectionRepository.findBySaasType(saasType)
                .orElse(SaasConnection.builder().saasType(saasType).build());

        connection.setAccessTokenEncrypted(tokenEncryptor.encrypt("demo-" + saasType.name().toLowerCase() + "-mock-token"));
        connection.setWorkspaceId("demo-" + saasType.name().toLowerCase() + "-ws");
        connection.setWorkspaceName("[데모] " + saasType.name() + " Workspace");
        connection.setConnected(true);
        connection.setConnectedAt(LocalDateTime.now());
        getCurrentUser().ifPresent(connection::setConnectedBy);
        connectionRepository.save(connection);

        auditService.log(null, "DEMO_CONNECT", "SAAS_CONNECTION", saasType.name(),
                "[데모] " + saasType + " 데모 연결 완료");

        return SaasConnectionDto.Response.builder()
                .id(connection.getId())
                .saasType(connection.getSaasType())
                .workspaceName(connection.getWorkspaceName())
                .isConnected(true)
                .connectedAt(connection.getConnectedAt())
                .build();
    }

    @Transactional
    public void disconnect(SaasType saasType) {
        SaasConnection connection = connectionRepository.findBySaasType(saasType)
                .orElseThrow(() -> new IllegalArgumentException("SaaS not connected: " + saasType));

        connectorRegistry.getConnector(saasType).ifPresent(connector -> {
            try {
                String token = tokenEncryptor.decrypt(connection.getAccessTokenEncrypted());
                connector.disconnect(token);
            } catch (Exception e) {
                log.warn("Token revocation failed during disconnect: {}", e.getMessage());
            }
        });

        connection.setConnected(false);
        connection.setAccessTokenEncrypted(null);
        connection.setRefreshTokenEncrypted(null);
        connectionRepository.save(connection);

        auditService.log(null, "DISCONNECT_SAAS", "SAAS_CONNECTION", saasType.name(),
                "Disconnected from " + saasType);
    }

    private Optional<User> getCurrentUser() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email);
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
