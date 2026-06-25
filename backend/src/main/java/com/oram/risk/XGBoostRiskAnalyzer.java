package com.oram.risk;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.oram.dto.RiskDto;
import com.oram.enums.RiskLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * ORAM 6-Feature Risk Engine (진짜 SHAP).
 *
 * 제품이 실제 수집하는 6개 피처(is_admin, is_owner, has_api_token, recent_login,
 * repo_count, workspace_count)를 그대로 Python 모델 서버에 전달하고,
 * 서버가 XGBoost TreeSHAP(pred_contribs)으로 계산한 진짜 기여도를 받아 화면에 보여줍니다.
 *
 * Priority:
 * 1. Python FastAPI 모델 서버 (진짜 SHAP 설명 제공) — ai-service/app.py
 * 2. Java 규칙 폴백 (서버 다운 시 degraded 모드)
 */
@Slf4j
@Component
public class XGBoostRiskAnalyzer {

    private static final String MODEL_SERVER_ENGINE_NAME = "ORAM_XGBOOST_6F_SHAP";
    private static final String FALLBACK_ENGINE_NAME = "ORAM_RULE_FALLBACK";

    private final WebClient webClient;

    @Value("${oram.ai.model-server-enabled:true}")
    private boolean modelServerEnabled;

    @Value("${oram.ai.model-url:http://127.0.0.1:8090}")
    private String modelUrl;

    @Value("${oram.ai.request-timeout-ms:3000}")
    private long requestTimeoutMs;

