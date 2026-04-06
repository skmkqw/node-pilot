# System Metrics Gathering

This document explains how `SystemStatusService` gathers system metrics on Linux, what each output field means, and how the final values are calculated.

## Where the data comes from

The implementation reads two Linux virtual files:

- `/proc/stat` for CPU activity counters
- `/proc/meminfo` for memory counters

These files are provided by the Linux kernel. They are not regular files stored on disk. Each read returns the current kernel view of system activity.

The service only supports Linux. If the application runs on a different operating system, it returns `SystemStatus.PlatformNotSupported`.

## High-level flow

`GetSystemStatusAsync` performs these steps:

1. Verifies that the current OS is Linux.
2. Reads CPU counters from `/proc/stat`.
3. Waits 300 ms.
4. Reads CPU counters from `/proc/stat` again.
5. Calculates CPU usage from the difference between the two snapshots.
6. Reads memory values from `/proc/meminfo`.
7. Maps the calculated values into the `SystemStatus` response object.
8. Rounds the percentage fields to 2 decimal places.

## Output fields

The service returns these values:

- `CpuUsagePercent`: Estimated CPU usage across the sampling window.
- `RamUsagePercent`: Percentage of RAM currently in use.
- `TotalMemoryBytes`: Total system memory in bytes.
- `UsedMemoryBytes`: Used memory in bytes.
- `AvailableMemoryBytes`: Memory currently available to applications in bytes.
- `CollectedAtUtc`: UTC timestamp added when the response object is created.

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

The service returns domain errors instead of throwing runtime exceptions for expected metric-reading failures.

Examples include:

- unsupported platform
- `/proc/stat` not readable
- invalid `/proc/stat` format
- invalid numeric CPU counter values
- `/proc/meminfo` not readable
- missing or invalid memory keys
- invalid total memory value

This keeps the service aligned with the `ErrorOr<SystemStatus>` contract.

## Important assumptions

- The implementation is Linux-only.
- CPU usage is an average over roughly 300 ms, not an instantaneous reading.
- Memory values depend on what the Linux kernel reports at the time of the read.
- The reported percentages are rounded for presentation, so they are slightly less precise than the raw calculated values.

## Related code

- `apps/backend/src/NodePilot.Application/SystemStatus/Services/SystemStatusService.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/SystemStatus.cs`
- `apps/backend/src/NodePilot.Application/SystemStatus/Errors/SystemStatusErrors.cs`
