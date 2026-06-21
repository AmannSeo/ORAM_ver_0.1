package com.oram.risk;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.oram.dto.RiskDto;
import com.oram.enums.RiskLevel;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import ml.dmlc.xgboost4j.java.Booster;
import ml.dmlc.xgboost4j.java.DMatrix;
import ml.dmlc.xgboost4j.java.XGBoost;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * ORAM2 XGBoost Risk Engine integrated for the Spring Boot backend.
 *
 * Priority:
 * 1. Direct JVM inference with ORAM2 xgboost_model.json via xgboost4j.
 * 2. Python FastAPI model server.
 * 3. Java fallback using the same ORAM2 12-feature risk structure.
 */
@Slf4j
@Component
public class XGBoostRiskAnalyzer {

    private static final String DIRECT_ENGINE_NAME = "ORAM2_XGBOOST4J_MODEL";
    private static final String MODEL_SERVER_ENGINE_NAME = "ORAM2_XGBOOST_MODEL_SERVER";
    private static final String FALLBACK_ENGINE_NAME = "ORAM2_XGBOOST_COMPAT_RULE_ENGINE";
    private static final int FEATURE_COUNT = 12;

    private final WebClient webClient;
    private Booster directBooster;
    private boolean directModelLoaded;

    @Value("${oram.ai.model-server-enabled:true}")
    private boolean modelServerEnabled;

    @Value("${oram.ai.model-url:http://127.0.0.1:8090}")
    private String modelUrl;

    @Value("${oram.ai.request-timeout-ms:3000}")
    private long requestTimeoutMs;

    public XGBoostRiskAnalyzer(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder.build();
    }

