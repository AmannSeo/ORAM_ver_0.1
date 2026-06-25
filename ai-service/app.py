"""
ORAM AI Risk Model Server (6-Feature, 진짜 SHAP)

제품이 실제 수집하는 6개 피처(is_admin, is_owner, has_api_token, recent_login,
repo_count, workspace_count)를 입력받아 XGBoost 회귀 모델로 위험 점수를 추론하고,
TreeSHAP(pred_contribs) 기반의 진짜 기여도 설명을 반환합니다.

추론 엔진은 models/xgboost_risk_engine.py 의 싱글톤을 사용합니다.

실행:
    cd ai-service
    .venv/Scripts/python.exe -m uvicorn app:app --host 127.0.0.1 --port 8090
"""
from __future__ import annotations

from typing import Any, List

from fastapi import FastAPI
from pydantic import BaseModel, Field

from models.xgboost_risk_engine import xgboost_risk_engine, ENGINE_NAME


class RiskRequest(BaseModel):
    is_admin: bool = False
    is_owner: bool = False
    has_api_token: bool = False
    recent_login: bool = False
    repo_count: int = 0
    workspace_count: int = 0


class Explanation(BaseModel):
    feature: str
    contribution: float


class RiskResponse(BaseModel):
    engine: str
    model_loaded: bool
    total_risk_score: int = Field(ge=0, le=100)
    anomaly_score: float = Field(ge=0.0, le=1.0)
    is_anomaly: bool
    shap_explanations: List[Explanation]


app = FastAPI(title="ORAM AI Risk Model Server (6F SHAP)")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "engine": ENGINE_NAME,
        "model_loaded": xgboost_risk_engine.model_loaded,
    }


@app.post("/predict", response_model=RiskResponse)
def predict(request: RiskRequest) -> RiskResponse:
    result = xgboost_risk_engine.analyze(
        is_admin=request.is_admin,
        is_owner=request.is_owner,
        has_api_token=request.has_api_token,
        recent_login=request.recent_login,
        repo_count=request.repo_count,
        workspace_count=request.workspace_count,
    )
    return RiskResponse(**result)
