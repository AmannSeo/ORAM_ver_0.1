package com.oram;

import com.oram.dto.response.DiscoveredPermissionDto;
import com.oram.entity.OffboardingResult.RiskLevel;
import com.oram.entity.SaaSConnection.SaaSPlatform;
import com.oram.risk.RiskAnalysisService;
import com.oram.risk.RiskFeatures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RiskAnalysisServiceTest {

    private RiskAnalysisService riskAnalysisService;

    @BeforeEach
    void setUp() {
        riskAnalysisService = new RiskAnalysisService();
    }

    @Test
    void criticalRisk_whenAdminOwnerAndApiToken() {
        List<DiscoveredPermissionDto> permissions = List.of(
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.SLACK)
                        .permissionType("ADMIN")
                        .isAdmin(true)
                        .isOwner(false)
                        .hasApiToken(false)
                        .accessibleResources(1)
                        .build(),
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.GITHUB)
                        .permissionType("ORGANIZATION_OWNER")
                        .isAdmin(true)
                        .isOwner(true)
                        .hasApiToken(true)
                        .accessibleResources(5)
                        .build()
        );

        RiskAnalysisService.RiskResult result = riskAnalysisService.analyze(permissions);

        assertThat(result.score()).isGreaterThanOrEqualTo(75);
        assertThat(result.level()).isEqualTo(RiskLevel.CRITICAL);
    }

    @Test
    void lowRisk_whenBasicMemberNoAdminNoToken() {
        List<DiscoveredPermissionDto> permissions = List.of(
                DiscoveredPermissionDto.builder()
                        .platform(SaaSPlatform.NOTION)
                        .permissionType("WORKSPACE_MEMBER")
                        .isAdmin(false)
                        .isOwner(false)
                        .hasApiToken(false)
                        .accessibleResources(1)
                        .build()
        );

        RiskFeatures features = riskAnalysisService.extractFeatures(permissions);
        int score = riskAnalysisService.calculateRiskScore(features);

        assertThat(score).isLessThan(50);
    }

    @Test
    void riskLevelClassification_correctBands() {
        assertThat(riskAnalysisService.classifyRiskLevel(0)).isEqualTo(RiskLevel.LOW);
        assertThat(riskAnalysisService.classifyRiskLevel(24)).isEqualTo(RiskLevel.LOW);
        assertThat(riskAnalysisService.classifyRiskLevel(25)).isEqualTo(RiskLevel.MEDIUM);
        assertThat(riskAnalysisService.classifyRiskLevel(49)).isEqualTo(RiskLevel.MEDIUM);
        assertThat(riskAnalysisService.classifyRiskLevel(50)).isEqualTo(RiskLevel.HIGH);
        assertThat(riskAnalysisService.classifyRiskLevel(74)).isEqualTo(RiskLevel.HIGH);
        assertThat(riskAnalysisService.classifyRiskLevel(75)).isEqualTo(RiskLevel.CRITICAL);
        assertThat(riskAnalysisService.classifyRiskLevel(100)).isEqualTo(RiskLevel.CRITICAL);
    }
}
