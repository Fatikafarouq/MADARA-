"""Train a research-only Wood baseline plus XGBoost residual model."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.optimize import curve_fit
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, root_mean_squared_error
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor


ID_COLUMN = "cow_id"
BREED_COLUMN = "breed"
TIME_COLUMN = "days_in_milk"
TARGET_COLUMN = "test_day_milk_yield_kg"
MIN_ANIMAL_RECORDS = 5

NUMERIC_FEATURES = [
    "age_years",
    "parity",
    "days_in_milk",
    "body_condition_score",
    "feed_quantity_kg_day",
    "milking_frequency",
]
CATEGORICAL_FEATURES = [
    "breed",
    "feed_type",
    "mastitis_status",
    "pregnancy_status",
]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES
REQUIRED_COLUMNS = [ID_COLUMN, *FEATURES, TARGET_COLUMN]


def woods_predict(days_in_milk: Any, a: float, b: float, c: float) -> np.ndarray:
    """Return Wood-curve daily yield for positive days in milk."""
    t = np.asarray(days_in_milk, dtype=float)
    if np.any(~np.isfinite(t)) or np.any(t <= 0):
        raise ValueError("days_in_milk must contain positive finite values")
    return a * np.power(t, b) * np.exp(-c * t)


def fit_woods_curve(days_in_milk: Any, milk_yield: Any) -> tuple[float, float, float]:
    """Fit Wood parameters using log-linear initial guesses and curve_fit."""
    t = np.asarray(days_in_milk, dtype=float)
    y = np.asarray(milk_yield, dtype=float)
    valid = np.isfinite(t) & np.isfinite(y) & (t > 0) & (y > 0)
    t, y = t[valid], y[valid]
    if len(t) < MIN_ANIMAL_RECORDS:
        raise ValueError(f"Wood fitting requires at least {MIN_ANIMAL_RECORDS} positive observations")

    # ln(y) = ln(a) + b*ln(t) - c*t
    design = np.column_stack([np.ones_like(t), np.log(t), -t])
    log_a, b_guess, c_guess = np.linalg.lstsq(design, np.log(y), rcond=None)[0]
    initial = [max(float(np.exp(log_a)), 1e-6), max(float(b_guess), 1e-6), max(float(c_guess), 1e-6)]
    params, _ = curve_fit(
        woods_predict,
        t,
        y,
        p0=initial,
        bounds=([1e-8, 0.0, 1e-8], [np.inf, 5.0, 5.0]),
        maxfev=50_000,
    )
    return tuple(float(value) for value in params)


def validate_data(frame: pd.DataFrame) -> None:
    missing_columns = sorted(set(REQUIRED_COLUMNS) - set(frame.columns))
    if missing_columns:
        raise ValueError(f"Missing required columns: {', '.join(missing_columns)}")
    if frame[REQUIRED_COLUMNS].isna().any().any():
        raise ValueError("Required training columns contain missing values")
    for column in [*NUMERIC_FEATURES, TARGET_COLUMN]:
        frame[column] = pd.to_numeric(frame[column], errors="raise")
    if (frame[TIME_COLUMN] <= 0).any() or (frame[TARGET_COLUMN] <= 0).any():
        raise ValueError("Wood fitting requires positive days_in_milk and milk yield")
    if frame.duplicated([ID_COLUMN, TIME_COLUMN]).any():
        raise ValueError("Duplicate cow_id/days_in_milk observations found")


def fit_curves(frame: pd.DataFrame) -> tuple[dict[str, tuple[float, float, float]], dict[str, tuple[float, float, float]]]:
    breed_curves = {
        str(breed): fit_woods_curve(group[TIME_COLUMN], group[TARGET_COLUMN])
        for breed, group in frame.groupby(BREED_COLUMN, sort=True)
    }
    animal_curves: dict[str, tuple[float, float, float]] = {}
    for cow_id, group in frame.groupby(ID_COLUMN, sort=True):
        if len(group) >= MIN_ANIMAL_RECORDS:
            try:
                animal_curves[str(cow_id)] = fit_woods_curve(group[TIME_COLUMN], group[TARGET_COLUMN])
            except (RuntimeError, ValueError, FloatingPointError):
                # A failed nonlinear animal fit safely falls back to its breed curve.
                continue
    return animal_curves, breed_curves


def baseline_for_row(row: pd.Series, animal_curves: dict[str, tuple[float, float, float]], breed_curves: dict[str, tuple[float, float, float]]) -> float:
    params = animal_curves.get(str(row[ID_COLUMN])) or breed_curves.get(str(row[BREED_COLUMN]))
    if params is None:
        raise ValueError(f"No Wood curve available for breed {row[BREED_COLUMN]!r}")
    return float(woods_predict([row[TIME_COLUMN]], *params)[0])


def combine_prediction(woods_baseline: Any, residual_prediction: Any, clip_high: float) -> np.ndarray:
    """Add the learned residual to Wood's baseline and apply safe output bounds."""
    combined = np.asarray(woods_baseline, dtype=float) + np.asarray(residual_prediction, dtype=float)
    return np.clip(combined, 0.0, clip_high)


