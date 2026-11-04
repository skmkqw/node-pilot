# Web client & deployment

The Next.js 16 / React 19 single-page client that hosts all the features, plus the Docker Compose setup that runs it together with the backend. This document covers the shared parts: the app shell, the API client, polling, error handling and how the two containers find each other.

## User perspective

### What it does

- **One app for all devices.** On desktop there is a sidebar. On phones there is a bottom tab bar that respects the iPhone safe areas.
- **Two sections:** *Dashboard* (monitoring and ad blocking) and *Files & Media*.
- **Live data with no reload.** Cards refresh on their own and pause while the tab is in the background.
- **Clear failure states.** Skeletons while loading, "server not reachable" banners, toasts for actions, and confirmation dialogs before anything destructive.

### Usage scenarios

- **Bookmark `http://<server-ip>:3000`** on every phone and laptop in the household. No per-device configuration is needed, because the client works out the API address from the address you opened.
- **Add to the home screen** on a phone for app-like access. There is no offline mode and no PWA manifest, so this works as a plain bookmark.

### Limitations

- **Two ports must be reachable:** `3000` for the web app and `5000` for the API. The browser talks to the API directly, and there is no proxy through Next.js. Firewalls must allow both ports.
- **No HTTPS out of the box.** For TLS or a single hostname, put both services behind a reverse proxy and set `NEXT_PUBLIC_API_URL` accordingly. Note that changing the variable requires a rebuild of the web image (see below).
- **Dark theme only.** English only, with times and dates in the browser's locale.
- **No offline support.** Without the backend, the UI shows its error states.

## Developer perspective

### How it works

```
Browser ──► web :3000 (Next.js standalone, all pages are client components)
   │
   └── fetch(credentials: "include") ──► backend :5000 (ASP.NET Core)
                                          └─ SQLite volume, /files bind mount, /proc, /sys
```

- **API base URL** (`lib/api/client.ts`, `getApiBaseUrl`):
  - It is `NEXT_PUBLIC_API_URL` if set.
  - Otherwise it is `${location.protocol}//${location.hostname}:5000`. That is what makes the same build work from `localhost`, `192.168.x.x` or `server.local`.
- **`request<T>()`** wraps `fetch` with `credentials: "include"`, `cache: "no-store"`, JSON bodies and abort signals. Errors become an `ApiError(message, status)`:
  - The message is taken from ProblemDetails: the first validation error, then `title`, then a generic text.
  - Status `0` means "server not reachable".
  - `429` gets a friendly message.
  - Any `401` (except from login) dispatches `nodepilot:unauthorized`, which `AuthProvider` listens for.
- **`usePolling(fetcher, intervalMs, deps)`**, used by every live card:
  - Fetches immediately, then schedules the next fetch with `setTimeout` *after* the current one finishes, so slow responses never overlap.
  - Aborts the in-flight request on unmount or when `deps` change.
  - Pauses on `visibilitychange` (hidden) and fetches immediately when the tab becomes visible again.
  - Keeps the last good data when an error occurs.
  - Resets to empty when `deps` change, for example when opening another folder.
  - `setData` allows optimistic updates, for example after a delete or a toggle.
- **Routing:**
  - The `(app)` route group wraps authenticated pages in `AppShell`. Its layout shows a splash while the auth state is loading and redirects anonymous users to `/login`.
  - The files page keeps the folder in `?path=`, so links can be shared and back/forward work.

### Implementation details & gotchas

- **`NEXT_PUBLIC_API_URL` is built into the bundle.** Next.js inlines `NEXT_PUBLIC_*` values at **build time**. In Docker it is a build `ARG`, so changing it in `.env` requires `docker compose up --build web`.
- **The web Dockerfile needs `output: "standalone"`** in `next.config.ts`. The runtime image copies `.next/standalone` and runs `node server.js`.
- **`allowedDevOrigins`** in `next.config.ts` is needed only for `npm run dev` when the dev server is opened from another device. Add it to the `nextConfig` object; do not use a separate `module.exports`.
- **Polling cost per open dashboard tab:**
  - current metrics every 5 s
  - overview every 10 s
  - Pi-hole status every 15 s, which is 2 upstream calls each time
  - chart history every max(bucket, 15 s)

  Several open tabs multiply this, which is still negligible for a home server.
- **The session never expires while a tab is open.** Polling plus sliding cookie expiration keeps it alive (see [authentication.md](authentication.md)).
- **Backend container specifics:**
  - It runs as `root`.
  - It listens on `8080`, which is published as `${BACKEND_PORT:-5000}`.
  - The SQLite database is in the `nodepilot-data` named volume at `/app/data`.
  - The file root is the bind mount `/files`.
  - `/proc` gives host-wide CPU, RAM and load. Hostname, OS name and the `/` disk come from the container (see [system-monitoring.md](system-monitoring.md)).
  - If `BACKEND_PORT` is not `5000`, also set `NEXT_PUBLIC_API_URL`, because the client's fallback URL hard-codes port `5000`.
- **Startup order:** `web` waits for `backend` to report `service_healthy` (see [health-checks.md](health-checks.md)). Database migrations run on backend startup (`InitializeDatabaseAsync`), and a failed migration aborts startup.
- **Configuration errors fail fast.** Every options section uses `ValidateOnStart`, so a bad `.env` stops the backend with a clear message instead of failing on the first request.

### Configuration

| Variable | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | empty | The backend URL used by the browser. Empty means the same host on port 5000. Build time only |
| `WEB_PORT` / `BACKEND_PORT` | `3000` / `5000` | Published ports |
| `ASPNETCORE_ENVIRONMENT` | `Production` (compose) | `.env.example` sets `Development` |
| `NODE_PILOT_DB_CONNECTION_STRING` | `Data Source=data/nodepilot.db` | Required. Compose overrides it to `/app/data/nodepilot.db` |

### Tests

There are no frontend unit tests. The checks are `npm run lint` and `npm run build`, which runs the type check. Backend integration tests (`NodePilotApiFactory`) host the real API in memory with a temporary database and file root.

### Key files

- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/endpoints.ts`
- `apps/web/src/lib/api/types.ts`
- `apps/web/src/lib/use-polling.ts`
- `apps/web/src/components/shell/app-shell.tsx`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/next.config.ts`
- `apps/web/Dockerfile`
- `apps/backend/Dockerfile`
- `compose.yaml`
