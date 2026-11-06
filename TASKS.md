# NodePilot: work plan

| # | Task | Type | Estimate |
|---|---|---|---|
| 1 | ~~Store session encryption keys in a known place~~ (done), leftovers | fix | 10 min |
| 2 | Get the real client IP behind a reverse proxy | fix | 35 min |
| 3 | Use the configured alert thresholds in the UI | feature / refactor | 50 min |
| 4 | Warn when the dashboard shows old data | feature | 35 min |
| 5 | Rename and move in the file manager | feature | 75 min |
| 6 | Native deployment with systemd | feature / docs | 40 min |
| 7 | Handle upload name clashes (replace / keep both) | feature | 40 min (stretch) |
| 8 | End other sessions when the password changes | security fix | 25 min |
| 9 | Apply monitoring settings changes consistently | bugfix | 35 min |

---

2(nginx) 1 6 9 8 7 4 5 3

## 1. Store session encryption keys in a known place: done, small leftovers (10 min)

**Done on `main`.** `AddInfrastructure` now calls `AddDataProtection().SetApplicationName("NodePilot").PersistKeysToFileSystem(<data dir>/keys)`, where the data dir is the folder of the SQLite database (`DatabaseExtensions.ResolveDataDirectory`). The same key ring also encrypts the Pi-hole password stored in `app_settings`. In Docker the folder is on the `nodepilot-data` volume, and the README and `authentication.md` already say to back up `data/` as a whole.

**Leftovers (optional)**

1. **Permissions.** `data/keys` is created with the default mode (`755` here). The key files are what decrypt every session cookie and the Pi-hole password, so make the folder readable only by the service user: create it up front and `File.SetUnixFileMode(path, UserRead | UserWrite | UserExecute)` on Linux. This matters most for the native install (task 6).
2. **Test** that keys survive a restart: an integration test that logs in, builds a *second* `WebApplicationFactory` pointing at the same database/keys folder, and checks that the first factory's cookie still works on `/api/auth/me`.

---

## 2. Get the real client IP behind a reverse proxy (35 min)

**Background.** Without Docker, the natural way to give NodePilot one address with HTTPS is a reverse proxy (Caddy, nginx, Traefik) in front of the backend and the web app, for example `https://nodepilot.home` → `localhost:5000` and `localhost:3000`. It also removes the "two ports must be open" limitation from `web-client.md`.

With a proxy in front, the backend's TCP connection always comes from the **proxy** (`127.0.0.1`), not from your phone or laptop. The proxy passes the real client's details in headers:
- `X-Forwarded-For: 192.168.1.42`: the real client IP
- `X-Forwarded-Proto: https`: the scheme the client used

ASP.NET Core ignores these headers unless you turn on the **Forwarded Headers middleware**. NodePilot doesn't, which causes two bugs:

1. **Shared rate limit.** The `login` limiter in `RateLimitingExtensions` partitions by `context.Connection.RemoteIpAddress`, and behind a proxy that is always `127.0.0.1`. It now covers **setup, login and invite acceptance** (`Auth:LoginAttemptsPerMinute`, default 5), so five wrong passwords from *any* device lock out sign-in *and* new invitees on *every* device for a minute.
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
5. Optional, from `auth-architecture-proposal.md` §6: add a second limiter partitioned **per username** for login, so a proxy that is misconfigured still can't be used for unlimited guessing of one account.

**Tests:** an integration test with the setting enabled. `TestServer`'s remote IP is not in `KnownProxies` by default, so add the test server's address in the test config. Send 5 failed logins with `X-Forwarded-For: 10.0.0.1`, then check that a login with `X-Forwarded-For: 10.0.0.2` is *not* rejected with 429. Add a second test: with the setting disabled, the header is ignored.

---

## 3. Use the configured alert thresholds in the UI (50 min)

**Problem.** There are two sets of thresholds, and they disagree:

