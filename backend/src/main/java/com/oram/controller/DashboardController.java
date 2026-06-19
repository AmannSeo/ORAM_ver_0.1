package com.oram.controller;

import com.oram.dto.DashboardDto;
import com.oram.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
    public ResponseEntity<DashboardDto.Stats> getStats() {
        return ResponseEntity.ok(dashboardService.getStats());
    }

    @GetMapping("/saas-sync-alerts")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
    public ResponseEntity<List<DashboardDto.SaasSyncAlertResponse>> getSaasSyncAlerts(
            @RequestParam(defaultValue = "5") int limit) {
        return ResponseEntity.ok(dashboardService.getOpenSaasSyncAlerts(limit));
    }
}
