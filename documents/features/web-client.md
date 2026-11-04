# Web client & deployment

The Next.js 16 / React 19 single-page client that hosts all the features, plus the ways to run it together with the backend: `./start.sh` for a local start and Docker Compose for a permanent installation. This document covers the shared parts: the app shell, routing, the API client, polling, error handling and how the two parts find each other.

## User perspective

### What it does

- **One app for all devices.** On desktop there is a sidebar. On phones there is a top bar and a bottom tab bar that respects the iPhone safe areas.
- **Sections:** *Dashboard* (monitoring and ad blocking), *Files & Media*, *Users* (admins only) and *Settings*. Members don't see *Users*, and their *Settings* page shows only the account section.
- **Standalone screens** outside the shell: the first-start wizard (`/setup`), sign-in (`/login`) and the invite page (`/invite/<token>`).
- **Live data with no reload.** Cards refresh on their own and pause while the tab is in the background.
- **Clear failure states.** Skeletons while loading, an offline screen with *Retry* when the backend can't be reached at startup, "server not reachable" banners, toasts for actions, and confirmation dialogs before anything destructive.
- **"Hardware panel" look:** a light teal-and-saffron theme with thick borders, status lamps and monospace labels.

### Usage scenarios

- **Bookmark `http://<server-ip>:3000`** on every phone and laptop in the household. No per-device configuration is needed, because the client works out the API address from the address you opened.
- **Add to the home screen** on a phone for app-like access. There is no offline mode and no PWA manifest, so this works as a plain bookmark.
- **Trying it out on a laptop:** `./start.sh` builds and starts both parts in one terminal, prints the LAN address for phones, and sets up `adb reverse` for a phone on a USB cable.

### Limitations

- **Two ports must be reachable:** `3000` for the web app and `5000` for the API. The browser talks to the API directly, and there is no proxy through Next.js. Firewalls must allow both ports.
- **No HTTPS out of the box.** For TLS or a single hostname, put both services behind a reverse proxy and set `NEXT_PUBLIC_API_URL` accordingly. Note that changing the variable requires a rebuild of the web app (see below).
- **One theme only** (light, no dark mode). English only, with times and dates in the browser's locale.
- **No offline support.** Without the backend, the UI shows its error states.
- **`./start.sh` runs the development servers** (`dotnet run`, `npm run dev`). It is meant for trying NodePilot out, not for leaving it running on the server; use Docker Compose for that.

## Developer perspective

### How it works

```
Browser ──► web :3000 (Next.js standalone, all pages are client components)
   │
   └── fetch(credentials: "include") ──► backend :5000 (ASP.NET Core)
                                          └─ SQLite + keys in data/, file root, /proc, /sys
```

- **API base URL** (`lib/api/client.ts`, `getApiBaseUrl`):
  - It is `NEXT_PUBLIC_API_URL` if set.
  - Otherwise it is `${location.protocol}//${location.hostname}:5000`. That is what makes the same build work from `localhost`, `192.168.x.x` or `server.local`.
- **`request<T>()`** wraps `fetch` with `credentials: "include"`, `cache: "no-store"`, JSON bodies and abort signals. Errors become an `ApiError(message, status)`:
  - The message is taken from ProblemDetails: the first validation error, then `title`, then a generic text.
  - Status `0` means "server not reachable".
  - `429` gets a friendly message.
  - Any `401` dispatches `nodepilot:unauthorized`, which `AuthProvider` listens for. `401`s from `/api/auth/login`, `/api/auth/setup` and `/api/auth/password` are excluded, because there they mean "wrong credentials", not "session expired".
- **Auth state** (`AuthProvider`): one `GET /api/auth/status` on load gives `setup`, `anonymous`, `authenticated` or `offline`. `isAdmin` comes from the role. Details in [authentication.md](authentication.md).
- **`usePolling(fetcher, intervalMs, deps)`**, used by every live view:
  - Fetches immediately, then schedules the next fetch with `setTimeout` *after* the current one finishes, so slow responses never overlap.
  - Aborts the in-flight request on unmount or when `deps` change.
  - Pauses on `visibilitychange` (hidden) and fetches immediately when the tab becomes visible again.
  - Keeps the last good data when an error occurs.
  - Resets to empty when `deps` change, for example when opening another folder.
  - `setData` allows optimistic updates, for example after a delete or a toggle; `refresh` re-fetches at once.
- **Routing:**
  - The `(app)` route group wraps authenticated pages in `AppShell`. Its layout shows a splash while the auth state is loading, the offline screen when the backend is unreachable, and redirects to `/setup` or `/login?next=…`.
  - `/setup` sends signed-in users who didn't just finish the wizard back to `/`. `/invite/[token]` works without a session.
  - Admin-only navigation items are filtered by `isAdmin`. The backend enforces the same rules independently.
  - The files page keeps the folder in `?path=`, so links can be shared and back/forward work.
