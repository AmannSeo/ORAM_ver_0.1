package com.oram.service;

import com.oram.dto.EmployeeDto;
import com.oram.entity.Employee;
import com.oram.enums.EmployeeStatus;
import com.oram.repository.EmployeeRepository;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.PermissionRecordRepository;
import com.oram.repository.SaasIdentityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.criteria.Predicate;

import java.io.BufferedReader;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmployeeService {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private final EmployeeRepository employeeRepository;
    private final OffboardingResultRepository offboardingResultRepository;
    private final PermissionRecordRepository permissionRecordRepository;
    private final SaasIdentityRepository saasIdentityRepository;
    private final OffboardingService offboardingService;

    @Transactional(readOnly = true)
    public EmployeeDto.PageResponse getEmployees(EmployeeStatus status, String department, String query, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        String normalizedDepartment = normalizeFilter(department);
        String normalizedQuery = normalizeFilter(query);
        Page<Employee> result = employeeRepository.findAll(buildEmployeeSearchSpec(status, normalizedDepartment, normalizedQuery), pageable);

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
                .status(request.getStatus() != null ? request.getStatus() : EmployeeStatus.ACTIVE)
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

        return offboardingService.triggerOffboarding(employee);
    }

    @Transactional
    public void deleteEmployee(UUID id) {
        Employee employee = findById(id);
        saasIdentityRepository.deleteByEmployeeId(employee.getId());
        employeeRepository.delete(employee);
    }

    private String normalizeFilter(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim();
    }

    private Specification<Employee> buildEmployeeSearchSpec(EmployeeStatus status, String department, String query) {
        return (root, criteriaQuery, cb) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }

            if (department != null) {
                predicates.add(cb.like(cb.lower(root.get("department")), "%" + department.toLowerCase() + "%"));
            }

            if (query != null) {
                String like = "%" + query.toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("employeeId")), like),
                        cb.like(cb.lower(root.get("name")), like),
                        cb.like(cb.lower(root.get("email")), like),
                        cb.like(cb.lower(root.get("department")), like)
                ));
            }

            return predicates.isEmpty()
                    ? cb.conjunction()
                    : cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    @Transactional
    public long deleteAllEmployees() {
        long count = employeeRepository.count();
        permissionRecordRepository.deleteAllInBatch();
        offboardingResultRepository.deleteAllInBatch();
        saasIdentityRepository.deleteAllInBatch();
        employeeRepository.deleteAllInBatch();
        return count;
    }

    @Transactional
    public EmployeeDto.CsvImportResult importFromCsv(String csvContent) {
        List<String> success = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> seenEmails = new HashSet<>();
        Set<String> seenEmployeeIds = new HashSet<>();
        Map<String, Integer> headerMap = null;
        int lineNum = 0;

        try (BufferedReader reader = new BufferedReader(new StringReader(csvContent))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                line = line.trim();
                if (line.isEmpty()) continue;

                List<String> cols = parseCsvLine(line);
                if (lineNum == 1 && looksLikeHeader(cols)) {
                    headerMap = buildHeaderMap(cols);
                    continue;
                }

                if (cols.size() < 3) {
                    errors.add("Line " + lineNum + ": not enough columns");
                    continue;
                }

                String employeeId = getColumn(cols, headerMap, "employeeId", 0);
                String name = getColumn(cols, headerMap, "name", 1);
                String email = getColumn(cols, headerMap, "email", 2).toLowerCase();
                String department = getColumn(cols, headerMap, "department", 3);
                String statusStr = getColumn(cols, headerMap, "status", 4);

                if (name.isEmpty() || email.isEmpty() || department.isEmpty()) {
                    errors.add("Line " + lineNum + ": name, email, and department are required");
                    continue;
                }
                if (!EMAIL_PATTERN.matcher(email).matches()) {
                    errors.add("Line " + lineNum + ": invalid email - " + email);
                    continue;
                }
                if (employeeId.isEmpty()) {
                    employeeId = generateEmployeeId(email, lineNum);
                }

                if (seenEmails.contains(email) || seenEmployeeIds.contains(employeeId)) {
                    skipped.add(email + " (duplicate in CSV)");
                    continue;
                }
                seenEmails.add(email);
                seenEmployeeIds.add(employeeId);

                if (employeeRepository.existsByEmail(email) || employeeRepository.existsByEmployeeId(employeeId)) {
                    skipped.add(email + " (already exists)");
                    continue;
                }

                Employee employee = Employee.builder()
                        .employeeId(employeeId)
                        .name(name)
                        .email(email)
                        .department(department)
                        .status(parseStatus(statusStr))
                        .build();
                employeeRepository.save(employee);
                success.add(email);
                log.info("CSV import: {} ({})", email, employeeId);
            }
        } catch (Exception e) {
            throw new RuntimeException("CSV parsing error: " + e.getMessage(), e);
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

    private List<String> parseCsvLine(String line) {
        List<String> cols = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (ch == ',' && !inQuotes) {
                cols.add(cleanCsvValue(current.toString()));
                current.setLength(0);
            } else {
                current.append(ch);
            }
        }
        cols.add(cleanCsvValue(current.toString()));
        return cols;
    }

    private String cleanCsvValue(String value) {
        return value == null ? "" : value.replace("\uFEFF", "").trim();
    }

    private boolean looksLikeHeader(List<String> cols) {
        return cols.stream()
                .map(this::normalizeHeader)
                .anyMatch(header -> header.equals("employeeid")
                        || header.equals("name")
                        || header.equals("email")
                        || header.equals("department")
                        || header.equals("status")
                        || header.equals("사번")
                        || header.equals("이름")
                        || header.equals("이메일")
                        || header.equals("부서")
                        || header.equals("상태"));
    }

    private Map<String, Integer> buildHeaderMap(List<String> cols) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < cols.size(); i++) {
            String header = normalizeHeader(cols.get(i));
            if (header.equals("employeeid") || header.equals("사번") || header.equals("직원번호") || header.equals("직원id")) {
                map.put("employeeId", i);
            } else if (header.equals("name") || header.equals("이름") || header.equals("성명")) {
                map.put("name", i);
            } else if (header.equals("email") || header.equals("이메일") || header.equals("메일")) {
                map.put("email", i);
            } else if (header.equals("department") || header.equals("부서") || header.equals("팀") || header.equals("소속")) {
                map.put("department", i);
            } else if (header.equals("status") || header.equals("상태") || header.equals("재직상태")) {
                map.put("status", i);
            }
        }
        return map;
    }

    private String normalizeHeader(String value) {
        return cleanCsvValue(value).toLowerCase()
                .replace("_", "")
                .replace("-", "")
                .replace(" ", "");
    }

    private String getColumn(List<String> cols, Map<String, Integer> headerMap, String key, int fallbackIndex) {
        int index = headerMap != null && headerMap.containsKey(key) ? headerMap.get(key) : fallbackIndex;
        return index >= 0 && index < cols.size() ? cleanCsvValue(cols.get(index)) : "";
    }

    private EmployeeStatus parseStatus(String statusStr) {
        String normalized = cleanCsvValue(statusStr).toUpperCase();
        if (normalized.isEmpty()) {
            return EmployeeStatus.ACTIVE;
        }
        if (normalized.equals("재직") || normalized.equals("재직중") || normalized.equals("활성")) {
            return EmployeeStatus.ACTIVE;
        }
        if (normalized.equals("퇴사") || normalized.equals("퇴사자") || normalized.equals("비활성")) {
            return EmployeeStatus.RESIGNED;
        }
        try {
            return EmployeeStatus.valueOf(normalized);
        } catch (Exception e) {
            return EmployeeStatus.ACTIVE;
        }
    }

    private String generateEmployeeId(String email, int lineNum) {
        String localPart = email.split("@")[0].replaceAll("[^A-Za-z0-9]", "").toUpperCase();
        if (localPart.isEmpty()) {
            localPart = "CSV";
        }
        return "CSV-" + localPart + "-" + lineNum;
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
