# System monitoring

The dashboard shows the server's health: CPU, RAM, CPU temperature and disk gauges, a CPU/RAM history chart, and host details such as uptime, load average, OS and architecture. CPU and RAM are sampled in the background and stored in SQLite. Everything else is read live when the dashboard asks for it.

## User perspective

### What it does

- **Four gauges.**
  - CPU % and Memory % come from the latest stored sample, refreshed every 5 s.
  - Temperature °C and Disk % are read live every 10 s.
  - Each gauge shows a severity badge: *Healthy* below 70 %, *Elevated* from 70 %, *Critical* from 90 %. For temperature the badges are *Optimal*, *Warm* (≥ 70 °C) and *Hot* (≥ 85 °C).
- **Performance chart.**
  - Shows CPU or Memory over the last 15 min, 1 h, 6 h or 24 h.
  - Each point is the average of a time bucket (15 s, 1 min, 5 min or 15 min). The shaded band shows the min–max range within the bucket.
  - Gaps in the line mean that no samples exist for that period, for example while the server was off.
  - Hovering a point shows the average, the range and the sample count.
- **System card.** Hostname, OS, uptime, core count, architecture, and the 1/5/15-minute load average shown as bars relative to the core count.
- Polling pauses while the browser tab is hidden and resumes immediately when you return to it.

### Usage scenarios

- **"Why is the server slow?"** Check whether CPU or RAM is high now, then switch the chart to 6 h or 24 h to see when it started. For example: a backup job every night at 3:00, or a media transcode.
- **Thermal checks on a Raspberry Pi or mini PC.** Watch the temperature gauge during heavy load to spot throttling or a failing fan.
- **Disk-full prevention.** The disk gauge turns *Critical* at 90 % before downloads or the database start failing.
- **Load versus cores.** A 15-minute load average close to the core count means the machine is saturated even when the CPU % snapshot looks fine.

### Limitations

- **Linux only.** All values come from `/proc` and `/sys`. On Windows or macOS (for example a dev machine), CPU and RAM samples are stored as failed, and the gauges show *Unavailable*.
- **Only CPU and RAM have history.** Temperature, disk, load and uptime are live values only, so there is no "temperature over the last day" chart.
- **History is kept for 72 hours by default** (`MaxMetricAgeHours`). The API accepts ranges up to 7 days, but anything older than the retention period is already deleted.
- **Disk shows only the `/` filesystem.** Other mounts (a data disk, a NAS share) are not shown. **In Docker, `/` is the container's own filesystem**, so this value may differ from the host disk you care about.
- **Inside Docker, some host details are wrong.**
  - *Hostname* is the container ID unless `hostname:` is set in `compose.yaml`.
  - *OS* is the container image's distro (Debian) instead of the host OS.
  - CPU, RAM, load and uptime are not affected, because `/proc` reports host-wide values.
- **"Current" may be old.** The gauges show the latest *successful* sample. If collection stops failing silently, the gauges keep showing the last value without telling you how old it is.
- **CPU % is a 300 ms average** taken once per sampling interval (default 15 s). Short spikes between samples are missed.
- **Temperature is a best guess.** On unknown boards the hottest plausible sensor is used, which may be a chipset or NVMe sensor rather than the CPU.
- **There are no alerts or notifications.** The `Monitoring:Alerts` settings are validated but not used yet.

## Developer perspective

### How it works

Three independent flows:

```
1. Sampling (background)
   MetricsSamplingBackgroundService ─ every IntervalSeconds (PeriodicTimer)
     └─ LinuxSystemMetricsCollector.CollectAsync
          ├─ SystemMetricsReader.ReadCpuUsagePercentAsync  (/proc/stat ×2, 300 ms apart)
          └─ SystemMetricsReader.ReadMemoryInfo            (/proc/meminfo)
     └─ SystemMetricsRepository.SaveAsync + UnitOfWork.SaveChangesAsync → SQLite system_metrics
     └─ MetricsCollectorState.MarkSuccess / MarkFailure           (read by /health)

2. Retention (background)
   MetricsCleanupBackgroundService ─ every CleanupIntervalMinutes
     └─ MetricsRetentionService → DELETE WHERE collected_at_utc < now − MaxMetricAgeHours

3. Reads (HTTP)
   GET /api/system/metrics/current     → latest row with status != ReadFailed
   GET /api/system/metrics/historical  → rows in [start, end] → epoch-aligned buckets → summaries
   GET /api/system/overview            → SystemOverviewProvider (live, not persisted)
```

### Implementation details & gotchas

- **CPU formula:** `usage = 100 × (1 − Δidle / Δtotal)`, where `idle = idle + iowait` and `total` is the sum of the first 8 counters. The result is clamped to 0–100.
- **RAM formula:** `(MemTotal − MemAvailable) / MemTotal`. `MemAvailable` is used instead of `MemFree`, so reclaimable page cache does not count as "used".
- **Errors are values, not exceptions.** The reader returns `ErrorOr<T>`. The collector turns failures into a stored row with `Status = PartialSuccess | ReadFailed` and a `FailureReason` (the first error code), so the history shows *why* data is missing.
- **Row shape is enforced by SQLite CHECK constraints** (`SystemMetricsConfiguration`):
  - `total_reads` equals the number of enabled metrics.
  - Each status has a valid shape. For example, `Success` means all reads succeeded and `failure_reason IS NULL`.
  - Percentages are within 0–100.
  - Changing the collector logic without updating these constraints makes inserts fail.
