# Health checks

The backend has three public health endpoints. `/health/live` tells whether the process answers at all. `/health/ready` tells whether the database and the metrics collector work. `/health` runs every check and is kept for monitors and older setups. Docker uses `/health` to decide whether the web container may start. The web app has its own trivial `/api/health`.

## User perspective

### What it does

- `http://<server>:5000/health` returns a JSON report with an overall status and one entry for each check: `system_status`, `database_status` and `metrics_collector`.
- `/health/ready` returns the same report for the database and collector checks only. `/health/live` runs no checks and returns `Healthy` as long as the backend responds.
- A status of **Healthy** or **Degraded** returns HTTP `200`. **Unhealthy** returns `503`.
- `docker compose ps` shows the backend as `healthy` or `unhealthy`. The web container starts only after the backend reports healthy.

### Usage scenarios

- **"The dashboard is empty, why?"** Open `/health`. The `metrics_collector` entry shows `lastError` and when the last successful sample was taken.
- **Uptime monitoring.** Point Uptime Kuma or a similar tool at `/health/ready` and alert on a non-200 response. Use `/health/live` if you only want to know that the process is up.
- **After an upgrade**, confirm that database migrations ran (`database_status` is healthy).
- **Collection turned off on purpose** (`Monitoring:Collection:Enabled = false`): the collector reports *Healthy* with the description "Metrics collection is disabled." and `enabled: false` in its data, so monitors stay green. This holds on any operating system.

### Limitations

- **Degraded counts as up.** On a non-Linux host the collector reports *Degraded*, which returns `200`. Monitors that look only at the HTTP status will not notice; read the JSON `status` field if you care.
- **The endpoints are public** and reveal the .NET version, OS version, CPU count and collector errors. That is fine inside a LAN, but block them at the proxy if the panel is exposed.
- **Pi-hole and the file root are not checked.** A missing Pi-hole or an unwritable files folder does not affect health.
- **Docker and `./start.sh` still probe `/health`,** not `/health/ready`. Because Degraded returns `200` and disabled collection is Healthy, this works, but `system_status` adds nothing to the decision.
- **A crashed collector stays unhealthy until restart.** Nothing restarts it automatically (see below).

## Developer perspective

### How it works

| Check | Class | Tags | Result |
|---|---|---|---|
| `system_status` | `SystemHealthCheck` | `general` | Always Healthy (the process answers). Data: `dotnetVersion`, `processors`, `osVersion`, `os` |
| `database_status` | `SqliteHealthCheck` | `database`, `ready` | Healthy when a new connection runs `SELECT 1` and gets `1`. Data: `state`, `serverVersion`, `timestampUtc` |
| `metrics_collector` | `MetricsCollectorReadinessCheck` | `collector`, `ready` | See the decision order below |

`metrics_collector` decides in this order and stops at the first match:

1. **Collection disabled** (`Monitoring:Collection:Enabled = false`) → Healthy ("disabled"). Checked first, so this wins on every OS.
2. **Not Linux** → Degraded ("not supported on this operating system").
3. **Sampler not running** (it crashed or stopped) → Unhealthy.
4. **No successful collection yet** → Unhealthy.
5. **Last success older than `max(30 s, 3 × IntervalSeconds)`** → Unhealthy ("stale").
6. Otherwise → Healthy.

Its data: `enabled`, `isRunning`, `lastSuccessfulCollectionUtc`, `lastAttemptUtc`, `lastError`, `maxSnapshotAgeSeconds`, plus `snapshotAgeSeconds` once a sample exists.

| Endpoint | Predicate | Checks run |
|---|---|---|
| `/health/live` | `_ => false` | none |
| `/health/ready` | `Tags.Contains("ready")` | `database_status`, `metrics_collector` |
| `/health` | all | all three |

- `MetricsCollectorState` is a singleton guarded by a lock. `MetricsSamplingBackgroundService` updates it with `MarkRunning`, `MarkSuccess`, `MarkFailure` and `MarkStopped`. The health check reads an immutable `Snapshot()`.
- `PartialSuccess` samples count as success for health purposes. Only `ReadFailed` samples and exceptions mark a failure.
- `HealthCheckResponseWriter` serializes the report as `{ status, totalDuration, checks: [{ name, status, description, duration, tags, data }] }`. For `/health/live`, `checks` is empty.
- All three endpoints are mapped with `.AllowAnonymous()`, which bypasses the global authorization fallback policy.

### Implementation details & gotchas

- **Staleness scales with the interval.** A fixed 30 s window would mark any interval above 30 s as stale forever, so the limit is three missed cycles with a 30 s floor.
- **Settings are read at different times.** The health check reads `Monitoring:Collection` through `IOptionsMonitor` on every request, but the sampler reads `Enabled` and `IntervalSeconds` once at startup. Enabling collection in `appsettings.json` while the backend runs makes the check report "not running" (Unhealthy) until a restart. Changing the interval changes the staleness window but not the timer. Task 9 in `TASKS.md` fixes this.
- **Startup timing:** the sampler runs its first cycle immediately, about 300 ms for the CPU read. Docker's `start_period: 10s` is therefore enough, and the collector is healthy before the first probe.
- **The SQLite check opens its own connection** from `ResolveConnectionString()` and does not use EF. It therefore catches a missing or locked database file even if the DbContext pool is fine.
- **If the sampler loop crashes,** the exception is recorded in `lastError` and `isRunning` becomes `false`. The collector stays unhealthy until the process restarts. `restart: unless-stopped` does not restart a container that is only *unhealthy*, so use an external monitor or `autoheal` if you need that.
- **Web app health** (`apps/web/src/app/api/health/route.ts`) always returns `{ status: "ok" }`. It proves only that the Next.js server responds.

### Configuration

There are no dedicated settings. The staleness window comes from `Monitoring:Collection:IntervalSeconds`, and `Monitoring:Collection:Enabled` decides between the "disabled" and "not running" results. Docker probe timing is in `compose.yaml` and the Dockerfiles (`interval 30s`, `timeout 5s`, `retries 3`).

### API

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/health/live` (backend) | public | `200`, no checks |
| GET | `/health/ready` (backend) | public | `200` Healthy/Degraded, `503` Unhealthy |
| GET | `/health` (backend) | public | `200` Healthy/Degraded, `503` Unhealthy |
| GET | `/api/health` (web) | public | `200 { status: "ok" }` |

### Tests

- `HealthEndpointTests` (integration) runs the API with collection disabled. All three endpoints are public and return `200` Healthy, `/health/live` runs no checks, `/health/ready` runs only the `ready` checks, and the collector reports "disabled" with `enabled: false`.
- `MetricsCollectorReadinessCheckTests` (unit) covers every result of the check (disabled, not running, crashed, no sample yet, fresh, stale) and the staleness window for several intervals. The tests that need Linux are marked `[Platform("Linux")]`; the Degraded test runs only on other systems.

### Key files

- `apps/backend/src/NodePilot.Api/Program.cs` (endpoint mapping)
- `apps/backend/src/NodePilot.Api/DependencyInjection.cs` (check registration and tags)
- `apps/backend/src/NodePilot.Api/HealthChecks/MetricsCollectorReadinessCheck.cs`
- `apps/backend/src/NodePilot.Api/HealthChecks/SqliteHealthCheck.cs`
- `apps/backend/src/NodePilot.Api/HealthChecks/SystemHealthCheck.cs`
- `apps/backend/src/NodePilot.Api/HealthChecks/HealthCheckResponseWriter.cs`
- `apps/backend/src/NodePilot.Application/Monitoring/Models/MetricsCollectorState.cs`
- `compose.yaml`
