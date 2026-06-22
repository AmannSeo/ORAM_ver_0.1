package com.oram.service;

import com.oram.config.EncryptionConfig;
import com.oram.connector.ConnectorRegistry;
import com.oram.connector.GitHubConnector;
import com.oram.connector.NotionConnector;
import com.oram.connector.SaaSConnector;
import com.oram.connector.SlackConnector;
import com.oram.dto.SaasConnectionDto;
import com.oram.entity.Employee;
import com.oram.entity.SaasIdentity;
import com.oram.entity.SaasConnection;
import com.oram.entity.SaasSyncAlert;
import com.oram.entity.User;
import com.oram.enums.EmployeeStatus;
import com.oram.enums.SaasSyncAlertStatus;
import com.oram.enums.SaasType;
import com.oram.repository.EmployeeRepository;
import com.oram.repository.SaasIdentityRepository;
import com.oram.repository.SaasConnectionRepository;
import com.oram.repository.SaasSyncAlertRepository;
import com.oram.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaasConnectionService {

    private final SaasConnectionRepository connectionRepository;
    private final ConnectorRegistry connectorRegistry;
    private final EncryptionConfig.TokenEncryptor tokenEncryptor;
    private final EmployeeRepository employeeRepository;
    private final SaasIdentityRepository saasIdentityRepository;
    private final SaasSyncAlertRepository saasSyncAlertRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final OffboardingService offboardingService;

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
                            .accountScope(resolveAccountScope(c.getSaasType(), c.getAccountScope()))
                            .enterpriseAccount(isEnterpriseAccount(c.getSaasType(), c.getAccountScope()))
                            .isConnected(c.isConnected())
                            .connectedAt(c.getConnectedAt())
                            .connectedBy(c.getConnectedBy() != null ? c.getConnectedBy().getEmail() : null)
                            .identityCount(saasIdentityRepository.countBySaasType(type))
                            .lastSyncedAt(saasIdentityRepository.findLatestSyncedAtBySaasType(type))
                            .openAlertCount(saasSyncAlertRepository.countBySaasTypeAndStatus(type, SaasSyncAlertStatus.OPEN))
                            .build()
                    ).orElse(SaasConnectionDto.Response.builder()
                            .saasType(type)
                            .accountScope(resolveAccountScope(type, null))
                            .enterpriseAccount(false)
                            .isConnected(false)
                            .identityCount(saasIdentityRepository.countBySaasType(type))
                            .lastSyncedAt(saasIdentityRepository.findLatestSyncedAtBySaasType(type))
                            .openAlertCount(saasSyncAlertRepository.countBySaasTypeAndStatus(type, SaasSyncAlertStatus.OPEN))
                            .build());
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SaasConnectionDto.IdentityResponse> getIdentities(SaasType saasType) {
        return saasIdentityRepository.findBySaasTypeOrderByUpdatedAtDesc(saasType).stream()
                .map(identity -> SaasConnectionDto.IdentityResponse.builder()
                        .id(identity.getId())
                        .saasType(identity.getSaasType())
                        .externalUserId(identity.getExternalUserId())
                        .externalUsername(identity.getExternalUsername())
                        .externalEmail(identity.getExternalEmail())
                        .displayName(identity.getDisplayName())
                        .department(identity.getDepartment())
                        .status(identity.getStatus() != null ? identity.getStatus().name() : null)
                        .accessRevoked(identity.isAccessRevoked())
                        .lastSyncedAt(identity.getLastSyncedAt())
                        .employeeId(identity.getEmployee() != null ? identity.getEmployee().getId() : null)
                        .employeeName(identity.getEmployee() != null ? identity.getEmployee().getName() : null)
                        .employeeEmail(identity.getEmployee() != null ? identity.getEmployee().getEmail() : null)
                        .build())
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
        connection.setAccountScope(resolveAccountScope(saasType, null));
        connection.setConnected(true);
        connection.setConnectedAt(LocalDateTime.now());

        if (tokenInfo.expiresInSeconds() > 0) {
            connection.setExpiresAt(LocalDateTime.now().plusSeconds(tokenInfo.expiresInSeconds()));
        }

        // 현재 로그인 사용자 설정
        getCurrentUser().ifPresent(connection::setConnectedBy);
        connectionRepository.save(connection);
        SaasConnectionDto.SyncUsersResponse syncResult = syncUsersFromConnector(saasType, connector, tokenInfo.accessToken());

        auditService.log(null, "CONNECT_SAAS", "SAAS_CONNECTION", saasType.name(),
                "Connected to " + saasType + " workspace: " + tokenInfo.workspaceName() + ", synced users: " + syncResult.getSyncedCount());
        log.info("SaaS connection established: {}, workspace: {}, synced users: {}",
                saasType, tokenInfo.workspaceName(), syncResult.getSyncedCount());
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
        return tokenConnect(saasType, rawToken, workspaceName, null);
    }

    @Transactional
    public SaasConnectionDto.Response tokenConnect(SaasType saasType, String rawToken, String workspaceName, String accountScope) {
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
        connection.setAccountScope(resolveAccountScope(saasType, accountScope));
        connection.setConnected(true);
        connection.setConnectedAt(LocalDateTime.now());
        getCurrentUser().ifPresent(connection::setConnectedBy);
        connectionRepository.save(connection);
        SaasConnectionDto.SyncUsersResponse syncResult = syncUsersFromConnector(saasType, connector, token);

        auditService.log(null, "TOKEN_CONNECT", "SAAS_CONNECTION", saasType.name(),
                "Token-based connection: " + saasType + " / " + connection.getWorkspaceName() + ", synced users: " + syncResult.getSyncedCount());
        log.info("Token-based SaaS connection established: {}, synced users: {}", saasType, syncResult.getSyncedCount());

        return SaasConnectionDto.Response.builder()
                .id(connection.getId())
                .saasType(connection.getSaasType())
                .workspaceName(connection.getWorkspaceName())
                .accountScope(resolveAccountScope(connection.getSaasType(), connection.getAccountScope()))
                .enterpriseAccount(isEnterpriseAccount(connection.getSaasType(), connection.getAccountScope()))
                .isConnected(true)
                .connectedAt(connection.getConnectedAt())
                .identityCount(saasIdentityRepository.countBySaasType(saasType))
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
        connection.setAccountScope(resolveAccountScope(saasType, null));
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
                .accountScope(resolveAccountScope(connection.getSaasType(), connection.getAccountScope()))
                .enterpriseAccount(isEnterpriseAccount(connection.getSaasType(), connection.getAccountScope()))
                .isConnected(true)
                .connectedAt(connection.getConnectedAt())
                .identityCount(saasIdentityRepository.countBySaasType(saasType))
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
    public SaasConnectionDto.SyncUsersResponse syncConnectedUsers(SaasType saasType) {
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
    private SaasConnectionDto.SyncUsersResponse syncUsersFromConnector(SaasType saasType, SaaSConnector connector, String token) {
        try {
            List<SaaSConnector.SyncedUser> users = connector.listUsers(token);
            List<SaasIdentity> previousIdentities = saasIdentityRepository.findBySaasTypeOrderByUpdatedAtDesc(saasType);
            Set<String> seenExternalIds = new HashSet<>();
            List<String> warnings = new ArrayList<>();
            int created = 0;
            int mapped = 0;
            int inactiveCount = 0;
            int residualAccessCount = 0;
            int resolvedAlertCount = 0;

            for (SaaSConnector.SyncedUser user : users) {
                String email = normalizeEmail(user.email());
                String externalId = normalizeExternalId(saasType, user.externalId(), email);
                if (externalId == null) {
                    warnings.add("Skipped a " + saasType + " account because it had no stable id or email.");
                    continue;
                }
                seenExternalIds.add(externalId);

                Employee employee = resolveOrCreateEmployee(saasType, user, email, externalId);
                boolean resignedEmployeeStillActive = employee != null
                        && employee.getStatus() == EmployeeStatus.RESIGNED
                        && user.active();
                SaasIdentity identity = saasIdentityRepository
                        .findBySaasTypeAndExternalUserId(saasType, externalId)
                        .orElseGet(() -> {
                            SaasIdentity newIdentity = SaasIdentity.builder()
                                    .saasType(saasType)
                                    .externalUserId(externalId)
                                    .build();
                            return newIdentity;
                        });

                if (identity.getId() == null) created++;
                if (identity.getEmployee() == null && employee != null) mapped++;

                identity.setEmployee(employee);
                identity.setExternalEmail(email);
                identity.setExternalUsername(extractExternalUsername(saasType, externalId, email));
                identity.setDisplayName(user.name() != null && !user.name().isBlank() ? user.name() : email);
                identity.setDepartment(user.department() != null && !user.department().isBlank()
                        ? user.department()
                        : saasType.name());
                identity.setStatus(user.active() ? EmployeeStatus.ACTIVE : EmployeeStatus.RESIGNED);
                identity.setHasRevokePermission(saasType != SaasType.NOTION && user.active());
                identity.setLastSyncedAt(LocalDateTime.now());
                saasIdentityRepository.save(identity);

                if (employee != null && !user.active()) {
                    inactiveCount++;
                    employee.setStatus(EmployeeStatus.RESIGNED);
                    employeeRepository.save(employee);
                    UUID resultId = offboardingService.autoAnalyzeOffboarding(
                            employee,
                            saasType + "_SYNC_INACTIVE_ACCOUNT"
                    );
                    upsertOpenSyncAlert(
                            identity,
                            "INACTIVE_FROM_LATEST_SYNC",
                            "The latest " + saasType + " sync returned this account as inactive. ORAM marked the mapped employee as resigned and started risk analysis."
                    );
                    resolvedAlertCount += resolveOpenAlert(saasType, externalId, "RESIGNED_ACCOUNT_STILL_ACTIVE");
                    warnings.add("Auto risk analysis created for inactive " + saasType
                            + " account: " + employee.getEmail() + " (" + resultId + ")");
                } else if (resignedEmployeeStillActive) {
                    residualAccessCount++;
                    UUID resultId = offboardingService.autoAnalyzeOffboarding(
                            employee,
                            saasType + "_SYNC_RESIGNED_ACCOUNT_STILL_ACTIVE"
                    );
                    upsertOpenSyncAlert(
                            identity,
                            "RESIGNED_ACCOUNT_STILL_ACTIVE",
                            "This employee is marked resigned in ORAM, but the latest " + saasType
                                    + " sync still returns an active account. Revoke access or complete the required manual removal."
                    );
                    resolvedAlertCount += resolveOpenAlert(saasType, externalId, "MISSING_FROM_LATEST_SYNC");
                    resolvedAlertCount += resolveOpenAlert(saasType, externalId, "INACTIVE_FROM_LATEST_SYNC");
                    warnings.add("Residual access detected for resigned employee in " + saasType
                            + ": " + employee.getEmail() + " (" + resultId + ")");
                } else {
                    resolvedAlertCount += resolveOpenAlert(saasType, externalId, "MISSING_FROM_LATEST_SYNC");
                    resolvedAlertCount += resolveOpenAlert(saasType, externalId, "INACTIVE_FROM_LATEST_SYNC");
                    resolvedAlertCount += resolveOpenAlert(saasType, externalId, "RESIGNED_ACCOUNT_STILL_ACTIVE");
                }
            }

            int missingCount = users.isEmpty()
                    ? 0
                    : detectMissingAccounts(saasType, previousIdentities, seenExternalIds);

            if (created > 0 || mapped > 0) {
                auditService.log(null, "SYNC_SAAS_USERS", "SAAS_CONNECTION", saasType.name(),
                        "Synced identities from " + saasType + ": created=" + created + ", mapped=" + mapped);
            }

            if (missingCount > 0) {
                warnings.add(saasType + "에서 이전 동기화 때 존재하던 계정 " + missingCount + "개가 이번 동기화에서 사라졌습니다.");
                auditService.log(null, "SAAS_ACCOUNT_MISSING", "SAAS_CONNECTION", saasType.name(),
                        "Detected missing identities from " + saasType + ": missing=" + missingCount);
            }

            if (inactiveCount > 0) {
                warnings.add(saasType + "에서 비활성 상태로 반환된 계정 " + inactiveCount + "개를 퇴사/점검 대상으로 표시했습니다.");
            }

            if (residualAccessCount > 0) {
                warnings.add(saasType + "에서 퇴사자에게 남아 있는 활성 계정 " + residualAccessCount + "개를 감지했습니다.");
            }

            if (resolvedAlertCount > 0) {
                warnings.add("이전 SaaS 동기화 알림 " + resolvedAlertCount + "개를 자동 해제했습니다.");
            }

            if (users.isEmpty()) {
                warnings.add(saasType + "에서 동기화할 사용자를 찾지 못했습니다. 토큰 scope 또는 접근 가능한 조직/저장소 권한을 확인하세요.");
            }

            return SaasConnectionDto.SyncUsersResponse.builder()
                    .message(buildSyncMessage(saasType, users.size(), created, mapped, inactiveCount, missingCount, resolvedAlertCount, warnings))
                    .syncedCount(created)
                    .totalFound(users.size())
                    .missingCount(missingCount)
                    .inactiveCount(inactiveCount)
                    .resolvedAlertCount(resolvedAlertCount)
                    .warnings(warnings)
                    .build();
        } catch (Exception e) {
            log.warn("SaaS user sync failed for {}: {}", saasType, e.getMessage());
            throw new IllegalArgumentException(buildSyncFailureMessage(saasType, e), e);
        }
    }

    private String buildSyncMessage(
            SaasType saasType,
            int totalFound,
            int created,
            int mapped,
            int inactiveCount,
            int missingCount,
            int resolvedAlertCount,
            List<String> warnings
    ) {
        if (totalFound == 0) {
            return saasType + " 연결은 되어 있지만 조회된 사용자가 없습니다.";
        }
        String message = saasType + " 사용자 " + totalFound + "명을 확인했고 신규 " + created + "명, 매핑 " + mapped + "명을 반영했습니다.";
        if (inactiveCount > 0 || missingCount > 0 || resolvedAlertCount > 0) {
            message += " 비활성 " + inactiveCount + "개, 누락 " + missingCount + "개, 해제 알림 " + resolvedAlertCount + "개를 처리했습니다.";
        }
        if (!warnings.isEmpty()) {
            return message + " 일부 항목은 확인이 필요합니다.";
        }
        return message;
    }

    private String buildSyncFailureMessage(SaasType saasType, Exception e) {
        String detail = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
        if (saasType == SaasType.GITHUB) {
            return "GitHub 동기화 실패: 토큰 scope(repo, read:org, admin:org) 또는 조직/저장소 접근 권한을 확인하세요. 상세: " + detail;
        }
        return saasType + " 동기화 실패: " + detail;
    }

    private int detectMissingAccounts(SaasType saasType, List<SaasIdentity> previousIdentities, Set<String> seenExternalIds) {
        int missingCount = 0;
        for (SaasIdentity identity : previousIdentities) {
            if (identity.getExternalUserId() == null || seenExternalIds.contains(identity.getExternalUserId())) {
                continue;
            }
            if (identity.isAccessRevoked()) {
                continue;
            }

            identity.setStatus(EmployeeStatus.RESIGNED);
            identity.setHasRevokePermission(false);
            identity.setRevokeMessage("Account was not returned by the latest " + saasType + " sync.");
            identity.setRevokedAt(LocalDateTime.now());
            saasIdentityRepository.save(identity);

            if (identity.getEmployee() != null) {
                Employee employee = identity.getEmployee();
                employee.setStatus(EmployeeStatus.RESIGNED);
                employeeRepository.save(employee);
                UUID resultId = offboardingService.autoAnalyzeOffboarding(
                        employee,
                        saasType + "_SYNC_MISSING_ACCOUNT"
                );
                log.info("Auto risk analysis created for missing {} identity. employee={}, resultId={}",
                        saasType, employee.getEmail(), resultId);
            }

            saasSyncAlertRepository
                    .findBySaasTypeAndExternalUserIdAndReasonAndStatus(
                            saasType,
                            identity.getExternalUserId(),
                            "MISSING_FROM_LATEST_SYNC",
                            SaasSyncAlertStatus.OPEN
                    )
                    .orElseGet(() -> saasSyncAlertRepository.save(buildSyncAlert(
                            identity,
                            "MISSING_FROM_LATEST_SYNC",
                            "This account existed in ORAM, but was not returned by the latest " + saasType + " user sync."
                    )));
            missingCount++;
        }
        return missingCount;
    }

    private SaasSyncAlert buildSyncAlert(SaasIdentity identity, String reason, String detail) {
        return SaasSyncAlert.builder()
                .saasType(identity.getSaasType())
                .employee(identity.getEmployee())
                .externalUserId(identity.getExternalUserId())
                .externalUsername(identity.getExternalUsername())
                .externalEmail(identity.getExternalEmail())
                .displayName(identity.getDisplayName())
                .reason(reason)
                .detail(detail)
                .status(SaasSyncAlertStatus.OPEN)
                .build();
    }

    private void upsertOpenSyncAlert(SaasIdentity identity, String reason, String detail) {
        saasSyncAlertRepository
                .findBySaasTypeAndExternalUserIdAndReasonAndStatus(
                        identity.getSaasType(),
                        identity.getExternalUserId(),
                        reason,
                        SaasSyncAlertStatus.OPEN
                )
                .orElseGet(() -> saasSyncAlertRepository.save(buildSyncAlert(identity, reason, detail)));
    }

    private int resolveOpenAlert(SaasType saasType, String externalId, String reason) {
        return saasSyncAlertRepository
                .findBySaasTypeAndExternalUserIdAndReasonAndStatus(
                        saasType,
                        externalId,
                        reason,
                        SaasSyncAlertStatus.OPEN
                )
                .map(alert -> {
                    alert.setStatus(SaasSyncAlertStatus.RESOLVED);
                    alert.setResolvedAt(LocalDateTime.now());
                    saasSyncAlertRepository.save(alert);
                    return 1;
                })
                .orElse(0);
    }

    private String normalizeEmail(String email) {
        if (email == null || email.isBlank()) return null;
        return email.trim().toLowerCase();
    }

    private String normalizeExternalId(SaasType saasType, String externalId, String email) {
        String source = externalId != null && !externalId.isBlank() ? externalId : email;
        if (source == null || source.isBlank()) return null;
        return source.startsWith(saasType.name().toLowerCase() + ":")
                ? source
                : saasType.name().toLowerCase() + ":" + source;
    }

    private Employee resolveOrCreateEmployee(SaasType saasType, SaaSConnector.SyncedUser user, String email, String externalId) {
        if (email != null) {
            Optional<Employee> existing = employeeRepository.findByEmail(email);
            if (existing.isPresent()) return existing.get();
        }

        String employeeId = buildSaasEmployeeId(saasType, externalId, email);
        if (employeeId == null) return null;

        Optional<Employee> byEmployeeId = employeeRepository.findByEmployeeId(employeeId);
        if (byEmployeeId.isPresent()) return byEmployeeId.get();

        String fallbackEmail = email != null ? email : externalId.replaceAll("[^A-Za-z0-9]", "-") + "@saas.local";
        Employee employee = Employee.builder()
                .employeeId(employeeId)
                .name(user.name() != null && !user.name().isBlank() ? user.name() : fallbackEmail)
                .email(fallbackEmail)
                .department(user.department() != null && !user.department().isBlank()
                        ? user.department()
                        : saasType.name())
                .status(user.active() ? EmployeeStatus.ACTIVE : EmployeeStatus.RESIGNED)
                .build();
        return employeeRepository.save(employee);
    }

    private String extractExternalUsername(SaasType saasType, String externalId, String email) {
        String prefix = saasType.name().toLowerCase() + ":";
        if (externalId != null && externalId.startsWith(prefix)) {
            return externalId.substring(prefix.length());
        }
        return email;
    }

    private String normalizeToken(String token) {
        if (token == null) return "";
        return token.replaceAll("\\s+", "");
    }

    private String resolveAccountScope(SaasType saasType, String accountScope) {
        if (saasType != SaasType.GITHUB) {
            return "WORKSPACE";
        }
        if (accountScope == null || accountScope.isBlank()) {
            return "ORGANIZATION";
        }
        String normalized = accountScope.trim().toUpperCase();
        return switch (normalized) {
            case "PERSONAL", "ORGANIZATION", "ENTERPRISE" -> normalized;
            default -> "ORGANIZATION";
        };
    }

    private boolean isEnterpriseAccount(SaasType saasType, String accountScope) {
        return saasType == SaasType.GITHUB && "ENTERPRISE".equalsIgnoreCase(resolveAccountScope(saasType, accountScope));
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
