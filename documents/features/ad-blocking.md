# Ad blocking (Pi-hole)

Integration with an existing **Pi-hole v6** instance. A dashboard card shows Pi-hole's query statistics and lets you switch network-wide ad blocking on or off, or pause it for a fixed time. An administrator connects Pi-hole in *Settings* (or in the first-start wizard). NodePilot does not block anything itself. It acts as a remote control for Pi-hole.

## User perspective

### What it does

- Shows whether blocking is **on**, **off** or **paused**, with a countdown while paused.
- Shows the share of queries blocked (as a ring), total and blocked queries, active clients, and the number of domains on the blocklist. The counters are what Pi-hole's summary endpoint reports, normally the last 24 hours.
- An I/O switch turns blocking on or off. When blocking is on, *Pause for* buttons turn it off for 5 min, 30 min or 1 h, after which Pi-hole turns it back on automatically. Every signed-in user, members included, can use the switch.
- **Connecting Pi-hole** (admins): *Settings → Ad blocker (Pi-hole)*, or step 2 of the first-start wizard. Enter the address and the app password, press *Test connection* to check them without saving, then *Save*. *Disconnect* removes the saved connection.
- The saved password is stored encrypted and is never shown again. Leave the field empty when saving to keep it.
- If Pi-hole is not connected, the card says so. Admins get a button to the Pi-hole settings; members are told to ask an administrator. If Pi-hole is unreachable, the card shows the reason (timeout, wrong password, HTTP error) and a *Retry* button.
- The card refreshes every 15 s.

### Usage scenarios

- **"This site breaks with ad blocking."** Pause for 5 minutes, finish the checkout or login, and blocking comes back on by itself.
- **Checking whether filtering works.** A non-zero blocked % and a growing query count show that devices really use Pi-hole as their DNS server.
- **Household control from a phone**, without opening Pi-hole's own admin page and signing in there.
- **Pi-hole moved to a new IP**, or its password changed: update it in Settings, test, save. No restart needed.

### Limitations

- **Pi-hole v6 only.** v5 and older use a different API (`api.php`) and will show as unreachable or as an unexpected response.
- **One Pi-hole only.** Redundant setups (two Pi-holes, or Pi-hole + AdGuard) are not supported. Toggling affects only the configured instance.
- **No blocklist or domain management.** There is no allow or deny list, no query log, no per-client settings and no gravity update. Use Pi-hole's own UI for those.
- **The UI offers only 5, 30 and 60 minute pauses.** The API accepts 1 s to 24 h. A pause has no time-limited "enable" counterpart in the UI.
- **Members can switch blocking off.** There is no separate permission for the switch.
- **HTTPS with a self-signed certificate fails** (certificate validation). Use `http://` inside the LAN or a trusted certificate.
- **The request timeout is not editable in the UI.** It comes from `PiHole:RequestTimeoutSeconds` and needs a restart. *Test connection* always uses 5 s.
- **Losing `data/keys` loses the password.** The saved Pi-hole password can then no longer be decrypted and is treated as empty, so it has to be entered again.
- **The countdown is approximate.** It counts from the time of the last status check, so it can be a few seconds off.

## Developer perspective

### How it works

```
AdBlockController (/api/adblock)              SettingsController (/api/settings/pihole, admin)
  └─ IAdBlockerService → PiHoleClient            ├─ IPiHoleSettingsStore (GET / PUT / DELETE)
        │   (typed HttpClient, timeout =          └─ IAdBlockerService.TestConnectionAsync (POST …/test)
        │    RequestTimeoutSeconds)
        ├─ IPiHoleSettingsStore.GetEffectiveAsync   ← read on every call
        ├─ PiHoleSessionStore (singleton): cached SID, keyed by URL + password
        ├─ GET  {BaseUrl}/api/dns/blocking   ┐ status = both calls
        ├─ GET  {BaseUrl}/api/stats/summary  ┘
        ├─ POST {BaseUrl}/api/dns/blocking  { blocking, timer }  then re-read the status
        └─ POST {BaseUrl}/api/auth { password } → session.sid → header X-FTL-SID
```

- **Where the settings come from** (`PiHoleSettingsStore`):
  - Settings saved in the app live in the `app_settings` table under `pihole.base_url` and `pihole.password`. The password is encrypted with Data Protection (`DataProtectionSecretProtector`, purpose `NodePilot.Secrets.v1`).
  - If no URL is saved in the app, `PiHole__BaseUrl` / `PiHole__Password` from the environment are used. App settings always win.
  - `GET /api/settings/pihole` reports which one is active as `source`: `App`, `Environment` or `None`. The password is never returned, only `hasPassword`.
  - `PUT` with `password: null` keeps the saved password, `""` removes it.
  - `DELETE` removes the app settings; an environment configuration, if any, becomes active again.
- **URL normalisation** (`PiHoleUrl.TryNormalize`): absolute `http`/`https` only, no query or fragment, trailing `/` removed. Anything else is `400 AdBlocker.InvalidUrl`.
- **Sessions:**
  - The first request logs in and caches the SID. Pi-hole limits concurrent sessions (`webserver.api.max_sessions`), so logging in on every call would exhaust them.
  - The cached SID is tied to a SHA-256 fingerprint of URL + password. Saving new settings makes the next call log in again; no restart is needed.
  - If a request returns `401`, the session is invalidated and the request is retried **once** with a fresh login.
  - An empty password means "no auth", so no `X-FTL-SID` header is sent.
