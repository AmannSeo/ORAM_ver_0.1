package com.oram.controller;

import com.oram.dto.OffboardingDto;
import com.oram.entity.User;
import com.oram.repository.UserRepository;
import com.oram.service.OffboardingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/offboarding")
@RequiredArgsConstructor
public class OffboardingController {

    private final OffboardingService offboardingService;
    private final UserRepository userRepository;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
    public ResponseEntity<List<OffboardingDto.Summary>> getAllResults() {
        return ResponseEntity.ok(offboardingService.getAllResults());
    }

    @GetMapping("/{resultId}")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
    public ResponseEntity<OffboardingDto.Detail> getDetail(@PathVariable UUID resultId) {
        return ResponseEntity.ok(offboardingService.getDetail(resultId));
    }

    @GetMapping("/{resultId}/revoke-plan")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
    public ResponseEntity<OffboardingDto.RevokePlanResponse> getRevokePlan(@PathVariable UUID resultId) {
        return ResponseEntity.ok(offboardingService.getRevokePlan(resultId));
    }

    @PostMapping("/{resultId}/revoke-all")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<OffboardingDto.RevokeResponse> revokeAll(
            @PathVariable UUID resultId,
            Authentication authentication) {
        User reviewer = userRepository.findByEmail(authentication.getName()).orElse(null);
        return ResponseEntity.ok(offboardingService.revokeAll(resultId, reviewer));
    }
}
