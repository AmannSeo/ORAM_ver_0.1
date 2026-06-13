package com.oram.repository;

import com.oram.entity.Employee;
import com.oram.enums.EmployeeStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, UUID> {
    Optional<Employee> findByEmail(String email);
    Optional<Employee> findByEmployeeId(String employeeId);
    Page<Employee> findByStatus(EmployeeStatus status, Pageable pageable);
    Page<Employee> findByStatusAndDepartment(EmployeeStatus status, String department, Pageable pageable);
    long countByStatus(EmployeeStatus status);
    boolean existsByEmail(String email);
    boolean existsByEmployeeId(String employeeId);
}
