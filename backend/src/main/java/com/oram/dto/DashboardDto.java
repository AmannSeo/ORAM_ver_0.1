package com.oram.dto;

import com.oram.enums.SaasSyncAlertStatus;
import com.oram.enums.SaasType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

public class DashboardDto {

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Stats {
        private long totalEmployees;
        private long activeEmployees;
        private long resignedEmployees;
        private long connectedSaasCount;
        private long criticalRiskCount;
        private long pendingOffboardings;
        private long openSaasSyncAlerts;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SaasSyncAlertResponse {
        private UUID id;
        private SaasType saasType;
        private SaasSyncAlertStatus status;
        private String reason;
        private String detail;
        private String externalUsername;
        private String externalEmail;
        private String displayName;
        private UUID employeeId;
        private String employeeName;
        private String employeeEmail;
        private LocalDateTime createdAt;
    }
}
