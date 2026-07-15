# Deployment

## Runtime Contract

- Node.js 20 or newer
- Start command: `npm start`
- Port: `PORT` from the hosting environment, default `4173`
- Host: `HOST`, default `0.0.0.0`
- Health check: `GET /healthz`
- No database, persistent disk, secrets, runtime dependencies, or install step

`GET /healthz` returns HTTP 200 with:

```json
{
  "status": "ok",
  "service": "aolined-personal-scenes"
}
```

The health check does not call Hacker News or refresh the AI cache.

## Deploy To Render

1. Push the repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Render reads `render.yaml`, runs the dependency-free syntax check, starts the service with `npm start`, and checks `/healthz`.
4. After the first deploy, open the generated Render URL and confirm `/healthz` returns HTTP 200.

The Blueprint sets `TRUST_PROXY=true` so refresh limiting uses the first valid address supplied by Render in `X-Forwarded-For`. Do not enable this setting when exposing the Node process directly through an untrusted proxy.

## Manual Refresh Limit

Only `GET /api/hot-search?refresh=1` is limited. The default policy allows five forced refreshes per client address per 60 seconds. A rejected request returns HTTP 429 with `Retry-After` and rate-limit headers. Normal `GET /api/hot-search` cache reads remain available.

The limiter is held in process memory. It resets when Render restarts the service and applies independently to each instance. A shared store or edge rate limiter is required before scaling to multiple instances or handling hostile traffic.

## Verification

Run before every deployment:

```powershell
npm run check
npm test
```

Local production-style smoke test:

```powershell
$env:PORT = "4174"
$env:HOST = "0.0.0.0"
npm start
```

Then request `http://127.0.0.1:4174/healthz`.

## Rollback

Render can redeploy the previous successful commit from the service dashboard. After rollback, confirm `/healthz`, the homepage, and `/api/hot-search` all return expected responses.