def json_ready(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_ready(item) for item in value]
    if isinstance(value, (np.integer, np.floating)):
        return value.item()
    return value


def split_cows_by_breed(frame: pd.DataFrame, seed: int) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    cow_breeds = frame[[ID_COLUMN, BREED_COLUMN]].drop_duplicates()
    if cow_breeds[ID_COLUMN].duplicated().any():
        raise ValueError("Each cow_id must belong to exactly one breed")
    rng = np.random.default_rng(seed)
    train_ids: set[Any] = set()
    calibration_ids: set[Any] = set()
    test_ids: set[Any] = set()
    for _, group in cow_breeds.groupby(BREED_COLUMN, sort=True):
        ids = group[ID_COLUMN].to_numpy().copy()
        rng.shuffle(ids)
        if len(ids) < 10:
            raise ValueError("Each breed requires at least 10 cows for train/calibration/test splitting")
        test_count = max(1, round(len(ids) * 0.20))
        calibration_count = max(1, round(len(ids) * 0.20))
        test_ids.update(ids[:test_count])
        calibration_ids.update(ids[test_count:test_count + calibration_count])
        train_ids.update(ids[test_count + calibration_count:])
    return (
        frame[frame[ID_COLUMN].isin(train_ids)].copy(),
        frame[frame[ID_COLUMN].isin(calibration_ids)].copy(),
        frame[frame[ID_COLUMN].isin(test_ids)].copy(),
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", required=True, type=Path)
    parser.add_argument("--output", default=Path("artifacts"), type=Path)
    parser.add_argument("--seed", default=42, type=int)
    args = parser.parse_args()

    frame = pd.read_csv(args.data)
    validate_data(frame)
    output = args.output
    output.mkdir(parents=True, exist_ok=True)

    train, calibration, test = split_cows_by_breed(frame, args.seed)

    train_animals, train_breeds = fit_curves(train)
    # The current app has no test-day history for fitting a cow-specific curve.
    # Train and evaluate the correction against the same breed fallback used on-device.
    train["woods_baseline"] = train.apply(lambda row: baseline_for_row(row, {}, train_breeds), axis=1)
    test["woods_baseline"] = test.apply(lambda row: baseline_for_row(row, {}, train_breeds), axis=1)
    train["residual"] = train[TARGET_COLUMN] - train["woods_baseline"]

    preprocessor = ColumnTransformer(
        transformers=[
            ("numeric", "passthrough", NUMERIC_FEATURES),
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=False), CATEGORICAL_FEATURES),
        ],
        verbose_feature_names_out=False,
    )
    x_train = preprocessor.fit_transform(train[FEATURES])
    x_calibration = preprocessor.transform(calibration[FEATURES])
    x_test = preprocessor.transform(test[FEATURES])

    model = XGBRegressor(
        objective="reg:squarederror",
        n_estimators=300,
        max_depth=4,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_lambda=1.0,
        random_state=args.seed,
        n_jobs=1,
    )
    model.fit(x_train, train["residual"])

    clip_high = float(train[TARGET_COLUMN].quantile(0.995))
    calibration["woods_baseline"] = calibration.apply(lambda row: baseline_for_row(row, {}, train_breeds), axis=1)
    calibration_prediction = combine_prediction(calibration["woods_baseline"], model.predict(x_calibration), clip_high)
    calibration["absolute_error"] = np.abs(calibration[TARGET_COLUMN].to_numpy() - calibration_prediction)
    breed_error_bands = {
        str(breed): float(np.quantile(group["absolute_error"], 0.70, method="higher"))
        for breed, group in calibration.groupby(BREED_COLUMN, sort=True)
    }

    clip_low = 0.0
    final_prediction = combine_prediction(test["woods_baseline"], model.predict(x_test), clip_high)
    actual = test[TARGET_COLUMN].to_numpy()
    absolute_errors = np.abs(actual - final_prediction)
    range_half_width = float(np.quantile(calibration["absolute_error"], 0.70, method="higher"))
    test_results = test[[ID_COLUMN, BREED_COLUMN, TARGET_COLUMN]].copy()
    test_results["prediction"] = final_prediction
    test_results["absolute_error"] = absolute_errors
    test_results["range_half_width"] = test_results[BREED_COLUMN].map(breed_error_bands)
    test_results["in_range"] = test_results["absolute_error"] <= test_results["range_half_width"]
    per_breed: dict[str, dict[str, Any]] = {}
    for breed, group in test_results.groupby(BREED_COLUMN, sort=True):
        breed_actual = group[TARGET_COLUMN].to_numpy()
        breed_prediction = group["prediction"].to_numpy()
        breed_mape = float(mean_absolute_percentage_error(breed_actual, breed_prediction))
        coverage = float(group["in_range"].mean())
        per_breed[str(breed)] = {
            "rows": len(group),
            "cows": int(group[ID_COLUMN].nunique()),
            "mae": float(mean_absolute_error(breed_actual, breed_prediction)),
            "rmse": float(root_mean_squared_error(breed_actual, breed_prediction)),
            "mape": breed_mape,
            "range_coverage": coverage,
            "range_half_width_kg_per_day": breed_error_bands[str(breed)],
            "passes_numeric_thresholds": breed_mape <= 0.15 and coverage >= 0.70,
        }

    metrics = {
        "research_only": True,
        "units": "kg per test day",
        "rows": len(frame),
        "cows": int(frame[ID_COLUMN].nunique()),
        "training_rows": len(train),
        "calibration_rows": len(calibration),
        "held_out_rows": len(test),
        "training_cows": int(train[ID_COLUMN].nunique()),
        "calibration_cows": int(calibration[ID_COLUMN].nunique()),
        "held_out_cows": int(test[ID_COLUMN].nunique()),
        "mae": mean_absolute_error(actual, final_prediction),
        "rmse": root_mean_squared_error(actual, final_prediction),
        "mape": mean_absolute_percentage_error(actual, final_prediction),
        "absolute_error_70": range_half_width,
        "range_coverage": float(test_results["in_range"].mean()),
        "per_breed": per_breed,
        "clip_min": clip_low,
        "clip_max": clip_high,
        "model_version": "woods-xgb-synthetic-research-0.1",
    }

    categories = {
        column: list(map(str, values))
        for column, values in zip(CATEGORICAL_FEATURES, preprocessor.named_transformers_["categorical"].categories_)
    }
    preprocessor_artifact = {
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "feature_order_after_encoding": list(map(str, preprocessor.get_feature_names_out())),
        "categories": categories,
        "unknown_category_behavior": "all-zero one-hot values",
    }
    curves_artifact = {
        "formula": "y = a * t^b * exp(-c * t)",
        "minimum_animal_records": MIN_ANIMAL_RECORDS,
        "animal": train_animals,
        "breed": train_breeds,
    }
    field_audit = {
        "used_features": FEATURES,
        "identifier_only": ["name", "cow_id"],
        "dropped_current_predictive_inputs": [],
        "days_in_milk_feature": TIME_COLUMN,
        "target": f"{TARGET_COLUMN} - woods_baseline",
        "dataset_limitations": [
            "synthetic data",
            "White Fulani only",
            "daily kilograms do not match app seven-day litres",
            "no species field because the app is cow-specific",
            "mastitis status is current status, not history",
        ],
    }

    model.save_model(output / "xgboost_residual.json")
    (output / "woods_curves.json").write_text(json.dumps(json_ready(curves_artifact), indent=2), encoding="utf-8")
    (output / "preprocessor.json").write_text(json.dumps(json_ready(preprocessor_artifact), indent=2), encoding="utf-8")
    (output / "metrics.json").write_text(json.dumps(json_ready(metrics), indent=2), encoding="utf-8")
    (output / "field_audit.json").write_text(json.dumps(json_ready(field_audit), indent=2), encoding="utf-8")
    print(json.dumps(json_ready(metrics), indent=2))


if __name__ == "__main__":
    main()
