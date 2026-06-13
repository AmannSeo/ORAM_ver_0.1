package com.oram.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.oram.enums.OffboardingStatus;
import com.oram.enums.RiskLevel;
import com.oram.enums.SaasType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class OffboardingDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Summary {
        private UUID id;
        private EmployeeInfo employee;
        private OffboardingStatus status;
        private Integer riskScore;
        private RiskLevel riskLevel;
        private LocalDateTime startedAt;
        private boolean revokedAll;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Detail {
        private UUID id;
        private EmployeeInfo employee;
        private OffboardingStatus status;
        private Integer riskScore;
        private RiskLevel riskLevel;
        private List<PermissionInfo> permissions;
        private List<String> recommendedActions;
        private boolean revokedAll;
        private LocalDateTime startedAt;
        private LocalDateTime completedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class EmployeeInfo {
        private UUID id;
        private String name;
        private String email;
        private String department;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PermissionInfo {
        private SaasType saasType;
        private String permissionType;
        private String resourceName;
        @JsonProperty("isAdmin")
        private boolean isAdmin;
        @JsonProperty("isOwner")
        private boolean isOwner;
        private boolean hasApiToken;
        private boolean recentLogin;
        private int repoCount;
        private int workspaceCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevokeResponse {
        private String message;
        private LocalDateTime revokedAt;
        private List<SaasType> revokedSaas;
    }
}
