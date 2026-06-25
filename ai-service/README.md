# ORAM AI Service (6-Feature, 진짜 SHAP)

제품이 **실제 수집하는 6개 피처**로 XGBoost 위험 점수를 추론하고,
TreeSHAP(`pred_contribs`)으로 **진짜 SHAP 기여도**를 반환하는 FastAPI 서비스입니다.

수집 피처: `is_admin, is_owner, has_api_token, recent_login, repo_count, workspace_count`
(= 백엔드 `PermissionRecord` 컬럼과 1:1)

## 구성

| 파일 | 역할 |
|---|---|
| `models/feature_schema.py` | 6개 피처의 단일 정의(이름·순서·라벨·설명) |
| `models/xgboost_risk_engine.py` | 추론 + `pred_contribs` 진짜 SHAP 엔진 (싱글톤) |
| `train_model.py` | 상호작용+노이즈 목업으로 모델 학습 → `models/xgboost_model.json` |
| `app.py` | `/predict`, `/health` FastAPI 엔드포인트 |

## 1) 설치

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 2) 모델 학습 (최초 1회, 또는 재학습)

```bash
.venv\Scripts\python.exe train_model.py
```

> 라벨은 단순 선형 합이 아니라 **피처 상호작용 + 가우시안 노이즈**로 생성됩니다.
> 그래서 SHAP이 "휴면 관리자 토큰", "Owner+대량 저장소" 같은 **조합 위험**을 설명합니다.
> 추후 `revoked_all`/`false_positive` 실데이터가 쌓이면 같은 스크립트 구조로 재학습해
> 목업 → 실데이터 라벨로 전환할 수 있습니다.

## 3) 서버 실행

```bash
.venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8090
```

Spring Boot 백엔드는 `oram.ai.model-url`(기본 `http://127.0.0.1:8090`)로 이 서버를 호출합니다.
서버가 꺼져 있으면 백엔드는 동일 규칙의 Java 폴백으로 degraded 동작합니다(SHAP 대신 규칙 기여).

## 요청/응답 예시

```bash
curl -X POST http://127.0.0.1:8090/predict -H "Content-Type: application/json" \
  -d '{"is_admin":true,"is_owner":false,"has_api_token":true,"recent_login":false,"repo_count":30,"workspace_count":2}'
```

```json
{
  "engine": "ORAM_XGBOOST_6F_SHAP",
  "model_loaded": true,
  "total_risk_score": 68,
  "anomaly_score": 0.6797,
  "is_anomaly": true,
  "shap_explanations": [
    {"feature": "is_admin", "contribution": 26.13},
    {"feature": "has_api_token", "contribution": 15.34},
    {"feature": "is_owner", "contribution": -4.43}
  ]
}
```

음수 기여도는 "위험을 낮추는 방향"으로 작용한 피처를 의미합니다(진짜 TreeSHAP).

## Champion–Challenger 재학습

관리자의 실제 결정(`revoked_all`/`false_positive`)을 라벨로 챌린저를 학습하고
챔피언과 비교한 뒤, 더 나으면 승격합니다. 백엔드 `RetrainService`가 라벨을 모아 호출합니다.

| 엔드포인트 | 설명 |
|---|---|
| `POST /retrain` | `{samples:[{is_admin,...,label:"REVOKED"\|"FALSE_POSITIVE"}]}` → 챌린저 학습 + 비교 결과 |
| `POST /promote` | 챌린저를 챔피언으로 교체(`xgboost_model.json`) + 엔진 핫리로드 |
| `GET /model-status` | 챔피언/챌린저 메타데이터 |

- 실데이터가 적으면 목업으로 백필하되 `real_sample_count`로 실제 사용 라벨 수를 표시(과장 없음).
- 비교는 고정 시드 목업 검증셋 + 실데이터 부분집합 RMSE/MAE로 수행.
- 챌린저 산출물(`xgboost_challenger*.json`)은 런타임 생성물이라 git에서 제외됩니다.
