package com.oram.controller;

import com.oram.dto.response.OffboardingResultResponse;
import com.oram.service.OffboardingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/offboarding")
@RequiredArgsConstructor
public class OffboardingController {

    private final OffboardingService offboardingService;

    @GetMapping
    public ResponseEntity<List<OffboardingResultResponse>> getAllOffboardingResults() {
        return ResponseEntity.ok(offboardingService.getAllOffboardingResults());
    }

    @GetMapping("/{id}")
    public ResponseEntity<OffboardingResultResponse> getOffboardingResult(@PathVariable Long id) {
        return ResponseEntity.ok(offboardingService.getOffboardingResult(id));
    }

    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<List<OffboardingResultResponse>> getResultsForEmployee(@PathVariable Long employeeId) {
        return ResponseEntity.ok(offboardingService.getOffboardingResultsForEmployee(employeeId));
    }

    /**
     * Initiate offboarding workflow for a specific employee.
     * This triggers Steps 2-5: discovery, risk scoring, and dashboard update.
     */
    @PostMapping("/initiate/{employeeId}")
    public ResponseEntity<OffboardingResultResponse> initiateOffboarding(@PathVariable Long employeeId) {
        return ResponseEntity.ok(offboardingService.initiateOffboarding(employeeId));
    }

    /**
     * Revoke all discovered permissions for an offboarding result.
     * This is Step 6: one-click revocation.
     */
    @PostMapping("/{id}/revoke-all")
    public ResponseEntity<OffboardingResultResponse> revokeAll(@PathVariable Long id) {
        return ResponseEntity.ok(offboardingService.revokeAllAccess(id));
    }
}
