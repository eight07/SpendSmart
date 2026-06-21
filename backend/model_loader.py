import joblib
import numpy as np
import os
import pandas as pd

# Paths — relative to the backend folder
ML_DATA_PATH = os.path.join(os.path.dirname(__file__), '..', 'ml', 'data')

# These are loaded once when the server starts
model = None
model_name = None
label_encoder = None
feature_columns = None
category_stats = None

def load_artifacts():
    """Load model, encoder and feature list from disk."""
    global model, model_name, label_encoder, feature_columns, category_stats
    
    model_path      = os.path.join(ML_DATA_PATH, 'model.pkl')
    model_name_path = os.path.join(ML_DATA_PATH, 'best_model_name.pkl')
    encoder_path    = os.path.join(ML_DATA_PATH, 'label_encoder.pkl')
    features_path   = os.path.join(ML_DATA_PATH, 'features.pkl')
    stats_path      = os.path.join(ML_DATA_PATH, 'category_stats.pkl')
    
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"model.pkl not found at {model_path}. Run the notebook first.")
    
    model           = joblib.load(model_path)
    model_name      = joblib.load(model_name_path) if os.path.exists(model_name_path) else type(model).__name__
    label_encoder   = joblib.load(encoder_path)
    feature_columns = joblib.load(features_path)
    category_stats  = joblib.load(stats_path) if os.path.exists(stats_path) else None
    
    print(f"Model loaded: {model_name} ({type(model).__name__})")
    print(f"Label encoder loaded. Known categories: {list(label_encoder.classes_)}")
    print(f"Features: {feature_columns}")

def predict(year, month, category, prev_month_spend, prev_prev_month_spend, rolling_avg_3):
    """Transform inputs and run prediction."""
    global model, label_encoder, feature_columns, category_stats
    
    # Encode category — must use the same encoder from training
    if category not in label_encoder.classes_:
        raise ValueError(
            f"Unknown category '{category}'. "
            f"Valid categories: {list(label_encoder.classes_)}"
        )
    
    category_encoded = label_encoder.transform([category])[0]

    stats = {}
    if category_stats:
        stats = category_stats.get('by_category', {}).get(category, {})
        global_stats = category_stats.get('global', {})
    else:
        global_stats = {}

    category_mean = stats.get('CategoryMean', global_stats.get('CategoryMean', rolling_avg_3))
    category_median = stats.get('CategoryMedian', global_stats.get('CategoryMedian', rolling_avg_3))
    category_std = stats.get('CategoryStd', global_stats.get('CategoryStd', 0.0))

    feature_values = {
        'Year': year,
        'Month': month,
        'CategoryEncoded': category_encoded,
        'PrevMonthSpend': prev_month_spend,
        'PrevPrevMonthSpend': prev_prev_month_spend,
        'RollingAvg3': rolling_avg_3,
        'CategoryMean': category_mean,
        'CategoryMedian': category_median,
        'CategoryStd': category_std,
        'LagDelta': prev_month_spend - prev_prev_month_spend,
        'LagToMeanRatio': prev_month_spend / (category_mean + 1),
        'MonthSin': np.sin(2 * np.pi * month / 12),
        'MonthCos': np.cos(2 * np.pi * month / 12),
    }

    # Build feature array in EXACT same order as training.
    features = pd.DataFrame([[feature_values[col] for col in feature_columns]], columns=feature_columns)
    
    prediction = model.predict(features)[0]
    
    # Spending can't be negative — clip to 0
    return max(0.0, round(float(prediction), 2))

def get_valid_categories():
    """Return list of categories the model knows about."""
    global label_encoder
    return list(label_encoder.classes_)

def get_model_name():
    """Return the selected model name loaded at startup."""
    global model_name
    return model_name or "unknown"
