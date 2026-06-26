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
        private String analysisSource;
        private String analysisTrigger;
        private String analysisEngine;
        private LocalDateTime startedAt;
        private boolean revokedAll;
        private boolean falsePositive;
        private String falsePositiveReason;
        private LocalDateTime falsePositiveAt;
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
        private String analysisSource;
        private String analysisTrigger;
        private String analysisEngine;
        private Double anomalyScore;
        private RiskDto.Breakdown riskBreakdown;
        private List<RiskDto.Explanation> riskExplanations;
        private List<PermissionInfo> permissions;
        private List<String> recommendedActions;
        private boolean revokedAll;
        private boolean falsePositive;
        private String falsePositiveReason;
        private LocalDateTime falsePositiveAt;
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
        private LocalDateTime resignedAt;
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
        private List<RevokePlanItem> items;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FalsePositiveRequest {
        private String reason;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FalsePositiveResponse {
        private String message;
        private UUID resultId;
        private LocalDateTime falsePositiveAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevokePlanResponse {
        private UUID resultId;
        private EmployeeInfo employee;
        private int readyCount;
        private int manualCount;
        private int blockedCount;
        private List<RevokePlanItem> items;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RevokePlanItem {
        private SaasType saasType;
        private String status;
        private boolean canRevoke;
        private boolean accountMatched;
        private int resourceCount;
        private String action;
        private String reason;
        private List<String> resources;
    }
}
