# app/ai_models/feature_schema.py
"""
ORAM Feature Schema — 중앙 집중식 Feature 정의 (6-Feature 실수집 버전)

제품이 SaaS 연동(discoverPermissions)에서 **실제로 수집**하는 6개 피처만 정의합니다.
이 6개는 PermissionRecord 엔티티의 컬럼과 1:1로 매핑됩니다.

  is_admin, is_owner, has_api_token, recent_login, repo_count, workspace_count

이 파일을 참조하는 모든 모듈(xgboost_risk_engine.py, train_model.py, app.py)이
동일한 Feature 순서를 공유하도록 단일 출처(single source of truth)로 사용합니다.

⚠️ FEATURE_DEFINITIONS의 순서를 변경하면 학습된 모델 가중치와 호환성이 깨집니다.
   순서 변경 시 반드시 재학습(train_model.py)이 필요합니다.
"""
from __future__ import annotations

from typing import Any, Dict, List


# ────────────────────────────────────────────────────────────
# 6개 Feature 정의 (순서가 모델 추론·학습·SHAP 설명에 직접 매핑됨)
# ────────────────────────────────────────────────────────────
FEATURE_DEFINITIONS: List[Dict[str, str]] = [
    {
        "name": "is_admin",
        "dtype": "int",
        "label": "관리자 권한",
        "desc": "SaaS 관리자 권한. 다른 계정·권한을 변경할 수 있어 잔여 접근의 영향 범위를 키웁니다.",
    },
    {
        "name": "is_owner",
        "dtype": "int",
        "label": "Owner 권한",
        "desc": "GitHub Org Owner 같은 최상위 권한. 조직 설정까지 바꿀 수 있어 높은 위험으로 봅니다.",
    },
    {
        "name": "has_api_token",
        "dtype": "int",
        "label": "API 토큰/PAT 보유",
        "desc": "PAT/API Key는 계정 비활성화 이후에도 외부 접근이 가능해 별도 폐기가 필요합니다.",
    },
    {
        "name": "recent_login",
        "dtype": "int",
        "label": "최근 로그인",
        "desc": "최근 활동이 있는 계정은 아직 실제 사용 중일 가능성이 높습니다.",
    },
    {
        "name": "repo_count",
        "dtype": "int",
        "label": "저장소 접근 범위",
        "desc": "접근 가능한 코드 저장소 수. 많을수록 코드·시크릿 노출 범위가 커집니다.",
    },
    {
        "name": "workspace_count",
        "dtype": "int",
        "label": "워크스페이스 접근 범위",
        "desc": "여러 SaaS 워크스페이스에 걸친 권한은 일괄 회수 우선순위를 높입니다.",
    },
]


# ────────────────────────────────────────────────────────────
# 파생 상수
# ────────────────────────────────────────────────────────────
FEATURE_NAMES: List[str] = [f["name"] for f in FEATURE_DEFINITIONS]
"""6개 Feature 이름 리스트 (모델 학습·추론·SHAP 설명에 공통 사용)"""

FEATURE_COUNT: int = len(FEATURE_NAMES)
"""현재 Feature 차원 수 (= 6)"""

FEATURE_INDEX: Dict[str, int] = {name: i for i, name in enumerate(FEATURE_NAMES)}
"""Feature 이름 → 인덱스 역매핑"""

FEATURE_LABELS: Dict[str, str] = {f["name"]: f["label"] for f in FEATURE_DEFINITIONS}
"""Feature 이름 → 한국어 표시명"""

FEATURE_DESCRIPTIONS: Dict[str, str] = {f["name"]: f["desc"] for f in FEATURE_DEFINITIONS}
"""Feature 이름 → 한국어 설명"""

# 정규화 상한 (피처 벡터 빌드/학습에서 동일하게 사용)
REPO_COUNT_CAP: int = 50
WORKSPACE_COUNT_CAP: int = 10


# ────────────────────────────────────────────────────────────
# 공통 유틸리티
# ────────────────────────────────────────────────────────────
def build_feature_vector(
    is_admin: bool,
    is_owner: bool,
    has_api_token: bool,
    recent_login: bool,
    repo_count: int,
    workspace_count: int,
) -> List[float]:
    """
    실제 수집된 6개 원시 신호를 FEATURE_NAMES 순서대로 모델 입력 벡터로 변환합니다.
    repo/workspace count는 상한으로 클리핑합니다(학습 분포와 일치시키기 위함).
    """
    return [
        1.0 if is_admin else 0.0,
        1.0 if is_owner else 0.0,
        1.0 if has_api_token else 0.0,
        1.0 if recent_login else 0.0,
        float(min(max(int(repo_count), 0), REPO_COUNT_CAP)),
        float(min(max(int(workspace_count), 0), WORKSPACE_COUNT_CAP)),
    ]


def build_feature_vector_from_dict(payload: Dict[str, Any]) -> List[float]:
    """dict(JSON 요청 바디 등)에서 6-피처 벡터를 추출합니다."""
    return build_feature_vector(
        is_admin=bool(payload.get("is_admin", False)),
        is_owner=bool(payload.get("is_owner", False)),
        has_api_token=bool(payload.get("has_api_token", False)),
        recent_login=bool(payload.get("recent_login", False)),
        repo_count=int(payload.get("repo_count", 0) or 0),
        workspace_count=int(payload.get("workspace_count", 0) or 0),
    )
