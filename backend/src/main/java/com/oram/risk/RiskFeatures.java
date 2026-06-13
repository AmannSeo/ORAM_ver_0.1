package com.oram.risk;

import lombok.Builder;
import lombok.Data;

/**
 * XGBoost 입력 피처 객체
 * 여러 PermissionRecord에서 집계된 최대값을 사용합니다.
 */
@Data
@Builder
public class RiskFeatures {
    private boolean isAdmin;
    private boolean isOwner;
    private boolean hasApiToken;
    private boolean recentLogin;
    private int repoCount;
    private int workspaceCount;

    /**
     * 여러 권한 레코드에서 최악(가장 위험한) 피처 집계
     */
    public static RiskFeatures aggregate(java.util.List<com.oram.entity.PermissionRecord> records) {
        if (records == null || records.isEmpty()) {
            return RiskFeatures.builder().build();
        }
        boolean isAdmin = records.stream().anyMatch(com.oram.entity.PermissionRecord::isAdmin);
        boolean isOwner = records.stream().anyMatch(com.oram.entity.PermissionRecord::isOwner);
        boolean hasApiToken = records.stream().anyMatch(com.oram.entity.PermissionRecord::isHasApiToken);
        boolean recentLogin = records.stream().anyMatch(com.oram.entity.PermissionRecord::isRecentLogin);
        int repoCount = records.stream().mapToInt(com.oram.entity.PermissionRecord::getRepoCount).sum();
        int workspaceCount = records.stream().mapToInt(com.oram.entity.PermissionRecord::getWorkspaceCount).sum();

        return RiskFeatures.builder()
                .isAdmin(isAdmin)
                .isOwner(isOwner)
                .hasApiToken(hasApiToken)
                .recentLogin(recentLogin)
                .repoCount(repoCount)
                .workspaceCount(workspaceCount)
                .build();
    }
}
