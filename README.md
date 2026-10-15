# NodePilot

NodePilot is a lightweight, unified control panel for a home server. One web app, reachable from any device in your home network, replaces the terminal and the separate admin panels for the everyday jobs:

| Feature | What it does |
|---|---|
| **Live dashboard** | CPU, memory, CPU temperature and disk usage as animated gauges, a performance history chart (15 min – 24 h), uptime, load average and host details. |
| **Files & media** | Browse a sandboxed folder on the server, upload (drag & drop), create folders, download and delete files. |
| **Video player** | Stream MP4, WebM, MOV and OGV videos (plus audio and images) right in the browser, with seeking via HTTP range requests. |
| **Ad blocking** | Pi-hole (v6) integration: see today's statistics and switch network-wide blocking on/off or pause it for 5 min – 1 h. |
| **Sign-in** | A single administrator account protected by an HTTP-only session cookie and login rate limiting. |

## Monorepo structure

```text
nodepilot/
├─ apps/
│  ├─ backend/                 # ASP.NET Core Web API (.NET 10)
│  │  ├─ src/NodePilot.Api             # controllers, auth, CORS, health checks
│  │  ├─ src/NodePilot.Application     # domain models, services, interfaces
│  │  ├─ src/NodePilot.Infrastructure  # EF Core + SQLite, background jobs, Pi-hole client
│  │  └─ tests/NodePilot.Api.Tests     # unit + integration tests (NUnit)
│  └─ web/                     # Next.js 16 / React 19 client (Tailwind 4, Motion)
├─ documents/                  # API reference, metrics notes, mockups, Postman
├─ compose.yaml
└─ .env.example
```

## Tech stack

- **Backend:** ASP.NET Core (.NET 10), EF Core 10 + SQLite, ErrorOr, FluentValidation, cookie authentication, rate limiting
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Motion, Lucide icons
- **Deployment:** Docker Compose
- **Architecture:** client–server (REST, JSON), layered backend (Api → Application ← Infrastructure)

## Requirements

- .NET SDK 10.0
- Node.js **20.9+** (required by Next.js 16)
- Docker Engine with Compose (optional)
- Linux host (system metrics are read from `/proc` and `/sys`)

## Configuration

Copy the example file and **set a password**:

```bash
cp .env.example .env
```

| Variable | Purpose | Default |
|---|---|---|
| `Auth__Username` | Administrator login | `admin` |
| `Auth__Password` | Administrator password (min. 8 characters) | — (required) |
| `NODE_PILOT_DB_CONNECTION_STRING` | SQLite connection string for local runs | `Data Source=data/nodepilot.db` |
| `PiHole__BaseUrl` | Pi-hole v6 address, e.g. `http://192.168.1.2`. Empty disables the integration. | empty |
| `PiHole__Password` | Pi-hole app password | empty |
| `NODEPILOT_FILES_DIR` | Host folder shown in the file manager (Docker Compose) | `./data/files` |
| `NEXT_PUBLIC_API_URL` | Backend URL used by the browser. Empty = same host, port 5000. | empty |
| `BACKEND_PORT` / `WEB_PORT` | Published ports | `5000` / `3000` |

Further settings live in `apps/backend/src/NodePilot.Api/appsettings.json`:

- `Monitoring`: sampling interval, retention, which metrics to collect
- `FileManager`: `RootPath` (the only directory the file manager can access) and `MaxUploadMegabytes`
- `Cors`: allowed origins; `AllowPrivateNetworkOrigins` lets devices in the LAN use the panel
- `Auth:SessionLifetimeHours`

Every section is validated at startup, and the app refuses to start with a clear message if something is missing.

## Running

### Option 1: Docker Compose

```bash
cp .env.example .env    # then edit Auth__Password
docker compose up --build
```

- Web: <http://localhost:3000> (or `http://<server-ip>:3000` from your phone)
- Backend: <http://localhost:5000>, health check at `/health`

The metrics database is kept in the `nodepilot-data` volume, and `NODEPILOT_FILES_DIR` is mounted as the file manager root.

### Option 2: Run the apps natively

```bash
# backend
cd apps/backend/src/NodePilot.Api
dotnet run

# web (in a second terminal)
cd apps/web
npm install
npm run dev
```

Open <http://localhost:3000> and sign in with the credentials from `.env`.

## Tests

```bash
cd apps/backend
dotnet test
```

The suite has unit tests (path traversal protection, symlink escapes, Linux parsers, CORS policy, Pi-hole client against a fake API, UTC bucketing) and integration tests that host the real API in memory (authentication, file upload / range streaming / delete, access control).

```bash
cd apps/web
npm run lint
npm run build
```

## Security notes

- All `/api/*` endpoints require a signed-in user; only `/health` is public.
- Sessions use an HTTP-only, `SameSite=Lax` cookie; login is limited to 5 attempts per minute per IP.
- The file manager is restricted to `FileManager:RootPath`. Paths are normalised and every symlink along a path is resolved, so `..` sequences and links pointing outside the root are rejected (403).
- NodePilot does not execute shell commands.
- For access from outside the home network, put it behind a VPN or a reverse proxy with HTTPS.

## Documentation

- [API reference](documents/api.md)
- [System metrics collection](documents/system-metrics.md)
- [UI mockups](documents/mockups)
