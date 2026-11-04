# NodePilot: work plan (~6 h)

Current state: 116/116 backend tests pass, and `eslint` and `tsc` are clean on the web app.

| # | Task | Type | Estimate |
|---|---|---|---|
| 0 | Housekeeping | fix | 15 min |
| 1 | Health checks that don't fail when collection is disabled | bugfix | 45 min |
| 2 | Store session encryption keys in a known place | fix | 25 min |
| 3 | Make `MaxStoredSamples` do something (or delete it) | bugfix / cleanup | 30 min |
| 4 | Get the real client IP behind a reverse proxy | fix | 35 min |
| 5 | Use the configured alert thresholds in the UI | feature / refactor | 50 min |
| 6 | Warn when the dashboard shows old data | feature | 35 min |
| 7 | Rename and move in the file manager | feature | 75 min |
| 8 | Native deployment with systemd | feature / docs | 40 min |
| 9 | Handle upload name clashes (replace / keep both) | feature | 40 min (stretch) |

Do 0–4 first; they are short and fix real defects. Tasks 5–7 are the main feature work. Task 9 is for when time is left.

---

## 0. Housekeeping (15 min)

Two small things that will get in the way otherwise.

- **`apps/web/next.config.ts` is broken (uncommitted change).** The file now has both `export default nextConfig` and `module.exports = { allowedDevOrigins: [...] }`. These are two different config objects, and Next.js uses only one of them. You lose either `output: "standalone"` or `allowedDevOrigins`.
  - **Fix:** put `allowedDevOrigins` into the existing `nextConfig` object.
  - **Better:** don't hardcode the IP. Read it from an env var such as `NODEPILOT_DEV_ORIGINS` (comma-separated).
- **Vulnerable NuGet packages.** `dotnet test` warns (NU1903) about:
  - `Microsoft.OpenApi` 2.0.0 (GHSA-v5pm-xwqc-g5wc)
  - `SQLitePCLRaw.lib.e_sqlite3` 2.1.11 (GHSA-2m69-gcr7-jv3q)

  Upgrade the packages that bring them in, or add direct `PackageReference`s to patched versions. Then re-run `dotnet test`.

---

## 1. Health checks that don't fail when collection is disabled (45 min)

**Problem.** `/health` runs three checks: `system_status`, `database_status` and `metrics_collector`. When any of them fails, the endpoint returns **503**. `MetricsCollectorReadinessCheck` reports *Unhealthy* when the sampler is not running. The sampler is never running in these cases:

- `Monitoring:Collection:Enabled = false` (you deliberately turned collection off)
- the backend runs on a non-Linux dev machine (every read fails, so there is never a "last successful collection")

In both cases NodePilot reports itself as broken forever, although the API works fine. Anything that watches `/health` (Uptime Kuma, a systemd watchdog script, a reverse proxy health probe) will alert all the time.

There is a second problem: liveness and readiness are mixed together.
- **Liveness:** is the process alive? This decides whether it gets restarted.
- **Readiness:** is it fully working? This decides whether to send traffic or raise a warning.

The checks already carry `ready` / `general` tags (`apps/backend/src/NodePilot.Api/DependencyInjection.cs`), but only one endpoint exists.

**What to do**

1. In `MetricsCollectorReadinessCheck`, read `IMonitoringSettingsProvider.Current.Collection.Enabled`. When collection is disabled, return `HealthCheckResult.Healthy("Metrics collection is disabled.")` with `data["enabled"] = false`.
2. Decide what a non-Linux host should report. **Degraded** fits best: the app works, but a feature is missing. Degraded maps to HTTP 200 by default, so monitors stay green while the JSON still shows the problem.
3. Split the endpoint in `Program.cs`:
   - `/health/live`: `Predicate = _ => false`. No checks run, so it answers 200 whenever the process responds.
   - `/health/ready`: `Predicate = c => c.Tags.Contains("ready")`.
   - `/health`: keep it with all checks, for backwards compatibility and the Postman collection.
4. Update `documents/features/health-checks.md` (the "Limitations" section describes this exact bug), `documents/api.md` and the README.

**Tests:** in `NodePilotApiFactory`, set `Monitoring:Collection:Enabled=false` and check that `/health` returns 200 and the collector entry is Healthy. Add a unit test for the check itself, giving it a `MetricsCollectorState` that was never started.

