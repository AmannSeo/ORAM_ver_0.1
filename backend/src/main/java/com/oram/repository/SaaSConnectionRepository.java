package com.oram.repository;

import com.oram.entity.SaaSConnection;
import com.oram.entity.SaaSConnection.SaaSPlatform;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SaaSConnectionRepository extends JpaRepository<SaaSConnection, Long> {

    Optional<SaaSConnection> findByPlatform(SaaSPlatform platform);

    List<SaaSConnection> findByConnected(Boolean connected);

    long countByConnected(Boolean connected);
}
