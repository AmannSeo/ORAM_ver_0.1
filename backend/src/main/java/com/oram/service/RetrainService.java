package com.oram.service;

import com.oram.entity.OffboardingResult;
import com.oram.repository.OffboardingResultRepository;
import com.oram.risk.RiskFeatures;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Champion–Challenger 재학습 오케스트레이션.
 *
 * 관리자의 실제 결정(revokedAll=회수, falsePositive=오탐)을 라벨로 모아
 * ai-service(/retrain)에 전달하고, 챔피언/챌린저 비교 결과와 승격(/promote),
 * 모델 상태(/model-status)를 중계합니다. ML 로직은 ai-service(Python)에 있습니다.
 */
@Slf4j
@Service
public class RetrainService {

    private final OffboardingResultRepository resultRepository;
    private final WebClient webClient;

    @Value("${oram.ai.model-server-enabled:true}")
    private boolean modelServerEnabled;

    @Value("${oram.ai.model-url:http://127.0.0.1:8090}")
    private String modelUrl;

    @Value("${oram.ai.request-timeout-ms:3000}")
    private long requestTimeoutMs;

    public RetrainService(OffboardingResultRepository resultRepository, WebClient.Builder webClientBuilder) {
        this.resultRepository = resultRepository;
        this.webClient = webClientBuilder.build();
    }

    /** 실제 라벨을 수집해 챌린저 학습을 트리거하고 비교 결과를 반환. */
    @Transactional(readOnly = true)
    public Map<String, Object> collectAndRetrain() {
        if (!modelServerEnabled) {
            return disabledMap();
        }
        List<Map<String, Object>> samples = new ArrayList<>();
        for (OffboardingResult r : resultRepository.findByRevokedAllTrue()) {
            samples.add(toSample(RiskFeatures.aggregate(r.getPermissions()), "REVOKED"));
        }
        for (OffboardingResult r : resultRepository.findByFalsePositiveTrue()) {
            samples.add(toSample(RiskFeatures.aggregate(r.getPermissions()), "FALSE_POSITIVE"));
        }

        Map<String, Object> body = new HashMap<>();
        body.put("samples", samples);
        // 학습은 수 초 걸릴 수 있어 타임아웃을 넉넉히
        return postJson("/retrain", body, Math.max(requestTimeoutMs, 60000));
    }

    /** 챌린저를 챔피언으로 승격. */
    public Map<String, Object> promote() {
        if (!modelServerEnabled) {
            return disabledMap();
        }
        return postJson("/promote", new HashMap<>(), Math.max(requestTimeoutMs, 15000));
    }

    /** 현재 챔피언/챌린저 메타데이터 조회. */
    @SuppressWarnings("unchecked")
    public Map<String, Object> modelStatus() {
        if (!modelServerEnabled) {
            return disabledMap();
        }
        try {
            return webClient.get()
                    .uri(url("/model-status"))
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofMillis(requestTimeoutMs));
        } catch (Exception e) {
            return errorMap(e);
        }
    }

    private Map<String, Object> toSample(RiskFeatures f, String label) {
        Map<String, Object> m = new HashMap<>();
        m.put("is_admin", f.isAdmin());
        m.put("is_owner", f.isOwner());
        m.put("has_api_token", f.isHasApiToken());
        m.put("recent_login", f.isRecentLogin());
        m.put("repo_count", f.getRepoCount());
        m.put("workspace_count", f.getWorkspaceCount());
        m.put("label", label);
        return m;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> postJson(String path, Map<String, ?> body, long timeoutMs) {
        try {
            return webClient.post()
                    .uri(url(path))
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .block(Duration.ofMillis(timeoutMs));
        } catch (Exception e) {
            return errorMap(e);
        }
    }

    private Map<String, Object> disabledMap() {
        log.info("AI model server is disabled (oram.ai.model-server-enabled=false). Skipping outbound call.");
        Map<String, Object> result = new HashMap<>();
        result.put("error", false);
        result.put("disabled", true);
        result.put("message", "AI 모델 서버가 비활성화되어 있습니다 (AI_MODEL_SERVER_ENABLED=false). "
                + "재학습/승격은 ai-service를 실행하고 AI_MODEL_SERVER_ENABLED=true, AI_MODEL_URL을 설정하면 동작합니다.");
        return result;
    }

    private Map<String, Object> errorMap(Exception e) {
        log.warn("AI model server call failed: {}", e.getMessage());
        Map<String, Object> err = new HashMap<>();
        err.put("error", true);
        err.put("message", "AI 모델 서버에 연결할 수 없습니다. ai-service를 실행하거나 AI_MODEL_SERVER_ENABLED=false로 설정하세요. 원인: " + e.getMessage());
        return err;
    }

    private String url(String path) {
        String base = modelUrl.endsWith("/") ? modelUrl.substring(0, modelUrl.length() - 1) : modelUrl;
        return base + path;
    }
}
