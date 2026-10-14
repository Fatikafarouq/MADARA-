# Multi-breed model audit

Dataset: `all_breeds_synthetic_milk_yield.csv` (not copied into the repository)

## Data structure

- 3,250 complete test-day records from 650 synthetic cows.
- 13 breeds with 50 cows per breed.
- No missing required fields and no duplicate cow/day observations.
- Each cow has 4–6 records; 213 cows have fewer than the five records required for an individual Wood curve.
- Every current predictive app input is represented. Cow ID is used only for grouping and is excluded from XGBoost.
- `data_confidence` is provenance metadata and is excluded from prediction.

## Evaluation design

Cows are separated within every breed into three non-overlapping groups:

- 390 training cows (60%).
- 130 calibration cows (20%) used to set breed-specific range widths.
- 130 test cows (20%) used only for final evaluation.

The on-device workflow has no historical test-day series, so training, calibration, and testing all use the breed-average Wood baseline. XGBoost predicts the residual from that same baseline. This matches the app instead of training against cow-specific curves unavailable at prediction time.

## Result

Overall held-out performance:

- MAE: 1.033 kg per test day.
- RMSE: 1.441 kg per test day.
- MAPE: 24.05%.
- Breed-calibrated range coverage: 73.81%.

The agreed numerical gate is MAPE no greater than 15% and range coverage of at least 70%. Only Girolando passed both on this split (MAPE 13.70%, coverage 82.35%). Results were not stable enough across breeds to enable a general multi-breed model. White Fulani scored 16.90% MAPE on this split, demonstrating sensitivity to which unseen cows are selected.

## Decision

Do not replace the current bundled app model or enable additional breed predictions from this dataset yet. The app may continue registering every listed breed and recording its actual yield. A future model should use representative real records and an approved way to incorporate prior yield history, then repeat this cow-separated evaluation before deployment.
