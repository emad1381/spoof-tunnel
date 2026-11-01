# Persian panel frontend

Production is a Next.js static export embedded by the Go panel. Build from the repository root with `bash scripts/build.sh` on Linux/WSL. The exported frontend needs the same-origin Go API and the panel URL prefix; `next start` is not a production server for this project.

```sh
npm ci
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:ui
```

Playwright serves the real production export and mocks API responses for deterministic UI regressions. The real Go API is tested separately by `scripts/smoke_panel.py`. On Windows with Edge installed, use `PW_CHANNEL=msedge` (PowerShell: `$env:PW_CHANNEL='msedge'`).

The test suite covers theme hydration, mobile navigation/focus, login errors, restoring active diagnostics, stale-response protection, IP-pool saves, total traffic and password byte validation.
