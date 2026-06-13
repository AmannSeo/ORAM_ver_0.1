package com.oram.repository;

import com.oram.entity.SaasConnection;
import com.oram.enums.SaasType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SaasConnectionRepository extends JpaRepository<SaasConnection, UUID> {
    Optional<SaasConnection> findBySaasType(SaasType saasType);
    List<SaasConnection> findByConnectedTrue();
    long countByConnectedTrue();
}