---

## 2. Store session encryption keys in a known place (25 min)

**Background: what Data Protection is.** On login, the `nodepilot.session` cookie isn't a random ID looked up in a database. It *contains* the user's identity and the expiry time, encrypted and signed by ASP.NET Core **Data Protection**. To read the cookie on later requests, the server needs the same key ring that encrypted it. If the keys disappear, every existing cookie becomes unreadable and everyone is signed out.

**Where the keys go now.** The code never configures Data Protection (`grep DataProtection` finds nothing), so ASP.NET Core uses its defaults. On Linux that is:
- `~/.aspnet/DataProtection-Keys` of the user running the backend, if that user has a writable home directory;
- otherwise **memory only**, with a startup warning. The keys are then lost on every restart.

When run natively as a systemd service under a dedicated system user (task 8), the user often has no home directory. Every backend restart or update then logs everyone out. The keys also end up in a place you'd never think of when backing up or moving the app to another machine.

**What to do**

1. Add a setting such as `Auth:KeysPath`. Default it to a folder next to the SQLite database, e.g. `data/keys`, using the same `Path.GetFullPath` logic as `DatabaseExtensions.EnsureSqliteDirectoryExists`.
2. In `AddCookieAuthentication`:
   ```csharp
   services.AddDataProtection()
       .SetApplicationName("NodePilot")
       .PersistKeysToFileSystem(new DirectoryInfo(keysPath));
   ```
   `SetApplicationName` keeps the keys valid even when the app is started from a different folder.
3. Create the directory at startup. Ideally make it readable only by the service user (`chmod 700`).
4. In `documents/features/authentication.md`, replace the "sessions do not survive a container rebuild" limitation with: "keys live in `data/keys`; deleting that folder signs everyone out". This also gives you an easy "log out all devices" procedure.

**Test:** an integration test that logs in, builds a *second* `WebApplicationFactory` pointing at the same keys folder, and checks that the first factory's cookie still works on `/api/auth/me`.

---

## 3. Make `MaxStoredSamples` do something, or delete it (30 min)

**Problem.** `Monitoring:Retention:MaxStoredSamples` (250 000) is in `appsettings.json` and `MonitoringSettingsValidator` requires it, but nothing reads it. Cleanup (`MetricsCleanupBackgroundService` → `MetricsRetentionService`) only deletes rows older than `MaxMetricAgeHours`. A setting that is validated but ignored is misleading. Someone who changes it would expect the database size to change.

For scale: at the default 15 s interval, 72 h of history is about 17 300 rows. The cap only matters if someone sets a short interval with a long retention, e.g. 5 s for 30 days is about 518 000 rows. That makes it a safety cap, not a main setting.

**Option A: implement it (recommended)**
1. Add `Task<int> DeleteExceedingCountAsync(int maxRows, CancellationToken ct)` to `ISystemMetricsRepository`. In SQLite this is one statement:
   ```sql
   DELETE FROM system_metrics
   WHERE id NOT IN (SELECT id FROM system_metrics ORDER BY collected_at_utc DESC LIMIT @max)
   ```
   You can also do it in EF: find the timestamp of the N-th newest row, then `ExecuteDeleteAsync` everything older.
2. In `MetricsRetentionService.ApplyRetentionAsync`, run the age-based delete first, then the count cap. Return both counts in `RetentionResult` and log them.
3. Pass the setting through `MetricsCleanupBackgroundService` the same way as `MaxMetricAgeHours`.

**Option B: remove it.** Delete it from `RetentionSettings`, the validator, `appsettings.json` and the docs.

**Small extra fix in the same file.** `MetricsCleanupBackgroundService` reads `settings` once per loop. When cleanup is disabled it still wakes up every `CleanupIntervalMinutes` only to log "skipped". Log once and return instead, like `MetricsSamplingBackgroundService` does.

**Test (option A):** insert N + 10 rows with an in-memory SQLite database, run retention, and check that exactly N rows remain and that the newest ones were kept.

---

## 4. Get the real client IP behind a reverse proxy (35 min)

**Background.** Without Docker, the natural way to give NodePilot one address with HTTPS is a reverse proxy (Caddy, nginx, Traefik) in front of the backend and the web app, for example `https://nodepilot.home` → `localhost:5000` and `localhost:3000`. It also removes the "two ports must be open" limitation from `web-client.md`.

