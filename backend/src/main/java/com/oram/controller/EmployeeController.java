package com.oram.controller;

import com.oram.dto.EmployeeDto;
import com.oram.enums.EmployeeStatus;
import com.oram.service.EmployeeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
    public ResponseEntity<EmployeeDto.PageResponse> getEmployees(
            @RequestParam(required = false) EmployeeStatus status,
            @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return ResponseEntity.ok(employeeService.getEmployees(status, department, page, size));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
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
    public ResponseEntity<Map<String, Object>> resignEmployee(@PathVariable UUID id) {
        UUID offboardingResultId = employeeService.resignEmployee(id);
        return ResponseEntity.ok(Map.of(
                "message", "Employee resigned. Offboarding workflow triggered.",
                "offboardingResultId", offboardingResultId.toString()
        ));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteEmployee(@PathVariable UUID id) {
        employeeService.deleteEmployee(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> deleteAllEmployees() {
        long deletedCount = employeeService.deleteAllEmployees();
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
