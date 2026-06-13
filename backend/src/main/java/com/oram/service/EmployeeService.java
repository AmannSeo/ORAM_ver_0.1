package com.oram.service;

import com.oram.dto.request.EmployeeRequest;
import com.oram.dto.response.EmployeeResponse;
import com.oram.entity.Employee;
import com.oram.entity.Employee.EmployeeStatus;
import com.oram.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<EmployeeResponse> getAllEmployees() {
        return employeeRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeResponse getEmployee(Long id) {
        return employeeRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new NoSuchElementException("Employee not found: " + id));
    }

    public EmployeeResponse createEmployee(EmployeeRequest request) {
        if (employeeRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already exists: " + request.getEmail());
        }
        if (employeeRepository.existsByEmployeeId(request.getEmployeeId())) {
            throw new IllegalArgumentException("Employee ID already exists: " + request.getEmployeeId());
        }

        Employee employee = Employee.builder()
                .employeeId(request.getEmployeeId())
                .name(request.getName())
                .email(request.getEmail())
                .department(request.getDepartment())
                .status(EmployeeStatus.valueOf(request.getStatus()))
                .build();

        Employee saved = employeeRepository.save(employee);
        log.info("Created employee: {}", saved.getEmployeeId());
        return toResponse(saved);
    }

    public EmployeeResponse updateEmployee(Long id, EmployeeRequest request) {
        Employee employee = employeeRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Employee not found: " + id));

        EmployeeStatus newStatus = EmployeeStatus.valueOf(request.getStatus());
        boolean statusChangedToResigned = employee.getStatus() != EmployeeStatus.RESIGNED
                && newStatus == EmployeeStatus.RESIGNED;

        employee.setName(request.getName());
        employee.setEmail(request.getEmail());
        employee.setDepartment(request.getDepartment());
        employee.setStatus(newStatus);

        if (statusChangedToResigned) {
            employee.setResignedAt(LocalDateTime.now());
            log.info("Employee {} marked as resigned – offboarding workflow will be triggered", employee.getEmployeeId());
        }

        Employee saved = employeeRepository.save(employee);
        return toResponse(saved);
    }

    public void deleteEmployee(Long id) {
        if (!employeeRepository.existsById(id)) {
            throw new NoSuchElementException("Employee not found: " + id);
        }
        employeeRepository.deleteById(id);
        log.info("Deleted employee with id: {}", id);
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    public EmployeeResponse toResponse(Employee employee) {
        return EmployeeResponse.builder()
                .id(employee.getId())
                .employeeId(employee.getEmployeeId())
                .name(employee.getName())
                .email(employee.getEmail())
                .department(employee.getDepartment())
                .status(employee.getStatus())
                .offboardingTriggered(employee.getOffboardingTriggered())
                .createdAt(employee.getCreatedAt())
                .updatedAt(employee.getUpdatedAt())
                .resignedAt(employee.getResignedAt())
                .build();
    }
}
