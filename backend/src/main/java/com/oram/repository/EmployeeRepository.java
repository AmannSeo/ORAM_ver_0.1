package com.oram.repository;

import com.oram.entity.Employee;
import com.oram.entity.Employee.EmployeeStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByEmail(String email);

    Optional<Employee> findByEmployeeId(String employeeId);

    List<Employee> findByStatus(EmployeeStatus status);

    long countByStatus(EmployeeStatus status);

    @Query("SELECT e FROM Employee e WHERE e.status = 'RESIGNED' AND e.offboardingTriggered = false")
    List<Employee> findResignedWithoutOffboarding();

    boolean existsByEmail(String email);

    boolean existsByEmployeeId(String employeeId);
}
