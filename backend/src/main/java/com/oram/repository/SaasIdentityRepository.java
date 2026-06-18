package com.oram.repository;

import com.oram.entity.SaasIdentity;
import com.oram.enums.SaasType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SaasIdentityRepository extends JpaRepository<SaasIdentity, UUID> {
    Optional<SaasIdentity> findBySaasTypeAndExternalUserId(SaasType saasType, String externalUserId);
    List<SaasIdentity> findByEmployeeId(UUID employeeId);
    long countBySaasType(SaasType saasType);
    void deleteByEmployeeId(UUID employeeId);
}
