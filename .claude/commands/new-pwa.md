---
description: Scaffold a local-first, offline, iOS-installable PWA (Vite + TS, IndexedDB, backup/restore, Cloudflare Pages)
argument-hint: <app spec — name, slug, type, what it does, data, screens, theme, UI language>
---

# Build a local-first, offline PWA

The app spec is passed in `$ARGUMENTS` (below the template). Use the template fields as a checklist:
if `$ARGUMENTS` is empty or leaves any field below unanswered, ask me for the missing fields before writing code.
Do not invent values for the placeholders.

---

## APP SPEC (fill this in)

- **App name:** <e.g. Roda Cabutan>
- **Slug** (lowercase, used for folder + Cloudflare project name): <e.g. roda-cabutan>
- **App type:** SIMPLE | MULTI-VIEW
  - SIMPLE = one main screen (lucky-draw wheel, choice picker, "last time I did X" tracker). Settings/backup can be a modal or drawer.
  - MULTI-VIEW = several screens the user navigates between (list → detail → edit, history, stats).
- **What it does (1–3 sentences):** <...>
- **Data it stores:** <entities and fields, e.g. "Item: name, colour, weight; DrawResult: itemId, timestamp">
- **Screens / key features:** <...>
- **Theme colour / vibe:** <e.g. #0F766E, playful, dark-first>
- **Language of UI text:** <e.g. Bahasa Melayu>

$ARGUMENTS

---

## NON-NEGOTIABLE REQUIREMENTS

### 1. Fully offline, zero network at runtime
- After first load, the app must work forever with no network: airplane mode, server gone, everything.
- No CDN scripts, no Google Fonts, no remote images, no analytics, no external APIs. Every asset (fonts, icons, images, sounds) is bundled in the build.
- Add a Content-Security-Policy via `public/_headers` that allows only `'self'` (plus `blob:`/`data:` where needed for exports and images). If something tries to reach the network, it should fail loudly in dev.

### 2. PWA, installable on iOS (Safari → Share → Add to Home Screen)
- Vite + TypeScript. Use `vite-plugin-pwa` with Workbox **precaching of every built asset** (JS, CSS, HTML, fonts, icons, images, sounds). No runtime-only caching for app assets.
- Web app manifest: name, short_name, `display: "standalone"`, `start_url: "./"`, `scope: "./"`, theme_color, background_color.
- iOS specifics in `index.html`:
  - `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (180×180 PNG, no transparency)
  - `<meta name="apple-mobile-web-app-capable" content="yes">` and `<meta name="mobile-web-app-capable" content="yes">`
  - `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
  - `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  - Respect safe areas with `env(safe-area-inset-*)` padding.
- Generate PNG icons (192, 512, 512 maskable, 180 apple-touch) from one source SVG with a script, and commit the outputs.
- Update flow: when a new service worker is waiting, show a small "Update available — reload" banner. Never auto-reload while the user is mid-task.

### 3. All data local (IndexedDB)
- Store all user data in **IndexedDB** (use `idb` or Dexie). Do NOT use localStorage for user data; it's fine only for trivial UI prefs.
- On first launch, call `navigator.storage.persist()` and show the result in Settings ("Storage: persistent / best-effort").
- Wrap all storage in a single `db.ts` module with a typed API so the UI never touches IndexedDB directly.
- Include a `schemaVersion` and a migrations list from day one, even if there's only v1.

### 4. Backup: export / import
- **Export:** produce one JSON file named `<slug>-backup.json` (same name every time, so saving it over the last one replaces it), plus a secondary "dated copy" button that names it `<slug>-backup-YYYY-MM-DD.json`. It contains `{ app: "<slug>", schemaVersion, exportedAt, data: {...} }`. Include any user-added images/blobs as base64 inside the JSON so one file = full backup.
  - On iOS, prefer `navigator.share({ files: [file] })` (files only: adding `title` or `text` makes Save to Files write an extra .txt file) when `navigator.canShare({ files })` is true (so the user can save to Files / send to themselves). Fall back to a normal `<a download>` blob link.
- **Import:** file picker → validate `app` and `schemaVersion` → run migrations if older → show a summary ("12 items, 340 records") → let the user choose **Replace all** or **Merge** (merge by id, newer `updatedAt` wins) → confirm before writing.
- Track `lastBackupAt`. If it's never been done, or more than 14 days ago, show a gentle non-blocking reminder.
- Settings also has **Delete all data** behind a typed confirmation.

### 5. Architecture by app type
- **SIMPLE:** vanilla TypeScript + plain CSS, no framework, no router. One screen; settings and backup live in a modal/drawer. Keep the bundle tiny.
- **MULTI-VIEW:** Preact (or React if a library needs it) with **hash-based routing** (`#/list`, `#/item/123`) so refreshes and deep links never hit the server. Every view must work offline.
- Both: mobile-first, touch targets ≥ 44px, works in light and dark mode, no horizontal scroll at 375px width.

