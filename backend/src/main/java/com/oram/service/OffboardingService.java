package com.oram.service;

import com.oram.config.EncryptionConfig;
import com.oram.connector.ConnectorRegistry;
import com.oram.connector.SaaSConnector;
import com.oram.dto.OffboardingDto;
import com.oram.dto.RiskDto;
import com.oram.entity.Employee;
import com.oram.entity.OffboardingResult;
import com.oram.entity.PermissionRecord;
import com.oram.entity.SaasConnection;
import com.oram.entity.SaasIdentity;
import com.oram.entity.User;
import com.oram.enums.OffboardingStatus;
import com.oram.enums.RiskLevel;
import com.oram.enums.SaasType;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.SaasConnectionRepository;
import com.oram.repository.SaasIdentityRepository;
import com.oram.risk.RiskFeatures;
import com.oram.risk.XGBoostRiskAnalyzer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
    private final SaasIdentityRepository saasIdentityRepository;

    @Transactional
    public UUID triggerOffboarding(Employee employee) {
        return createAndAnalyzeOffboarding(employee, "MANUAL_TRIGGER", true);
    }

    @Transactional
    public UUID analyzeEmployee(Employee employee) {
        Optional<OffboardingResult> latest = resultRepository.findTopByEmployee_IdOrderByCreatedAtDesc(employee.getId());
        if (latest.isPresent() && !latest.get().isRevokedAll() && !latest.get().isFalsePositive()) {
            return analyzeExistingResult(latest.get(), "MANUAL_ANALYSIS_REQUEST", true);
        }
        return createAndAnalyzeOffboarding(employee, "MANUAL_ANALYSIS_REQUEST", true);
    }

    @Transactional
    public UUID autoAnalyzeOffboarding(Employee employee, String triggerReason) {
        Optional<OffboardingResult> latest = resultRepository.findTopByEmployee_IdOrderByCreatedAtDesc(employee.getId());
        if (latest.isPresent() && !latest.get().isRevokedAll() && !latest.get().isFalsePositive()) {
            return analyzeExistingResult(latest.get(), triggerReason, false);
        }
        return createAndAnalyzeOffboarding(employee, triggerReason, false);
    }

    private UUID createAndAnalyzeOffboarding(Employee employee, String triggerReason, boolean manualTrigger) {
        log.info("Triggering {} offboarding analysis for employee: {}, reason={}",
                manualTrigger ? "manual" : "automatic", employee.getEmail(), triggerReason);

        OffboardingResult result = OffboardingResult.builder()
                .employee(employee)
                .status(OffboardingStatus.IN_PROGRESS)
                .startedAt(LocalDateTime.now())
                .build();
        result = resultRepository.save(result);

        return analyzeAndSaveResult(result, triggerReason, manualTrigger);
    }

    private UUID analyzeExistingResult(OffboardingResult result, String triggerReason, boolean manualTrigger) {
        result.setStatus(OffboardingStatus.IN_PROGRESS);
        if (result.getStartedAt() == null) {
            result.setStartedAt(LocalDateTime.now());
        }
        result.setCompletedAt(null);
        result.getPermissions().clear();
        result = resultRepository.save(result);

        return analyzeAndSaveResult(result, triggerReason, manualTrigger);
    }

    private UUID analyzeAndSaveResult(OffboardingResult result, String triggerReason, boolean manualTrigger) {
        Employee employee = result.getEmployee();
        try {
            List<PermissionRecord> permissions = discoverPermissions(employee, result);
            if (permissions.isEmpty()) {
                permissions = buildIdentityBasedPermissions(employee, result);
            }
            result.getPermissions().addAll(permissions);

            RiskFeatures features = RiskFeatures.aggregate(permissions);
            var scoreResponse = riskAnalyzer.analyze(features);

            result.setRiskScore(scoreResponse.getScore());
            result.setRiskLevel(scoreResponse.getLevel());
            result.setAnalysisSource(manualTrigger ? "MANUAL" : "AUTOMATIC");
            result.setAnalysisTrigger(triggerReason);
            result.setAnalysisEngine(scoreResponse.getEngine());
            result.setStatus(OffboardingStatus.COMPLETED);
            result.setCompletedAt(LocalDateTime.now());

            resultRepository.save(result);

            auditService.log(null, manualTrigger ? "OFFBOARDING_TRIGGERED" : "AUTO_RISK_ANALYZED",
                    "EMPLOYEE", employee.getId().toString(),
                    "Offboarding analysis completed. Reason: " + triggerReason
                            + ", Risk: " + scoreResponse.getScore() + "/" + scoreResponse.getLevel()
                            + ", Engine: " + scoreResponse.getEngine(),
                    auditTargetLabel(employee));

            log.info("Offboarding analysis completed for {}. Reason={}, Score={}, Level={}, Engine={}",
                    employee.getEmail(), triggerReason, scoreResponse.getScore(),
                    scoreResponse.getLevel(), scoreResponse.getEngine());

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

    private List<PermissionRecord> buildIdentityBasedPermissions(Employee employee, OffboardingResult result) {
        List<SaasIdentity> identities = saasIdentityRepository.findByEmployeeId(employee.getId());
        List<PermissionRecord> permissions = new ArrayList<>();

        for (SaasIdentity identity : identities) {
            permissions.add(PermissionRecord.builder()
                    .offboardingResult(result)
                    .saasType(identity.getSaasType())
                    .permissionType(identity.isHasRevokePermission() ? "SYNCED_ACCOUNT" : "MISSING_OR_LIMITED_ACCOUNT")
                    .resourceName(identity.getDisplayName() != null ? identity.getDisplayName() : identity.getExternalUsername())
                    .admin(false)
                    .owner(false)
                    .hasApiToken(false)
                    .recentLogin(identity.getLastSyncedAt() != null
                            && identity.getLastSyncedAt().isAfter(LocalDateTime.now().minusDays(7)))
                    .repoCount(identity.getSaasType() == SaasType.GITHUB ? 1 : 0)
                    .workspaceCount(1)
                    .build());
        }

        return permissions;
    }

    @Transactional
    public OffboardingDto.RevokeResponse revokeAll(UUID resultId, User reviewedBy) {
        OffboardingResult result = findById(resultId);
        if (result.isFalsePositive()) {
            throw new IllegalStateException("False positive result cannot be revoked.");
        }
        Employee employee = result.getEmployee();

        List<SaasType> revokedSaas = new ArrayList<>();
        List<OffboardingDto.RevokePlanItem> items = new ArrayList<>();
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
                    markIdentitiesRevoked(employee, connection.getSaasType(), revokeResult.message());
                    auditService.log(reviewedBy, "REVOKE_ACCESS", "EMPLOYEE", employee.getId().toString(),
                            "Revoked " + connection.getSaasType() + " access for " + employee.getEmail(),
                            auditTargetLabel(employee));
                }

                items.add(toRevokeResultItem(connection.getSaasType(), revokeResult));
            } catch (Exception e) {
                log.error("Revoke failed for SaaS {}: {}", connection.getSaasType(), e.getMessage());
                items.add(OffboardingDto.RevokePlanItem.builder()
                        .saasType(connection.getSaasType())
                        .status("FAILED")
                        .canRevoke(false)
                        .accountMatched(false)
                        .resourceCount(0)
                        .action("Revoke failed")
                        .reason(e.getMessage())
                        .build());
            }
        }

        boolean revokedAnyAccess = !revokedSaas.isEmpty();
        result.setRevokedAll(revokedAnyAccess);
        result.setReviewedBy(reviewedBy);
        resultRepository.save(result);

        return OffboardingDto.RevokeResponse.builder()
                .message(revokedAnyAccess
                        ? "권한 회수 요청이 완료되었습니다."
                        : "자동으로 회수된 권한이 없습니다. SaaS 토큰 권한과 계정 매핑 상태를 확인하세요.")
                .revokedAt(LocalDateTime.now())
                .revokedSaas(revokedSaas)
                .items(items)
                .build();
    }

    @Transactional
    public OffboardingDto.FalsePositiveResponse markFalsePositive(UUID resultId, User reviewedBy, String reason) {
        OffboardingResult result = findById(resultId);
        String resolvedReason = reason == null || reason.isBlank()
                ? "관리자가 오탐으로 판단했습니다."
                : reason.trim();

        result.setFalsePositive(true);
        result.setFalsePositiveReason(resolvedReason);
        result.setFalsePositiveAt(LocalDateTime.now());
        result.setReviewedBy(reviewedBy);
        resultRepository.save(result);

        auditService.log(reviewedBy, "MARK_FALSE_POSITIVE", "OFFBOARDING_RESULT", resultId.toString(),
                "Marked offboarding risk as false positive. Reason: " + resolvedReason,
                auditTargetLabel(result.getEmployee()));

        return OffboardingDto.FalsePositiveResponse.builder()
                .message("오탐으로 처리했습니다. 이 항목은 권한 회수 대상과 AI 리스크 목록에서 제외됩니다.")
                .resultId(resultId)
                .falsePositiveAt(result.getFalsePositiveAt())
                .build();
    }

    @Transactional(readOnly = true)
    public OffboardingDto.RevokePlanResponse getRevokePlan(UUID resultId) {
        OffboardingResult result = findById(resultId);
        Employee employee = result.getEmployee();
        List<SaasConnection> activeConnections = connectionRepository.findByConnectedTrue();

        List<OffboardingDto.RevokePlanItem> items = activeConnections.stream()
                .map(connection -> buildRevokePlanItem(employee, result, connection))
                .toList();

        long readyCount = items.stream().filter(item -> "READY".equals(item.getStatus())).count();
        long manualCount = items.stream().filter(item -> "MANUAL".equals(item.getStatus())).count();
        long blockedCount = items.stream()
                .filter(item -> !"READY".equals(item.getStatus()) && !"MANUAL".equals(item.getStatus()))
                .count();

        return OffboardingDto.RevokePlanResponse.builder()
                .resultId(result.getId())
                .employee(toEmployeeInfo(employee))
                .readyCount((int) readyCount)
                .manualCount((int) manualCount)
                .blockedCount((int) blockedCount)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public List<OffboardingDto.Summary> getAllResults() {
        return getLatestResultPerEmployee().stream().map(this::toSummary).toList();
    }

    private List<OffboardingResult> getLatestResultPerEmployee() {
        Map<UUID, OffboardingResult> latestByEmployee = new LinkedHashMap<>();

        resultRepository.findAll().stream()
                .filter(result -> !result.isFalsePositive())
                .sorted(Comparator.comparing(
                        OffboardingResult::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .forEach(result -> {
                    Employee employee = result.getEmployee();
                    if (employee != null && employee.getId() != null) {
                        latestByEmployee.putIfAbsent(employee.getId(), result);
                    }
                });

        return new ArrayList<>(latestByEmployee.values());
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

    private OffboardingDto.RevokePlanItem buildRevokePlanItem(
            Employee employee,
            OffboardingResult result,
            SaasConnection connection
    ) {
        SaasType saasType = connection.getSaasType();
        List<SaasIdentity> identities = saasIdentityRepository.findByEmployeeIdAndSaasType(employee.getId(), saasType);
        List<PermissionRecord> permissions = result.getPermissions().stream()
                .filter(permission -> permission.getSaasType() == saasType)
                .toList();

        boolean accountMatched = !identities.isEmpty();
        int resourceCount = permissions.isEmpty() ? identities.size() : permissions.size();

        if (!accountMatched) {
            return OffboardingDto.RevokePlanItem.builder()
                    .saasType(saasType)
                    .status("NO_ACCOUNT")
                    .canRevoke(false)
                    .accountMatched(false)
                    .resourceCount(resourceCount)
                    .action("매핑 계정 없음")
                    .reason("이 직원과 매핑된 " + saasType + " 계정이 없습니다. SaaS 동기화를 먼저 실행하세요.")
                    .build();
        }

        if (saasType == SaasType.NOTION) {
            return OffboardingDto.RevokePlanItem.builder()
                    .saasType(saasType)
                    .status("MANUAL")
                    .canRevoke(false)
                    .accountMatched(true)
                    .resourceCount(resourceCount)
                    .action("수동 제거 필요")
                    .reason("Notion 공개 API는 이 흐름에서 워크스페이스 멤버 제거를 제공하지 않습니다.")
                    .build();
        }

        if (saasType == SaasType.SLACK && isSlackBotToken(connection)) {
            return OffboardingDto.RevokePlanItem.builder()
                    .saasType(saasType)
                    .status("MANUAL")
                    .canRevoke(false)
                    .accountMatched(true)
                    .resourceCount(resourceCount)
                    .action("사용자 토큰 필요")
                    .reason("현재 Slack 연결은 xoxb 봇 토큰입니다. 봇 토큰은 사용자 수집만 가능하고 워크스페이스 접근 제거는 할 수 없습니다. Enterprise Grid에서 admin.users:write 권한이 있는 xoxp 사용자 토큰을 연결해야 합니다.")
                    .build();
        }

        String reason = saasType == SaasType.SLACK
                ? "Slack API 회수는 Enterprise Grid와 admin.users:write 권한이 있는 xoxp 사용자 토큰에서만 성공할 수 있습니다."
                : "GitHub 토큰 권한으로 조직 멤버 또는 저장소 collaborator 제거를 시도합니다.";

        return OffboardingDto.RevokePlanItem.builder()
                .saasType(saasType)
                .status("READY")
                .canRevoke(true)
                .accountMatched(true)
                .resourceCount(resourceCount)
                .action("자동 회수 시도")
                .reason(reason)
                .build();
    }

    private boolean isSlackBotToken(SaasConnection connection) {
        try {
            String token = tokenEncryptor.decrypt(connection.getAccessTokenEncrypted());
            return token != null && token.replaceAll("\\s+", "").startsWith("xoxb-");
        } catch (Exception e) {
            log.warn("Failed to inspect Slack token type for revoke plan: {}", e.getMessage());
            return false;
        }
    }

    private OffboardingDto.RevokePlanItem toRevokeResultItem(SaasType saasType, SaaSConnector.RevokeResult revokeResult) {
        return OffboardingDto.RevokePlanItem.builder()
                .saasType(saasType)
                .status(revokeResult.success() ? "REVOKED" : "FAILED")
                .canRevoke(revokeResult.success())
                .accountMatched(true)
                .resourceCount(revokeResult.revokedResources() != null ? revokeResult.revokedResources().size() : 0)
                .action(revokeResult.success() ? "회수 완료" : "회수 실패")
                .reason(revokeResult.message())
                .resources(revokeResult.revokedResources())
                .build();
    }

    private String auditTargetLabel(Employee employee) {
        if (employee == null) {
            return "-";
        }
        return employee.getName() + " / " + employee.getEmail();
    }

    private void markIdentitiesRevoked(Employee employee, SaasType saasType, String message) {
        List<SaasIdentity> identities = saasIdentityRepository.findByEmployeeIdAndSaasType(employee.getId(), saasType);
        for (SaasIdentity identity : identities) {
            identity.setAccessRevoked(true);
            identity.setRevokedAt(LocalDateTime.now());
            identity.setRevokeMessage(message);
        }
        saasIdentityRepository.saveAll(identities);
    }

    private OffboardingDto.Summary toSummary(OffboardingResult r) {
        return OffboardingDto.Summary.builder()
                .id(r.getId())
                .employee(toEmployeeInfo(r.getEmployee()))
                .status(r.getStatus())
                .riskScore(r.getRiskScore())
                .riskLevel(r.getRiskLevel())
                .analysisSource(r.getAnalysisSource())
                .analysisTrigger(r.getAnalysisTrigger())
                .analysisEngine(r.getAnalysisEngine())
                .startedAt(r.getStartedAt())
                .revokedAll(r.isRevokedAll())
                .falsePositive(r.isFalsePositive())
                .falsePositiveReason(r.getFalsePositiveReason())
                .falsePositiveAt(r.getFalsePositiveAt())
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
        RiskDto.ScoreResponse riskDetail = buildRiskDetail(r);

        return OffboardingDto.Detail.builder()
                .id(r.getId())
                .employee(toEmployeeInfo(r.getEmployee()))
                .status(r.getStatus())
                .riskScore(r.getRiskScore())
                .riskLevel(r.getRiskLevel())
                .analysisSource(r.getAnalysisSource())
                .analysisTrigger(r.getAnalysisTrigger())
                .analysisEngine(r.getAnalysisEngine())
                .anomalyScore(riskDetail.getAnomalyScore())
                .riskBreakdown(riskDetail.getBreakdown())
                .riskExplanations(riskDetail.getExplanations())
                .permissions(perms)
                .recommendedActions(generateRecommendations(r))
                .revokedAll(r.isRevokedAll())
                .falsePositive(r.isFalsePositive())
                .falsePositiveReason(r.getFalsePositiveReason())
                .falsePositiveAt(r.getFalsePositiveAt())
                .startedAt(r.getStartedAt())
                .completedAt(r.getCompletedAt())
                .build();
    }

    private RiskDto.ScoreResponse buildRiskDetail(OffboardingResult result) {
        try {
            RiskFeatures features = RiskFeatures.aggregate(result.getPermissions());
            return riskAnalyzer.analyze(features);
        } catch (Exception e) {
            log.warn("Failed to build risk detail for result {}: {}", result.getId(), e.getMessage());
            return RiskDto.ScoreResponse.builder()
                    .score(result.getRiskScore() != null ? result.getRiskScore() : 0)
                    .level(result.getRiskLevel())
                    .engine(result.getAnalysisEngine())
                    .anomalyScore(result.getRiskScore() != null ? result.getRiskScore() / 100.0 : 0.0)
                    .breakdown(RiskDto.Breakdown.builder().build())
                    .explanations(List.of())
                    .build();
        }
    }

    private OffboardingDto.EmployeeInfo toEmployeeInfo(Employee e) {
        return OffboardingDto.EmployeeInfo.builder()
                .id(e.getId())
                .name(e.getName())
                .email(e.getEmail())
                .department(e.getDepartment())
                .resignedAt(e.getUpdatedAt())
                .build();
    }

    private List<String> generateRecommendations(OffboardingResult result) {
        List<String> actions = new ArrayList<>();
        if (result.isFalsePositive()) {
            actions.add("오탐으로 처리된 항목입니다. 권한 회수 대상에서 제외됩니다.");
            return actions;
        }

        RiskLevel level = result.getRiskLevel();

        if (level == RiskLevel.CRITICAL || level == RiskLevel.HIGH) {
            actions.add("Immediately revoke all SaaS access.");
        }

        result.getPermissions().forEach(p -> {
            if (p.isOwner()) actions.add(p.getSaasType() + " Owner access should be revoked immediately.");
            if (p.isHasApiToken()) actions.add(p.getSaasType() + " API token/PAT should be invalidated immediately.");
            if (p.isAdmin()) actions.add(p.getSaasType() + " Admin access should be reviewed and revoked.");
        });

        if (actions.isEmpty()) {
            actions.add("Proceed with the standard offboarding review.");
        }
        return actions;
    }
}