With a proxy in front, the backend's TCP connection always comes from the **proxy** (`127.0.0.1`), not from your phone or laptop. The proxy passes the real client's details in headers:
- `X-Forwarded-For: 192.168.1.42`: the real client IP
- `X-Forwarded-Proto: https`: the scheme the client used

ASP.NET Core ignores these headers unless you turn on the **Forwarded Headers middleware**. NodePilot doesn't, which causes two bugs:

1. **Shared login rate limit.** `RateLimitingExtensions` partitions by `context.Connection.RemoteIpAddress`, and behind a proxy that is always `127.0.0.1`. Five wrong passwords from *any* device lock out *every* device for a minute.
2. **The cookie is not marked `Secure`.** The cookie uses `CookieSecurePolicy.SameAsRequest`. The proxy talks to the backend over plain HTTP, so the backend thinks the request is HTTP and never sets `Secure`, even though the browser is on HTTPS.

**Why not just trust the header always?** Anyone can send `X-Forwarded-For: 1.2.3.4` themselves. If the backend trusts it from every sender, an attacker rotates the header and gets unlimited login attempts. Only trust it when the connection comes from a known proxy.

**What to do**

1. Add a config section with the feature off by default:
   ```json
   "ReverseProxy": { "Enabled": false, "KnownProxies": [ "127.0.0.1", "::1" ] }
   ```
2. When it is enabled, configure `ForwardedHeadersOptions` in `AddPresentation`:
   - `ForwardedHeaders = XForwardedFor | XForwardedProto`
   - fill `KnownProxies` from the config
   - set `ForwardLimit = 1`
3. Call `app.UseForwardedHeaders()` **first** in `Program.cs`, before `UseCors`, `UseAuthentication` and `UseRateLimiter`. Order matters: the rate limiter must already see the rewritten IP.
4. Document a minimal Caddy or nginx example in the README and update the two limitations in `authentication.md` (shared limit and `Secure`).

**Tests:** an integration test with the setting enabled. `TestServer`'s remote IP is not in `KnownProxies` by default, so add the test server's address in the test config. Send 5 failed logins with `X-Forwarded-For: 10.0.0.1`, then check that a login with `X-Forwarded-For: 10.0.0.2` is *not* rejected with 429. Add a second test: with the setting disabled, the header is ignored.

---

## 5. Use the configured alert thresholds in the UI (50 min)

**Problem.** There are two sets of thresholds, and they disagree:

- **Backend config** `Monitoring:Alerts`: CPU 85 %, RAM 90 %, disk 90 %, temperature 80 °C. They are validated by `MonitoringSettingsValidator` and then **never used** (the comment in `MonitoringSettings.cs` even says `// NOT USED`).
- **Frontend**, hardcoded in `apps/web/src/lib/format.ts:82-94`: usage warns at 70 % and is critical at 90 %; temperature warns at 70 °C and is critical at 85 °C.

Changing `appsettings.json` has no effect on what the dashboard colors red. Each threshold should be set in one place, on the server.

**What to do**

*Backend*
1. Rename or extend `AlertingSettings` so each metric has a **warning and a critical** level, since the UI has three states (`ok`/`warn`/`critical`):
   ```json
   "Alerts": {
     "Cpu":         { "Warning": 70, "Critical": 90 },
     "Ram":         { "Warning": 80, "Critical": 90 },
     "Disk":        { "Warning": 80, "Critical": 90 },
     "Temperature": { "Warning": 70, "Critical": 85 }
   }
   ```
   In the validator, require `0 < Warning < Critical <= 100` for percentages and a sensible range for °C. Remove `NotificationsEnabled` unless you plan to build notifications.
2. Expose the thresholds. The simplest way is to add `thresholds` to `SystemOverview`, since the dashboard already polls it every 10 s. A cleaner way is a separate `GET /api/system/settings` that the client loads once.
3. Remove the stale `// USED` / `// NOT USED` comments in `CollectionSettings.cs` and `MonitoringSettings.cs`.

*Frontend*

