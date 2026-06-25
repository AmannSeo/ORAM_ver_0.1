"""
ORAM Champion–Challenger 재학습기.

관리자의 실제 결정(revoked_all / false_positive)으로 만들어진 라벨 샘플을 받아
'챌린저' 모델을 학습하고, 현재 운영 중인 '챔피언'과 동일한 검증셋에서 성능을
비교합니다. 실데이터가 부족하면 목업으로 백필하되, 실제 사용된 라벨 수를 그대로
보고하여 과장하지 않습니다.

- 실제 라벨 가중치(REAL_SAMPLE_WEIGHT)로 소수의 실데이터가 학습에 반영되게 함
- 검증은 고정 시드 목업 홀드아웃(공정 비교) + 실데이터 부분집합(가장 중요한 지표)
- 추천(PROMOTE/KEEP)은 실데이터가 있으면 실데이터 적합도로, 없으면 보류
"""
from __future__ import annotations

import json
import os
import shutil
from datetime import datetime, timezone
from typing import Any, Dict, List

import numpy as np
import xgboost as xgb

try:
    from models.feature_schema import FEATURE_NAMES, FEATURE_COUNT, build_feature_vector
    from train_model import generate_dataset, MODEL_PATH, METADATA_PATH
except ImportError:  # cwd=ai-service 에서 직접 실행
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"))
    from feature_schema import FEATURE_NAMES, FEATURE_COUNT, build_feature_vector  # type: ignore
    from train_model import generate_dataset, MODEL_PATH, METADATA_PATH  # type: ignore

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHAMPION_PATH = MODEL_PATH
CHAMPION_META_PATH = METADATA_PATH
CHALLENGER_PATH = os.path.join(BASE_DIR, "models", "xgboost_challenger.json")
CHALLENGER_META_PATH = os.path.join(BASE_DIR, "models", "xgboost_challenger_metadata.json")

# 실제 결정 → 회귀 타깃 점수 매핑
REVOKED_TARGET = 92.0          # 관리자가 실제 회수 = 진짜 위험
FALSE_POSITIVE_TARGET = 8.0    # 오탐 처리 = 위험 아님
REAL_SAMPLE_WEIGHT = 25.0      # 소수 실데이터가 학습에 반영되도록 가중
MOCK_BACKFILL = 3000
VALIDATION_SEED = 31337
VALIDATION_SIZE = 1500

PARAMS = {
    "objective": "reg:squarederror",
    "eval_metric": "rmse",
    "max_depth": 4,
    "eta": 0.08,
    "subsample": 0.9,
    "colsample_bytree": 0.9,
    "min_child_weight": 3,
    "seed": 42,
}
NUM_ROUND = 300


# ──────────────────────────────────────────────────────────
# 내부 유틸
# ──────────────────────────────────────────────────────────
def _samples_to_xy(samples: List[Dict[str, Any]]):
    X: List[List[float]] = []
    y: List[float] = []
    for s in samples:
        feat = build_feature_vector(
            is_admin=bool(s.get("is_admin", False)),
            is_owner=bool(s.get("is_owner", False)),
            has_api_token=bool(s.get("has_api_token", False)),
            recent_login=bool(s.get("recent_login", False)),
            repo_count=int(s.get("repo_count", 0) or 0),
            workspace_count=int(s.get("workspace_count", 0) or 0),
        )
        if s.get("target") is not None:
            target = float(s["target"])
        elif str(s.get("label", "")).upper() == "FALSE_POSITIVE":
            target = FALSE_POSITIVE_TARGET
        else:
            target = REVOKED_TARGET
        X.append(feat)
        y.append(target)
    return (np.array(X, dtype=np.float32).reshape(-1, FEATURE_COUNT),
            np.array(y, dtype=np.float32))


def _train(X, y, weights=None) -> xgb.Booster:
    dtrain = xgb.DMatrix(X, label=y, weight=weights, feature_names=FEATURE_NAMES)
    return xgb.train(PARAMS, dtrain, num_boost_round=NUM_ROUND)


def _load_champion() -> xgb.Booster | None:
    if not os.path.exists(CHAMPION_PATH):
        return None
    booster = xgb.Booster()
    booster.load_model(CHAMPION_PATH)
    return booster


def _metrics(model: xgb.Booster | None, X, y) -> Dict[str, float] | None:
    if model is None or X is None or len(X) == 0:
        return None
    pred = np.clip(model.predict(xgb.DMatrix(X, feature_names=FEATURE_NAMES)), 0, 100)
    rmse = float(np.sqrt(np.mean((pred - y) ** 2)))
    mae = float(np.mean(np.abs(pred - y)))
    return {"rmse": round(rmse, 3), "mae": round(mae, 3), "n": int(len(y))}


