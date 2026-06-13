package com.oram.repository;

import com.oram.entity.OffboardingResult;
import com.oram.entity.OffboardingResult.RiskLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OffboardingResultRepository extends JpaRepository<OffboardingResult, Long> {

    List<OffboardingResult> findByEmployeeId(Long employeeId);

    Optional<OffboardingResult> findTopByEmployeeIdOrderByInitiatedAtDesc(Long employeeId);

    long countByRiskLevel(RiskLevel riskLevel);

    @Query("SELECT COUNT(DISTINCT o.employee.id) FROM OffboardingResult o WHERE o.riskLevel = 'CRITICAL'")
    long countDistinctCriticalRiskEmployees();
}