- **Theme** (`app/globals.css`): CSS variables (`--ink`, `--accent`, `--ground`, `--surface`, `--ok`, `--alert`, …) exposed to Tailwind 4 through `@theme inline`. Re-theming means changing those variables. Fonts are Space Grotesk and Space Mono.

### Implementation details & gotchas

- **`NEXT_PUBLIC_API_URL` is built into the bundle.** Next.js inlines `NEXT_PUBLIC_*` values at **build time**. In Docker it is a build `ARG`, so changing it in `.env` requires `docker compose up --build web`.
- **The web Dockerfile needs `output: "standalone"`** in `next.config.ts`. The runtime image copies `.next/standalone` and runs `node server.js`.
- **`allowedDevOrigins`** in `next.config.ts` is filled automatically with this machine's non-internal IPv4 addresses (`os.networkInterfaces()`), so `npm run dev` can be opened from a phone in the LAN. It has no effect on production builds.
- **Polling cost per open tab:**
  - Dashboard: current metrics every 5 s, overview every 10 s, Pi-hole status every 15 s (2 upstream calls each time), chart history every max(bucket, 15 s)
  - Files: the folder listing every 30 s
  - Users: users and pending invitations every 60 s
  - Settings: the Pi-hole connection every 10 min

  Several open tabs multiply this, which is still negligible for a home server. Every authenticated request also costs one account lookup in SQLite (see [authentication.md](authentication.md)).
- **The session never expires while a tab is open.** Polling plus sliding cookie expiration keeps it alive.
- **Clipboard and Share** (`invite-panel.tsx`) need a secure origin. Over plain HTTP the code falls back to `document.execCommand("copy")` and hides *Share*.
- **Backend container specifics:**
  - It runs as `root`.
  - It listens on `8080`, which is published as `${BACKEND_PORT:-5000}`.
  - The SQLite database (accounts, settings, metrics) and the Data Protection keys (`data/keys`) are in the `nodepilot-data` named volume at `/app/data`, so they survive rebuilds.
  - The file root is the bind mount `/files` (`NODEPILOT_FILES_DIR` on the host).
  - `/proc` gives host-wide CPU, RAM and load. Hostname, OS name and the `/` disk come from the container (see [system-monitoring.md](system-monitoring.md)).
  - If `BACKEND_PORT` is not `5000`, also set `NEXT_PUBLIC_API_URL`, because the client's fallback URL hard-codes port `5000`.
- **Startup order:** `web` waits for `backend` to report `service_healthy` (see [health-checks.md](health-checks.md)). Database migrations run on backend startup (`InitializeDatabaseAsync`), and a failed migration aborts startup.
- **Configuration errors fail fast.** Every options section uses `ValidateOnStart`, so a bad setting stops the backend with a clear message instead of failing on the first request.
- **`./start.sh`** checks for .NET 10 and Node 20.9+ (switching with nvm if available), installs web packages on the first run (`--install` forces it), builds the backend, then runs `dotnet run --no-build --launch-profile http` and `npm run dev` with prefixed output. `--clean` deletes the Next.js cache first. It refuses to start if port 3000 or 5000 is taken.

### Configuration

No configuration is required. Optional variables (see `.env.example`):

| Variable | Default | Effect |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | empty | The backend URL used by the browser. Empty means the same host on port 5000. Build time only |
| `WEB_PORT` / `BACKEND_PORT` | `3000` / `5000` | Published ports (Docker Compose) |
| `NODEPILOT_FILES_DIR` | `./data/files` | Host folder mounted as the file root (Docker Compose) |
| `ASPNETCORE_ENVIRONMENT` | `Production` (compose) | `Development` loads `appsettings.Development.json` (shorter metric retention) |
| `NODE_PILOT_DB_CONNECTION_STRING` | `Data Source=data/nodepilot.db` | Optional. Compose sets `/app/data/nodepilot.db`. The keys folder goes next to the database |

### Tests

There are no frontend unit tests. The checks are `npm run lint` and `npm run build`, which runs the type check. Backend integration tests (`NodePilotApiFactory`) host the real API in memory with a temporary database and file root.

### Key files

- `apps/web/src/lib/api/client.ts`
- `apps/web/src/lib/api/endpoints.ts`
- `apps/web/src/lib/api/types.ts`
- `apps/web/src/lib/use-polling.ts`
- `apps/web/src/components/auth/auth-provider.tsx`
- `apps/web/src/components/shell/app-shell.tsx`
- `apps/web/src/components/shell/offline-screen.tsx`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/next.config.ts`
- `apps/web/Dockerfile`
- `apps/backend/Dockerfile`
- `compose.yaml`
- `start.sh`