# ──────────────────────────────────────────────────────────
# 공개 API
# ──────────────────────────────────────────────────────────
def retrain(samples: List[Dict[str, Any]]) -> Dict[str, Any]:
    """챌린저 학습 + 챔피언 대비 성능 비교."""
    real_n = len(samples)
    Xr, yr = _samples_to_xy(samples) if real_n > 0 else (None, None)

    # 목업 백필
    Xm, ym = generate_dataset(MOCK_BACKFILL, seed=42)

    if real_n > 0:
        X = np.vstack([Xm, Xr])
        y = np.concatenate([ym, yr])
        w = np.concatenate([np.ones(len(ym), dtype=np.float32),
                            np.full(len(yr), REAL_SAMPLE_WEIGHT, dtype=np.float32)])
    else:
        X, y, w = Xm, ym, None

    challenger = _train(X, y, w)

    # 공정 비교용 고정 검증셋(목업 홀드아웃) + 실데이터 부분집합
    Xv, yv = generate_dataset(VALIDATION_SIZE, seed=VALIDATION_SEED)
    champion = _load_champion()

    champ_full = _metrics(champion, Xv, yv)
    chal_full = _metrics(challenger, Xv, yv)
    champ_real = _metrics(champion, Xr, yr) if real_n > 0 else None
    chal_real = _metrics(challenger, Xr, yr) if real_n > 0 else None

    # 추천 판단
    if real_n == 0:
        recommendation = "KEEP_CHAMPION"
        reason = "실제 라벨(revoked/false_positive) 데이터가 아직 없어 챌린저가 목업만으로 학습됐습니다. 승격을 권장하지 않습니다."
    else:
        champ_rmse = champ_real["rmse"] if champ_real else float("inf")
        chal_rmse = chal_real["rmse"] if chal_real else float("inf")
        if chal_rmse + 1e-6 < champ_rmse:
            recommendation = "PROMOTE_CHALLENGER"
            reason = f"실제 라벨 {real_n}건에서 챌린저 RMSE({chal_rmse})가 챔피언({champ_rmse})보다 낮아 더 잘 맞습니다."
        else:
            recommendation = "KEEP_CHAMPION"
            reason = f"실제 라벨 {real_n}건에서 챌린저가 챔피언을 능가하지 못했습니다(챌린저 {chal_rmse} ≥ 챔피언 {champ_rmse})."

    # 챌린저 저장
    challenger.save_model(CHALLENGER_PATH)
    meta = {
        "model_version": "oram-6f-challenger",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "real_sample_count": real_n,
        "mock_backfill_count": MOCK_BACKFILL,
        "real_sample_weight": REAL_SAMPLE_WEIGHT,
        "feature_names": FEATURE_NAMES,
        "validation": {"champion": champ_full, "challenger": chal_full},
        "validation_real": {"champion": champ_real, "challenger": chal_real},
        "recommendation": recommendation,
    }
    with open(CHALLENGER_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return {
        "real_sample_count": real_n,
        "mock_backfill_count": MOCK_BACKFILL,
        "validation": {"champion": champ_full, "challenger": chal_full},
        "validation_real": {"champion": champ_real, "challenger": chal_real},
        "recommendation": recommendation,
        "reason": reason,
        "challenger_saved": True,
    }


def promote() -> Dict[str, Any]:
    """챌린저를 챔피언으로 승격(파일 교체). 엔진 핫리로드는 호출 측에서 수행."""
    if not os.path.exists(CHALLENGER_PATH):
        return {"promoted": False, "reason": "승격할 챌린저 모델이 없습니다. 먼저 재학습을 실행하세요."}

    shutil.copyfile(CHALLENGER_PATH, CHAMPION_PATH)

    champ_meta: Dict[str, Any] = {}
    if os.path.exists(CHAMPION_META_PATH):
        try:
            with open(CHAMPION_META_PATH, "r", encoding="utf-8") as f:
                champ_meta = json.load(f)
        except Exception:  # noqa: BLE001
            champ_meta = {}
    if os.path.exists(CHALLENGER_META_PATH):
        with open(CHALLENGER_META_PATH, "r", encoding="utf-8") as f:
            chal_meta = json.load(f)
        champ_meta.update({
            "promoted_from": "challenger",
            "promoted_at": datetime.now(timezone.utc).isoformat(),
            "model_version": "oram-6f-promoted",
            "real_sample_count": chal_meta.get("real_sample_count", 0),
            "validation_real": chal_meta.get("validation_real"),
        })
        with open(CHAMPION_META_PATH, "w", encoding="utf-8") as f:
            json.dump(champ_meta, f, ensure_ascii=False, indent=2)

    return {"promoted": True, "reason": "챌린저가 챔피언으로 승격되었습니다."}


def status() -> Dict[str, Any]:
    champ_meta = None
    if os.path.exists(CHAMPION_META_PATH):
        try:
            with open(CHAMPION_META_PATH, "r", encoding="utf-8") as f:
                champ_meta = json.load(f)
        except Exception:  # noqa: BLE001
            champ_meta = None
    chal_meta = None
    if os.path.exists(CHALLENGER_META_PATH):
        try:
            with open(CHALLENGER_META_PATH, "r", encoding="utf-8") as f:
                chal_meta = json.load(f)
        except Exception:  # noqa: BLE001
            chal_meta = None
    return {
        "champion": champ_meta,
        "challenger": chal_meta,
        "has_challenger": chal_meta is not None,
    }
