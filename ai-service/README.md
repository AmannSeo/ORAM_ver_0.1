# ORAM AI Service

FastAPI service for real ORAM2 XGBoost model inference.

## Run locally

```bash
cd ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app:app --host 127.0.0.1 --port 8090
```

Then run the Spring Boot backend with:

```bash
AI_MODEL_URL=http://127.0.0.1:8090
```
