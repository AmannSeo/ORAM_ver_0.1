package com.oram.repository;

import com.oram.entity.SaasIdentity;
import com.oram.enums.SaasType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SaasIdentityRepository extends JpaRepository<SaasIdentity, UUID> {
    Optional<SaasIdentity> findBySaasTypeAndExternalUserId(SaasType saasType, String externalUserId);
    List<SaasIdentity> findBySaasTypeOrderByUpdatedAtDesc(SaasType saasType);
    List<SaasIdentity> findByEmployeeId(UUID employeeId);
    List<SaasIdentity> findByEmployeeIdAndSaasType(UUID employeeId, SaasType saasType);
    long countBySaasType(SaasType saasType);
    long countBySaasTypeAndAccessRevokedFalse(SaasType saasType);
    @Query("select max(i.lastSyncedAt) from SaasIdentity i where i.saasType = :saasType")
    LocalDateTime findLatestSyncedAtBySaasType(SaasType saasType);
    void deleteByEmployeeId(UUID employeeId);
}
