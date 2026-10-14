# Wood + XGBoost research pipeline

This folder trains a research-only hybrid milk-yield model:

1. Wood's curve supplies the lactation baseline: `y = a * t^b * exp(-c * t)`.
2. XGBoost predicts the remaining error: `actual - Wood baseline`.
3. The combined daily prediction is clipped to the observed training range.

The pipeline does **not** replace the app's demonstration estimator. The attached dataset is synthetic, contains only White Fulani cattle, and measures kg per test day while the app displays litres per seven days. Dataset provenance, licensing, scientific suitability, unit conversion, performance, and output limits require veterinary approval before app integration.

## Setup

Python 3.11 or 3.12 is required.

```powershell
cd training
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

## Train

Pass the dataset path explicitly; CSV files and generated artifacts are ignored by Git.

```powershell
python train.py --data "C:\path\to\white_fulani_synthetic_milk_yield.csv" --output artifacts
```

Outputs:

- `woods_curves.json`: animal and breed-average Wood parameters.
- `xgboost_residual.json`: XGBoost residual model.
- `preprocessor.json`: ordered feature list and categorical encodings.
- `metrics.json`: held-out-cow performance and clipping limits.
- `field_audit.json`: dataset-to-app feature audit.

The evaluation split is grouped by `cow_id`, preventing records from the same cow appearing in both training and test groups. Held-out cows use the breed-average curve, matching the app's fallback for animals without historical test-day records.

