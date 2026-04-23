# System Metrics Collection

This document explains how NodePilot reads Linux system metrics, how the background sampling flow persists them, what each output field means, and how the final values are calculated.

## Where the data comes from

The implementation reads two Linux virtual files:

- `/proc/stat` for CPU activity counters
- `/proc/meminfo` for memory counters

These files are provided by the Linux kernel. They are not regular files stored on disk. Each read returns the current kernel view of system activity.

The service only supports Linux. If the application runs on a different operating system, it returns `SystemStatus.PlatformNotSupported`.

## High-level flow

There are two metrics flows:

1. `GET /api/system/status` reads the current status on demand.
2. `MetricsSamplingBackgroundService` collects and persists a metrics sample in the background.

### Live status read

`SystemController.GetSystemStatus` calls `ISystemMetricsReader.ReadSystemStatusAsync`, implemented by `SystemMetricsReader`.

`ReadSystemStatusAsync` performs these steps:

1. Verifies that the current OS is Linux.
2. Reads CPU counters from `/proc/stat`.
3. Waits 300 ms.
4. Reads CPU counters from `/proc/stat` again.
5. Calculates CPU usage from the difference between the two snapshots.
6. Reads memory values from `/proc/meminfo`.
7. Maps the calculated values into the `SystemStatus` response object.
8. Rounds the percentage fields to 2 decimal places.

### Background sampling and persistence

`MetricsSamplingBackgroundService` is registered as a hosted service in infrastructure. It starts with an immediate collection cycle, then repeats every 5 seconds with `PeriodicTimer`.

Each cycle performs these steps:

1. Calls `ISystemMetricsCollector.CollectAsync`, implemented by `LinuxSystemMetricsCollector`.
2. The collector calls `ISystemMetricsReader.ReadSystemStatusAsync`.
3. If the read succeeds, the collector creates a successful `SystemMetric` with rounded CPU and RAM percentages.
4. If the read fails, the collector creates a failed `SystemMetric` with `Status = ReadFailed`, null metric values, and a `FailureReason` based on the first error code.
5. The background service creates a scoped dependency scope.
6. It saves the sample through `ISystemMetricsRepository.SaveAsync`.
7. It commits the insert through `IUnitOfWork.SaveChangesAsync`.

Unexpected exceptions during a sampling cycle are logged and do not stop the hosted service. Cancellation still stops the service normally.

## Live status fields

`SystemMetricsReader` returns these values in `SystemStatus`:

- `CpuUsagePercent`: Estimated CPU usage across the sampling window.
- `RamUsagePercent`: Percentage of RAM currently in use.
- `TotalMemoryBytes`: Total system memory in bytes.
- `UsedMemoryBytes`: Used memory in bytes.
- `AvailableMemoryBytes`: Memory currently available to applications in bytes.
- `CollectedAtUtc`: UTC timestamp added when the response object is created.

## Persisted metric fields

Background samples are stored as `SystemMetric` rows in the `system_metrics` table:

- `Id` / `id`: Database-generated primary key.
- `CpuUsagePercent` / `cpu_usage_percent`: CPU usage percent for a successful read, or `NULL` for a failed read.
- `RamUsagePercent` / `ram_usage_percent`: RAM usage percent for a successful read, or `NULL` for a failed read.
- `Status` / `status`: Collection result stored as an integer enum.
- `FailureReason` / `failure_reason`: Error code for a failed read, capped at 500 characters, or `NULL` for success.
- `CollectedAtUtc` / `collected_at_utc`: UTC timestamp captured when the collector started the sample.

`MetricCollectionStatus` currently has these values:

- `Success` (`0`)
- `ReadFailed` (`1`)

The database enforces the expected row shape:

- successful rows must have CPU and RAM values and no failure reason
- failed rows must have no CPU or RAM values and must have a failure reason
- CPU and RAM percentages must be `NULL` or within `0..100`

## Metrics API endpoints

The persisted metrics API is exposed by `SystemController` under:

```http
/api/system/metrics
```

### Get current metrics

Returns the latest successful persisted metrics sample.