- **Bucketing** (`SystemMetricsProvider.BucketByInterval`):
  - Buckets are `unixSeconds / interval`, so their boundaries align to the epoch. That is what lets the client match `intervalStart` to its own grid.
  - Empty buckets are **omitted**. The chart (`buildPoints`) fills the grid itself and breaks the line at gaps.
  - The default bucket size is 5 s, the minimum is 5 s, and the maximum range is 7 days.
- **Bucketing runs in memory.** All rows in the range are loaded and grouped in C#. That is fine at the default 15 s interval (about 40k rows per week). With a 1 s interval and a 7-day query it becomes about 600k rows per request, which is slow on a Pi.
- **UTC handling.** SQLite returns `DateTimeKind.Unspecified`. An EF value converter and the bucketing code both force `Utc`, otherwise the buckets would shift by the host's UTC offset.
- **Which settings apply without a restart:**
  - Read **once** at startup: `Collection.Enabled` and `IntervalSeconds`. The `PeriodicTimer` is created once.
  - Read on every cycle or request: `CollectCpuUsage`/`CollectRamUsage` (each sample), `CollectDiskUsage`/`CollectTemperature` (each overview request) and the retention values (each cleanup loop). Edits to `appsettings.json` for these are picked up through `IOptionsMonitor`.
- **Unused settings:** `Retention.MaxStoredSamples` and the whole `Alerts` section are validated but not used yet.
- **Edge case:** with CPU and RAM collection both disabled but `Collection.Enabled = true`, rows are still written with `TotalReads = 0` and status `Success`, and every value is null.
- **Temperature selection** (`LinuxSystemParsers.SelectCpuTemperatureCelsius`):
  - Reads `thermal_zone*/type,temp` and `hwmon*/name,temp1_input`.
  - Drops readings outside 1–150 °C.
  - Picks by priority: `x86_pkg_temp`, `coretemp`, `k10temp`, `zenpower`, `cpu_thermal`, `cpu-thermal`, `soc_thermal`, `tcpu`, `acpitz`. If none matches, it uses the hottest remaining sensor.
- **Disk:** `DriveInfo("/")`. *Used* is `Total − TotalFree`. *Available* is `AvailableFreeSpace`, which excludes the root-reserved blocks, so used + available can be less than total.
- **Overview never fails.** Each part is optional and is `null` when unreadable. Failures are logged at Debug level.

### Configuration (`Monitoring` section, FluentValidation, `ErrorOnUnknownConfiguration`)

| Key | Default | Range | Restart needed |
|---|---|---|---|
| `Collection:Enabled` | `true` | — | yes |
| `Collection:IntervalSeconds` | `15` | 1–3600 | yes |
| `Collection:CollectCpuUsage` / `CollectRamUsage` | `true` | at least one metric must be enabled | no |
| `Collection:CollectDiskUsage` / `CollectTemperature` | `true` | affect `/overview` only | no |
| `Retention:CleanupEnabled` | `true` | — | no |
| `Retention:MaxMetricAgeHours` | `72` | 1–8760 | no |
| `Retention:CleanupIntervalMinutes` | `30` | 1–1440 | no |
| `Retention:MaxStoredSamples` | `250000` | 100–10M | *not used* |
| `Alerts:*` | — | validated | *not used* |

Unknown keys under `Monitoring` stop the app at startup, so a typo is caught immediately.

### API

| Method | Path | Result |
|---|---|---|
| GET | `/api/system/metrics/current` | `200 SystemMetric`, or `404` before the first successful sample |
| GET | `/api/system/metrics/historical?start&end&minIntervalSeconds` | `200 IntervalMetricsSummary[]` (count, min/avg/max, coverage per bucket), or `400` |
| GET | `/api/system/overview` | `200 SystemOverview` |

Validation codes: `SystemMetrics.History.InvalidRange`, `StartInFuture`, `RangeTooLarge` (> 7 days) and `InvalidInterval` (< 5 s). An `end` in the future is clamped to now.

### Tests

`LinuxSystemParsersTests` (uptime, loadavg, os-release, sensor priority and plausibility), `SystemMetricsProviderTests` (UTC bucketing), and the `Overview_ReturnsHostInformation` integration test.

### Key files

- `apps/backend/src/NodePilot.Application/Monitoring/Services/SystemMetricsReader.cs`
- `apps/backend/src/NodePilot.Application/Monitoring/Services/SystemMetricsCollector.cs`
- `apps/backend/src/NodePilot.Application/Monitoring/Services/SystemMetricsProvider.cs`
- `apps/backend/src/NodePilot.Application/Monitoring/Services/SystemOverviewProvider.cs`
- `apps/backend/src/NodePilot.Application/Monitoring/Services/LinuxSystemParsers.cs`
- `apps/backend/src/NodePilot.Infrastructure/Background/MetricsSamplingBackgroundService.cs`
- `apps/backend/src/NodePilot.Infrastructure/Background/MetricsCleanupBackgroundService.cs`
- `apps/backend/src/NodePilot.Infrastructure/Persistence/Configurations/SystemMetricsConfiguration.cs`
- `apps/backend/src/NodePilot.Infrastructure/Configuration/Monitoring/MonitoringSettingsValidator.cs`
- `apps/web/src/app/(app)/page.tsx`
- `apps/web/src/components/dashboard/performance-chart.tsx`
- `apps/web/src/components/dashboard/metric-gauge.tsx`
- `apps/web/src/components/dashboard/system-card.tsx`

See also [../system-metrics.md](../system-metrics.md) for the detailed `/proc` parsing notes.
