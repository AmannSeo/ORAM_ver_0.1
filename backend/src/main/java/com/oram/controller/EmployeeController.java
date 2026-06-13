package com.oram.controller;

import com.oram.dto.EmployeeDto;
import com.oram.enums.EmployeeStatus;
import com.oram.service.EmployeeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
}