- **Backend config** `Monitoring:Alerts`: CPU 85 %, RAM 90 %, disk 90 %, temperature 80 °C (`appsettings.Development.json`: 70 / 75 / 85 / 70). They are validated by `MonitoringSettingsValidator` and then **never used** (the comment in `MonitoringSettings.cs` even says `// NOT USED`).
- **Frontend**, hardcoded in `apps/web/src/lib/format.ts` (`usageSeverity` / `temperatureSeverity`, end of the file): usage warns at 70 % and is critical at 90 %; temperature warns at 70 °C and is critical at 85 °C.

Changing `appsettings.json` has no effect on which channel card turns saffron or how many "warnings" the dashboard headline counts. Each threshold should be set in one place, on the server.

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
   In the validator, require `0 < Warning < Critical <= 100` for percentages and a sensible range for °C. Remove `NotificationsEnabled` unless you plan to build notifications. Update both `appsettings*.json` files (`ErrorOnUnknownConfiguration` will stop the app on any leftover old key).
2. Expose the thresholds. The simplest way is to add `thresholds` to `SystemOverview`, since the dashboard already polls it every 10 s. A cleaner way is a separate `GET /api/system/settings` that the client loads once.
3. Remove the stale `// USED` / `// NOT USED` comments in `CollectionSettings.cs` and `MonitoringSettings.cs`.

*Frontend*

4. Add the new types in `lib/api/types.ts`.
5. Change `usageSeverity(percent)` and `temperatureSeverity(celsius)` into one `severity(value, threshold)`. Keep the current numbers as a fallback while the overview hasn't loaded yet.
6. Update the `severities` array in `app/(app)/page.tsx` (it feeds both the four `MetricMeter` cards and the "N warnings" headline).
7. Optional: mark the warning threshold on the 10-segment meter in `components/dashboard/metric-meter.tsx`, e.g. a notch above the segment where it starts.

**Tests:** validator tests for invalid pairs (warning ≥ critical). If you add an endpoint, add an integration test that it returns the configured values.

---

## 4. Warn when the dashboard shows old data (35 min)

