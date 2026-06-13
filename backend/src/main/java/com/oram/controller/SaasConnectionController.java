package com.oram.controller;

import com.oram.dto.SaasConnectionDto;
import com.oram.enums.SaasType;
import com.oram.service.SaasConnectionService;
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
