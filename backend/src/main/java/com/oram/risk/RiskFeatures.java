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
    private String primarySaas;
    private String department;
    private int hourOfDay;
    private double trafficMb;
    private int apiCount;
    private String ipAddress;

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
                .primarySaas(records.stream()
                        .findFirst()
                        .map(record -> record.getSaasType().name())
                        .orElse("UNKNOWN"))
                .department(records.stream()
                        .findFirst()
                        .map(record -> record.getSaasType().name())
                        .orElse("UNKNOWN"))
                .hourOfDay(java.time.LocalDateTime.now().getHour())
                .trafficMb(estimateTrafficMb(records))
                .apiCount(estimateApiCount(records))
                .build();
    }

    private static double estimateTrafficMb(java.util.List<com.oram.entity.PermissionRecord> records) {
        int repoTotal = records.stream().mapToInt(com.oram.entity.PermissionRecord::getRepoCount).sum();
        int workspaceTotal = records.stream().mapToInt(com.oram.entity.PermissionRecord::getWorkspaceCount).sum();
        long privileged = records.stream()
                .filter(record -> record.isAdmin() || record.isOwner() || record.isHasApiToken())
                .count();
        return Math.min(2500.0, (repoTotal * 35.0) + (workspaceTotal * 80.0) + (privileged * 120.0));
    }

    private static int estimateApiCount(java.util.List<com.oram.entity.PermissionRecord> records) {
        int base = records.size() * 8;
        int repoTotal = records.stream().mapToInt(com.oram.entity.PermissionRecord::getRepoCount).sum();
        long tokenCount = records.stream().filter(com.oram.entity.PermissionRecord::isHasApiToken).count();
        return Math.min(2000, base + (repoTotal * 3) + (int) tokenCount * 150);
    }
}
