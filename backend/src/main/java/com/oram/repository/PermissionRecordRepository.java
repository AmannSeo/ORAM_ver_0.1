package com.oram.repository;

import com.oram.entity.PermissionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PermissionRecordRepository extends JpaRepository<PermissionRecord, UUID> {
}
