package com.oram.service;

import com.oram.dto.response.DashboardStatsResponse;
import com.oram.entity.Employee.EmployeeStatus;
import com.oram.entity.OffboardingResult.OffboardingStatus;
import com.oram.entity.OffboardingResult.RiskLevel;
import com.oram.repository.EmployeeRepository;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.SaaSConnectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {

    private final EmployeeRepository employeeRepository;
    private final SaaSConnectionRepository saaSConnectionRepository;
    private final OffboardingResultRepository offboardingResultRepository;

    public DashboardStatsResponse getStats() {
        long totalEmployees = employeeRepository.count();
        long activeEmployees = employeeRepository.countByStatus(EmployeeStatus.ACTIVE);
        long resignedEmployees = employeeRepository.countByStatus(EmployeeStatus.RESIGNED);
        long connectedSaas = saaSConnectionRepository.countByConnected(true);

        long criticalRisk = offboardingResultRepository.countByRiskLevel(RiskLevel.CRITICAL);
        long highRisk = offboardingResultRepository.countByRiskLevel(RiskLevel.HIGH);
        long mediumRisk = offboardingResultRepository.countByRiskLevel(RiskLevel.MEDIUM);
        long lowRisk = offboardingResultRepository.countByRiskLevel(RiskLevel.LOW);

        long pendingOffboardings = offboardingResultRepository.findAll().stream()
                .filter(r -> r.getStatus() == OffboardingStatus.PENDING || r.getStatus() == OffboardingStatus.IN_PROGRESS)
                .count();
        long completedOffboardings = offboardingResultRepository.findAll().stream()
                .filter(r -> r.getStatus() == OffboardingStatus.COMPLETED)
                .count();

        return DashboardStatsResponse.builder()
                .totalEmployees(totalEmployees)
                .activeEmployees(activeEmployees)
                .resignedEmployees(resignedEmployees)
                .connectedSaasCount(connectedSaas)
                .criticalRiskAccounts(criticalRisk)
                .highRiskAccounts(highRisk)
                .mediumRiskAccounts(mediumRisk)
                .lowRiskAccounts(lowRisk)
                .pendingOffboardings(pendingOffboardings)
                .completedOffboardings(completedOffboardings)
                .build();
    }
}
