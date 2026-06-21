package com.oram.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.oram.enums.SaasType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public class SaasConnectionDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Response {
        private UUID id;
        private SaasType saasType;
        private String workspaceName;
        private String accountScope;
        private boolean enterpriseAccount;
        @JsonProperty("isConnected")
        private boolean isConnected;
        private LocalDateTime connectedAt;
        private String connectedBy;
        private long identityCount;
        private LocalDateTime lastSyncedAt;
        private long openAlertCount;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OAuthUrlResponse {
        private String authorizationUrl;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SyncUsersResponse {
        private String message;
        private int syncedCount;
        private int totalFound;
        private int missingCount;
        private int inactiveCount;
        private int resolvedAlertCount;
        private List<String> warnings;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class IdentityResponse {
        private UUID id;
        private SaasType saasType;
        private String externalUserId;
        private String externalUsername;
        private String externalEmail;
        private String displayName;
        private String department;
        private String status;
        private boolean accessRevoked;
        private LocalDateTime lastSyncedAt;
        private UUID employeeId;
        private String employeeName;
        private String employeeEmail;
    }
}