```http
GET /api/system/metrics/current
```

Example:

```bash
curl http://localhost:5000/api/system/metrics/current
```

Example response:

```json
{
  "id": 104,
  "cpuUsagePercent": 12.58,
  "ramUsagePercent": 71.44,
  "status": "Success",
  "failureReason": null,
  "collectedAtUtc": "2026-04-23T14:03:15.123Z"
}
```

Responses:

- `200 OK`: Latest successful sample was found.
- `404 Not Found`: No successful samples are available yet.

### Get historical metrics

Returns persisted metrics samples collected between `start` and `end`, ordered by `collectedAtUtc` ascending.

```http
GET /api/system/metrics/historical?start={startUtc}&end={endUtc}&minIntervalSeconds={seconds}
```

Query parameters:

- `start`: Required start timestamp. Must be earlier than `end` and cannot be in the future.
- `end`: Required end timestamp. If it is in the future, it is normalized to the current UTC time.
- `minIntervalSeconds`: Optional downsampling interval. When supplied, it must be at least `5`.

Constraints:

- The requested range cannot exceed 7 days.
- Historical results include both successful and failed samples.
- Use ISO 8601 timestamps. UTC timestamps with `Z` are recommended.

Example:

```bash
curl "http://localhost:5212/api/system/metrics/historical?start=2026-04-23T12:00:00Z&end=2026-04-23T13:00:00Z"
```

Example with downsampling:

```bash
curl "http://localhost:5212/api/system/metrics/historical?start=2026-04-23T12:00:00Z&end=2026-04-23T13:00:00Z&minIntervalSeconds=60"
```

Example response:

```json
[
  {
    "id": 100,
    "cpuUsagePercent": 10.15,
    "ramUsagePercent": 69.82,
    "status": "Success",
    "failureReason": null,
    "collectedAtUtc": "2026-04-23T12:00:00.000Z"
  },
  {
    "id": 101,
    "cpuUsagePercent": null,
    "ramUsagePercent": null,
    "status": "ReadFailed",
    "failureReason": "SystemStatus.PlatformNotSupported",
    "collectedAtUtc": "2026-04-23T12:00:05.000Z"
  }
]
```

Responses:

- `200 OK`: Query succeeded. The body may be an empty array if no samples exist in the range.
- `400 Bad Request`: Query validation failed.

Validation errors:

- `SystemMetrics.History.InvalidRange`: `start` is not earlier than `end`.
- `SystemMetrics.History.StartInFuture`: `start` is in the future.
- `SystemMetrics.History.RangeTooLarge`: Requested range is greater than 7 days.
- `SystemMetrics.History.InvalidInterval`: `minIntervalSeconds` is less than 5.

### API usage notes

For dashboards, call `GET /api/system/metrics/current` for the most recent point and periodically refresh it.
For charts, call `GET /api/system/metrics/historical` with a bounded time window.

Use `minIntervalSeconds` when rendering longer ranges to reduce payload size. For example, a 1-hour chart can request one point every 60 seconds, while a short live chart can omit downsampling to use the raw 5-second samples.

Because sampling runs in the background, a newly started application may briefly return `404` for current metrics until the first successful Linux sample is persisted.

## CPU metrics

### Source

CPU usage is read from the first line of `/proc/stat`, which starts with `cpu`.

Example shape:

```text
cpu  4705 150 2260 136239 120 0 85 0
```

After the `cpu` label, the service parses numeric counters in this order:

- `user`: Time spent running user-space processes
- `nice`: Time spent running niced user-space processes
- `system`: Time spent in kernel-space work
- `idle`: Time spent idle
- `iowait`: Time waiting for I/O while idle
- `irq`: Time servicing hardware interrupts
- `softirq`: Time servicing software interrupts
- `steal`: Time taken by other virtual machines in virtualized environments

These values are cumulative counters maintained by the kernel. They keep increasing over time.

### Intermediate values

The service groups the counters like this:

- `idleAll = idle + iowait`
- `nonIdle = user + nice + system + irq + softirq + steal`
- `total = idleAll + nonIdle`

