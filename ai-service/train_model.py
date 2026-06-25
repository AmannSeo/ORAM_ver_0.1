"""
ORAM 6-Feature Risk Model — 상호작용 + 노이즈 목업 학습 스크립트

제품이 실제 수집하는 6개 피처로 XGBoost 회귀 모델을 학습합니다.
라벨은 단순 선형 합이 아니라 **피처 간 상호작용 + 가우시안 노이즈**로 생성하여,
TreeSHAP 설명이 "조합 위험"(예: 휴면 관리자 토큰)을 드러내도록 합니다.

회귀(reg:squarederror)를 쓰는 이유:
  - 출력이 0~100 점수 공간이라 pred_contribs(SHAP) 기여도가 "점수 단위"로 가산적.
  - 따라서 각 피처의 SHAP 값이 "이 피처가 점수를 몇 점 올렸나"로 바로 해석됨.

실행:
    cd ai-service
    .venv/Scripts/python.exe train_model.py
출력:
    models/xgboost_model.json, models/xgboost_metadata.json
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import numpy as np
import xgboost as xgb

try:
    from models.feature_schema import (
        FEATURE_NAMES, FEATURE_COUNT, REPO_COUNT_CAP, WORKSPACE_COUNT_CAP,
    )
except ImportError:  # cwd=ai-service 에서 직접 실행
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"))
    from feature_schema import (  # type: ignore
        FEATURE_NAMES, FEATURE_COUNT, REPO_COUNT_CAP, WORKSPACE_COUNT_CAP,
    )

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "xgboost_model.json")
METADATA_PATH = os.path.join(BASE_DIR, "models", "xgboost_metadata.json")


def risk_label(is_admin, is_owner, has_api_token, recent_login,
               repo_count, workspace_count, rng=None):
    """상호작용이 포함된 위험 점수(0~100) 생성 함수(목업 정답 시뮬레이터)."""
    if rng is None:
        rng = np.random.default_rng()
    repo_norm = min(repo_count, REPO_COUNT_CAP) / REPO_COUNT_CAP        # 0~1
    ws_norm = min(workspace_count, WORKSPACE_COUNT_CAP) / WORKSPACE_COUNT_CAP  # 0~1

    # --- 1차(주효과) ---
    score = 0.0
    score += 22.0 * is_admin
    score += 18.0 * is_owner
    score += 15.0 * has_api_token
    score += 8.0 * recent_login          # 활성 계정일수록 잔여 접근 위험 ↑
    score += 10.0 * repo_norm
    score += 8.0 * ws_norm

    # --- 2차(상호작용) : SHAP이 드러내야 할 '조합 위험' ---
    # 휴면 권한 토큰: 토큰 보유 + 최근 미접속 + 관리자/Owner → 폐기 누락 시 치명적
    if has_api_token and not recent_login and (is_admin or is_owner):
        score += 22.0
    # 조직 전체 폭발 반경: Owner + 많은 저장소
    score += 14.0 * is_owner * repo_norm
    # 수평 이동: 관리자 + 여러 워크스페이스
    score += 12.0 * is_admin * ws_norm
    # 권한 중첩 상승: admin + owner + token 3종 결합
    if is_admin and is_owner and has_api_token:
        score += 13.0

    # --- 노이즈 + 클리핑 ---
    score += rng.normal(0.0, 5.0)
    return float(np.clip(score, 0.0, 100.0))


def generate_dataset(n_samples: int = 8000, seed: int = 42):
    """시드 고정 목업 데이터 생성(재학습기·검증셋에서 재현 가능하게 사용)."""
    rng = np.random.default_rng(seed)
    X = np.zeros((n_samples, FEATURE_COUNT), dtype=np.float32)
    y = np.zeros(n_samples, dtype=np.float32)

    for i in range(n_samples):
        is_admin = int(rng.random() < 0.30)
        is_owner = int(rng.random() < 0.15)
        has_api_token = int(rng.random() < 0.40)
        recent_login = int(rng.random() < 0.60)
        repo_count = int(rng.integers(0, REPO_COUNT_CAP + 1))
        workspace_count = int(rng.integers(0, WORKSPACE_COUNT_CAP + 1))

        X[i] = [is_admin, is_owner, has_api_token, recent_login, repo_count, workspace_count]
        y[i] = risk_label(is_admin, is_owner, has_api_token, recent_login,
                          repo_count, workspace_count, rng=rng)

    return X, y


def main() -> None:
    print(f"Generating interaction+noise mock dataset ({FEATURE_COUNT} features)...")
    X, y = generate_dataset(8000)

    n_train = int(len(X) * 0.85)
    X_train, X_test = X[:n_train], X[n_train:]
    y_train, y_test = y[:n_train], y[n_train:]

    dtrain = xgb.DMatrix(X_train, label=y_train, feature_names=FEATURE_NAMES)
    dtest = xgb.DMatrix(X_test, label=y_test, feature_names=FEATURE_NAMES)

    params = {
        "objective": "reg:squarederror",
        "eval_metric": "rmse",
        "max_depth": 4,
        "eta": 0.08,
        "subsample": 0.9,
        "colsample_bytree": 0.9,
        "min_child_weight": 3,
        "seed": 42,
    }
    print("Training XGBoost regressor...")
    booster = xgb.train(
        params, dtrain, num_boost_round=400,
        evals=[(dtrain, "train"), (dtest, "test")],
        early_stopping_rounds=30, verbose_eval=False,
    )

    pred = booster.predict(dtest)
    rmse = float(np.sqrt(np.mean((pred - y_test) ** 2)))
    mae = float(np.mean(np.abs(pred - y_test)))
    print(f"Test RMSE: {rmse:.3f} | MAE: {mae:.3f} | best_iteration: {booster.best_iteration}")

    # Feature importance (gain)
    gain = booster.get_score(importance_type="gain")
    importance = {name: round(float(gain.get(name, 0.0)), 2) for name in FEATURE_NAMES}
    print("Feature importance (gain):")
    for name, val in sorted(importance.items(), key=lambda kv: -kv[1]):
        print(f"  {name:>16}: {val}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    booster.save_model(MODEL_PATH)

    metadata = {
        "model_version": "oram-6f-shap-v1",
        "objective": params["objective"],
        "feature_names": FEATURE_NAMES,
        "feature_count": FEATURE_COUNT,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": int(len(X)),
        "label_source": "interaction_noise_mock",
        "test_rmse": round(rmse, 3),
        "test_mae": round(mae, 3),
        "feature_importance_gain": importance,
        "note": "상호작용+노이즈 목업으로 부트스트랩. revoked_all/false_positive 실데이터 누적 시 재학습.",
    }
    with open(METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    print(f"\nSaved model    -> {MODEL_PATH}")
    print(f"Saved metadata -> {METADATA_PATH}")

    # ── 샘플 추론 + SHAP 검증 ──
    print("\nSample predictions with SHAP (pred_contribs):")
    samples = {
        "휴면 관리자 토큰 (admin+token, 미접속)": [1, 0, 1, 0, 30, 2],
        "조직 Owner + 많은 저장소":              [0, 1, 0, 1, 45, 1],
        "일반 멤버":                            [0, 0, 0, 1, 2, 1],
        "권한 3종 결합":                         [1, 1, 1, 1, 40, 5],
    }
    for label, feat in samples.items():
        dm = xgb.DMatrix(np.array([feat], dtype=np.float32), feature_names=FEATURE_NAMES)
        score = float(np.clip(booster.predict(dm)[0], 0, 100))
        contribs = booster.predict(dm, pred_contribs=True)[0]
        top = sorted(
            [(FEATURE_NAMES[i], round(float(contribs[i]), 1)) for i in range(FEATURE_COUNT)],
            key=lambda kv: -kv[1],
        )[:3]
        print(f"  [{label}] score={score:.0f}  top SHAP={top}")


if __name__ == "__main__":
    main()
