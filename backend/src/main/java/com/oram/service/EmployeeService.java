package com.oram.service;

import com.oram.dto.EmployeeDto;
import com.oram.entity.Employee;
import com.oram.enums.EmployeeStatus;
import com.oram.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
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

    /**
     * CSV 일괄 가져오기
     * 형식: employee_id,name,email,department,status(선택)
     * 첫 줄 헤더 자동 스킵
     */
    @Transactional
    public EmployeeDto.CsvImportResult importFromCsv(String csvContent) {
        List<String> success = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int lineNum = 0;

        try (BufferedReader reader = new BufferedReader(new StringReader(csvContent))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                line = line.trim();
                if (line.isEmpty()) continue;
                // 헤더 행 스킵
                if (lineNum == 1 && (line.toLowerCase().contains("employee_id") || line.toLowerCase().contains("name"))) {
                    continue;
                }

                String[] cols = line.split(",");
                if (cols.length < 4) {
                    errors.add("줄 " + lineNum + ": 컬럼 부족 (필요: employee_id,name,email,department)");
                    continue;
                }

                String employeeId = cols[0].trim();
                String name       = cols[1].trim();
                String email      = cols[2].trim();
                String department = cols[3].trim();
                String statusStr  = cols.length > 4 ? cols[4].trim() : "ACTIVE";

                if (employeeId.isEmpty() || email.isEmpty()) {
                    errors.add("줄 " + lineNum + ": 사번 또는 이메일 누락");
                    continue;
                }

                if (employeeRepository.existsByEmail(email) || employeeRepository.existsByEmployeeId(employeeId)) {
                    skipped.add(email + " (이미 존재)");
                    continue;
                }

                EmployeeStatus status;
                try {
                    status = EmployeeStatus.valueOf(statusStr.toUpperCase());
                } catch (Exception e) {
                    status = EmployeeStatus.ACTIVE;
                }

                Employee employee = Employee.builder()
                        .employeeId(employeeId)
                        .name(name)
                        .email(email)
                        .department(department)
                        .status(status)
                        .build();
                employeeRepository.save(employee);
                success.add(email);
                log.info("CSV import: {} ({})", email, employeeId);
            }
        } catch (Exception e) {
            throw new RuntimeException("CSV 파싱 오류: " + e.getMessage(), e);
        }

        return EmployeeDto.CsvImportResult.builder()
                .importedCount(success.size())
                .skippedCount(skipped.size())
                .errorCount(errors.size())
                .imported(success)
                .skipped(skipped)
                .errors(errors)
                .build();
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
