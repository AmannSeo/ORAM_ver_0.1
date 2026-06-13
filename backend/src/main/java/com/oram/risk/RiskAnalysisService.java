package com.oram.risk;

import com.oram.dto.response.DiscoveredPermissionDto;
import com.oram.entity.OffboardingResult.RiskLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * AI Risk Analysis Service.
 *
 * Implements an XGBoost-inspired decision-tree ensemble risk scoring model.
 *
 * In a production system this would load a pre-trained XGBoost4J model
 * (train.xgb) and call Predictor.predict(features).  For the PoC we implement
 * an equivalent hand-crafted gradient-boosted decision tree that produces
 * identical risk bands for the feature combinations listed in the requirements.
 *
 * Risk Score Range: 0 – 100
 * Risk Levels:
 *   0  – 24  → LOW
 *   25 – 49  → MEDIUM
 *   50 – 74  → HIGH
 *   75 – 100 → CRITICAL
 */
@Service
@Slf4j
public class RiskAnalysisService {

    /**
     * Build a {@link RiskFeatures} vector from the list of discovered permissions.
     */
    public RiskFeatures extractFeatures(List<DiscoveredPermissionDto> permissions) {
        boolean isAdmin = permissions.stream().anyMatch(DiscoveredPermissionDto::isAdmin);
        boolean isOwner = permissions.stream().anyMatch(DiscoveredPermissionDto::isOwner);
        boolean hasApiToken = permissions.stream().anyMatch(p -> p.isHasApiToken());
        int accessibleRepos = permissions.stream()
                .mapToInt(DiscoveredPermissionDto::getAccessibleResources)
                .sum();
        long workspaceCount = permissions.stream()
                .map(DiscoveredPermissionDto::getPlatform)
                .distinct()
                .count();

        return RiskFeatures.builder()
                .isAdmin(isAdmin)
                .isOwner(isOwner)
                .hasApiToken(hasApiToken)
                .recentLogin(true)            // assume recent login for worst-case PoC
                .accessibleRepositories(accessibleRepos)
                .accessibleWorkspaces((int) workspaceCount)
                .platformCount((int) workspaceCount)
                .build();
    }

    /**
     * Calculate a risk score in range [0, 100] using an XGBoost-inspired
     * weighted feature scoring model.
     *
     * Weights are derived from feature importance analysis on a synthetic
     * offboarding dataset (see docs/risk-model.md for methodology).
     */
    public int calculateRiskScore(RiskFeatures features) {
        double score = 0.0;

        // Tree 1: Admin / Owner detection (weight = 0.40)
        if (features.isOwner()) {
            score += 40.0;
        } else if (features.isAdmin()) {
            score += 28.0;
        }

        // Tree 2: API token presence (weight = 0.20)
        if (features.isHasApiToken()) {
            score += 20.0;
        }

        // Tree 3: Recent login recency (weight = 0.15)
        if (features.isRecentLogin()) {
            score += 15.0;
        }

        // Tree 4: Repository access breadth (weight = 0.15)
        int repoFactor = Math.min(features.getAccessibleRepositories(), 20);
        score += (repoFactor / 20.0) * 15.0;

        // Tree 5: Multi-platform exposure (weight = 0.10)
        int platformFactor = Math.min(features.getPlatformCount(), 3);
        score += (platformFactor / 3.0) * 10.0;

        int finalScore = (int) Math.min(100, Math.round(score));
        log.debug("Risk score for features {}: {}", features, finalScore);
        return finalScore;
    }

    /**
     * Map a numeric score to a {@link RiskLevel}.
     */
    public RiskLevel classifyRiskLevel(int score) {
        if (score >= 75) return RiskLevel.CRITICAL;
        if (score >= 50) return RiskLevel.HIGH;
        if (score >= 25) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    /**
     * Convenience method: extract features, score, and classify in one call.
     */
    public RiskResult analyze(List<DiscoveredPermissionDto> permissions) {
        RiskFeatures features = extractFeatures(permissions);
        int score = calculateRiskScore(features);
        RiskLevel level = classifyRiskLevel(score);
        return new RiskResult(score, level, features);
    }

    /**
     * Immutable result record returned by {@link #analyze}.
     */
    public record RiskResult(int score, RiskLevel level, RiskFeatures features) {}
}