It captures two snapshots:

- `first` at time `t1`
- `second` at time `t2`, around 300 ms later

Then it calculates:

- `idleDelta = second.Idle - first.Idle`
- `totalDelta = second.Total - first.Total`

### CPU usage formula

CPU usage is calculated with:

```text
usage = 100 * (1 - (idleDelta / totalDelta))
```

This means:

- if most new CPU time during the sampling window was idle time, usage is low
- if most new CPU time was non-idle time, usage is high

The result is clamped to the range `0..100` and then rounded to 2 decimal places before being returned.

If `totalDelta <= 0`, the service returns `0` for CPU usage.

## Memory metrics

### Source

Memory usage is read from `/proc/meminfo`.

The service reads these keys:

- `MemTotal`
- `MemAvailable`

The values in `/proc/meminfo` are reported in kilobytes, so the service converts them to bytes by multiplying by `1024`.

### What the values mean

- `MemTotal`: Total usable RAM reported by the kernel
- `MemAvailable`: Estimate of how much memory is available for starting new applications without swapping

The service calculates:

- `usedKb = totalKb - availableKb`
- `totalBytes = totalKb * 1024`
- `availableBytes = availableKb * 1024`
- `usedBytes = usedKb * 1024`

### RAM usage formula

RAM usage is calculated with:

```text
ramUsagePercent = 100 * usedKb / totalKb
```

That value is rounded to 2 decimal places before being returned.

## Why `MemAvailable` is used instead of `MemFree`

`MemFree` only reflects completely unused memory. On Linux, a lot of memory may be used for cache and buffers but still be quickly reclaimable.

`MemAvailable` is usually a better signal for application-facing memory pressure because it estimates how much memory can actually be used without heavy reclaim or swapping.

## Error handling

`SystemMetricsReader` returns domain errors instead of throwing runtime exceptions for expected metric-reading failures.

Examples include:

- unsupported platform
- `/proc/stat` not readable
- invalid `/proc/stat` format
- invalid numeric CPU counter values
- `/proc/meminfo` not readable
- missing or invalid memory keys
- invalid total memory value

This keeps the live reader aligned with the `ErrorOr<SystemStatus>` contract.

For background persistence, `LinuxSystemMetricsCollector` converts those errors into a persisted failed `SystemMetric` instead of discarding the sample. The stored `FailureReason` is the first error code, or `unknown_error` if the code is empty.

## Important assumptions

- The implementation is Linux-only.
- CPU usage is an average over roughly 300 ms, not an instantaneous reading.
- Memory values depend on what the Linux kernel reports at the time of the read.
- The reported percentages are rounded for presentation, so they are slightly less precise than the raw calculated values.
- The background sampling interval is currently hard-coded to 5 seconds.
- Persisted samples contain CPU and RAM percentages only. Full memory byte counters are available from the live `SystemStatus` read but are not stored in `SystemMetric`.

## Related code

- `apps/backend/src/NodePilot.Api/Controllers/SystemController.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/Services/SystemMetricsReader.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/Services/SystemMetricsCollector.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/Services/SystemMetricsProvider.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/SystemStatus.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/SystemMetric.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/Errors/SystemStatusErrors.cs`
- `apps/backend/src/NodePilot.Application/Interfaces/SystemStatus/ISystemMetricsReader.cs`
- `apps/backend/src/NodePilot.Application/Interfaces/SystemStatus/ISystemMetricsCollector.cs`
- `apps/backend/src/NodePilot.Application/Interfaces/SystemStatus/ISystemMetricsProvider.cs`
- `apps/backend/src/NodePilot.Application/Interfaces/SystemStatus/ISystemMetricsRepository.cs`
- `apps/backend/src/NodePilot.Infrastructure/Background/MetricsSamplingBackgroundService.cs`
- `apps/backend/src/NodePilot.Infrastructure/Persistence/Repositories/SystemMetricsRepository.cs`
- `apps/backend/src/NodePilot.Infrastructure/Persistence/Configurations/SystemMetricsConfiguration.cs`
