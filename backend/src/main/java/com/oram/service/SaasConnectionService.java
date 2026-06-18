package com.oram.service;

import com.oram.config.EncryptionConfig;
import com.oram.connector.ConnectorRegistry;
import com.oram.connector.GitHubConnector;
import com.oram.connector.NotionConnector;
import com.oram.connector.SaaSConnector;
import com.oram.connector.SlackConnector;
import com.oram.dto.SaasConnectionDto;
import com.oram.entity.Employee;
import com.oram.entity.SaasConnection;
import com.oram.entity.User;
import com.oram.enums.EmployeeStatus;
import com.oram.enums.SaasType;
import com.oram.repository.EmployeeRepository;
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
    private final EmployeeRepository employeeRepository;
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
        int syncedUsers = syncUsersFromConnector(saasType, connector, tokenInfo.accessToken());

        auditService.log(null, "CONNECT_SAAS", "SAAS_CONNECTION", saasType.name(),
                "Connected to " + saasType + " workspace: " + tokenInfo.workspaceName() + ", synced users: " + syncedUsers);
        log.info("SaaS connection established: {}, workspace: {}, synced users: {}",
                saasType, tokenInfo.workspaceName(), syncedUsers);
    }

    /**
     * 토큰 직접 입력 방식 연결 (OAuth App 등록 없이 사용 가능)
     *
     * Slack  : Bot Token (xoxb-...) 또는 User Token (xoxp-...)
     * GitHub : Personal Access Token (ghp_...) 또는 Fine-grained PAT
     * Notion : Internal Integration Token (secret_...)
     *
     * 입력된 토큰을 실제 SaaS API로 검증한 후 저장합니다.
     */
    @Transactional
    public SaasConnectionDto.Response tokenConnect(SaasType saasType, String rawToken, String workspaceName) {
        String token = normalizeToken(rawToken);
        // 1. 실제 API 검증 (토큰이 살아있는지, 권한이 있는지)
        SaaSConnector connector = connectorRegistry.getConnector(saasType)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported SaaS: " + saasType));

        boolean valid = connector.validateToken(token);
        if (!valid) {
            throw new IllegalArgumentException(
                saasType.name() + " 토큰 인증 실패. 토큰이 유효한지, 필요한 권한(scope)이 있는지 확인하세요."
            );
        }

        // 워크스페이스 이름 자동 조회 (사용자가 직접 입력하지 않은 경우)
        String resolvedWorkspaceName = workspaceName != null && !workspaceName.isBlank()
                ? workspaceName
                : autoDetectWorkspaceName(saasType, connector, token);

        // 2. 저장 (AES-256 암호화)
        SaasConnection connection = connectionRepository.findBySaasType(saasType)
                .orElse(SaasConnection.builder().saasType(saasType).build());

        connection.setAccessTokenEncrypted(tokenEncryptor.encrypt(token));
        connection.setWorkspaceId(saasType.name().toLowerCase() + "-token-connect");
        connection.setWorkspaceName(resolvedWorkspaceName);
        connection.setConnected(true);
        connection.setConnectedAt(LocalDateTime.now());
        getCurrentUser().ifPresent(connection::setConnectedBy);
        connectionRepository.save(connection);
        int syncedUsers = syncUsersFromConnector(saasType, connector, token);

        auditService.log(null, "TOKEN_CONNECT", "SAAS_CONNECTION", saasType.name(),
                "Token-based connection: " + saasType + " / " + connection.getWorkspaceName() + ", synced users: " + syncedUsers);
        log.info("Token-based SaaS connection established: {}, synced users: {}", saasType, syncedUsers);

        return SaasConnectionDto.Response.builder()
                .id(connection.getId())
                .saasType(connection.getSaasType())
                .workspaceName(connection.getWorkspaceName())
                .isConnected(true)
                .connectedAt(connection.getConnectedAt())
                .build();
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

    @Transactional
    public int syncConnectedUsers(SaasType saasType) {
        SaasConnection connection = connectionRepository.findBySaasType(saasType)
                .filter(SaasConnection::isConnected)
                .orElseThrow(() -> new IllegalArgumentException("SaaS not connected: " + saasType));
        SaaSConnector connector = connectorRegistry.getConnector(saasType)
                .orElseThrow(() -> new IllegalArgumentException("Unsupported SaaS: " + saasType));

        String token = tokenEncryptor.decrypt(connection.getAccessTokenEncrypted());
        return syncUsersFromConnector(saasType, connector, token);
    }

    private Optional<User> getCurrentUser() {
        try {
            String email = SecurityContextHolder.getContext().getAuthentication().getName();
            return userRepository.findByEmail(email);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    /**
     * SaaS별 워크스페이스 이름 자동 탐지
     */
    private int syncUsersFromConnector(SaasType saasType, SaaSConnector connector, String token) {
        try {
            List<SaaSConnector.SyncedUser> users = connector.listUsers(token);
            int created = 0;

            for (SaaSConnector.SyncedUser user : users) {
                String email = normalizeEmail(user.email());
                String employeeId = buildSaasEmployeeId(saasType, user.externalId(), email);
                if (email == null || employeeId == null) continue;
                if (employeeRepository.existsByEmail(email) || employeeRepository.existsByEmployeeId(employeeId)) {
                    continue;
                }

                Employee employee = Employee.builder()
                        .employeeId(employeeId)
                        .name(user.name() != null && !user.name().isBlank() ? user.name() : email)
                        .email(email)
                        .department(user.department() != null && !user.department().isBlank()
                                ? user.department()
                                : saasType.name())
                        .status(user.active() ? EmployeeStatus.ACTIVE : EmployeeStatus.RESIGNED)
                        .build();
                employeeRepository.save(employee);
                created++;
            }

            if (created > 0) {
                auditService.log(null, "SYNC_SAAS_USERS", "SAAS_CONNECTION", saasType.name(),
                        "Synced " + created + " users from " + saasType);
            }
            return created;
        } catch (Exception e) {
            log.warn("SaaS user sync failed for {}: {}", saasType, e.getMessage());
            return 0;
        }
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) return null;
        return email.trim().toLowerCase();
    }

    private String normalizeToken(String token) {
        if (token == null) return "";
        return token.replaceAll("\\s+", "");
    }

    private String buildSaasEmployeeId(SaasType saasType, String externalId, String email) {
        String source = externalId != null && !externalId.isBlank() ? externalId : email;
        if (source == null || source.isBlank()) return null;
        String normalized = source.replaceAll("[^A-Za-z0-9]", "-").replaceAll("-+", "-").toUpperCase();
        String employeeId = saasType.name() + "-" + normalized;
        return employeeId.length() <= 50 ? employeeId : employeeId.substring(0, 50);
    }

    private String autoDetectWorkspaceName(SaasType saasType, SaaSConnector connector, String token) {
        try {
            return switch (saasType) {
                case SLACK  -> ((SlackConnector) connector).getWorkspaceName(token);
                case GITHUB -> ((GitHubConnector) connector).getWorkspaceName(token);
                case NOTION -> ((NotionConnector) connector).getWorkspaceName(token);
            };
        } catch (Exception e) {
            log.warn("Failed to detect workspace name for {}: {}", saasType, e.getMessage());
            return saasType.name() + " Workspace";
        }
    }
}
