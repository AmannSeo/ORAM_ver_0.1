package com.oram.controller;

import com.oram.dto.DashboardDto;
import com.oram.enums.UserRole;
import com.oram.repository.UserRepository;
import com.oram.security.JwtTokenProvider;
import com.oram.service.DashboardService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping("/stats")
    public ResponseEntity<?> getStats(Authentication authentication, HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireDashboardRole(authentication, request);
        if (denied != null) return denied;
        return ResponseEntity.ok(dashboardService.getStats());
    }

    @GetMapping("/saas-sync-alerts")
    public ResponseEntity<?> getSaasSyncAlerts(
            @RequestParam(defaultValue = "5") int limit,
            Authentication authentication,
            HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireDashboardRole(authentication, request);
        if (denied != null) return denied;
        return ResponseEntity.ok(dashboardService.getOpenSaasSyncAlerts(limit));
    }

    private ResponseEntity<Map<String, String>> requireDashboardRole(
            Authentication authentication,
            HttpServletRequest request) {
        String email = resolveAuthenticatedEmail(authentication, request);
        var user = email != null ? userRepository.findByEmailIgnoreCase(email).orElse(null) : null;
        Set<UserRole> allowedRoles = Set.of(UserRole.ADMIN, UserRole.SECURITY_MANAGER, UserRole.AUDITOR);

        if (user == null || !allowedRoles.contains(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Insufficient role for dashboard.",
                    "email", email != null ? email : "anonymous",
                    "role", user != null ? user.getRole().name() : "unknown"
            ));
        }

        return null;
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
}
