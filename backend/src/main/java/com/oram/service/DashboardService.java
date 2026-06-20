package com.oram.service;

import com.oram.dto.DashboardDto;
import com.oram.entity.OffboardingResult;
import com.oram.entity.SaasSyncAlert;
import com.oram.enums.EmployeeStatus;
import com.oram.enums.OffboardingStatus;
import com.oram.enums.RiskLevel;
import com.oram.enums.SaasSyncAlertStatus;
import com.oram.repository.EmployeeRepository;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.SaasConnectionRepository;
import com.oram.repository.SaasSyncAlertRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final EmployeeRepository employeeRepository;
    private final SaasConnectionRepository connectionRepository;
    private final OffboardingResultRepository offboardingResultRepository;
    private final SaasSyncAlertRepository saasSyncAlertRepository;

    @Transactional(readOnly = true)
    public DashboardDto.Stats getStats() {
        long total = employeeRepository.count();
        long active = employeeRepository.countByStatus(EmployeeStatus.ACTIVE);
        long resigned = employeeRepository.countByStatus(EmployeeStatus.RESIGNED);
        long connectedSaas = connectionRepository.countByConnectedTrue();
        List<OffboardingResult> currentResults = getLatestResultPerEmployee();
        long criticalRisk = currentResults.stream()
                .filter(result -> result.getRiskLevel() == RiskLevel.CRITICAL)
                .count();
        long pending = currentResults.stream()
                .filter(result -> result.getStatus() == OffboardingStatus.PENDING
                        || result.getStatus() == OffboardingStatus.IN_PROGRESS)
                .count();
        long openSaasAlerts = saasSyncAlertRepository.countByStatus(SaasSyncAlertStatus.OPEN);

        return DashboardDto.Stats.builder()
                .totalEmployees(total)
                .activeEmployees(active)
                .resignedEmployees(resigned)
                .connectedSaasCount(connectedSaas)
                .criticalRiskCount(criticalRisk)
                .pendingOffboardings(pending)
                .openSaasSyncAlerts(openSaasAlerts)
                .build();
    }

    private List<OffboardingResult> getLatestResultPerEmployee() {
        Map<UUID, OffboardingResult> latestByEmployee = new LinkedHashMap<>();

        offboardingResultRepository.findAll().stream()
                .filter(result -> !result.isFalsePositive())
                .sorted(Comparator.comparing(
                        OffboardingResult::getCreatedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())
                ))
                .forEach(result -> {
                    var employee = result.getEmployee();
                    if (employee != null && employee.getId() != null) {
                        latestByEmployee.putIfAbsent(employee.getId(), result);
                    }
                });

        return new ArrayList<>(latestByEmployee.values());
    }

    @Transactional(readOnly = true)
    public List<DashboardDto.SaasSyncAlertResponse> getOpenSaasSyncAlerts(int limit) {
        return saasSyncAlertRepository
                .findByStatusOrderByCreatedAtDesc(SaasSyncAlertStatus.OPEN, PageRequest.of(0, Math.max(1, limit)))
                .stream()
                .map(this::toAlertResponse)
                .toList();
    }

    private DashboardDto.SaasSyncAlertResponse toAlertResponse(SaasSyncAlert alert) {
        var employee = alert.getEmployee();
        return DashboardDto.SaasSyncAlertResponse.builder()
                .id(alert.getId())
                .saasType(alert.getSaasType())
                .status(alert.getStatus())
                .reason(alert.getReason())
                .detail(alert.getDetail())
                .externalUsername(alert.getExternalUsername())
                .externalEmail(alert.getExternalEmail())
                .displayName(alert.getDisplayName())
                .employeeId(employee != null ? employee.getId() : null)
                .employeeName(employee != null ? employee.getName() : null)
                .employeeEmail(employee != null ? employee.getEmail() : null)
                .createdAt(alert.getCreatedAt())
                .build();
    }
}
