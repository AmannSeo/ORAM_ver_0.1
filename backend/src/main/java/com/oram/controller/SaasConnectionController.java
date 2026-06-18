package com.oram.controller;

import com.oram.dto.SaasConnectionDto;
import com.oram.enums.SaasType;
import com.oram.service.SaasConnectionService;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/saas-connections")
@RequiredArgsConstructor
public class SaasConnectionController {

    private final SaasConnectionService saasConnectionService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER','AUDITOR')")
    public ResponseEntity<List<SaasConnectionDto.Response>> getAllConnections() {
        return ResponseEntity.ok(saasConnectionService.getAllConnections());
    }

    /**
     * Token direct connection: connect without registering an OAuth app.
     *
     * Slack  : xoxb-... (Bot Token) or xoxp-... (User Token)
     * GitHub : ghp_... (PAT) or Fine-grained PAT
     * Notion : secret_... (Internal Integration Token)
     */
    @PostMapping("/token-connect/{saasType}")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<SaasConnectionDto.Response> tokenConnect(
            @PathVariable SaasType saasType,
            @RequestBody TokenConnectRequest request) {
        SaasConnectionDto.Response result = saasConnectionService.tokenConnect(
                saasType, request.getToken(), request.getWorkspaceName());
        return ResponseEntity.ok(result);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArg(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @PostMapping("/token-connect-error/{saasType}")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<Map<String, String>> tokenConnectValidate(
            @PathVariable SaasType saasType,
            @RequestBody TokenConnectRequest request) {
        try {
            saasConnectionService.tokenConnect(saasType, request.getToken(), request.getWorkspaceName());
            return ResponseEntity.ok(Map.of("result", "ok"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/oauth/authorize/{saasType}")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<SaasConnectionDto.OAuthUrlResponse> getOAuthUrl(@PathVariable SaasType saasType) {
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
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<Void> disconnect(@PathVariable SaasType saasType) {
        saasConnectionService.disconnect(saasType);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{saasType}/sync")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<SaasConnectionDto.SyncUsersResponse> syncUsers(@PathVariable SaasType saasType) {
        return ResponseEntity.ok(saasConnectionService.syncConnectedUsers(saasType));
    }

    @PostMapping("/demo-connect/{saasType}")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<SaasConnectionDto.Response> demoConnect(@PathVariable SaasType saasType) {
        return ResponseEntity.ok(saasConnectionService.demoConnect(saasType));
    }

    @Data
    @NoArgsConstructor
    public static class TokenConnectRequest {
        private String token;
        private String workspaceName;
    }
}
