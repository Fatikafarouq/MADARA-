# Current app field audit

No current prediction input is removed. Identifiers remain available for record linking but are deliberately excluded from XGBoost to prevent memorisation and data leakage.

| Current app/schema field | Dataset column | XGBoost use | Decision |
|---|---|---:|---|
| Cow name | Not present | No | Retained in app; identification only |
| Unique cow ID / ear tag | `cow_id` | No | Retained for grouping and linking; excluded from features |
| Breed | `breed` | Yes | Categorical; dataset contains only White Fulani |
| Age | `age_years` | Yes | Numeric |
| Number of calvings (parity) | `parity` | Yes | Numeric |
| Days since calving | `days_in_milk` | Yes | Numeric and Wood-curve time variable |
| Body-condition score | `body_condition_score` | Yes | Numeric; dataset contains decimals while app currently accepts integers |
| Feed type | `feed_type` | Yes | Categorical |
| Feed quantity | `feed_quantity_kg_day` | Yes | Numeric; optional in app, complete in this dataset |
| Mastitis status | `mastitis_status` | Yes | Categorical; current status, not medical history |
| Pregnancy status | `pregnancy_status` | Yes | Categorical |
| Milking frequency | `milking_frequency` | Yes | Numeric |

Target: `test_day_milk_yield_kg - woods_predict(days_in_milk, a, b, c)`.

Important gaps:

- Species is not collected; the product is explicitly for cows.
- The app collects present mastitis status, not mastitis history.
- Cow name and ID are not valid predictive features.
- The dataset has no breed variation, so it cannot demonstrate that XGBoost generalises across breeds.
- The dataset is synthetic and has no licence or provenance file attached.
- The model target is daily kilograms, while the product result is a seven-day total in litres.
- The app does not collect test-day records for fitting a per-animal curve. Current app cows must therefore use the breed-average fallback unless a separately approved historical-record workflow is added.

