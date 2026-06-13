package com.oram.service;

import com.oram.dto.DashboardDto;
import com.oram.enums.EmployeeStatus;
import com.oram.enums.OffboardingStatus;
import com.oram.enums.RiskLevel;
import com.oram.repository.EmployeeRepository;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.SaasConnectionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final EmployeeRepository employeeRepository;
    private final SaasConnectionRepository connectionRepository;
    private final OffboardingResultRepository offboardingResultRepository;

    @Transactional(readOnly = true)
    public DashboardDto.Stats getStats() {
        long total = employeeRepository.count();
        long active = employeeRepository.countByStatus(EmployeeStatus.ACTIVE);
        long resigned = employeeRepository.countByStatus(EmployeeStatus.RESIGNED);
        long connectedSaas = connectionRepository.countByConnectedTrue();
        long criticalRisk = offboardingResultRepository.countByRiskLevel(RiskLevel.CRITICAL);
        long pending = offboardingResultRepository.countByStatus(OffboardingStatus.PENDING)
                     + offboardingResultRepository.countByStatus(OffboardingStatus.IN_PROGRESS);

        return DashboardDto.Stats.builder()
                .totalEmployees(total)
                .activeEmployees(active)
                .resignedEmployees(resigned)
                .connectedSaasCount(connectedSaas)
                .criticalRiskCount(criticalRisk)
                .pendingOffboardings(pending)
                .build();
    }
}
