# Madara Plan v0

An offline-first Android app for entering one cow's information, viewing a clearly labelled seven-day milk estimate, and later recording the actual yield and usefulness feedback.

White Fulani estimates combine a breed-average Wood lactation curve with an XGBoost correction. Other currently supported breeds use low-confidence breed/parity Wood curves. A lecturer-approved feed-score rule adjusts the seven-day estimate afterward. Results remain estimates—not guarantees or diagnoses. See [the agreed feed changes](docs/FEED_CHANGES.md) for the calculation, limitations, and manual checks.

## Run locally

1. Install Node.js 22.18 or newer (needed for the test command) and an Expo Go version compatible with this project's Expo SDK 54 on an Android phone.
2. Open PowerShell in this `mobile-app` folder.
3. Run `npm.cmd install`.
4. Run `npm.cmd start`.
5. Put the computer and phone on the same Wi-Fi network.
6. Open Expo Go on the phone and scan the QR code shown in PowerShell.

If the phone cannot connect over local Wi-Fi, run `npx.cmd expo start --tunnel` instead.

## Checks

- `npm.cmd run typecheck`
- `npm.cmd test`
- `npx.cmd expo export --platform android --output-dir dist-check`

## Create a new GitHub repository

The supplied source ZIP includes the complete app, not just changed files. It excludes
dependencies, generated builds, local databases, training artifacts, account-link folders,
and old Git history. No API key is needed; see `.env.example`.

1. Extract the ZIP and open the `madara` folder.
2. On GitHub, click **+ → New repository**. Enter your repository name and click
   **Create repository**. Leave the README, licence, and .gitignore options unchecked
   because these files are already included.
3. Click **uploading an existing file** (or **Add file → Upload files**).
4. Drag the contents of `madara` into the upload area, not the outer folder or ZIP.
   Include `src`, `assets`, `tests`, `training`, `docs`, and the root files. Enable
   hidden files in File Explorer so `.gitignore` and `.env.example` are included.
5. Enter `Add Madara with approved feed scoring` and click **Commit changes**.
6. Check that `package.json`, `App.tsx`, and `src` appear at the repository root.

For running the app, follow Run locally above. GitHub stores the source; uploading
it does not install the app on a phone. The existing Expo owner/project ID in
`app.json` is retained for your existing Madara project. Relink it if you deliberately
want a separate Expo build project. This package is not a pilot-ready accuracy claim.