4. Add the new types in `lib/api/types.ts`.
5. Change `usageSeverity(percent)` and `temperatureSeverity(celsius)` into one `severity(value, threshold)`. Keep the current numbers as a fallback while the overview hasn't loaded yet.
6. Update the four call sites in `app/(app)/page.tsx` (lines ~89–124).
7. Optional: show the threshold as a tick mark on the gauge arc in `metric-gauge.tsx`.

**Tests:** validator tests for invalid pairs (warning ≥ critical). If you add an endpoint, add an integration test that it returns the configured values.

---

## 6. Warn when the dashboard shows old data (35 min)

**Problem.** The CPU and RAM gauges show `GET /api/system/metrics/current`, which is the **latest successful** sample in the database. If sampling starts failing (for example `/proc` can't be read) or the sampler crashes, that endpoint keeps returning the same old row. The dashboard keeps showing, say, "CPU 12 %" from an hour ago as if it were live. `system-monitoring.md` lists this as a limitation.

Every response already includes `collectedAtUtc`, so the frontend has all it needs.

**What to do**

1. Decide the staleness threshold. It should match the health check: `max(30 s, 3 × IntervalSeconds)`. The frontend doesn't know the interval, so either:
   - add `samplingIntervalSeconds` to the overview or settings response (this pairs well with task 5), or
   - use a fixed 60 s on the client to start with.
2. In `app/(app)/page.tsx`, compute `ageMs = now - Date.parse(metric.collectedAtUtc)`. Update `now` every few seconds with a small `useNow(5000)` hook so the age grows even when polling returns the same row.
3. When the data is stale:
   - show a small amber "Stale · updated 4 min ago" badge on the CPU and RAM gauges. Put a `stale?: boolean` / `updatedAt?: string` prop on `MetricGauge` and reuse the severity dot styling;
   - dim the gauge (e.g. `opacity-60`) so it doesn't look live.
4. Put the relative-time formatting ("12 s ago", "4 min ago") in `lib/format.ts` next to the other helpers.
5. Optional: if the backend returns 404 (no successful sample ever), show "Waiting for first sample…" instead of a generic error.

**How to check it:** run the backend, then stop sampling by setting `Collection:Enabled=false` and restarting. The DB keeps the old rows, so the badge should appear after the threshold.

---

## 7. Rename and move in the file manager (75 min)

**Problem.** `files-and-media.md` lists "no rename, move, copy". Right now the only way to fix a typo in a file name is to download, delete and re-upload it, which is painful for multi-GB videos.

**Backend (~40 min)**

1. Add to `IFileManagerService` and `FileManagerService`:
   ```csharp
   ErrorOr<FileEntry> Rename(string? path, string? newName);
   ErrorOr<FileEntry> Move(string? path, string? destinationDirectory);
   ```
2. Both must use the same safety rules as everything else:
   - resolve the source with `SafePathResolver.Resolve`; it must exist and must not be the root (`RootDeletionForbidden` or a new `RootModificationForbidden`);
   - check `newName` with `SafePathResolver.IsValidName`: no `/`, no `..`, no leading `.` (hidden files aren't allowed);
   - resolve the destination folder with `SafePathResolver.Resolve`; it must be a directory inside the root;
   - **moving a folder into itself or one of its own subfolders must fail.** Check that `destFull` doesn't start with `sourceFull + Path.DirectorySeparatorChar`;
   - if the target name exists → `FileErrors.AlreadyExists` (409);
   - use `File.Move` / `Directory.Move`, both without overwrite. Catch `IOException` and `UnauthorizedAccessException` → `IoFailure` / `AccessDenied`.
   - Note: `Directory.Move` fails across filesystems (e.g. root on one disk, subfolder mounted from another). Return a clear error for that; don't silently copy.
3. Add the endpoints to `FilesController`:
   - `POST /api/files/rename` `{ "path": "...", "newName": "..." }` → 200 + `FileEntry`
   - `POST /api/files/move` `{ "path": "...", "destination": "..." }` → 200 + `FileEntry`

**Tests (~15 min).** Copy the style of `FileManagerServiceTests` and `ApiTests`:
- rename success; rename to an existing name → 409; invalid name (`../x`, `.hidden`, `a/b`) → 400;
- move into a subfolder; move a folder into its own child → 400; destination outside the root or through a symlink → 403;
- the root can't be renamed or moved.

**Frontend (~20 min)**
1. Add `rename(path, newName)` and `move(path, destination)` to `filesApi` in `lib/api/endpoints.ts`.
2. **Rename:** add a pencil action to each row in `file-browser.tsx`, next to delete. Open a dialog modelled on `new-folder-dialog.tsx`, with the current name pre-filled and the part before the extension selected.
3. **Move:** a simple first version is a dialog with a breadcrumb folder picker that reuses `filesApi.list`. If time is short, ship rename only and leave move as API-only.
4. After success, call `refresh()` on the listing and show a toast.
5. Update `documents/api.md` and the limitations in `files-and-media.md`.

---

## 8. Native deployment with systemd (40 min)

**Why.** The README only explains `docker compose up` and `dotnet run` / `npm run dev`. The dev commands aren't suitable for leaving NodePilot running on the server. Since Docker is not the target, the README needs a real "install on the host" path. This task also fixes a risky default that matters much more without Docker.

**The risky default.** Commit `d63a8dc` changed `FileManager:RootPath` from `data/files` to `/`. In Docker this was hidden, because compose overrides it with `/files`. Run natively, the file manager can browse, upload into and **delete from the whole host filesystem**, limited only by the permissions of the user running the backend. If the backend runs as root, that means everything.

**What to do**

1. **Root path.**
   - Set `appsettings.json` back to a safe default (`data/files`). If you want `/` for local development, put it in `appsettings.Development.json`.
   - Add a startup check that refuses `/` (and optionally `/etc`, `/boot`, …) unless `FileManager:AllowSystemRoot=true` is set explicitly.
   - Add a unit test for the check.
2. **Publish scripts.**
   - Backend: `dotnet publish -c Release -o /opt/nodepilot/backend`.
   - Web: `npm run build`, then copy `.next/standalone`, `.next/static` and `public` to `/opt/nodepilot/web` (the standard Next.js standalone layout).
   - Put both in a `scripts/publish.sh`.
3. **systemd units**, e.g. in `deploy/systemd/`:
   - `nodepilot-backend.service`:
     - `User=nodepilot`
     - `WorkingDirectory=/var/lib/nodepilot`, so `data/nodepilot.db` and `data/keys` from task 2 land there
     - `EnvironmentFile=/etc/nodepilot/nodepilot.env`
     - `ExecStart=/opt/nodepilot/backend/NodePilot.Api`
     - `Restart=on-failure`
   - `nodepilot-web.service`: `ExecStart=/usr/bin/node /opt/nodepilot/web/server.js`, with `PORT=3000`.
   - Hardening that costs nothing: `NoNewPrivileges=true`, `ProtectSystem=strict`, `ReadWritePaths=/var/lib/nodepilot <files root>`, `PrivateTmp=true`.
4. **Check that metrics still work as a non-root user.** `/proc/stat`, `/proc/meminfo` and `/sys/class/thermal` are readable by everyone, but confirm the temperature sensor on your board.
5. **Docs.**
   - Add a "Native install" section to the README.
   - Note that `NEXT_PUBLIC_API_URL` is baked in at `npm run build` time.
   - In `system-monitoring.md`, mark the Docker-specific limitations (hostname = container ID, `/` = container filesystem) as "Docker only". Natively these values are correct.

---

## 9. Handle upload name clashes: replace or keep both (stretch, 40 min)

**Problem.** Uploading a file whose name already exists fails with 409 *already exists*, and the docs tell you to "delete the old file first". When you upload a whole batch where one name clashes, `FilesController.UploadAsync` stops at the first error. Files before it are saved and files after it are not.

**What to do**

1. Add `?onConflict=fail|replace|rename` to `POST /api/files/upload`, defaulting to `fail` so nothing changes for existing clients.
   - `replace`: write to a temp file in the same folder, then `File.Move(temp, target, overwrite: true)`. A failed upload then never destroys the old file. Directories are never replaced.
   - `rename`: pick `name (1).ext`, `name (2).ext`, … like browsers do.
2. Make the batch behaviour explicit: keep going and return a per-file result list (`created` / `failed` with a reason) instead of stopping at the first error.
3. In the frontend `upload-queue.tsx`, when a file gets 409, show **Replace** / **Keep both** / **Skip** buttons on that queue item. Choosing one retries just that file with the matching `onConflict`.
4. Tests: one per mode, plus "a failed replace keeps the original file".
