# NodePilot

NodePilot is a unified control panel for managing a home server.

This repository is a monorepo containing:

- A .NET backend server agent
- A Next.js web client

## Monorepo Structure

```text
nodepilot/
├─ apps/
│  ├─ backend/     # ASP.NET Core Web API
│  └─ web/         # Next.js web application
├─ .gitignore
├─ .env.example
├─ compose.yaml
└─ README.md
```

## Tech Stack

- Backend: .NET (ASP.NET Core Web API)
- Frontend: Next.js (React, TypeScript)
- Container orchestration: Docker Compose
- Architecture: Client-server (REST API, JSON)

## Requirements

Make sure you have installed:

- .NET SDK 10.0
- Node.js 20+
- npm (comes with Node.js)
- Docker Desktop or Docker Engine with Compose
- Git

## Environment Variables

### Global Reference

See `.env.example` in the repository root.

Configurable variables:

- `NODE_ENV`: runtime mode passed to the web container by Compose. Default: `production`
- `ASPNETCORE_ENVIRONMENT`: ASP.NET Core environment passed to the backend container by Compose. Default: `Development`
- `BACKEND_PORT`: host port mapped to the backend container's internal port `8080`. Default: `5000`
- `WEB_PORT`: host port mapped to the web container's internal port `3000`. Default: `3000`
- `NEXT_PUBLIC_API_URL`: public backend URL compiled into the web app and also provided to the web container at runtime. Default: `http://localhost:5000`

Container-internal variables used by Docker setup:

- `ASPNETCORE_URLS`: fixed to `http://+:8080` inside the backend container
- `PORT`: fixed to `3000` inside the web container
- `HOSTNAME`: fixed to `0.0.0.0` inside the web container so the server is reachable by Docker health checks

Precedence when running `docker compose`:

1. Shell environment variables in the terminal where you run Compose
2. Values from the repository-root `.env` file
3. The fallback defaults written in `compose.yaml` like `${WEB_PORT:-3000}`

### Web (Next.js)

For local non-Docker development, copy the example file:

```bash
cd apps/web
cp .env.local.example .env.local
```

Default value:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Running The Project Locally

You can run the apps directly with the native toolchains or together with Docker Compose.

### Option 1. Start with Docker Compose

From the repository root:

```bash
cp .env.example .env
docker compose up --build
```

The services will be available at:

```text
Web:     http://localhost:3000
Backend: http://localhost:5000
```

Container health checks:

- Backend: `GET /health`
- Web: `GET /api/health`

The web service waits for the backend service to become healthy before starting.

### Option 2. Start the Backend (.NET API)

```bash
cd apps/backend/src/NodePilot.Api
dotnet restore
dotnet run
```

By default, the API will be available at:

```text
http://localhost:5000
```

Endpoint:

```text
GET /health
```

- `/health` runs three backend health checks and returns a JSON response with the overall health status, total execution time, and per-check details.
- Registered checks:
  - `system_status`: reports basic process and host metadata such as OS, processor count, and .NET runtime version.
  - `database_status`: verifies the SQLite database is reachable by opening a connection and executing `SELECT 1`.
  - `metrics_collector`: verifies the background metrics sampler is running and that it has produced a recent successful sample.
- `metrics_collector` is reported as unhealthy when the sampler is not running, has not completed a successful collection yet, or its latest successful sample is older than 30 seconds.

### Option 3. Start the Web App (Next.js)

In a new terminal:

```bash
cd apps/web
npm install
npm run dev
```

Open in your browser:

```text
http://localhost:3000
```

## Verification Checklist

After setup, confirm that:

- `docker compose up --build` starts both services successfully
- `http://localhost:5000/health` returns a healthy JSON response
- `http://localhost:3000/api/health` returns `{ "status": "ok" }`
- The frontend loads at `http://localhost:3000`

The backend health response includes a top-level `status`, `totalDuration`, and a `checks` array. Each item in `checks` includes `name`, `status`, `description`, `duration`, `tags`, and `data`.
