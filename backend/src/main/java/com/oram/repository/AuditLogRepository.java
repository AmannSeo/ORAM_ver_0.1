package com.oram.repository;

import com.oram.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {
    Page<AuditLog> findByAction(String action, Pageable pageable);
    Page<AuditLog> findByTargetType(String targetType, Pageable pageable);
    Page<AuditLog> findByUser_Id(UUID userId, Pageable pageable);
    Page<AuditLog> findByTargetTypeInOrderByCreatedAtDesc(List<String> targetTypes, Pageable pageable);
}
