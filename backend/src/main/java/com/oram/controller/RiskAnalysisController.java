package com.oram.controller;

import com.oram.dto.RiskDto;
import com.oram.risk.RiskFeatures;
import com.oram.risk.XGBoostRiskAnalyzer;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/risk-analysis")
@RequiredArgsConstructor
public class RiskAnalysisController {

    private final XGBoostRiskAnalyzer riskAnalyzer;

    @PostMapping("/score")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<RiskDto.ScoreResponse> calculateScore(@RequestBody RiskDto.ScoreRequest request) {
        RiskFeatures features = RiskFeatures.builder()
                .isAdmin(request.isAdmin())
                .isOwner(request.isOwner())
                .hasApiToken(request.isHasApiToken())
                .recentLogin(request.isRecentLogin())
                .repoCount(request.getRepoCount())
                .workspaceCount(request.getWorkspaceCount())
                .build();
        return ResponseEntity.ok(riskAnalyzer.analyze(features));
    }
}
