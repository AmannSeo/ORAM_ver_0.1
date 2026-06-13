package com.oram.service;

import com.oram.dto.EmployeeDto;
import com.oram.entity.Employee;
import com.oram.enums.EmployeeStatus;
import com.oram.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EmployeeService {

    private final EmployeeRepository employeeRepository;
    private final OffboardingService offboardingService;

    @Transactional(readOnly = true)
    public EmployeeDto.PageResponse getEmployees(EmployeeStatus status, String department, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<Employee> result;

        if (status != null && department != null) {
            result = employeeRepository.findByStatusAndDepartment(status, department, pageable);
        } else if (status != null) {
            result = employeeRepository.findByStatus(status, pageable);
        } else {
            result = employeeRepository.findAll(pageable);
        }

        return EmployeeDto.PageResponse.builder()
                .content(result.getContent().stream().map(this::toResponse).toList())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .page(result.getNumber())
                .size(result.getSize())
                .build();
    }

    @Transactional(readOnly = true)
    public EmployeeDto.Response getEmployee(UUID id) {
        Employee employee = findById(id);
        return toResponse(employee);
    }

    @Transactional
    public EmployeeDto.Response createEmployee(EmployeeDto.CreateRequest request) {
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
                .status(EmployeeStatus.ACTIVE)
                .build();
        return toResponse(employeeRepository.save(employee));
    }

    @Transactional
    public EmployeeDto.Response updateEmployee(UUID id, EmployeeDto.UpdateRequest request) {
        Employee employee = findById(id);
        if (request.getName() != null) employee.setName(request.getName());
        if (request.getDepartment() != null) employee.setDepartment(request.getDepartment());
        if (request.getStatus() != null) employee.setStatus(request.getStatus());
        return toResponse(employeeRepository.save(employee));
    }

    @Transactional
    public UUID resignEmployee(UUID id) {
        Employee employee = findById(id);
        if (employee.getStatus() == EmployeeStatus.RESIGNED) {
            throw new IllegalStateException("Employee is already resigned.");
        }
        employee.setStatus(EmployeeStatus.RESIGNED);
        employeeRepository.save(employee);

        // 오프보딩 워크플로우 트리거
        return offboardingService.triggerOffboarding(employee);
    }

    @Transactional
    public void deleteEmployee(UUID id) {
        Employee employee = findById(id);
        employeeRepository.delete(employee);
    }

    private Employee findById(UUID id) {
        return employeeRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + id));
    }

    private EmployeeDto.Response toResponse(Employee e) {
        return EmployeeDto.Response.builder()
                .id(e.getId())
                .employeeId(e.getEmployeeId())
                .name(e.getName())
                .email(e.getEmail())
                .department(e.getDepartment())
                .status(e.getStatus())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
