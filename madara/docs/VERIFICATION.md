# Verification: feed update, 14 October 2026

## Checks run

| Check | Result |
| --- | --- |
| `npm.cmd run check` | Passed: TypeScript check and all 24 app tests (14 existing, 10 new). Repeated after the final feed-list ordering change. |
| `training/.venv/Scripts/python.exe -m unittest test_training.py` from training | Passed: all 4 existing training tests. |
| `git diff --check` | Passed. Only normal Windows line-ending notices. |
| Android JavaScript export with `--no-bytecode` | Passed: 593 modules bundled; 1.36 MB JavaScript Android bundle and metadata exported to dist-check-feeds. |
| Default Android bytecode export | Blocked by this environment: permission denied when executing bundled hermesc.exe. This does not establish that a release APK builds. |
| Physical Android phone / offline interaction | Not run in this environment. Follow FEED_CHANGES.md for manual checks. |

The JavaScript export command used:

```powershell
$env:EXPO_OFFLINE='1'
$env:EXPO_NO_TELEMETRY='1'
$env:CI='1'
node.exe .\node_modules\expo\bin\cli export --platform android --no-bytecode --output-dir dist-check-feeds
```

`--no-bytecode` was used only for this verification; the app's production configuration
and engine were not changed. Node reported an existing module-type warning, and Metro
reported a terminal-colour warning; neither failed the checks. No dependencies were added.

## New test coverage

Every approved feed score; all 45 unique feed choices; valid form input for each choice;
neutral/upward/downward percentages; averaging and duplicate removal; generic-category
overlap and non-overlap; Other and unknown legacy values; both score-zero feeds alone
and in mixtures; processed versus raw cassava; one-time adjustment for both existing
prediction methods; prediction ranges; version tagging; optional quantity left blank;
and the text explaining approximation and the human-translation fallback.

The existing model's Python golden output and existing Hausa copy tests still pass.

## Files changed for this update

- App.tsx: shared expanded feed choices and feed-effect explanation on the result.
- src/domain.ts: post-model seven-day feed adjustment, range shift, and version tag.
- tests/domain.test.ts: existing breed-curve test now separates feed effects from
  unsupported non-feed features.
- README.md: current estimator description, prerequisites and new-repository upload steps.
- .gitignore: excludes the verification build output and .env.
- Added src/feeds.ts, src/feed_labels.ts, tests/feeds.test.ts, .env.example,
  docs/FEED_CHANGES.md and this verification record.

No schema migrations, added libraries, retraining, or updates to previously saved
predictions were needed. Existing unrelated uncommitted project work was preserved.
No local Git commit was made; the project rules require confirmation that the app works first.

## Source package

The deliverables packaging script copies the full current source with a reviewed file
allowlist, includes the project PRD, checks source hashes against ZIP entries, and rejects
private-data, database, secret-file, dependency, build, and Git-history paths. Generated
bundles are not part of the source ZIP. GitHub upload steps are in README.md.

The attachment's 79-field dictionary and its checker were not imported: the user narrowed
the task to existing core inputs and feed choices/scoring, rather than adopting that schema.

Lecturer approval of the supplied scores/rules was stated by the builder; no new
scientific accuracy evaluation was performed. New Hausa translations and physical-device
verification remain outstanding, and the provisional ranges need subsequent calibration.
