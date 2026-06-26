package com.oram.controller;

import com.oram.dto.AuditLogDto;
import com.oram.dto.EmployeeDto;
import com.oram.entity.AuditLog;
import com.oram.enums.UserRole;
import com.oram.enums.EmployeeStatus;
import com.oram.enums.SaasType;
import com.oram.repository.AuditLogRepository;
import com.oram.repository.EmployeeRepository;
import com.oram.repository.OffboardingResultRepository;
import com.oram.repository.UserRepository;
import com.oram.security.JwtTokenProvider;
import com.oram.service.EmployeeService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;
    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditLogRepository auditLogRepository;
    private final EmployeeRepository employeeRepository;
    private final OffboardingResultRepository offboardingResultRepository;

    @GetMapping
    public ResponseEntity<EmployeeDto.PageResponse> getEmployees(
            @RequestParam(required = false) EmployeeStatus status,
            @RequestParam(required = false) String department,
            @RequestParam(required = false) SaasType saasType,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(employeeService.getEmployees(status, department, saasType, q, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<EmployeeDto.Response> getEmployee(@PathVariable UUID id) {
        return ResponseEntity.ok(employeeService.getEmployee(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EmployeeDto.Response> createEmployee(@Valid @RequestBody EmployeeDto.CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(employeeService.createEmployee(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EmployeeDto.Response> updateEmployee(
            @PathVariable UUID id,
            @RequestBody EmployeeDto.UpdateRequest request) {
        return ResponseEntity.ok(employeeService.updateEmployee(id, request));
    }

    @PutMapping("/{id}/resign")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<Map<String, Object>> resignEmployee(
            @PathVariable UUID id,
            Authentication authentication,
            HttpServletRequest request) {
        var actor = resolveActor(authentication, request);
        UUID offboardingResultId = employeeService.resignEmployee(id, actor);
        return ResponseEntity.ok(Map.of(
                "message", "Employee resigned. Offboarding workflow triggered.",
                "offboardingResultId", offboardingResultId.toString()
        ));
    }

    @PostMapping("/{id}/analyze")
    public ResponseEntity<Map<String, Object>> analyzeEmployee(
            @PathVariable UUID id,
            Authentication authentication,
            HttpServletRequest request) {
        String email = resolveAuthenticatedEmail(authentication, request);
        var user = email != null ? userRepository.findByEmailIgnoreCase(email).orElse(null) : null;

        if (user == null || (user.getRole() != UserRole.ADMIN && user.getRole() != UserRole.SECURITY_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "관리자 또는 보안 관리자만 직원 위험도 분석을 실행할 수 있습니다.",
                    "reason", user == null ? "TOKEN_USER_NOT_FOUND" : "ROLE_NOT_ALLOWED",
                    "email", email != null ? email : "anonymous",
                    "role", user != null ? user.getRole().name() : "unknown"
            ));
        }

        UUID offboardingResultId = employeeService.analyzeEmployee(id, user);
        return ResponseEntity.ok(Map.of(
                "message", "Employee risk analysis completed.",
                "offboardingResultId", offboardingResultId.toString()
        ));
    }

    private String resolveAuthenticatedEmail(Authentication authentication, HttpServletRequest request) {
        if (authentication != null && authentication.getName() != null && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName();
        }

        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            String token = authorization.substring(7);
            if (jwtTokenProvider.validateToken(token)) {
                return jwtTokenProvider.getEmailFromToken(token);
            }
        }

        String fallbackToken = request.getHeader("X-ORAM-Auth-Token");
        if (fallbackToken != null && !fallbackToken.isBlank() && jwtTokenProvider.validateToken(fallbackToken)) {
            return jwtTokenProvider.getEmailFromToken(fallbackToken);
        }

        return null;
    }

    private com.oram.entity.User resolveActor(Authentication authentication, HttpServletRequest request) {
        String email = resolveAuthenticatedEmail(authentication, request);
        return email != null ? userRepository.findByEmailIgnoreCase(email).orElse(null) : null;
    }

    @GetMapping("/audit-logs")
    public ResponseEntity<AuditLogDto.PageResponse> getAuditLogs(
            Authentication authentication,
            HttpServletRequest request,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        String email = resolveAuthenticatedEmail(authentication, request);
        var user = email != null ? userRepository.findByEmailIgnoreCase(email).orElse(null) : null;

        if (user == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }

        PageRequest pageable = PageRequest.of(page, size);
        Page<AuditLog> logPage = auditLogRepository.findByTargetTypeInOrderByCreatedAtDesc(
                List.of("EMPLOYEE", "OFFBOARDING_RESULT"), pageable);
        List<AuditLogDto.Response> content = logPage.getContent().stream()
                .map(log -> AuditLogDto.Response.builder()
                        .id(log.getId().toString())
                        .createdAt(log.getCreatedAt() != null ? log.getCreatedAt().toString() : null)
                        .actorName(log.getUser() != null ? log.getUser().getName() : null)
                        .actorEmail(log.getUser() != null ? log.getUser().getEmail() : null)
                        .action(log.getAction())
                        .targetType(log.getTargetType())
                        .targetId(log.getTargetId())
                        .targetLabel(resolveAuditTargetLabel(log))
                        .detail(log.getDetail())
                        .build())
                .toList();
        return ResponseEntity.ok(AuditLogDto.PageResponse.builder()
                .content(content)
                .page(logPage.getNumber())
                .size(logPage.getSize())
                .totalElements(logPage.getTotalElements())
                .totalPages(logPage.getTotalPages())
                .build());
    }

    private String resolveAuditTargetLabel(AuditLog log) {
        if (log.getTargetLabel() != null && !log.getTargetLabel().isBlank()) {
            return log.getTargetLabel();
        }

        if (log.getTargetId() == null || log.getTargetId().isBlank()) {
            return "-";
        }

        try {
            UUID id = UUID.fromString(log.getTargetId());
            if ("EMPLOYEE".equals(log.getTargetType())) {
                return employeeRepository.findById(id)
                        .map(employee -> employee.getName() + " / " + employee.getEmail())
                        .orElse(log.getTargetId());
            }
            if ("OFFBOARDING_RESULT".equals(log.getTargetType())) {
                return offboardingResultRepository.findById(id)
                        .map(result -> result.getEmployee().getName() + " / " + result.getEmployee().getEmail())
                        .orElse(log.getTargetId());
            }
        } catch (Exception ignored) {
            // Non-UUID targets such as SaaS names are displayed as-is.
        }

        return log.getTargetId();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteEmployee(
            @PathVariable UUID id,
            Authentication authentication,
            HttpServletRequest request) {
        employeeService.deleteEmployee(id, resolveActor(authentication, request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/delete-all")
    public ResponseEntity<Map<String, Object>> deleteAllEmployees(
            Authentication authentication,
            HttpServletRequest request) {
        String email = resolveAuthenticatedEmail(authentication, request);
        var user = email != null ? userRepository.findByEmailIgnoreCase(email).orElse(null) : null;

        if (user == null || (user.getRole() != UserRole.ADMIN && user.getRole() != UserRole.SECURITY_MANAGER)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "전체 삭제는 관리자 또는 보안 관리자만 실행할 수 있습니다.",
                    "reason", user == null ? "TOKEN_USER_NOT_FOUND" : "ROLE_NOT_ALLOWED",
                    "email", email != null ? email : "anonymous",
                    "role", user != null ? user.getRole().name() : "unknown"
            ));
        }

        long deletedCount = employeeService.deleteAllEmployees(user);
        return ResponseEntity.ok(Map.of(
                "message", "All employees deleted.",
                "deletedCount", deletedCount
        ));
    }

    /**
     * CSV 파일로 직원 일괄 가져오기
     * 형식: employee_id,name,email,department,status(선택)
     * 기존 HR 시스템 데이터를 CSV로 내보낸 후 업로드하면 됩니다.
     */
    @PostMapping(value = "/csv-import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<EmployeeDto.CsvImportResult> csvImport(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        try {
            byte[] bytes = file.getBytes();
            String csvContent = new String(bytes, StandardCharsets.UTF_8);
            if (csvContent.contains("\uFFFD")) {
                csvContent = new String(bytes, Charset.forName("MS949"));
            }
            return ResponseEntity.ok(employeeService.importFromCsv(csvContent));
        } catch (IOException e) {
            throw new RuntimeException("파일 읽기 오류: " + e.getMessage(), e);
        }
    }
}