### 6. Deployment to Cloudflare Pages (auto-deploy via GitHub Actions)
- The app lives in its own folder `<slug>/` at the repo root (next to the other apps). Build output in `<slug>/dist/`. Each app is its own Cloudflare Pages project (own `<slug>.pages.dev` origin) so apps never share storage.
- Add `<slug>/.gitignore` with `node_modules`, `dist`, `dev-dist`, `.wrangler` (the repo has no root .gitignore).
- `public/_headers`:
  - `/sw.js` and `/index.html` → `Cache-Control: no-cache`
  - hashed assets under `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`
  - the CSP from section 1
- Add npm scripts:
  - `npm run dev`, `npm run build`, `npm run preview`, `npm test`
  - `npm run deploy` → `npx wrangler pages deploy dist --project-name=<slug> --branch=main` (manual fallback only)
- Add `.github/workflows/deploy-<slug>.yml` so every merge to `main` that touches the app deploys it. Use exactly this shape (only `<slug>` changes):

  ```yaml
  name: Deploy <App name>

  on:
    push:
      branches: [main]
      paths: ['<slug>/**', '.github/workflows/deploy-<slug>.yml']
    workflow_dispatch:

  concurrency: deploy-<slug>

  jobs:
    deploy:
      runs-on: ubuntu-latest
      defaults:
        run:
          working-directory: <slug>
      env:
        CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: 22
            cache: npm
            cache-dependency-path: <slug>/package-lock.json
        - run: npm ci
        - run: npm test
        - run: npm run build
        # First run only: create the Pages project (fails harmlessly once it exists).
        - run: npx wrangler pages project create <slug> --production-branch=main || true
        - run: npx wrangler pages deploy dist --project-name=<slug> --branch=main
  ```

  - The `paths` filter means a merge only deploys the apps whose folders changed; other apps are untouched.
  - `CLOUDFLARE_API_TOKEN` (Account › Cloudflare Pages › Edit) and `CLOUDFLARE_ACCOUNT_ID` are **repository** secrets and already exist in `aimanuslim/first-pwa`. Don't ask me for them and never put them in files. If the app is being built in a different repository, tell me to add both secrets there first (GitHub → Settings → Secrets and variables → Actions).
  - Do NOT use the Cloudflare dashboard "Connect to Git" flow for new apps.
  - `package-lock.json` must be committed (`npm ci` needs it).
- Write a short `README.md` with: how it deploys (merge to `main` → workflow; manual re-run from the Actions tab), how to install on iPhone, and how to back up / restore.

---

## WORKFLOW

1. Restate the spec back to me in 5 bullets and list any assumptions. If the data model is ambiguous, ask me before writing code.
2. Scaffold the project, then build `db.ts` + export/import **before** the UI, with a quick test that export → wipe → import round-trips identical data.
3. Build the UI.
4. Verify before saying you're done:
   - `npm run build` passes with no warnings about un-precached assets.
   - Run `npm run preview`, load once, then go offline (Chrome DevTools → Network → Offline) and reload: the app must fully work.
   - Grep the built `dist/` for `http://` and `https://` and confirm nothing points to external hosts.
   - Confirm the manifest and service worker show correctly in DevTools → Application.
5. Commit and push the app + workflow on a branch, then tell me: merging to `main` deploys it to `https://<slug>.pages.dev` (first run creates the Pages project), and remind me to test on the real iPhone: install from Safari, turn on airplane mode, force-quit, reopen.
