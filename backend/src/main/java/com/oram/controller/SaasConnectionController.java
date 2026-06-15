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
     * 토큰 직접 입력 연결 — OAuth App 등록 없이 바로 연결 가능
     *
     * Slack  : xoxb-... (Bot Token) 또는 xoxp-... (User Token)
     * GitHub : ghp_... (PAT) 또는 Fine-grained PAT
     * Notion : secret_... (Internal Integration Token)
     */
    @PostMapping("/token-connect/{saasType}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SaasConnectionDto.Response> tokenConnect(
            @PathVariable SaasType saasType,
            @RequestBody TokenConnectRequest request) {
        SaasConnectionDto.Response result = saasConnectionService.tokenConnect(
                saasType, request.getToken(), request.getWorkspaceName());
        return ResponseEntity.ok(result);
    }

    @org.springframework.web.bind.annotation.ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArg(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }

    @PostMapping("/token-connect-error/{saasType}")
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> disconnect(@PathVariable SaasType saasType) {
        saasConnectionService.disconnect(saasType);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/demo-connect/{saasType}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SaasConnectionDto.Response> demoConnect(@PathVariable SaasType saasType) {
        return ResponseEntity.ok(saasConnectionService.demoConnect(saasType));
    }

    @Data
    @NoArgsConstructor
    public static class TokenConnectRequest {
        private String token;          // 실제 SaaS 토큰
        private String workspaceName;  // 사용자가 직접 입력하는 워크스페이스 이름
    }
}


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

    @GetMapping("/oauth/authorize/{saasType}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SaasConnectionDto.OAuthUrlResponse> getOAuthUrl(@PathVariable SaasType saasType) {
        return ResponseEntity.ok(saasConnectionService.getOAuthUrl(saasType));
    }

    /**
     * OAuth 콜백 - 프론트엔드에서 redirect 후 이 엔드포인트 호출
     * 실제 운영에서는 state 파라미터로 CSRF 검증 필요
     */
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
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> disconnect(@PathVariable SaasType saasType) {
        saasConnectionService.disconnect(saasType);
        return ResponseEntity.noContent().build();
    }

    /**
     * 데모 연결: OAuth 자격증명 없이 PoC 시연용 연결 생성
     */
    @PostMapping("/demo-connect/{saasType}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SaasConnectionDto.Response> demoConnect(@PathVariable SaasType saasType) {
        return ResponseEntity.ok(saasConnectionService.demoConnect(saasType));
    }
}
