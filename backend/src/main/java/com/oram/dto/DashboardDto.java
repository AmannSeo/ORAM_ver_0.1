package com.oram.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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
    }
}
