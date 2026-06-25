# app/ai_models/xgboost_risk_engine.py
"""
ORAM XGBoost Risk Engine — 6-Feature 실수집 + 진짜 SHAP 버전.

원본 27차원 엔진의 핵심 설계(중앙 feature_schema 참조 + XGBoost pred_contribs
기반 진짜 SHAP 설명)를 그대로 유지하면서, 제품이 실제로 수집하는 6개 피처
(is_admin, is_owner, has_api_token, recent_login, repo_count, workspace_count)에
맞춰 이식했습니다.

추론 입력은 SaaS 연동에서 실제로 수집된 값이고, 설명은 모델의 TreeSHAP
기여도(model.predict(..., pred_contribs=True))로 산출됩니다 → 진짜 SHAP.
"""
from __future__ import annotations

import os
import json
from typing import Any, Dict, List

import numpy as np
import xgboost as xgb

try:  # uvicorn 실행(cwd=ai-service) 및 패키지 import 양쪽 호환
    from models.feature_schema import (
        FEATURE_NAMES, FEATURE_COUNT, FEATURE_INDEX,
        FEATURE_LABELS, FEATURE_DESCRIPTIONS, build_feature_vector,
    )
except ImportError:  # 같은 디렉터리에서 직접 import 될 때
    from feature_schema import (  # type: ignore
        FEATURE_NAMES, FEATURE_COUNT, FEATURE_INDEX,
        FEATURE_LABELS, FEATURE_DESCRIPTIONS, build_feature_vector,
    )

ENGINE_NAME = "ORAM_XGBOOST_6F_SHAP"


