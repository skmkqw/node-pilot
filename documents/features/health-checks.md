# Health checks

A public `GET /health` endpoint reports whether the backend is up, whether the SQLite database answers, and whether the metrics collector is producing fresh data. Docker uses it to restart or hold back containers. The web app has its own trivial `/api/health`.

## User perspective

### What it does

- `http://<server>:5000/health` returns a JSON report with an overall status and one entry for each check: `system_status`, `database_status` and `metrics_collector`.
- `docker compose ps` shows the backend as `healthy` or `unhealthy`. The web container starts only after the backend reports healthy.

### Usage scenarios

- **"The dashboard is empty, why?"** Open `/health`. The `metrics_collector` data shows `lastError` and when the last successful sample was taken.
- **Uptime monitoring.** Point Uptime Kuma or a similar tool at `/health` and alert on a non-200 response.
- **After an upgrade**, confirm that database migrations ran (`database_status` is healthy).

### Limitations

- **Any failing check makes the whole service unhealthy (HTTP 503).** Turning off metrics collection (`Monitoring:Collection:Enabled = false`), or running on a non-Linux host, keeps `metrics_collector` unhealthy permanently. With Docker Compose, **the web container then never starts**, because it waits for `service_healthy`.
- **No distinction between liveness and readiness.** Checks are tagged `ready`/`general`, but only one endpoint exists and it runs all checks.
- **The endpoint is public** and reveals the .NET version, OS version, CPU count and collector errors. That is fine inside a LAN, but block it at the proxy if the panel is exposed.
- **Pi-hole and the file root are not checked.** A missing Pi-hole or an unwritable files folder does not affect health.

## Developer perspective

### How it works

| Check | Class | Healthy when | Data |
|---|---|---|---|
| `system_status` | `SystemHealthCheck` | Always (the process answers) | `dotnetVersion`, `processors`, `osVersion`, `os` |
| `database_status` | `SqliteHealthCheck` | A new connection runs `SELECT 1` and gets `1` | `state`, `serverVersion`, `timestampUtc` |
| `metrics_collector` | `MetricsCollectorReadinessCheck` | The sampler is running, has had at least one success, and the last success is ≤ `max(30 s, 3 × IntervalSeconds)` old | `isRunning`, `lastSuccessfulCollectionUtc`, `lastAttemptUtc`, `lastError`, `maxSnapshotAgeSeconds`, `snapshotAgeSeconds` |

- `MetricsCollectorState` is a singleton guarded by a lock. `MetricsSamplingBackgroundService` updates it with `MarkRunning`, `MarkSuccess`, `MarkFailure` and `MarkStopped`. The health check reads an immutable `Snapshot()`.
- `PartialSuccess` samples count as success for health purposes. Only `ReadFailed` samples and exceptions mark a failure.
- `HealthCheckResponseWriter` serializes the report as `{ status, totalDuration, checks: [{ name, status, description, duration, tags, data }] }`.
- The endpoint is mapped with `.AllowAnonymous()`, which bypasses the global authorization fallback policy.

### Implementation details & gotchas

- **Staleness scales with the interval.** A fixed 30 s window would mark any interval above 30 s as stale forever, so the limit is three missed cycles with a 30 s floor.
- **Startup timing:** the sampler runs its first cycle immediately, about 300 ms for the CPU read. Docker's `start_period: 10s` is therefore enough, and the collector is healthy before the first probe.
- **The SQLite check opens its own connection** from `ResolveConnectionString()` and does not use EF. It therefore catches a missing or locked database file even if the DbContext pool is fine.
- **If the sampler loop crashes,** the exception is recorded in `lastError` and `isRunning` becomes `false`. The collector stays unhealthy until the process restarts. `restart: unless-stopped` does not restart a container that is only *unhealthy*, so use an external monitor or `autoheal` if you need that.
- **Web app health** (`apps/web/src/app/api/health/route.ts`) always returns `{ status: "ok" }`. It proves only that the Next.js server responds.

### Configuration

There are no dedicated settings. The staleness window comes from `Monitoring:Collection:IntervalSeconds`. Docker probe timing is in `compose.yaml` and the Dockerfiles (`interval 30s`, `timeout 5s`, `retries 3`).

### API

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/health` (backend) | public | `200` Healthy, or `503` Unhealthy/Degraded |
| GET | `/api/health` (web) | public | `200 { status: "ok" }` |

### Tests

`ApiTests.Health_IsPublic`: `/health` responds without a session.

### Key files

- `apps/backend/src/NodePilot.Api/HealthChecks/MetricsCollectorReadinessCheck.cs`
- `apps/backend/src/NodePilot.Api/HealthChecks/SqliteHealthCheck.cs`
- `apps/backend/src/NodePilot.Api/HealthChecks/SystemHealthCheck.cs`
- `apps/backend/src/NodePilot.Api/HealthChecks/HealthCheckResponseWriter.cs`
- `apps/backend/src/NodePilot.Application/Monitoring/Models/MetricsCollectorState.cs`
- `compose.yaml`
