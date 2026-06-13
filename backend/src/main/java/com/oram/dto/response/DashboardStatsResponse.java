package com.oram.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DashboardStatsResponse {
    private long totalEmployees;
    private long activeEmployees;
    private long resignedEmployees;
    private long connectedSaasCount;
    private long criticalRiskAccounts;
    private long highRiskAccounts;
    private long mediumRiskAccounts;
    private long lowRiskAccounts;
    private long pendingOffboardings;
    private long completedOffboardings;
}