    @PostConstruct
    void loadDirectModel() {
        try {
            ClassPathResource modelResource = new ClassPathResource("models/xgboost_model.json");
            if (!modelResource.exists()) {
                log.warn("XGBoost model resource not found. Direct model inference disabled.");
                return;
            }

            Path tempModel = Files.createTempFile("oram-xgboost-model-", ".json");
            Files.copy(modelResource.getInputStream(), tempModel, java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            directBooster = XGBoost.loadModel(tempModel.toString());
            directModelLoaded = true;
            log.info("ORAM2 XGBoost model loaded directly with xgboost4j.");
        } catch (Throwable e) {
            directModelLoaded = false;
            log.warn("Direct xgboost4j model loading failed. Model server/fallback will be used: {}", e.getMessage());
        }
    }

    public RiskDto.ScoreResponse analyze(RiskFeatures features) {
        if (directModelLoaded) {
            try {
                return analyzeWithDirectModel(features);
            } catch (Throwable e) {
                log.warn("Direct xgboost4j inference failed. Trying model server/fallback: {}", e.getMessage());
            }
        }

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

    private RiskDto.ScoreResponse analyzeWithDirectModel(RiskFeatures features) throws Exception {
        FeatureVector vector = toFeatureVector(features);
        float[] featureArray = toFeatureArray(features, vector);
        DMatrix matrix = new DMatrix(featureArray, 1, FEATURE_COUNT, Float.NaN);
        float[][] prediction = directBooster.predict(matrix);
        int score = Math.round(Math.max(0.0f, Math.min(100.0f, prediction[0][0])));

        return RiskDto.ScoreResponse.builder()
                .score(score)
                .level(toRiskLevel(score))
                .engine(DIRECT_ENGINE_NAME)
                .anomalyScore(score / 100.0)
                .explanations(explain(vector, features))
                .breakdown(buildFallbackBreakdown(features, vector))
                .build();
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
        FeatureVector vector = toFeatureVector(features);
        RiskDto.Breakdown breakdown = buildFallbackBreakdown(features, vector);
        int totalScore = breakdown.getAdminWeight()
                + breakdown.getOwnerWeight()
                + breakdown.getApiTokenWeight()
                + breakdown.getRecentLoginWeight()
                + breakdown.getRepoWeight()
                + breakdown.getWorkspaceWeight()
                + breakdown.getThreatIpWeight()
                + breakdown.getAutomationWeight()
                + breakdown.getBlastRadiusWeight()
                + breakdown.getPrivilegeSpreadWeight()
                + breakdown.getContextualAnomalyWeight()
                + breakdown.getLargeDataExportWeight();
        totalScore = Math.max(0, Math.min(100, totalScore));

        return RiskDto.ScoreResponse.builder()
                .score(totalScore)
                .level(toRiskLevel(totalScore))
                .engine(FALLBACK_ENGINE_NAME)
                .anomalyScore(totalScore / 100.0)
                .explanations(explain(vector, features))
                .breakdown(breakdown)
                .build();
    }

    private RiskDto.Breakdown buildFallbackBreakdown(RiskFeatures features, FeatureVector vector) {
        return RiskDto.Breakdown.builder()
                .adminWeight(features.isAdmin() ? 18 : 0)
                .ownerWeight(features.isOwner() ? 16 : 0)
                .apiTokenWeight(features.isHasApiToken() ? 14 : 0)
                .recentLoginWeight(features.isRecentLogin() ? 8 : 0)
                .repoWeight(Math.min(8, features.getRepoCount() * 8 / 10))
                .workspaceWeight(Math.min(6, features.getWorkspaceCount() * 6 / 3))
                .threatIpWeight(Math.round((float) vector.ipTypeScore * 18))
                .automationWeight(Math.round((float) vector.automationScore * 12))
                .blastRadiusWeight(Math.round((float) vector.blastAffinityScore * 14))
                .privilegeSpreadWeight(Math.round((float) vector.privilegeSpreadIndex * 12))
                .contextualAnomalyWeight(Math.round((float) vector.contextualAnomalyDelta * 8))
                .largeDataExportWeight(vector.trafficMb > 500.0 ? 8 : 0)
                .build();
    }

    private ModelRiskRequest toModelRequest(RiskFeatures features) {
        return new ModelRiskRequest(
                features.isOwner() ? "CTO" : features.isAdmin() ? "Security_Engineer" : "Developer",
                normalizeDepartment(features.getDepartment()),
                normalizeSaas(features.getPrimarySaas()),
                features.isAdmin() || features.isOwner() ? "admin" : features.isHasApiToken() ? "write" : "read",
                features.getTrafficMb(),
                features.getApiCount(),
                features.getIpAddress() != null ? features.getIpAddress() : "",
                features.getHourOfDay() > 0 ? features.getHourOfDay() : 14,
                false
        );
    }

    private float[] toFeatureArray(RiskFeatures features, FeatureVector vector) {
        ModelRiskRequest request = toModelRequest(features);
        return new float[] {
                roleIndex(request.userRole()),
                departmentIndex(request.userDept()),
                appIndex(request.saasApp()),
                scopeIndex(request.scopeLevel()),
                (float) request.trafficMb(),
                (float) vector.ipTypeScore,
                (float) vector.timeEntropy,
                (float) vector.userAgentClass,
                (float) vector.automationScore,
                (float) vector.blastAffinityScore,
                (float) vector.privilegeSpreadIndex,
                (float) vector.contextualAnomalyDelta
        };
    }

    private FeatureVector toFeatureVector(RiskFeatures features) {
        String saas = normalize(features.getPrimarySaas(), "UNKNOWN");
        String dept = normalize(features.getDepartment(), "UNKNOWN");
        String ipAddress = normalize(features.getIpAddress(), "");

        double ipTypeScore = scoreIp(ipAddress);
        double automationScore = features.getHourOfDay() < 6 || features.getHourOfDay() > 22 ? 0.85 : 0.2;
        double timeEntropy = features.getHourOfDay() < 6 || features.getHourOfDay() > 22 ? 0.25 : 0.8;
        double userAgentClass = features.getHourOfDay() < 6 || features.getHourOfDay() > 22 ? 1.0 : 0.0;

        boolean engineeringDept = dept.contains("DEV") || dept.contains("SECURITY") || dept.contains("GITHUB");
        double prodDbAccess = ("GITHUB".equals(saas) || "AWS".equals(saas)) && engineeringDept ? 1.0 : 0.0;
        double ciCdAccess = ("GITHUB".equals(saas) || "GITLAB".equals(saas)) && (features.isAdmin() || features.isOwner()) ? 1.0 : 0.0;
        double infraAccess = "AWS".equals(saas) || "OKTA".equals(saas) ? 1.0 : 0.0;
        double blastAffinityScore = (prodDbAccess * 0.5) + (ciCdAccess * 0.3) + (infraAccess * 0.2);

        double scopeValue = features.isAdmin() || features.isOwner() ? 5.0 : features.isHasApiToken() ? 2.5 : 1.0;
        double privilegeSpreadIndex = Math.min(1.0, (scopeValue / 5.0) + (features.isOwner() ? 0.25 : 0.0));
        double contextualAnomalyDelta = features.getTrafficMb() > 1000.0 || features.getApiCount() > 800 ? 0.75 : 0.1;

        return new FeatureVector(
                features.getTrafficMb(),
                ipTypeScore,
                timeEntropy,
                userAgentClass,
                automationScore,
                blastAffinityScore,
                privilegeSpreadIndex,
                contextualAnomalyDelta
        );
    }

    private RiskDto.Breakdown buildModelBreakdown(List<ModelExplanation> explanations) {
        return RiskDto.Breakdown.builder()
                .adminWeight(0)
                .ownerWeight(0)
                .apiTokenWeight(0)
                .recentLoginWeight(0)
                .repoWeight(0)
                .workspaceWeight(0)
                .threatIpWeight(contribution(explanations, "Threat IP Address / Proxy"))
                .automationWeight(contribution(explanations, "Zombie User / Automated Script"))
                .blastRadiusWeight(contribution(explanations, "Critical Infrastructure Access"))
                .privilegeSpreadWeight(contribution(explanations, "Privilege Escalation Risk"))
                .contextualAnomalyWeight(contribution(explanations, "Contextual Anomaly Delta"))
                .largeDataExportWeight(contribution(explanations, "Large Data Export"))
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

    private List<RiskDto.Explanation> explain(FeatureVector vector, RiskFeatures features) {
        List<RiskDto.Explanation> explanations = new ArrayList<>();
        add(explanations, "관리자 권한", features.isAdmin() ? 18 : 0, "관리자 권한은 퇴사 후 잔여 접근의 영향 범위를 크게 키웁니다.");
        add(explanations, "Owner 권한", features.isOwner() ? 16 : 0, "Owner 권한은 조직/저장소 설정 변경 가능성이 있어 높은 위험으로 봅니다.");
        add(explanations, "API 토큰", features.isHasApiToken() ? 14 : 0, "PAT/API 토큰은 계정 비활성화 이후에도 별도 폐기가 필요할 수 있습니다.");
        add(explanations, "최근 로그인", features.isRecentLogin() ? 8 : 0, "최근 활동이 있는 계정은 실제 사용 가능성이 높습니다.");
        add(explanations, "저장소 접근 범위", Math.min(8, features.getRepoCount() * 8 / 10), "접근 가능한 저장소가 많을수록 코드/시크릿 노출 범위가 커집니다.");
        add(explanations, "워크스페이스 접근 범위", Math.min(6, features.getWorkspaceCount() * 6 / 3), "여러 SaaS 워크스페이스에 걸친 권한은 일괄 회수 우선순위를 높입니다.");
        add(explanations, "위협 IP/프록시", Math.round((float) vector.ipTypeScore * 18), "공용/위협 IP 접근은 ORAM2의 네트워크 위험 피처에 해당합니다.");
        add(explanations, "자동화/비정상 시간대", Math.round((float) vector.automationScore * 12), "심야 접근은 자동화 스크립트 또는 비정상 접근 가능성을 반영합니다.");
        add(explanations, "Blast Radius", Math.round((float) vector.blastAffinityScore * 14), "개발/보안 계정의 GitHub/AWS 접근은 장애 및 유출 영향 범위가 큽니다.");
        add(explanations, "Privilege Spread", Math.round((float) vector.privilegeSpreadIndex * 12), "권한 범위가 넓을수록 잔여 접근 위험이 커집니다.");
        add(explanations, "Contextual Anomaly", Math.round((float) vector.contextualAnomalyDelta * 8), "트래픽 또는 API 호출량이 큰 경우 이상 행위 가능성을 반영합니다.");
        add(explanations, "Large Data Export", vector.trafficMb > 500.0 ? 8 : 0, "대량 데이터 이동 가능성은 권한 회수 우선순위를 높입니다.");

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

    private float roleIndex(String role) {
        return switch (role) {
            case "CEO" -> 1f;
            case "CIO" -> 2f;
            case "CTO" -> 3f;
            case "Designer" -> 4f;
            case "Developer" -> 5f;
            case "Director" -> 6f;
            case "Employee" -> 7f;
            case "Manager" -> 8f;
            case "Security_Engineer" -> 9f;
            default -> 0f;
        };
    }

    private float departmentIndex(String department) {
        return switch (department) {
            case "Development" -> 1f;
            case "Finance" -> 2f;
            case "HR" -> 3f;
            case "Legal" -> 4f;
            case "Sales" -> 5f;
            default -> 0f;
        };
    }

    private float appIndex(String app) {
        return switch (app) {
            case "AWS" -> 1f;
            case "Dropbox Business" -> 2f;
            case "Figma" -> 3f;
            case "Flex HR" -> 4f;
            case "GitHub" -> 5f;
            case "Google Workspace" -> 6f;
            case "Notion" -> 7f;
            case "Okta" -> 8f;
            case "Slack" -> 9f;
            default -> 0f;
        };
    }

    private float scopeIndex(String scope) {
        return switch (scope) {
            case "admin" -> 1f;
            case "read" -> 2f;
            case "write" -> 3f;
            default -> 0f;
        };
    }

    private double scoreIp(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) return 0.0;
        if (ipAddress.startsWith("185.") || ipAddress.startsWith("103.245.")) return 1.0;
        if (ipAddress.startsWith("10.") || ipAddress.startsWith("172.16.")
                || ipAddress.startsWith("192.168.") || ipAddress.startsWith("127.")) {
            return 0.0;
        }
        return 0.7;
    }

    private String normalizeModelUrl() {
        return modelUrl.endsWith("/") ? modelUrl.substring(0, modelUrl.length() - 1) : modelUrl;
    }

    private String normalizeSaas(String saas) {
        if (saas == null || saas.isBlank()) return "GitHub";
        return switch (saas.trim().toUpperCase()) {
            case "SLACK" -> "Slack";
            case "GITHUB" -> "GitHub";
            case "NOTION" -> "Notion";
            default -> saas;
        };
    }

    private String normalizeDepartment(String department) {
        if (department == null || department.isBlank()) return "Development";
        String normalized = department.trim().toUpperCase();
        if (normalized.contains("SECURITY")) return "Security";
        if (normalized.contains("HR")) return "HR";
        if (normalized.contains("LEGAL")) return "Legal";
        if (normalized.contains("SALES")) return "Sales";
        if (normalized.contains("FINANCE")) return "Finance";
        return "Development";
    }

    private String normalize(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim().toUpperCase();
    }

    private String toKoreanFeatureName(String feature) {
        return switch (feature) {
            case "Role Access Level" -> "역할 접근 수준";
            case "Department Context" -> "부서 맥락";
            case "SaaS App Affinity" -> "SaaS 앱 위험도";
            case "Permission Scope" -> "권한 범위";
            case "Large Data Export" -> "대량 데이터 이동";
            case "Threat IP Address / Proxy" -> "위협 IP/프록시";
            case "Off-hour Access" -> "비업무 시간 접근";
            case "User Agent Anomaly" -> "사용자 에이전트 이상";
            case "Zombie User / Automated Script" -> "자동화 계정 징후";
            case "Critical Infrastructure Access" -> "핵심 인프라 접근";
            case "Privilege Escalation Risk" -> "권한 확산 위험";
            case "Contextual Anomaly Delta" -> "맥락 이상 변화량";
            default -> feature;
        };
    }

    private String toFeatureDescription(String feature) {
        return switch (feature) {
            case "Large Data Export" -> "대량 데이터 이동 가능성이 모델 점수에 반영됐습니다.";
            case "Threat IP Address / Proxy" -> "공용 또는 위협 IP 접근 패턴이 모델 점수에 반영됐습니다.";
            case "Zombie User / Automated Script" -> "비정상 시간대 또는 자동화성 접근 가능성이 모델 점수에 반영됐습니다.";
            case "Critical Infrastructure Access" -> "GitHub/AWS 등 핵심 자산 접근 영향 범위가 모델 점수에 반영됐습니다.";
            case "Privilege Escalation Risk" -> "관리자성 권한 또는 넓은 권한 범위가 모델 점수에 반영됐습니다.";
            case "Contextual Anomaly Delta" -> "트래픽/API 호출량이 평소 맥락과 다른 위험으로 반영됐습니다.";
            default -> "ORAM2 XGBoost 모델의 SHAP 기여도입니다.";
        };
    }

    public static RiskLevel toRiskLevel(int score) {
        if (score >= 75) return RiskLevel.CRITICAL;
        if (score >= 50) return RiskLevel.HIGH;
        if (score >= 25) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    private record FeatureVector(
            double trafficMb,
            double ipTypeScore,
            double timeEntropy,
            double userAgentClass,
            double automationScore,
            double blastAffinityScore,
            double privilegeSpreadIndex,
            double contextualAnomalyDelta
    ) {}

    private record ModelRiskRequest(
            @JsonProperty("user_role")
            String userRole,
            @JsonProperty("user_dept")
            String userDept,
            @JsonProperty("saas_app")
            String saasApp,
            @JsonProperty("scope_level")
            String scopeLevel,
            @JsonProperty("traffic_mb")
            double trafficMb,
            @JsonProperty("api_count")
            int apiCount,
            @JsonProperty("ip_address")
            String ipAddress,
            @JsonProperty("hour_of_day")
            int hourOfDay,
            @JsonProperty("is_zombie")
            boolean isZombie
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