    public XGBoostRiskAnalyzer(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    public RiskDto.ScoreResponse analyze(RiskFeatures features) {
        // 1순위: Python 모델 서버 (진짜 TreeSHAP 설명)
        if (modelServerEnabled) {
            try {
                RiskDto.ScoreResponse modelResponse = analyzeWithModelServer(features);
                if (modelResponse != null) {
                    return modelResponse;
                }
            } catch (Exception e) {
                log.warn("AI model server unavailable. Falling back to Java risk engine: {}", e.getMessage());
            }
        }

        return analyzeWithFallback(features);
    }

    public int scoreOnly(RiskFeatures features) {
        return analyze(features).getScore();
    }

    private RiskDto.ScoreResponse analyzeWithModelServer(RiskFeatures features) {
        ModelRiskRequest request = toModelRequest(features);
        ModelRiskResponse response = webClient.post()
                .uri(normalizeModelUrl() + "/predict")
                .bodyValue(request)
                .retrieve()
                .bodyToMono(ModelRiskResponse.class)
                .block(Duration.ofMillis(requestTimeoutMs));

        if (response == null) {
            return null;
        }

        int score = Math.max(0, Math.min(100, response.totalRiskScore()));
        return RiskDto.ScoreResponse.builder()
                .score(score)
                .level(toRiskLevel(score))
                .engine(response.engine() != null ? response.engine() : MODEL_SERVER_ENGINE_NAME)
                .anomalyScore(response.anomalyScore())
                .explanations(toModelExplanations(response.shapExplanations()))
                .breakdown(buildModelBreakdown(response.shapExplanations()))
                .build();
    }

    private RiskDto.ScoreResponse analyzeWithFallback(RiskFeatures features) {
        RiskDto.Breakdown breakdown = buildFallbackBreakdown(features);
        int totalScore = breakdown.getAdminWeight()
                + breakdown.getOwnerWeight()
                + breakdown.getApiTokenWeight()
                + breakdown.getRecentLoginWeight()
                + breakdown.getRepoWeight()
                + breakdown.getWorkspaceWeight();
        // 휴면 권한 토큰 상호작용 (모델과 동일한 규칙)
        if (features.isHasApiToken() && !features.isRecentLogin()
                && (features.isAdmin() || features.isOwner())) {
            totalScore += 20;
        }
        totalScore = Math.max(0, Math.min(100, totalScore));

        return RiskDto.ScoreResponse.builder()
                .score(totalScore)
                .level(toRiskLevel(totalScore))
                .engine(FALLBACK_ENGINE_NAME)
                .anomalyScore(totalScore / 100.0)
                .explanations(explainFallback(features))
                .breakdown(breakdown)
                .build();
    }

    private ModelRiskRequest toModelRequest(RiskFeatures features) {
        return new ModelRiskRequest(
                features.isAdmin(),
                features.isOwner(),
                features.isHasApiToken(),
                features.isRecentLogin(),
                features.getRepoCount(),
                features.getWorkspaceCount()
        );
    }

    private RiskDto.Breakdown buildFallbackBreakdown(RiskFeatures features) {
        return RiskDto.Breakdown.builder()
                .adminWeight(features.isAdmin() ? 22 : 0)
                .ownerWeight(features.isOwner() ? 18 : 0)
                .apiTokenWeight(features.isHasApiToken() ? 15 : 0)
                .recentLoginWeight(features.isRecentLogin() ? 8 : 0)
                .repoWeight(Math.min(10, features.getRepoCount() * 10 / 50))
                .workspaceWeight(Math.min(8, features.getWorkspaceCount() * 8 / 10))
                .threatIpWeight(0)
                .automationWeight(0)
                .blastRadiusWeight(0)
                .privilegeSpreadWeight(0)
                .contextualAnomalyWeight(0)
                .largeDataExportWeight(0)
                .build();
    }

    private RiskDto.Breakdown buildModelBreakdown(List<ModelExplanation> explanations) {
        return RiskDto.Breakdown.builder()
                .adminWeight(contribution(explanations, "is_admin"))
                .ownerWeight(contribution(explanations, "is_owner"))
                .apiTokenWeight(contribution(explanations, "has_api_token"))
                .recentLoginWeight(contribution(explanations, "recent_login"))
                .repoWeight(contribution(explanations, "repo_count"))
                .workspaceWeight(contribution(explanations, "workspace_count"))
                .threatIpWeight(0)
                .automationWeight(0)
                .blastRadiusWeight(0)
                .privilegeSpreadWeight(0)
                .contextualAnomalyWeight(0)
                .largeDataExportWeight(0)
                .build();
    }

    private List<RiskDto.Explanation> toModelExplanations(List<ModelExplanation> explanations) {
        if (explanations == null) {
            return List.of();
        }
        return explanations.stream()
                .map(item -> RiskDto.Explanation.builder()
                        .feature(toKoreanFeatureName(item.feature()))
                        .contribution((int) Math.round(Math.max(0.0, item.contribution())))
                        .description(toFeatureDescription(item.feature()))
                        .build())
                .sorted(Comparator.comparingInt(RiskDto.Explanation::getContribution).reversed())
                .toList();
    }

    private List<RiskDto.Explanation> explainFallback(RiskFeatures features) {
        List<RiskDto.Explanation> explanations = new ArrayList<>();
        add(explanations, "관리자 권한", features.isAdmin() ? 22 : 0,
                "관리자 권한은 퇴사 후 잔여 접근의 영향 범위를 크게 키웁니다.");
        add(explanations, "Owner 권한", features.isOwner() ? 18 : 0,
                "Owner 권한은 조직/저장소 설정 변경 가능성이 있어 높은 위험으로 봅니다.");
        add(explanations, "API 토큰/PAT", features.isHasApiToken() ? 15 : 0,
                "PAT/API 토큰은 계정 비활성화 이후에도 별도 폐기가 필요할 수 있습니다.");
        add(explanations, "최근 로그인", features.isRecentLogin() ? 8 : 0,
                "최근 활동이 있는 계정은 실제 사용 가능성이 높습니다.");
        add(explanations, "저장소 접근 범위", Math.min(10, features.getRepoCount() * 10 / 50),
                "접근 가능한 저장소가 많을수록 코드/시크릿 노출 범위가 커집니다.");
        add(explanations, "워크스페이스 접근 범위", Math.min(8, features.getWorkspaceCount() * 8 / 10),
                "여러 SaaS 워크스페이스에 걸친 권한은 일괄 회수 우선순위를 높입니다.");

        explanations.sort(Comparator.comparingInt(RiskDto.Explanation::getContribution).reversed());
        return explanations;
    }

    private void add(List<RiskDto.Explanation> explanations, String feature, int contribution, String description) {
        explanations.add(RiskDto.Explanation.builder()
                .feature(feature)
                .contribution(contribution)
                .description(description)
                .build());
    }

    private int contribution(List<ModelExplanation> explanations, String feature) {
        if (explanations == null) return 0;
        return explanations.stream()
                .filter(item -> feature.equals(item.feature()))
                .findFirst()
                .map(item -> (int) Math.round(Math.max(0.0, item.contribution())))
                .orElse(0);
    }

    private String normalizeModelUrl() {
        return modelUrl.endsWith("/") ? modelUrl.substring(0, modelUrl.length() - 1) : modelUrl;
    }

    private String toKoreanFeatureName(String feature) {
        return switch (feature) {
            case "is_admin" -> "관리자 권한";
            case "is_owner" -> "Owner 권한";
            case "has_api_token" -> "API 토큰/PAT";
            case "recent_login" -> "최근 로그인";
            case "repo_count" -> "저장소 접근 범위";
            case "workspace_count" -> "워크스페이스 접근 범위";
            default -> feature;
        };
    }

    private String toFeatureDescription(String feature) {
        return switch (feature) {
            case "is_admin" -> "관리자 권한 보유가 모델 점수에 기여한 SHAP 값입니다.";
            case "is_owner" -> "Owner 권한 보유가 모델 점수에 기여한 SHAP 값입니다.";
            case "has_api_token" -> "API 토큰/PAT 보유가 모델 점수에 기여한 SHAP 값입니다.";
            case "recent_login" -> "최근 로그인(계정 활성) 여부가 모델 점수에 기여한 SHAP 값입니다.";
            case "repo_count" -> "저장소 접근 범위가 모델 점수에 기여한 SHAP 값입니다.";
            case "workspace_count" -> "워크스페이스 접근 범위가 모델 점수에 기여한 SHAP 값입니다.";
            default -> "ORAM XGBoost 모델의 SHAP 기여도입니다.";
        };
    }

    public static RiskLevel toRiskLevel(int score) {
        if (score >= 75) return RiskLevel.CRITICAL;
        if (score >= 50) return RiskLevel.HIGH;
        if (score >= 25) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    private record ModelRiskRequest(
            @JsonProperty("is_admin") boolean isAdmin,
            @JsonProperty("is_owner") boolean isOwner,
            @JsonProperty("has_api_token") boolean hasApiToken,
            @JsonProperty("recent_login") boolean recentLogin,
            @JsonProperty("repo_count") int repoCount,
            @JsonProperty("workspace_count") int workspaceCount
    ) {}

    private record ModelRiskResponse(
            String engine,
            @JsonProperty("model_loaded")
            boolean modelLoaded,
            @JsonProperty("total_risk_score")
            int totalRiskScore,
            @JsonProperty("anomaly_score")
            double anomalyScore,
            @JsonProperty("is_anomaly")
            boolean isAnomaly,
            @JsonProperty("shap_explanations")
            List<ModelExplanation> shapExplanations
    ) {}

    private record ModelExplanation(String feature, double contribution) {}
}