- **Test connection** uses a one-off session that does not touch the cached one, and logs it out (`DELETE /api/auth`) afterwards so it does not count against Pi-hole's session limit. When the request has no password, the saved one is used, so an existing connection can be re-tested.
- **Status never fails.** `GetStatusAsync` turns any upstream failure (`HttpRequestException`, timeout, JSON, URI or auth errors) into `200` with `reachable: false` and a readable `message`. The dashboard therefore never shows an error toast just because Pi-hole is down.
- **Toggling can fail.** `SetBlockingAsync` returns:
  - `400 AdBlocker.NotConfigured` when Pi-hole is not configured.
  - `400 AdBlocker.InvalidDuration` when the duration is outside 1 s–24 h.
  - `502` when the upstream call fails. This is a custom ErrorOr type (`CustomErrorTypes.Upstream`) that `BaseController` maps to Bad Gateway.
  - On success, it returns a fresh status.
- **Pausing** sends `{ blocking: false, timer: N }`. Pi-hole itself turns blocking back on after `N` seconds, so the pause works even if NodePilot is stopped. `timer: null` makes the change permanent.

### Implementation details & gotchas

- **Request bodies are buffered** with `StringContent` and an explicit `Content-Length` instead of `JsonContent`, which uses chunked encoding. Pi-hole's embedded web server (CivetWeb) handles buffered bodies reliably.
- **`blocking` mapping:** `"enabled"` → `true`, `"disabled"` → `false`. `"failed"`/`"unknown"` → `null`, which the UI shows as the "unknown" shield.
- **Load per open dashboard:** every status poll reads the settings from SQLite and makes 2 sequential Pi-hole calls. With the default 5 s timeout, a dead Pi-hole makes `/api/adblock` take up to about 10 s, plus a login attempt.
- **Cancellation:** a client abort (the tab closes) is *not* reported as "unreachable". The catch filter checks `!ct.IsCancellationRequested`.
- **The HttpClient timeout is set once** from `IOptions<PiHoleSettings>` when the typed client is created. App-saved settings have no timeout of their own and reuse the configured one.
- **An undecryptable password** (`CryptographicException`, for example after the key ring was deleted) is read as empty instead of failing.
- **Pi-hole with 2FA:** use an **app password** (Pi-hole → Settings → Web interface/API → *Configure app password*). App passwords bypass TOTP.
- **Validation at startup** (environment configuration only): `BaseUrl` must be an absolute URI if it is set, and `RequestTimeoutSeconds` must be 1–60.

### Configuration

The normal way is the Settings page. The environment variables are an optional fallback for automated deployments.

| Key | Default | Notes |
|---|---|---|
| `PiHole__BaseUrl` | empty | Fallback when nothing is saved in the app. Example: `http://192.168.1.2` |
| `PiHole__Password` | empty | Fallback Pi-hole app password, or empty if the API has no password |
| `PiHole:RequestTimeoutSeconds` | `5` | 1–60, per HTTP call. Applies to app-saved settings too |

### API

| Method | Path | Auth | Body | Result |
|---|---|---|---|---|
| GET | `/api/adblock` | user | — | `200 AdBlockerStatus`, always |
| POST | `/api/adblock/blocking` | user | `{ enabled, durationSeconds? }` | `200 AdBlockerStatus`, `400`, or `502` |
| GET | `/api/settings/pihole` | admin | — | `200 { baseUrl, hasPassword, source }` |
| PUT | `/api/settings/pihole` | admin | `{ baseUrl, password? }` | `200 { baseUrl, hasPassword, source }` or `400` |
| DELETE | `/api/settings/pihole` | admin | — | `204` |
| POST | `/api/settings/pihole/test` | admin | `{ baseUrl, password? }` | `200 AdBlockerStatus` for the given values, or `400` |

### Tests

- `PiHoleClientTests` run against a fake Pi-hole API: status mapping, session caching and the re-login on `401`, a changed password starting a new session, timer handling, failure descriptions, and a test connection that uses a throwaway session and logs out.
- `PiHoleSettingsStoreTests`: URL normalisation and password encryption, `null` keeps and `""` removes the password, the environment fallback until app settings exist, source `None` when nothing is configured.
- Integration: `AdBlock_NotConfigured_ReportsStatusAndRejectsToggle`, and `PiHoleSettings_SaveNeverReturnsPassword_AndCanBeCleared` in `SetupAndSettingsTests`.

### Key files

- `apps/backend/src/NodePilot.Infrastructure/AdBlocking/PiHoleClient.cs`
- `apps/backend/src/NodePilot.Infrastructure/AdBlocking/PiHoleSessionStore.cs`
- `apps/backend/src/NodePilot.Infrastructure/AdBlocking/PiHoleSettingsStore.cs`
- `apps/backend/src/NodePilot.Infrastructure/AdBlocking/PiHoleContracts.cs`
- `apps/backend/src/NodePilot.Infrastructure/Security/DataProtectionSecretProtector.cs`
- `apps/backend/src/NodePilot.Application/AdBlocking/PiHoleUrl.cs`
- `apps/backend/src/NodePilot.Application/AdBlocking/Models/AdBlockerStatus.cs`
- `apps/backend/src/NodePilot.Api/Controllers/AdBlockController.cs`
- `apps/backend/src/NodePilot.Api/Controllers/SettingsController.cs`
- `apps/web/src/components/dashboard/adblock-card.tsx`
- `apps/web/src/components/settings/pihole-form.tsx`
- `apps/web/src/app/(app)/settings/page.tsx`
