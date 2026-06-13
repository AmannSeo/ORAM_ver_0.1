package com.oram.dto.response;

import com.oram.entity.OffboardingResult.OffboardingStatus;
import com.oram.entity.OffboardingResult.RiskLevel;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class OffboardingResultResponse {
    private Long id;
    private EmployeeResponse employee;
    private OffboardingStatus status;
    private Integer riskScore;
    private RiskLevel riskLevel;
    private Integer totalPermissions;
    private Integer revokedPermissions;
    private LocalDateTime initiatedAt;
    private LocalDateTime completedAt;
    private List<PermissionResponse> permissions;
    private List<String> recommendedActions;
}
