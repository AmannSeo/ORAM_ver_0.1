package com.oram.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.oram.enums.RiskLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

public class RiskDto {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ScoreRequest {
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
    public static class ScoreResponse {
        private int score;
        private RiskLevel level;
        private Breakdown breakdown;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Breakdown {
        private int adminWeight;
        private int ownerWeight;
        private int apiTokenWeight;
        private int recentLoginWeight;
        private int repoWeight;
        private int workspaceWeight;
    }
}