**Problem.** The CPU and Memory cards show `GET /api/system/metrics/current`, which is the **latest successful** sample in the database. If sampling starts failing (for example `/proc` can't be read) or the sampler crashes, that endpoint keeps returning the same old row. The dashboard keeps showing, say, "CPU 12 %" from an hour ago as if it were live, and the blinking *Live* badge in the page header says the opposite of the truth. `system-monitoring.md` lists this as a limitation.

Every response already includes `collectedAtUtc`, so the frontend has all it needs.

**What to do**

1. Decide the staleness threshold. It should match the health check: `max(30 s, 3 × IntervalSeconds)`. The frontend doesn't know the interval, so either:
   - add `samplingIntervalSeconds` to the overview or settings response (this pairs well with task 3), or
   - use a fixed 60 s on the client to start with.
2. In `app/(app)/page.tsx`, compute `ageMs = now - Date.parse(metric.collectedAtUtc)`. Update `now` every few seconds with a small `useNow(5000)` hook so the age grows even when polling returns the same row.
3. When the data is stale:
   - show a small "Stale · updated 4 min ago" label on the CPU and Memory cards. Add `stale?: boolean` / `updatedAt?: string` props to `MetricMeter` and reuse its lamp styling (`led bg-accent`);
   - dim the reading (e.g. `opacity-60`) so it doesn't look live;
   - switch the header badge from *Live* to *Stale* (and stop the blink).
4. For the relative time, reuse `formatRelative` in `lib/format.ts` (it already returns "4 minutes ago" / "just now"). Add a shorter variant there only if the card needs "4 min ago".
5. Optional: if the backend returns 404 (no successful sample ever), show "Waiting for first sample…" instead of a generic error.

**How to check it:** run the backend, then stop sampling by setting `Collection:Enabled=false` and restarting. The DB keeps the old rows, so the label should appear after the threshold.

---

## 5. Rename and move in the file manager (75 min)

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
   - resolve the destination folder with `SafePathResolver.Resolve`; it must be a directory inside the root, and pass the same symlink check (`IsReallyWithinRoot`) as listing and upload;
   - **moving a folder into itself or one of its own subfolders must fail.** Check that `destFull` doesn't start with `sourceFull + Path.DirectorySeparatorChar`;
   - if the target name exists → `FileErrors.AlreadyExists` (409);
   - use `File.Move` / `Directory.Move`, both without overwrite. Catch `IOException` and `UnauthorizedAccessException` → `IoFailure` / `AccessDenied`.
   - Note: `Directory.Move` fails across filesystems (e.g. root on one disk, subfolder mounted from another). Return a clear error for that; don't silently copy.
3. Add the endpoints to `FilesController` (any signed-in user, like the other file endpoints):
   - `POST /api/files/rename` `{ "path": "...", "newName": "..." }` → 200 + `FileEntry`
   - `POST /api/files/move` `{ "path": "...", "destination": "..." }` → 200 + `FileEntry`

**Tests (~15 min).** Copy the style of `FileManagerServiceTests` and `ApiTests`:
- rename success; rename to an existing name → 409; invalid name (`../x`, `.hidden`, `a/b`) → 400;
- move into a subfolder; move a folder into its own child → 400; destination outside the root or through a symlink → 403;
- the root can't be renamed or moved.

**Frontend (~20 min)**

1. Add `rename(path, newName)` and `move(path, destination)` to `filesApi` in `lib/api/endpoints.ts`.
2. **Rename:** add a pencil action to each row in `file-browser.tsx`, next to delete. Open a dialog modelled on `new-folder-dialog.tsx` (it uses the shared `Modal` and `Field` components), with the current name pre-filled and the part before the extension selected.
3. **Move:** a simple first version is a dialog with a breadcrumb folder picker that reuses `filesApi.list`. If time is short, ship rename only and leave move as API-only.
4. After success, call `refresh()` on the listing (`usePolling` returns it) and show a toast.
5. Update `documents/api.md` and the limitations in `files-and-media.md`.

---

## 6. Native deployment with systemd (40 min)

**Why.** The README explains `./start.sh` (development servers), `docker compose up` and running the parts separately with `dotnet run` / `npm run dev`. None of these is a way to leave NodePilot running on the server without Docker. The README needs a real "install on the host" path.

**Root path.** ~~Commit `d63a8dc` changed `FileManager:RootPath` to `/`.~~ That was reverted in `eed357b`; the default is `data/files` again. What is still worth adding, because a native install runs with the service user's real filesystem access:
- a startup check that refuses `/` (and optionally `/etc`, `/boot`, …) unless `FileManager:AllowSystemRoot=true` is set explicitly;
- a unit test for the check.

**What to do**

1. **Publish scripts.**
   - Backend: `dotnet publish -c Release -o /opt/nodepilot/backend`.
   - Web: `npm run build`, then copy `.next/standalone`, `.next/static` and `public` to `/opt/nodepilot/web` (the standard Next.js standalone layout).
   - Put both in a `scripts/publish.sh`.
2. **systemd units**, e.g. in `deploy/systemd/`:
   - `nodepilot-backend.service`:
     - `User=nodepilot`
     - `WorkingDirectory=/var/lib/nodepilot`, so `data/nodepilot.db` and `data/keys` land there (both are resolved relative to the working directory unless `NODE_PILOT_DB_CONNECTION_STRING` is set)
     - `EnvironmentFile=-/etc/nodepilot/nodepilot.env` (optional: no configuration is required any more; accounts and Pi-hole are set up in the app)
     - `Environment=FileManager__RootPath=/srv/media` (or wherever the shared folder is)
     - `ExecStart=/opt/nodepilot/backend/NodePilot.Api`
     - `Restart=on-failure`
   - `nodepilot-web.service`: `ExecStart=/usr/bin/node /opt/nodepilot/web/server.js`, with `PORT=3000`.
   - Hardening that costs nothing: `NoNewPrivileges=true`, `ProtectSystem=strict`, `ReadWritePaths=/var/lib/nodepilot <files root>`, `PrivateTmp=true`, `UMask=0077`.
   - Note: `PrivateTmp` is fine for uploads, but multipart buffering writes the whole upload to the temp dir first (`files-and-media.md`), so the private `/tmp` needs space for the largest file.
3. **Check that metrics still work as a non-root user.** `/proc/stat`, `/proc/meminfo` and `/sys/class/thermal` are readable by everyone, but confirm the temperature sensor on your board.
4. **First start.** After `systemctl start`, the setup wizard is open to anyone on the LAN until the admin account exists (see `auth-architecture-proposal.md` §2.2 for a setup code). Say in the docs to open the panel right away.
5. **Docs.**
   - Add a "Native install" section to the README.
   - Note that `NEXT_PUBLIC_API_URL` is baked in at `npm run build` time.
   - In `system-monitoring.md`, mark the Docker-specific limitations (hostname = container ID, `/` = container filesystem) as "Docker only". Natively these values are correct.
   - In `files-and-media.md`, the "file ownership in Docker" limitation (`root`-owned uploads) doesn't apply natively: files belong to the service user.

---

## 7. Handle upload name clashes: replace or keep both (stretch, 40 min)

**Problem.** Uploading a file whose name already exists fails with 409 *already exists*, and the docs tell you to "delete the old file first". When you upload a whole batch where one name clashes, `FilesController.UploadAsync` stops at the first error. Files before it are saved and files after it are not. (The web client sends one file per request, so this mostly hits API users.)

**What to do**

1. Add `?onConflict=fail|replace|rename` to `POST /api/files/upload`, defaulting to `fail` so nothing changes for existing clients.
   - `replace`: write to a temp file in the same folder, then `File.Move(temp, target, overwrite: true)`. A failed upload then never destroys the old file. Directories are never replaced.
   - `rename`: pick `name (1).ext`, `name (2).ext`, … like browsers do.
2. Make the batch behaviour explicit: keep going and return a per-file result list (`created` / `failed` with a reason) instead of stopping at the first error.
3. In the frontend `upload-queue.tsx`, when a file gets 409, show **Replace** / **Keep both** / **Skip** buttons on that queue item. Choosing one retries just that file with the matching `onConflict`.
4. Tests: one per mode, plus "a failed replace keeps the original file".

Note: with members, *Replace* lets any household member overwrite anyone's file. That is consistent with delete already being open to everyone, but mention it in `files-and-media.md`.

---

## 8. End other sessions when the password changes (25 min)

**Problem.** `POST /api/auth/password` updates the hash and sets `users.password_changed_at_utc`, but nothing reads that column. Sessions are self-contained cookies, and the per-request check in `AuthenticationExtensions.ValidateAccountAsync` only looks at whether the account exists and whether the role changed. So after "someone knows my password, let me change it", every device that is already signed in, including the attacker's, **stays signed in** for up to `SessionLifetimeHours` (7 days, sliding).

**What to do**

1. In `AccountPrincipal.Create`, add a claim with the password version, e.g. `password_changed_at` = `account.PasswordChangedAtUtc` as Unix seconds (or a random `security_stamp` column, like ASP.NET Identity).
2. In `ValidateAccountAsync`, reject the principal (and sign out) when the claim is missing or differs from the account's current value. The account is already loaded there, so this costs nothing.
3. In `AuthController.ChangePasswordAsync`, re-issue the cookie for the *current* browser after a successful change (`HttpContext.SignInAsAsync(account, isPersistent)`), so the user who changed the password stays signed in.
4. Existing cookies have no claim yet. Either accept a missing claim once (and renew the cookie) or accept that everyone signs in again after the deploy; the second is simpler and fine for a home server.
5. Update the limitation in `documents/features/authentication.md` ("Changing the password does not end other sessions").

**Tests:** sign in with two clients as the same user, change the password with client A, then check that client A still gets `200` on `/api/auth/me` and client B gets `401`.

This is also the cheapest step towards "log out all devices" (a button that just bumps the stamp) and towards server-side sessions in `auth-architecture-proposal.md` §2.1.

---

## 9. Apply monitoring settings changes consistently (35 min)

**Problem.** `appsettings.json` is loaded with `reloadOnChange`, and `MonitoringSettingsProvider` returns `IOptionsMonitor.CurrentValue`. So an edit to the file while the backend runs reaches some readers immediately and others never:

| Reader | Reads settings | Picks up an edit |
|---|---|---|
| `MetricsSamplingBackgroundService` (`Enabled`, `IntervalSeconds`) | once, at startup | **no**, needs a restart |
| `SystemMetricsCollector` (`CollectCpuUsage`, `CollectRamUsage`, …) | every cycle | yes |
| `MetricsCleanupBackgroundService` (`Retention`) | every iteration | yes |
| `SystemOverviewProvider` | every request | yes |
| `MetricsCollectorReadinessCheck` (`Enabled`, `IntervalSeconds`) | every request | yes |

What goes wrong:
- **Collection off → on:** the health check sees `Enabled = true` while the sampler never started. `metrics_collector` reports *"not running"* (Unhealthy) until a restart, although nothing is broken.
- **Collection on → off:** the health check says "disabled" (Healthy) while the sampler keeps collecting and writing samples.
- **Interval change:** the staleness window (`max(30 s, 3 × IntervalSeconds)`) changes, but the timer doesn't. Shortening the interval from 60 s to 5 s while running makes the collector "stale" after 30 s, although it still samples every 60 s.
- **Invalid edit:** validation (`ValidateFluently`) runs again on reload. With an invalid file, every `CurrentValue` read throws `OptionsValidationException` until the file is fixed. The health check turns Unhealthy, the overview endpoint returns 500 and every sampling cycle fails. `ValidateOnStart` protects only the startup.

This mostly matters for the systemd deployment (task 6), where `appsettings.json` lives next to the binaries and is easy to edit in place. In Docker the file sits inside the image, and environment variables don't reload.

**What to do.** Pick one model and use it everywhere:

- **A. "Changes apply on restart" (recommended).** In `MonitoringSettingsProvider`, inject `IOptions<MonitoringSettings>` instead of `IOptionsMonitor` and return `.Value`. Every reader then sees the startup values, an invalid edit has no effect until the next restart (which fails fast with a clear message), and nothing else changes. Document it in `system-monitoring.md` ("restart the backend after editing monitoring settings").
- **B. Live reload.** Keep `IOptionsMonitor`, subscribe with `OnChange` in the sampler, and restart its loop (stop the `PeriodicTimer`, start or stop collection, use the new interval). Handle invalid reloads by keeping the last valid settings. This takes noticeably longer (about 90 min with tests) and is only worth it if you plan a settings UI for monitoring.

Either way, add the effective `intervalSeconds` to the `metrics_collector` health data, so you can see which interval the check uses.

Also in `MetricsCleanupBackgroundService`: when `CleanupEnabled` is false, the loop still wakes up every `CleanupIntervalMinutes` only to log "skipped". With option A the value can't change at runtime, so log once and return, like `MetricsSamplingBackgroundService` does. (With option B, keep the loop but log only when the value changes.)

**Tests (option A):** a unit test that `MonitoringSettingsProvider.Current` keeps returning the startup value after the configuration changes (use `ConfigurationBuilder` with an in-memory source and call `Reload()` after changing its data). The existing `MetricsCollectorReadinessCheckTests` cover the check itself.
