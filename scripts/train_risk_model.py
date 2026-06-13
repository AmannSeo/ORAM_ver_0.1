"""
ORAM - XGBoost Risk Scoring Model
University PoC Training Script

Requirements:
    pip install xgboost scikit-learn pandas numpy

Usage:
    python train_risk_model.py
    
This script trains an XGBoost classifier on sample labeled data
and exports the model. In production, the Spring Boot backend
would call this model via a REST microservice (see risk_api.py).
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import json

# ============================================================
# 1. Feature Definition
#    Features must match RiskFeatures.java
# ============================================================
FEATURES = [
    'is_admin',         # Boolean (0/1)
    'is_owner',         # Boolean (0/1)
    'has_api_token',    # Boolean (0/1)
    'recent_login',     # Boolean (0/1)
    'repo_count',       # Integer
    'workspace_count',  # Integer
]

# Risk levels (target)
RISK_LEVELS = {0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'CRITICAL'}

# ============================================================
# 2. Synthetic Training Data
#    In production: use real historical access revocation data
# ============================================================
def generate_training_data(n_samples=1000):
    np.random.seed(42)
    
    records = []
    for _ in range(n_samples):
        is_admin = np.random.choice([0, 1], p=[0.7, 0.3])
        is_owner = np.random.choice([0, 1], p=[0.85, 0.15])
        has_api_token = np.random.choice([0, 1], p=[0.6, 0.4])
        recent_login = np.random.choice([0, 1], p=[0.3, 0.7])
        repo_count = np.random.randint(0, 50)
        workspace_count = np.random.randint(0, 10)
        
        # Rule-based risk label for training
        score = (
            is_admin * 25 +
            is_owner * 20 +
            has_api_token * 20 +
            recent_login * 15 +
            min(repo_count / 10, 1.0) * 10 +
            min(workspace_count / 3, 1.0) * 10
        )
        
        # Add noise
        score = score + np.random.normal(0, 5)
        score = np.clip(score, 0, 100)
        
        if score >= 75:
            label = 3  # CRITICAL
        elif score >= 50:
            label = 2  # HIGH
        elif score >= 25:
            label = 1  # MEDIUM
        else:
            label = 0  # LOW
        
        records.append({
            'is_admin': is_admin,
            'is_owner': is_owner,
            'has_api_token': has_api_token,
            'recent_login': recent_login,
            'repo_count': repo_count,
            'workspace_count': workspace_count,
            'risk_level': label,
        })
    
    return pd.DataFrame(records)

# ============================================================
# 3. Train XGBoost Model
# ============================================================
def train_model():
    print("Generating training data...")
    df = generate_training_data(2000)
    
    X = df[FEATURES]
    y = df['risk_level']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    print(f"Risk level distribution:\n{y.value_counts().sort_index()}")
    
    # XGBoost Classifier
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='mlogloss',
        use_label_encoder=False,
        random_state=42,
        num_class=4,
        objective='multi:softmax',
    )
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )
    
    y_pred = model.predict(X_test)
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']))
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    
    # Feature importance
    importance = dict(zip(FEATURES, model.feature_importances_))
    print("\nFeature Importances:")
    for feat, imp in sorted(importance.items(), key=lambda x: -x[1]):
        print(f"  {feat}: {imp:.4f}")
    
    return model

# ============================================================
# 4. Convert score to 0-100 range
# ============================================================
def predict_risk_score(model, features: dict) -> dict:
    """
    Predict risk for a single employee.
    
    Args:
        features: dict with keys matching FEATURES
    Returns:
        dict with 'score' (0-100), 'level' (str)
    """
    row = pd.DataFrame([features])[FEATURES]
    
    # Get class probabilities
    proba = model.predict_proba(row)[0]  # [P(LOW), P(MED), P(HIGH), P(CRIT)]
    
    # Weighted score: 0*P(LOW) + 33*P(MED) + 66*P(HIGH) + 100*P(CRIT)
    score = int(0 * proba[0] + 33 * proba[1] + 66 * proba[2] + 100 * proba[3])
    score = min(100, max(0, score))
    
    if score >= 75:
        level = 'CRITICAL'
    elif score >= 50:
        level = 'HIGH'
    elif score >= 25:
        level = 'MEDIUM'
    else:
        level = 'LOW'
    
    return {'score': score, 'level': level}

# ============================================================
# 5. Main
# ============================================================
if __name__ == '__main__':
    model = train_model()
    
    # Save model
    model.save_model('oram_risk_model.json')
    print("\nModel saved to: oram_risk_model.json")
    
    # Test prediction
    test_cases = [
        {'is_admin': 1, 'is_owner': 1, 'has_api_token': 1, 'recent_login': 1, 'repo_count': 42, 'workspace_count': 3},
        {'is_admin': 0, 'is_owner': 0, 'has_api_token': 0, 'recent_login': 1, 'repo_count': 2, 'workspace_count': 1},
        {'is_admin': 1, 'is_owner': 0, 'has_api_token': 0, 'recent_login': 0, 'repo_count': 5, 'workspace_count': 2},
    ]
    
    print("\nSample Predictions:")
    for tc in test_cases:
        result = predict_risk_score(model, tc)
        print(f"  Features: {tc}")
        print(f"  → Score: {result['score']}, Level: {result['level']}\n")
