package com.oram.service;

import com.oram.config.EncryptionConfig;
import com.oram.connector.ConnectorRegistry;
import com.oram.connector.SaaSConnector;
import com.oram.dto.OffboardingDto;
import com.oram.entity.*;
import com.oram.enums.OffboardingStatus;
import com.oram.enums.RiskLevel;
import com.oram.enums.SaasType;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.SaasConnectionRepository;
import com.oram.risk.RiskFeatures;
import com.oram.risk.XGBoostRiskAnalyzer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class OffboardingService {

    private final OffboardingResultRepository resultRepository;
    private final SaasConnectionRepository connectionRepository;
    private final ConnectorRegistry connectorRegistry;
    private final XGBoostRiskAnalyzer riskAnalyzer;
    private final AuditService auditService;
    private final EncryptionConfig.TokenEncryptor tokenEncryptor;

    /**
     * Step 1-6: 오프보딩 워크플로우 전체 실행
     */
    @Transactional
    public UUID triggerOffboarding(Employee employee) {
        log.info("Triggering offboarding for employee: {}", employee.getEmail());

        // 결과 레코드 생성
        OffboardingResult result = OffboardingResult.builder()
                .employee(employee)
                .status(OffboardingStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .build();
        result = resultRepository.save(result);

        try {
            // Step 2-3: 연결된 모든 SaaS에서 권한 검색
            List<PermissionRecord> permissions = discoverPermissions(employee, result);
            result.setPermissions(permissions);

            // Step 4: 리스크 점수 계산
            RiskFeatures features = RiskFeatures.aggregate(permissions);
            var scoreResponse = riskAnalyzer.analyze(features);

            result.setRiskScore(scoreResponse.getScore());
            result.setRiskLevel(scoreResponse.getLevel());
            result.setStatus(OffboardingStatus.COMPLETED);
            result.setCompletedAt(LocalDateTime.now());

            resultRepository.save(result);

            auditService.log(null, "OFFBOARDING_TRIGGERED", "EMPLOYEE", employee.getId().toString(),
                    "Offboarding completed. Risk: " + scoreResponse.getScore() + "/" + scoreResponse.getLevel());

            log.info("Offboarding completed for {}. Score={}, Level={}", 
                    employee.getEmail(), scoreResponse.getScore(), scoreResponse.getLevel());

            return result.getId();
        } catch (Exception e) {
            log.error("Offboarding failed for {}: {}", employee.getEmail(), e.getMessage(), e);
            result.setStatus(OffboardingStatus.FAILED);
            resultRepository.save(result);
            throw new RuntimeException("Offboarding failed: " + e.getMessage(), e);
        }
    }

    private List<PermissionRecord> discoverPermissions(Employee employee, OffboardingResult result) {
        List<PermissionRecord> allPermissions = new ArrayList<>();
        List<SaasConnection> activeConnections = connectionRepository.findByConnectedTrue();

        for (SaasConnection connection : activeConnections) {
            Optional<SaaSConnector> connectorOpt = connectorRegistry.getConnector(connection.getSaasType());
            if (connectorOpt.isEmpty()) continue;

            SaaSConnector connector = connectorOpt.get();
            try {
                String accessToken = tokenEncryptor.decrypt(connection.getAccessTokenEncrypted());
                List<SaaSConnector.DiscoveredPermission> discovered =
                        connector.getPermissions(employee.getEmail(), accessToken);

                for (SaaSConnector.DiscoveredPermission dp : discovered) {
                    PermissionRecord record = PermissionRecord.builder()
                            .offboardingResult(result)
                            .saasType(connection.getSaasType())
                            .permissionType(dp.permissionType())
                            .resourceName(dp.resourceName())
                            .admin(dp.isAdmin())
                            .owner(dp.isOwner())
                            .hasApiToken(dp.hasApiToken())
                            .recentLogin(dp.recentLogin())
                            .repoCount(dp.repoCount())
                            .workspaceCount(dp.workspaceCount())
                            .build();
                    allPermissions.add(record);
                }
                log.info("Discovered {} permissions in {} for {}", 
                        discovered.size(), connection.getSaasType(), employee.getEmail());
            } catch (Exception e) {
                log.warn("Permission discovery failed for SaaS {}: {}", connection.getSaasType(), e.getMessage());
            }
        }
        return allPermissions;
    }

    /**
     * Step 6: 전체 권한 일괄 해제
     */
    @Transactional
    public OffboardingDto.RevokeResponse revokeAll(UUID resultId, User reviewedBy) {
        OffboardingResult result = findById(resultId);
        Employee employee = result.getEmployee();

        List<SaasType> revokedSaas = new ArrayList<>();
        List<SaasConnection> activeConnections = connectionRepository.findByConnectedTrue();

        for (SaasConnection connection : activeConnections) {
            Optional<SaaSConnector> connectorOpt = connectorRegistry.getConnector(connection.getSaasType());
            if (connectorOpt.isEmpty()) continue;

            try {
                SaaSConnector connector = connectorOpt.get();
                String accessToken = tokenEncryptor.decrypt(connection.getAccessTokenEncrypted());
                SaaSConnector.RevokeResult revokeResult = connector.revokeAccess(employee.getEmail(), accessToken);

                if (revokeResult.success()) {
                    revokedSaas.add(connection.getSaasType());
                    auditService.log(reviewedBy, "REVOKE_ACCESS", "EMPLOYEE", employee.getId().toString(),
                            "Revoked " + connection.getSaasType() + " access for " + employee.getEmail());
                }
            } catch (Exception e) {
                log.error("Revoke failed for SaaS {}: {}", connection.getSaasType(), e.getMessage());
            }
        }

        result.setRevokedAll(true);
        result.setReviewedBy(reviewedBy);
        resultRepository.save(result);

        return OffboardingDto.RevokeResponse.builder()
                .message("All access revoked successfully.")
                .revokedAt(LocalDateTime.now())
                .revokedSaas(revokedSaas)
                .build();
    }

    @Transactional(readOnly = true)
    public List<OffboardingDto.Summary> getAllResults() {
        return resultRepository.findAll().stream().map(this::toSummary).toList();
    }

    @Transactional(readOnly = true)
    public OffboardingDto.Detail getDetail(UUID resultId) {
        OffboardingResult result = findById(resultId);
        return toDetail(result);
    }

    private OffboardingResult findById(UUID id) {
        return resultRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Offboarding result not found: " + id));
    }

    private OffboardingDto.Summary toSummary(OffboardingResult r) {
        return OffboardingDto.Summary.builder()
                .id(r.getId())
                .employee(toEmployeeInfo(r.getEmployee()))
                .status(r.getStatus())
                .riskScore(r.getRiskScore())
                .riskLevel(r.getRiskLevel())
                .startedAt(r.getStartedAt())
                .revokedAll(r.isRevokedAll())
                .build();
    }

    private OffboardingDto.Detail toDetail(OffboardingResult r) {
        List<OffboardingDto.PermissionInfo> perms = r.getPermissions().stream()
                .map(p -> OffboardingDto.PermissionInfo.builder()
                        .saasType(p.getSaasType())
                        .permissionType(p.getPermissionType())
                        .resourceName(p.getResourceName())
                        .isAdmin(p.isAdmin())
                        .isOwner(p.isOwner())
                        .hasApiToken(p.isHasApiToken())
                        .recentLogin(p.isRecentLogin())
                        .repoCount(p.getRepoCount())
                        .workspaceCount(p.getWorkspaceCount())
                        .build())
                .toList();

        return OffboardingDto.Detail.builder()
                .id(r.getId())
                .employee(toEmployeeInfo(r.getEmployee()))
                .status(r.getStatus())
                .riskScore(r.getRiskScore())
                .riskLevel(r.getRiskLevel())
                .permissions(perms)
                .recommendedActions(generateRecommendations(r))
                .revokedAll(r.isRevokedAll())
                .startedAt(r.getStartedAt())
                .completedAt(r.getCompletedAt())
                .build();
    }

    private OffboardingDto.EmployeeInfo toEmployeeInfo(Employee e) {
        return OffboardingDto.EmployeeInfo.builder()
                .id(e.getId())
                .name(e.getName())
                .email(e.getEmail())
                .department(e.getDepartment())
                .build();
    }

    private List<String> generateRecommendations(OffboardingResult result) {
        List<String> actions = new ArrayList<>();
        RiskLevel level = result.getRiskLevel();

        if (level == RiskLevel.CRITICAL || level == RiskLevel.HIGH) {
            actions.add("⚠️ 즉시 모든 SaaS 접근 권한 해제 필요");
        }

        result.getPermissions().forEach(p -> {
            if (p.isOwner()) actions.add("🔴 " + p.getSaasType() + " Owner 권한 즉시 해제 필요");
            if (p.isHasApiToken()) actions.add("🔴 " + p.getSaasType() + " API 토큰/PAT 즉시 무효화 필요");
            if (p.isAdmin()) actions.add("🟠 " + p.getSaasType() + " Admin 권한 해제 권장");
        });

        if (actions.isEmpty()) actions.add("✅ 표준 오프보딩 절차 진행");
        return actions;
    }
}
