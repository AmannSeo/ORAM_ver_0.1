package com.oram.risk;

import com.oram.dto.RiskDto;
import com.oram.enums.RiskLevel;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * XGBoost 기반 리스크 분석기 (PoC: 가중치 기반 시뮬레이션)
 * 
 * 실제 운영 환경에서는 두 가지 방식으로 교체 가능합니다:
 * 
 * 방식 1: xgboost4j 라이브러리 사용
 *   - pom.xml에 ml.dmlc:xgboost4j 의존성 추가
 *   - XGBoost 모델 파일(.model) 로드하여 추론
 * 
 * 방식 2: Python 마이크로서비스
 *   - scripts/risk_model.py 의 XGBoost 모델 서빙
 *   - REST 호출로 점수 수신
 * 
 * PoC 구현: 도메인 전문가 가중치를 사용한 선형 스코어링
 * 실제 XGBoost 훈련 스크립트는 scripts/train_risk_model.py 참조
 */
@Slf4j
@Component
public class XGBoostRiskAnalyzer {

    // Feature weights (총합 = 100점 기준)
    private static final int WEIGHT_IS_ADMIN = 25;
    private static final int WEIGHT_IS_OWNER = 20;
    private static final int WEIGHT_HAS_API_TOKEN = 20;
    private static final int WEIGHT_RECENT_LOGIN = 15;
    private static final int WEIGHT_REPO = 10;       // 최대 10점
    private static final int WEIGHT_WORKSPACE = 10;   // 최대 10점

    public RiskDto.ScoreResponse analyze(RiskFeatures features) {
        int adminScore = features.isAdmin() ? WEIGHT_IS_ADMIN : 0;
        int ownerScore = features.isOwner() ? WEIGHT_IS_OWNER : 0;
        int apiTokenScore = features.isHasApiToken() ? WEIGHT_HAS_API_TOKEN : 0;
        int recentLoginScore = features.isRecentLogin() ? WEIGHT_RECENT_LOGIN : 0;

        // repo count: 10개 이상 = 만점
        int repoScore = Math.min(WEIGHT_REPO, features.getRepoCount() * WEIGHT_REPO / 10);

        // workspace count: 3개 이상 = 만점
        int workspaceScore = Math.min(WEIGHT_WORKSPACE, features.getWorkspaceCount() * WEIGHT_WORKSPACE / 3);

        int totalScore = adminScore + ownerScore + apiTokenScore + recentLoginScore + repoScore + workspaceScore;
        totalScore = Math.max(0, Math.min(100, totalScore));

        RiskLevel level = toRiskLevel(totalScore);

        log.debug("Risk analysis: score={}, level={}, features={}", totalScore, level, features);

        return RiskDto.ScoreResponse.builder()
                .score(totalScore)
                .level(level)
                .breakdown(RiskDto.Breakdown.builder()
                        .adminWeight(adminScore)
                        .ownerWeight(ownerScore)
                        .apiTokenWeight(apiTokenScore)
                        .recentLoginWeight(recentLoginScore)
                        .repoWeight(repoScore)
                        .workspaceWeight(workspaceScore)
                        .build())
                .build();
    }

    public int scoreOnly(RiskFeatures features) {
        return analyze(features).getScore();
    }

    public static RiskLevel toRiskLevel(int score) {
        if (score >= 75) return RiskLevel.CRITICAL;
        if (score >= 50) return RiskLevel.HIGH;
        if (score >= 25) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }
}
