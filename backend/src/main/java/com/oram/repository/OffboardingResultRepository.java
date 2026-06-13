package com.oram.repository;

import com.oram.entity.OffboardingResult;
import com.oram.enums.OffboardingStatus;
import com.oram.enums.RiskLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OffboardingResultRepository extends JpaRepository<OffboardingResult, UUID> {
    List<OffboardingResult> findByEmployee_Id(UUID employeeId);
    Optional<OffboardingResult> findTopByEmployee_IdOrderByCreatedAtDesc(UUID employeeId);
    long countByStatus(OffboardingStatus status);
    long countByRiskLevel(RiskLevel riskLevel);
}
