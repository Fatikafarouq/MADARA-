# Approved feed changes

Scope confirmed in the conversation on 14 October 2026: keep the existing core inputs,
English and Hausa, days since calving, and seven-day predictions. Add missing feed
choices only. Do not add the attachment's 79-field form, Fulfulde, daily records,
local units, weather fetching, or quantity features. Existing quantity and yield-record
features are left as they were. Existing saved data is not deleted or rewritten.

## Audit

The supplied feed_catalog.csv has 35 entries. Groundnut haulms already exists.
Retain all 11 existing choices and add the other 34: 45 unique choices in total.
Broad choices such as Hay and Silage remain for backwards compatibility alongside
specific feeds. Names are in src/feed_labels.ts and scores/rules in src/feeds.ts.
Feed quantity remains optional and does not weight the new scoring rule.

## Calculation

The builder supplied scores and explicitly confirmed lecturer approval. The rules are:

- Average the unique scored feeds selected, excluding overlapping generic categories.
- Other and unknown legacy values are unscored, not zero. An entirely unscored selection
  does not change the starting estimate.
- Five is neutral. Multiplier = 1 + (average score - 5) * 0.03.
- If either score-zero feed is selected, use multiplier 0.90 instead of the average-score
  multiplier. Do not stack reductions or apply both rules.
- Raw cassava and processed cassava remain separate choices.
- Apply the multiplier once, before rounding, to the current model's seven-day estimate.
  The starting estimate is the existing Wood + XGBoost output for White Fulani or the
  existing breed/parity Wood curve for other supported breeds. The existing trained
  feed-category features are retained; the new scores are a separate approved rule,
  not a retrained XGBoost feature and not a replacement for the Wood curve.
- Shift the range with the adjusted estimate and retain its original absolute error
  width. Range coverage has not been recalibrated for this provisional rule.
- Confidence remains low. Averaging without quantities is approximate; the result
  screen explains this and identifies the provisional safety-risk reduction.

## Generic-category overlap

The explicit mapping in src/feeds.ts suppresses:

- Grazing only when a seasonal natural pasture is selected.
- Grazing with supplement when a specific forage or supplement is selected.
- Cut-and-carry forage when a specific forage is selected.
- Crop residues when stalks/straw, groundnut haulms or cowpea haulms are selected.
- Maize or sorghum stover when either specific stover is selected.
- Hay when Grass hay is selected; Silage when either specific silage is selected.
- Concentrate when a specific supplement is selected.
- Mixed ration when a specific ingredient is selected.

Unrelated broad categories remain counted. This is a scoring deduplication rule,
not a claim about the actual amounts or composition of the ration.

## Storage and model readiness

No migration is necessary. Existing feed_types_json and prediction input_snapshot_json
already retain selected feeds. Predictions already save totals, ranges and model versions.
New scored predictions append +lecturer-feed-score-1 to the existing model version.
Old prediction totals and versions remain unchanged. No farmer data or model-training
data was imported from the supplied ZIP. No model was retrained, and the synthetic
research model is not evidence that these new rules meet the pilot accuracy targets.

## Language

Existing English and Hausa text is retained. New feed labels and rule explanations
use English fallback, with human-review TODOs in src/feed_labels.ts. No Fulfulde
was added and no Hausa translations were invented. Human-reviewed Hausa wording
for these additions remains outstanding.

## Verify in the app

1. Start the app and choose English, then open or add a cow.
2. Open Prediction Inputs. Keep the real cow details and leave feed quantity blank.
3. Select Hay only. Save Inputs and check the seven-day result: score 5, change 0%.
4. Return to the form, deselect Hay and select Maize silage. Save: score 9, change 12%.
5. Also select Silage: the score remains 9 because the generic choice is excluded.
6. Select Raw cassava or fresh peels with Soybean meal: change -10%, not zero yield.
7. Select Other and enter an unlisted feed: no approved score, no feed-rule adjustment.
8. Open Prediction History and confirm previously saved predictions retain their values.
9. Return to language selection and choose Hausa. Existing Hausa screens still display;
   new feed-specific text currently uses English until human translations are supplied.

Displayed litre changes may differ slightly because totals are rounded. Existing model
feed-category inputs may also change when the selection changes; the displayed percentage
is the separate feed-rule multiplier, not necessarily the difference from a prior result.

Automated evidence is recorded in VERIFICATION.md after checks finish.
