# NodePilot REST API

Base URL: `http://<server>:5000`. All responses are JSON and enums are serialized as strings. Errors use [RFC 9457 Problem Details](https://www.rfc-editor.org/rfc/rfc9457) (`title`, `status`, and `errors` for validation failures).

Every endpoint except `/health`, `GET /api/auth/status`, `POST /api/auth/setup` and `POST /api/auth/login` requires the session cookie `nodepilot.session`. Without it, the API answers **401**.

| Status | Meaning |
|---|---|
| 400 | Validation error (invalid range, name, duration …) |
| 401 | Not signed in / wrong credentials |
| 403 | Forbidden: path outside the file manager root, deleting the root |
| 404 | Not found |
| 409 | Conflict: a file or folder with that name exists |
| 429 | Too many login attempts (5 per minute per IP) |
| 502 | Pi-hole could not be reached or rejected the request |

## Authentication

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/auth/status` | – | `{ "setupRequired", "authenticated", "username" }` (public) |
| POST | `/api/auth/setup` | `{ "username", "password" }` | `201` + cookie. Only while no account exists, otherwise `409`. |
| POST | `/api/auth/login` | `{ "username", "password", "rememberMe" }` | `200 { "username" }` + cookie |
| POST | `/api/auth/logout` | – | `204` |
| GET | `/api/auth/me` | – | `200 { "username" }` |
| POST | `/api/auth/password` | `{ "currentPassword", "newPassword" }` | `204` |

- Usernames: 3–32 characters (`A–Z a–z 0–9 . _ -`), case-insensitive. Passwords: 8–128 characters.
- Passwords are stored as PBKDF2 hashes (ASP.NET Core Identity format v3).
- Setup and login share the rate limit (`Auth:LoginAttemptsPerMinute`, default 5 per IP).
- `rememberMe: true` makes the cookie persistent (lifetime `Auth:SessionLifetimeHours`, sliding).

## Settings

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/settings/pihole` | – | `{ "baseUrl", "hasPassword", "source": "None" \| "App" \| "Environment" }` (the password is never returned) |
| PUT | `/api/settings/pihole` | `{ "baseUrl", "password" }` | Saves. `password: null` keeps the saved one, `""` removes it. |
| DELETE | `/api/settings/pihole` | – | `204`, disconnects Pi-hole |
| POST | `/api/settings/pihole/test` | `{ "baseUrl", "password" }` | Ad blocker status for the given values, without saving (`password: null` = use the saved one) |

The Pi-hole password is encrypted with ASP.NET Core Data Protection; the key ring is stored in `data/keys` next to the database.

## System monitoring

| Method | Path | Result |
|---|---|---|
| GET | `/api/system/metrics/current` | Latest persisted sample (`Success` or `PartialSuccess`) |
| GET | `/api/system/metrics/historical?start&end&minIntervalSeconds` | Time-bucketed summaries (min/avg/max), range ≤ 7 days, buckets ≥ 5 s |
| GET | `/api/system/overview` | Live host info: hostname, OS, uptime, load average, memory, CPU temperature, disk usage |

Example `GET /api/system/overview`:

```json
{
  "hostname": "homeserver",
  "operatingSystem": "Ubuntu 24.04.2 LTS",
  "architecture": "x64",
  "processorCount": 8,
  "uptimeSeconds": 2849.92,
  "loadAverage": { "oneMinute": 0.75, "fiveMinutes": 0.88, "fifteenMinutes": 0.93 },
  "memory": { "totalMemoryBytes": 16537825280, "usedMemoryBytes": 12266450944, "availableMemoryBytes": 4271374336, "ramUsagePercent": 74.17 },
  "cpuTemperatureCelsius": 63,
  "disk": { "mountPoint": "/", "totalBytes": 289156972544, "usedBytes": 270948114432, "availableBytes": 3445694464, "usagePercent": 93.7 },
  "collectedAtUtc": "2026-10-15T11:10:25.168Z"
}
```

The temperature comes from `/sys/class/thermal` and `/sys/class/hwmon`. Known CPU sensors are preferred: `x86_pkg_temp`, `coretemp`, `k10temp`, `cpu-thermal` (Raspberry Pi) and others. `null` means no sensor was found or collection is disabled.

## Files & media

All paths are relative to `FileManager:RootPath` and start with `/`.

| Method | Path | Result |
|---|---|---|
| GET | `/api/files?path=/Movies` | Directory listing (folders first, hidden files omitted) |
| GET | `/api/files/content?path=/Movies/a.mp4[&download=true]` | File content; supports `Range` (206) for video seeking |
| POST | `/api/files/upload?path=/Movies` | `multipart/form-data` with one or more files → `201` |
| POST | `/api/files/directories` | `{ "path": "/", "name": "Movies" }` → `201` |
| DELETE | `/api/files?path=/Movies/a.mp4` | `204` (folders are deleted recursively; the root cannot be deleted) |

Each entry has `name`, `path`, `kind` (`Directory`, `Video`, `Audio`, `Image`, `Document`, `Archive`, `Code`, `Other`), `sizeBytes`, `modifiedAtUtc`, and `isPlayable` (playable natively in browsers: MP4/M4V, WebM, OGV, MOV, MP3, M4A, OGG, WAV, FLAC, AAC, Opus).

## Ad blocking (Pi-hole v6)

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/adblock` | – | Status (always `200`; see `configured` / `reachable`) |
| POST | `/api/adblock/blocking` | `{ "enabled": false, "durationSeconds": 300 }` | New status; `durationSeconds` is optional (1 s – 24 h) |

```json
{
  "configured": true,
  "reachable": true,
  "blockingEnabled": true,
  "blockingTimerSeconds": null,
  "totalQueries": 41234,
  "blockedQueries": 12403,
  "percentBlocked": 30.08,
  "activeClients": 18,
  "domainsOnBlocklist": 174832,
  "message": null,
  "checkedAtUtc": "2026-10-15T11:16:44.857Z"
}
```

NodePilot logs in to Pi-hole with `POST /api/auth`, caches the session id (`X-FTL-SID`) and logs in again automatically when the session expires.

## Health

`GET /health` (public) returns the aggregated status of `system_status`, `database_status` and `metrics_collector`.
