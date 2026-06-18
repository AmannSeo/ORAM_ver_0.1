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
        @JsonProperty("isConnected")
        private boolean isConnected;
        private LocalDateTime connectedAt;
        private String connectedBy;
        private long identityCount;
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
        private List<String> warnings;
    }
}
