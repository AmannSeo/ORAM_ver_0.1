package com.oram.controller;

import com.oram.dto.response.SaaSConnectionResponse;
import com.oram.entity.SaaSConnection.SaaSPlatform;
import com.oram.service.SaaSConnectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/saas")
@RequiredArgsConstructor
public class SaaSController {

    private final SaaSConnectionService connectionService;

    @GetMapping("/connections")
    public ResponseEntity<List<SaaSConnectionResponse>> getAllConnections() {
        return ResponseEntity.ok(connectionService.getAllConnections());
    }

    @GetMapping("/connections/{platform}")
    public ResponseEntity<SaaSConnectionResponse> getConnection(@PathVariable SaaSPlatform platform) {
        return ResponseEntity.ok(connectionService.getConnection(platform));
    }

    /**
     * OAuth2 callback endpoint.
     * In production this receives the authorization code, exchanges it for tokens,
     * and stores them securely.
     *
     * For PoC this endpoint accepts a mock token directly.
     */
    @PostMapping("/connections/{platform}/connect")
    public ResponseEntity<SaaSConnectionResponse> connect(
            @PathVariable SaaSPlatform platform,
            @RequestBody Map<String, String> payload,
            Authentication authentication
    ) {
        SaaSConnectionResponse response = connectionService.saveOAuthTokens(
                platform,
                payload.getOrDefault("accessToken", "mock-token-" + platform.name().toLowerCase()),
                payload.get("refreshToken"),
                payload.get("workspaceId"),
                payload.get("workspaceName"),
                authentication.getName()
        );
        return ResponseEntity.ok(response);
    }

    @PostMapping("/connections/{platform}/disconnect")
    public ResponseEntity<SaaSConnectionResponse> disconnect(@PathVariable SaaSPlatform platform) {
        return ResponseEntity.ok(connectionService.disconnect(platform));
    }

    /**
     * Generate OAuth authorization URL for the given platform.
     * Client should redirect the browser to this URL to start the OAuth flow.
     */
    @GetMapping("/oauth2/authorize/{platform}")
    public ResponseEntity<Map<String, String>> getOAuthUrl(@PathVariable SaaSPlatform platform) {
        String authUrl = buildOAuthUrl(platform);
        return ResponseEntity.ok(Map.of("authorizationUrl", authUrl, "platform", platform.name()));
    }

    private String buildOAuthUrl(SaaSPlatform platform) {
        return switch (platform) {
            case SLACK -> "https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=users:read,users:read.email&redirect_uri=http://localhost:8080/api/oauth2/callback/slack";
            case GITHUB -> "https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=read:org,admin:org&redirect_uri=http://localhost:8080/api/oauth2/callback/github";
            case NOTION -> "https://api.notion.com/v1/oauth/authorize?client_id=${NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=http://localhost:8080/api/oauth2/callback/notion";
        };
    }
}
