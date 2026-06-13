package com.oram.service;

import com.oram.connector.SaaSConnector;
import com.oram.dto.response.DiscoveredPermissionDto;
import com.oram.dto.response.EmployeeResponse;
import com.oram.dto.response.OffboardingResultResponse;
import com.oram.dto.response.PermissionResponse;
import com.oram.entity.*;
import com.oram.entity.OffboardingResult.OffboardingStatus;
import com.oram.entity.Permission.RevokeStatus;
import com.oram.repository.EmployeeRepository;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.PermissionRepository;
import com.oram.risk.RiskAnalysisService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class OffboardingService {

    private final EmployeeRepository employeeRepository;
    private final OffboardingResultRepository offboardingResultRepository;
    private final PermissionRepository permissionRepository;
    private final RiskAnalysisService riskAnalysisService;
    private final List<SaaSConnector> saaSConnectors;

    /**
     * Step 1-5: Initiate offboarding for an employee.
     * Discovers permissions across all connected SaaS platforms and calculates risk score.
     */
    public OffboardingResultResponse initiateOffboarding(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new NoSuchElementException("Employee not found: " + employeeId));

        log.info("Initiating offboarding for employee: {} ({})", employee.getName(), employee.getEmail());

        // Create offboarding result record
        OffboardingResult result = OffboardingResult.builder()
                .employee(employee)
                .status(OffboardingStatus.IN_PROGRESS)
                .build();
        result = offboardingResultRepository.save(result);

        // Step 2: Search all connected SaaS platforms
        List<DiscoveredPermissionDto> allDiscoveredPermissions = new ArrayList<>();

        for (SaaSConnector connector : saaSConnectors) {
            try {
                List<DiscoveredPermissionDto> perms = connector.getPermissions(employee.getEmail());
                allDiscoveredPermissions.addAll(perms);
                log.info("Found {} permissions on {} for {}", perms.size(), connector.getPlatformName(), employee.getEmail());
            } catch (Exception e) {
                log.error("Error fetching permissions from {}: {}", connector.getPlatformName(), e.getMessage());
            }
        }

        // Step 3: Save discovered permissions
        final OffboardingResult finalResult = result;
        List<Permission> permissions = allDiscoveredPermissions.stream()
                .map(dto -> Permission.builder()
                        .offboardingResult(finalResult)
                        .platform(dto.getPlatform())
                        .permissionType(dto.getPermissionType())
                        .permissionDetail(dto.getPermissionDetail())
                        .isAdmin(dto.isAdmin())
                        .isOwner(dto.isOwner())
                        .hasApiToken(dto.isHasApiToken())
                        .revokeStatus(RevokeStatus.PENDING)
                        .build())
                .collect(Collectors.toList());
        permissions = permissionRepository.saveAll(permissions);

        // Step 4: Calculate risk score
        RiskAnalysisService.RiskResult riskResult = riskAnalysisService.analyze(allDiscoveredPermissions);

        // Update offboarding result
        result.setRiskScore(riskResult.score());
        result.setRiskLevel(riskResult.level());
        result.setTotalPermissions(permissions.size());
        result.setRevokedPermissions(0);
        result.setStatus(OffboardingStatus.PENDING);
        result.setPermissions(permissions);
        result = offboardingResultRepository.save(result);

        // Mark employee offboarding as triggered
        employee.setOffboardingTriggered(true);
        employeeRepository.save(employee);

        log.info("Offboarding analysis complete for {}. Risk score: {} ({})",
                employee.getEmail(), riskResult.score(), riskResult.level());

        return toResponse(result);
    }

    /**
     * Step 6: Revoke all permissions for the offboarding result.
     */
    public OffboardingResultResponse revokeAllAccess(Long offboardingResultId) {
        OffboardingResult result = offboardingResultRepository.findById(offboardingResultId)
                .orElseThrow(() -> new NoSuchElementException("Offboarding result not found: " + offboardingResultId));

        Employee employee = result.getEmployee();
        log.info("Revoking all access for employee: {}", employee.getEmail());

        result.setStatus(OffboardingStatus.IN_PROGRESS);
        offboardingResultRepository.save(result);

        // Build connector map for quick lookup
        Map<String, SaaSConnector> connectorMap = saaSConnectors.stream()
                .collect(Collectors.toMap(SaaSConnector::getPlatformName, Function.identity()));

        int revokedCount = 0;
        for (Permission permission : result.getPermissions()) {
            if (permission.getRevokeStatus() == RevokeStatus.REVOKED) {
                revokedCount++;
                continue;
            }

            SaaSConnector connector = connectorMap.get(permission.getPlatform().name());
            if (connector == null) {
                permission.setRevokeStatus(RevokeStatus.SKIPPED);
                continue;
            }

            try {
                boolean success = connector.revokeAccess(employee.getEmail());
                if (success) {
                    permission.setRevokeStatus(RevokeStatus.REVOKED);
                    permission.setRevokedAt(LocalDateTime.now());
                    revokedCount++;
                } else {
                    permission.setRevokeStatus(RevokeStatus.FAILED);
                }
            } catch (Exception e) {
                log.error("Failed to revoke {} permission: {}", permission.getPlatform(), e.getMessage());
                permission.setRevokeStatus(RevokeStatus.FAILED);
            }
            permissionRepository.save(permission);
        }

        result.setRevokedPermissions(revokedCount);
        result.setStatus(OffboardingStatus.COMPLETED);
        result.setCompletedAt(LocalDateTime.now());
        result = offboardingResultRepository.save(result);

        log.info("Revocation complete for {}. Revoked {}/{} permissions",
                employee.getEmail(), revokedCount, result.getTotalPermissions());

        return toResponse(result);
    }

    @Transactional(readOnly = true)
    public OffboardingResultResponse getOffboardingResult(Long id) {
        OffboardingResult result = offboardingResultRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Offboarding result not found: " + id));
        return toResponse(result);
    }

    @Transactional(readOnly = true)
    public List<OffboardingResultResponse> getOffboardingResultsForEmployee(Long employeeId) {
        return offboardingResultRepository.findByEmployeeId(employeeId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<OffboardingResultResponse> getAllOffboardingResults() {
        return offboardingResultRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private OffboardingResultResponse toResponse(OffboardingResult result) {
        Employee emp = result.getEmployee();
        EmployeeResponse empResponse = EmployeeResponse.builder()
                .id(emp.getId())
                .employeeId(emp.getEmployeeId())
                .name(emp.getName())
                .email(emp.getEmail())
                .department(emp.getDepartment())
                .status(emp.getStatus())
                .offboardingTriggered(emp.getOffboardingTriggered())
                .createdAt(emp.getCreatedAt())
                .updatedAt(emp.getUpdatedAt())
                .resignedAt(emp.getResignedAt())
                .build();

        List<PermissionResponse> permResponses = result.getPermissions().stream()
                .map(p -> PermissionResponse.builder()
                        .id(p.getId())
                        .platform(p.getPlatform())
                        .permissionType(p.getPermissionType())
                        .permissionDetail(p.getPermissionDetail())
                        .isAdmin(p.getIsAdmin())
                        .isOwner(p.getIsOwner())
                        .hasApiToken(p.getHasApiToken())
                        .revokeStatus(p.getRevokeStatus())
                        .revokedAt(p.getRevokedAt())
                        .discoveredAt(p.getDiscoveredAt())
                        .build())
                .toList();

        List<String> recommendations = buildRecommendations(result);

        return OffboardingResultResponse.builder()
                .id(result.getId())
                .employee(empResponse)
                .status(result.getStatus())
                .riskScore(result.getRiskScore())
                .riskLevel(result.getRiskLevel())
                .totalPermissions(result.getTotalPermissions())
                .revokedPermissions(result.getRevokedPermissions())
                .initiatedAt(result.getInitiatedAt())
                .completedAt(result.getCompletedAt())
                .permissions(permResponses)
                .recommendedActions(recommendations)
                .build();
    }

    private List<String> buildRecommendations(OffboardingResult result) {
        List<String> recommendations = new ArrayList<>();
        boolean hasAdmin = result.getPermissions().stream().anyMatch(Permission::getIsAdmin);
        boolean hasOwner = result.getPermissions().stream().anyMatch(Permission::getIsOwner);
        boolean hasApiToken = result.getPermissions().stream().anyMatch(Permission::getHasApiToken);

        if (hasOwner) {
            recommendations.add("Transfer GitHub Organization ownership before revoking access");
        }
        if (hasAdmin) {
            recommendations.add("Remove admin privileges before deactivating account");
        }
        if (hasApiToken) {
            recommendations.add("Revoke all Personal Access Tokens (PATs) and API keys");
        }
        recommendations.add("Verify all shared credentials have been rotated");
        recommendations.add("Archive employee's data according to retention policy");
        return recommendations;
    }
}
