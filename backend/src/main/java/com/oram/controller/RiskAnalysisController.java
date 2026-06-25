package com.oram.controller;

import com.oram.dto.RiskDto;
import com.oram.risk.RiskFeatures;
import com.oram.risk.XGBoostRiskAnalyzer;
import com.oram.service.RetrainService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/risk-analysis")
@RequiredArgsConstructor
public class RiskAnalysisController {

    private final XGBoostRiskAnalyzer riskAnalyzer;
    private final RetrainService retrainService;

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
                .primarySaas("GITHUB")
                .department("Development")
                .hourOfDay(14)
                .trafficMb((request.getRepoCount() * 35.0) + (request.getWorkspaceCount() * 80.0))
                .apiCount(request.getRepoCount() * 3)
                .build();
        return ResponseEntity.ok(riskAnalyzer.analyze(features));
    }

    /** Champion–Challenger 재학습: 실제 관리자 결정(회수/오탐)으로 챌린저 학습 + 비교. */
    @PostMapping("/retrain")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<Map<String, Object>> retrain() {
        return ResponseEntity.ok(retrainService.collectAndRetrain());
    }

    /** 챌린저를 챔피언으로 승격. */
    @PostMapping("/promote")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> promote() {
        return ResponseEntity.ok(retrainService.promote());
    }

    /** 현재 챔피언/챌린저 모델 상태. */
    @GetMapping("/model-status")
    @PreAuthorize("hasAnyRole('ADMIN','SECURITY_MANAGER')")
    public ResponseEntity<Map<String, Object>> modelStatus() {
        return ResponseEntity.ok(retrainService.modelStatus());
    }
}
