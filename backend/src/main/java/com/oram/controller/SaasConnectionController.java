package com.oram.controller;

import com.oram.dto.SaasConnectionDto;
import com.oram.enums.SaasType;
import com.oram.enums.UserRole;
import com.oram.repository.UserRepository;
import com.oram.security.JwtTokenProvider;
import com.oram.service.SaasConnectionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/saas-connections")
@RequiredArgsConstructor
public class SaasConnectionController {

    private final SaasConnectionService saasConnectionService;
    private final UserRepository userRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @GetMapping
    public ResponseEntity<?> getAllConnections(Authentication authentication, HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireRole(authentication, request,
                Set.of(UserRole.ADMIN, UserRole.SECURITY_MANAGER, UserRole.AUDITOR));
        if (denied != null) return denied;
        return ResponseEntity.ok(saasConnectionService.getAllConnections());
    }

    @GetMapping("/{saasType}/identities")
    public ResponseEntity<List<SaasConnectionDto.IdentityResponse>> getIdentities(@PathVariable SaasType saasType) {
        return ResponseEntity.ok(saasConnectionService.getIdentities(saasType));
    }

    /**
     * Token direct connection: connect without registering an OAuth app.
     *
     * Slack  : xoxb-... (Bot Token) or xoxp-... (User Token)
     * GitHub : ghp_... (PAT) or Fine-grained PAT
     * Notion : secret_... (Internal Integration Token)
     */
    @PostMapping("/token-connect/{saasType}")
    public ResponseEntity<?> tokenConnect(
            @PathVariable SaasType saasType,
            @RequestBody TokenConnectRequest tokenRequest,
            Authentication authentication,
            HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireManager(authentication, request);
        if (denied != null) return denied;

        SaasConnectionDto.Response result = saasConnectionService.tokenConnect(
                saasType, tokenRequest.getToken(), tokenRequest.getWorkspaceName());
        return ResponseEntity.ok(result);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArg(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @PostMapping("/token-connect-error/{saasType}")
    public ResponseEntity<Map<String, String>> tokenConnectValidate(
            @PathVariable SaasType saasType,
            @RequestBody TokenConnectRequest tokenRequest,
            Authentication authentication,
            HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireManager(authentication, request);
        if (denied != null) return denied;

        try {
            saasConnectionService.tokenConnect(saasType, tokenRequest.getToken(), tokenRequest.getWorkspaceName());
            return ResponseEntity.ok(Map.of("result", "ok"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/oauth/authorize/{saasType}")
    public ResponseEntity<?> getOAuthUrl(
            @PathVariable SaasType saasType,
            Authentication authentication,
            HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireManager(authentication, request);
        if (denied != null) return denied;

        return ResponseEntity.ok(saasConnectionService.getOAuthUrl(saasType));
    }

    @GetMapping("/oauth/callback/{saasType}")
    public ResponseEntity<Map<String, String>> oauthCallback(
            @PathVariable SaasType saasType,
            @RequestParam String code,
            @RequestParam(required = false) String state) {
        saasConnectionService.handleOAuthCallback(saasType, code);
        return ResponseEntity.ok(Map.of(
                "message", saasType + " connected successfully.",
                "redirectUrl", "http://localhost:5173/saas-connections"
        ));
    }

    @DeleteMapping("/{saasType}")
    public ResponseEntity<?> disconnect(
            @PathVariable SaasType saasType,
            Authentication authentication,
            HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireManager(authentication, request);
        if (denied != null) return denied;

        saasConnectionService.disconnect(saasType);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{saasType}/sync")
    public ResponseEntity<?> syncUsers(
            @PathVariable SaasType saasType,
            Authentication authentication,
            HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireManager(authentication, request);
        if (denied != null) return denied;

        return ResponseEntity.ok(saasConnectionService.syncConnectedUsers(saasType));
    }

    @PostMapping("/demo-connect/{saasType}")
    public ResponseEntity<?> demoConnect(
            @PathVariable SaasType saasType,
            Authentication authentication,
            HttpServletRequest request) {
        ResponseEntity<Map<String, String>> denied = requireManager(authentication, request);
        if (denied != null) return denied;

        return ResponseEntity.ok(saasConnectionService.demoConnect(saasType));
    }

    private ResponseEntity<Map<String, String>> requireManager(Authentication authentication, HttpServletRequest request) {
        return requireRole(authentication, request, Set.of(UserRole.ADMIN, UserRole.SECURITY_MANAGER));
    }

    private ResponseEntity<Map<String, String>> requireRole(
            Authentication authentication,
            HttpServletRequest request,
            Set<UserRole> allowedRoles) {
        String email = resolveAuthenticatedEmail(authentication, request);
        var user = email != null ? userRepository.findByEmail(email).orElse(null) : null;

        if (user == null || !allowedRoles.contains(user.getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "error", "Insufficient role for SaaS connection.",
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

    @Data
    @NoArgsConstructor
    public static class TokenConnectRequest {
        private String token;
        private String workspaceName;
    }
}