class XGBoostRiskEngine:
    """
    6차원 실수집 피처를 입력받아 잔여 접근 위험 점수(0~100)를 추론하고,
    XGBoost TreeSHAP 기여도로 사람이 읽을 수 있는 근거를 생성합니다.
    """

    def __init__(self) -> None:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        self.model_path = os.path.join(base_dir, "xgboost_model.json")
        self.metadata_path = os.path.join(base_dir, "xgboost_metadata.json")

        self.model: xgb.Booster | None = None
        self.metadata: Dict[str, Any] = {}
        self.model_loaded = False

        self.load_model()
        print(f"[XGBoost Risk Engine] Initialized ({ENGINE_NAME}, "
              f"features={FEATURE_COUNT}, model_loaded={self.model_loaded})")

    # ──────────────────────────────────────────────────────
    # 모델 로딩
    # ──────────────────────────────────────────────────────
    def load_model(self) -> None:
        try:
            if os.path.exists(self.model_path):
                self.model = xgb.Booster()
                self.model.load_model(self.model_path)
                if os.path.exists(self.metadata_path):
                    with open(self.metadata_path, "r", encoding="utf-8") as f:
                        self.metadata = json.load(f)
                self.model_loaded = True
                print("[XGBoost] 6-feature model loaded successfully")
            else:
                print("[WARNING] No model weights found. "
                      "Run `python train_model.py` first. Rule fallback will be used.")
        except Exception as e:  # noqa: BLE001
            self.model_loaded = False
            print(f"[ERROR] model load failed: {e}. Rule fallback will be used.")

    # ──────────────────────────────────────────────────────
    # 예측
    # ──────────────────────────────────────────────────────
    def predict(self, features: List[float]) -> float:
        if len(features) != FEATURE_COUNT:
            raise ValueError(
                f"Feature count mismatch: expected {FEATURE_COUNT}, got {len(features)}"
            )
        if self.model_loaded and self.model is not None:
            try:
                inp = xgb.DMatrix(np.array([features], dtype=np.float32),
                                  feature_names=FEATURE_NAMES)
                return float(self.model.predict(inp)[0])
            except Exception as e:  # noqa: BLE001
                print(f"[WARNING] predict error: {e}")
        return self._rule_fallback(features)

    # ──────────────────────────────────────────────────────
    # 진짜 SHAP 설명 (TreeSHAP, pred_contribs=True)
    # ──────────────────────────────────────────────────────
    def explain_prediction(self, features: List[float]) -> List[Dict[str, Any]]:
        """
        XGBoost pred_contribs로 6개 피처의 SHAP 기여도(점수 단위)를 산출합니다.
        contribs 마지막 원소는 bias(기대값)이므로 제외합니다.
        """
        explanations: List[Dict[str, Any]] = []

        if self.model_loaded and self.model is not None:
            try:
                inp = xgb.DMatrix(np.array([features], dtype=np.float32),
                                  feature_names=FEATURE_NAMES)
                contribs = self.model.predict(inp, pred_contribs=True)[0]
                for i, name in enumerate(FEATURE_NAMES):
                    if i < len(contribs):
                        explanations.append({
                            "feature": name,
                            "contribution": round(float(contribs[i]), 2),
                        })
            except Exception as e:  # noqa: BLE001
                print(f"[WARNING] SHAP pred_contribs error: {e}")
                explanations = []

        if not explanations:
            explanations = self._rule_explain(features)

        explanations.sort(key=lambda x: x["contribution"], reverse=True)
        return explanations

    # ──────────────────────────────────────────────────────
    # 통합 분석 진입점 (app.py가 호출)
    # ──────────────────────────────────────────────────────
    def analyze(
        self,
        is_admin: bool,
        is_owner: bool,
        has_api_token: bool,
        recent_login: bool,
        repo_count: int,
        workspace_count: int,
    ) -> Dict[str, Any]:
        features = build_feature_vector(
            is_admin, is_owner, has_api_token, recent_login, repo_count, workspace_count
        )

        score = self.predict(features)
        score = min(100.0, max(0.0, score))

        explanations = self.explain_prediction(features)

        return {
            "engine": ENGINE_NAME if self.model_loaded else f"{ENGINE_NAME}_RULE_FALLBACK",
            "model_loaded": self.model_loaded,
            "total_risk_score": int(round(score)),
            "anomaly_score": round(score / 100.0, 4),
            "is_anomaly": score >= 60.0,
            "shap_explanations": explanations,
        }

    # ──────────────────────────────────────────────────────
    # 규칙 기반 폴백 (모델 부재 시에만 동작)
    # ──────────────────────────────────────────────────────
    def _rule_fallback(self, feat: List[float]) -> float:
        score = 5.0
        score += feat[FEATURE_INDEX["is_admin"]] * 22.0
        score += feat[FEATURE_INDEX["is_owner"]] * 18.0
        score += feat[FEATURE_INDEX["has_api_token"]] * 15.0
        score += feat[FEATURE_INDEX["recent_login"]] * 8.0
        score += min(10.0, feat[FEATURE_INDEX["repo_count"]] / 50.0 * 10.0)
        score += min(8.0, feat[FEATURE_INDEX["workspace_count"]] / 10.0 * 8.0)
        # 휴면 권한 토큰 상호작용
        if feat[FEATURE_INDEX["has_api_token"]] and not feat[FEATURE_INDEX["recent_login"]] \
                and (feat[FEATURE_INDEX["is_admin"]] or feat[FEATURE_INDEX["is_owner"]]):
            score += 20.0
        return min(100.0, score)

    def _rule_explain(self, feat: List[float]) -> List[Dict[str, Any]]:
        contribs = {
            "is_admin": feat[FEATURE_INDEX["is_admin"]] * 22.0,
            "is_owner": feat[FEATURE_INDEX["is_owner"]] * 18.0,
            "has_api_token": feat[FEATURE_INDEX["has_api_token"]] * 15.0,
            "recent_login": feat[FEATURE_INDEX["recent_login"]] * 8.0,
            "repo_count": min(10.0, feat[FEATURE_INDEX["repo_count"]] / 50.0 * 10.0),
            "workspace_count": min(8.0, feat[FEATURE_INDEX["workspace_count"]] / 10.0 * 8.0),
        }
        return [{"feature": n, "contribution": round(contribs.get(n, 0.0), 2)}
                for n in FEATURE_NAMES]


# 싱글톤 인스턴스
xgboost_risk_engine = XGBoostRiskEngine()
