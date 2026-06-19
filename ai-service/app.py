from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb
from fastapi import FastAPI
from pydantic import BaseModel, Field


BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "models" / "xgboost_model.json"
METADATA_PATH = BASE_DIR / "models" / "xgboost_metadata.json"

SCOPE_MAP = {"read": 1.0, "write": 2.5, "admin": 5.0}
FEATURE_NAMES = [
    "Role Access Level",
    "Department Context",
    "SaaS App Affinity",
    "Permission Scope",
    "Large Data Export",
    "Threat IP Address / Proxy",
    "Off-hour Access",
    "User Agent Anomaly",
    "Zombie User / Automated Script",
    "Critical Infrastructure Access",
    "Privilege Escalation Risk",
    "Contextual Anomaly Delta",
]


class RiskRequest(BaseModel):
    user_role: str = "Employee"
    user_dept: str = "Development"
    saas_app: str = "GitHub"
    scope_level: str = "read"
    traffic_mb: float = 0.0
    api_count: int = 0
    ip_address: str = ""
    hour_of_day: int = 14
    is_zombie: bool = False


class Explanation(BaseModel):
    feature: str
    contribution: float


class RiskResponse(BaseModel):
    engine: str
    model_loaded: bool
    total_risk_score: int = Field(ge=0, le=100)
    anomaly_score: float = Field(ge=0.0, le=1.0)
    is_anomaly: bool
    shap_explanations: list[Explanation]


class XGBoostRiskEngine:
    def __init__(self) -> None:
        self.metadata: dict[str, Any] = {}
        self.model: xgb.Booster | None = None
        self.model_loaded = False
        self.load_model()

    def load_model(self) -> None:
        if not MODEL_PATH.exists() or not METADATA_PATH.exists():
            return
        self.metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))
        self.model = xgb.Booster()
        self.model.load_model(str(MODEL_PATH))
        self.model_loaded = True

    def analyze(self, request: RiskRequest) -> RiskResponse:
        features = self._build_features(request)
        score = self._predict(features)
        if request.is_zombie:
            score = max(score, 85.0)

        explanations = self._explain(features)
        if request.is_zombie:
            explanations.append(Explanation(feature="Zombie User / Automated Script", contribution=35.0))

        explanations.sort(key=lambda item: item.contribution, reverse=True)
        score = min(100.0, max(0.0, score))
        return RiskResponse(
            engine="ORAM2_XGBOOST_MODEL_SERVER",
            model_loaded=self.model_loaded,
            total_risk_score=int(round(score)),
            anomaly_score=round(score / 100.0, 4),
            is_anomaly=score >= 60.0,
            shap_explanations=explanations,
        )

    def _build_features(self, request: RiskRequest) -> list[float]:
        role_map = self.metadata.get("role_map", {})
        dept_map = self.metadata.get("dept_map", {})
        app_map = self.metadata.get("app_map", {})
        scope_map = self.metadata.get("scope_map", {})

        role_idx = float(role_map.get(request.user_role, role_map.get("<UNKNOWN>", 0)))
        dept_idx = float(dept_map.get(request.user_dept, dept_map.get("<UNKNOWN>", 0)))
        app_idx = float(app_map.get(request.saas_app, app_map.get("<UNKNOWN>", 0)))
        scope_idx = float(scope_map.get(request.scope_level, scope_map.get("<UNKNOWN>", 0)))

        ip_type_score = self._score_ip(request.ip_address)
        time_entropy = 0.25 if request.hour_of_day < 6 or request.hour_of_day > 22 else 0.8
        user_agent_class = 1.0 if request.hour_of_day < 6 or request.hour_of_day > 22 else 0.0
        automation_score = 0.85 if request.hour_of_day < 6 or request.hour_of_day > 22 else 0.2

        prod_db_access = 1.0 if request.saas_app in {"AWS", "GitHub"} and request.user_dept in {"Development", "Security"} else 0.0
        ci_cd_access = 1.0 if request.saas_app in {"GitHub", "GitLab"} and request.user_role in {"CISO", "System", "CTO"} else 0.0
        infra_access = 1.0 if request.saas_app in {"AWS", "Okta"} else 0.0
        blast_affinity_score = (prod_db_access * 0.5) + (ci_cd_access * 0.3) + (infra_access * 0.2)

        scope_val = SCOPE_MAP.get(request.scope_level, 1.0)
        privilege_spread_index = min(1.0, (scope_val / 5.0) + (0.3 if request.user_role in {"CISO", "CEO", "CTO"} else 0.0))
        contextual_anomaly_delta = 0.75 if request.traffic_mb > 1000.0 or request.api_count > 800 else 0.1

        return [
            role_idx,
            dept_idx,
            app_idx,
            scope_idx,
            float(request.traffic_mb),
            ip_type_score,
            time_entropy,
            user_agent_class,
            automation_score,
            blast_affinity_score,
            privilege_spread_index,
            contextual_anomaly_delta,
        ]

    def _predict(self, features: list[float]) -> float:
        if self.model_loaded and self.model is not None:
            matrix = xgb.DMatrix(np.array([features], dtype=np.float32))
            return float(self.model.predict(matrix)[0])
        return self._rule_fallback(features)

    def _explain(self, features: list[float]) -> list[Explanation]:
        if self.model_loaded and self.model is not None:
            matrix = xgb.DMatrix(np.array([features], dtype=np.float32))
            contribs = self.model.predict(matrix, pred_contribs=True)[0]
            return [
                Explanation(feature=name, contribution=round(float(contribs[index]), 2))
                for index, name in enumerate(FEATURE_NAMES)
                if index < len(contribs)
            ]

        traffic_mb = features[4]
        rule_contribs = {
            "Threat IP Address / Proxy": features[5] * 25.0,
            "Zombie User / Automated Script": features[8] * 20.0,
            "Critical Infrastructure Access": features[9] * 25.0,
            "Privilege Escalation Risk": features[10] * 15.0,
            "Contextual Anomaly Delta": features[11] * 10.0,
            "Large Data Export": 15.0 if traffic_mb > 500.0 else 0.0,
        }
        return [
            Explanation(feature=name, contribution=round(rule_contribs.get(name, 0.0), 2))
            for name in FEATURE_NAMES
        ]

    def _score_ip(self, ip_address: str) -> float:
        if not ip_address:
            return 0.0
        if ip_address.startswith("185.") or ip_address.startswith("103.245."):
            return 1.0
        if ip_address.startswith(("10.", "172.16.", "192.168.", "127.")):
            return 0.0
        return 0.7

    def _rule_fallback(self, features: list[float]) -> float:
        score = 10.0
        score += features[5] * 25.0
        score += features[8] * 20.0
        score += features[9] * 25.0
        score += features[10] * 15.0
        score += features[11] * 10.0
        if features[4] > 500.0:
            score += 15.0
        return min(100.0, score)


engine = XGBoostRiskEngine()
app = FastAPI(title="ORAM AI Risk Model Server")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "engine": "ORAM2_XGBOOST_MODEL_SERVER",
        "model_loaded": engine.model_loaded,
    }


@app.post("/predict", response_model=RiskResponse)
def predict(request: RiskRequest) -> RiskResponse:
    return engine.analyze(request)
