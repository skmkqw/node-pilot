# Ad blocking (Pi-hole)

Integration with an existing **Pi-hole v6** instance. A dashboard card shows Pi-hole's query statistics and lets you switch network-wide ad blocking on or off, or pause it for a fixed time. NodePilot does not block anything itself. It acts as a remote control for Pi-hole.

## User perspective

### What it does

- Shows whether blocking is **on**, **off** or **paused**, with a countdown while paused.
- Shows the share of queries blocked (as a ring), total and blocked queries, active clients, and the number of domains on the blocklist. The counters are what Pi-hole's summary endpoint reports, normally the last 24 hours.
- A toggle switches blocking on or off. When blocking is on, *Pause for* buttons turn it off for 5 min, 30 min or 1 h, after which Pi-hole turns it back on automatically.
- If Pi-hole is not configured, the card shows the two `.env` lines to add. If Pi-hole is unreachable, it shows the reason (timeout, wrong password, HTTP error) and a *Retry* button.
- The card refreshes every 15 s.

### Usage scenarios

- **"This site breaks with ad blocking."** Pause for 5 minutes, finish the checkout or login, and blocking comes back on by itself.
- **Checking whether filtering works.** A non-zero blocked % and a growing query count show that devices really use Pi-hole as their DNS server.
- **Household control from a phone**, without opening Pi-hole's own admin page and signing in there.

### Limitations

- **Pi-hole v6 only.** v5 and older use a different API (`api.php`) and will show as unreachable or as an unexpected response.
- **One Pi-hole only.** Redundant setups (two Pi-holes, or Pi-hole + AdGuard) are not supported. Toggling affects only the configured instance.
- **No blocklist or domain management.** There is no allow or deny list, no query log, no per-client settings and no gravity update. Use Pi-hole's own UI for those.
- **The UI offers only 5, 30 and 60 minute pauses.** The API accepts 1 s to 24 h. A pause has no time-limited "enable" counterpart in the UI.
- **Changing settings requires a restart.** The address and password are read from `.env` at startup.
- **HTTPS with a self-signed certificate fails** (certificate validation). Use `http://` inside the LAN or a trusted certificate.
- **The countdown is approximate.** It counts from the time of the last status check, so it can be a few seconds off.

## Developer perspective

### How it works

```
AdBlockController (/api/adblock)
  └─ IAdBlockerService → PiHoleClient (typed HttpClient, timeout = RequestTimeoutSeconds)
        ├─ PiHoleSessionStore (singleton): cached SID, SemaphoreSlim-guarded login
        ├─ GET  {BaseUrl}/api/dns/blocking   ┐ status = both calls
        ├─ GET  {BaseUrl}/api/stats/summary  ┘
        ├─ POST {BaseUrl}/api/dns/blocking  { blocking, timer }  then re-read the status
        └─ POST {BaseUrl}/api/auth { password } → session.sid → header X-FTL-SID
```

- **Sessions:**
  - The first request logs in and caches the SID for the life of the process. Pi-hole limits concurrent sessions (`webserver.api.max_sessions`), so logging in on every call would exhaust them.
  - If a request returns `401`, the session is invalidated and the request is retried **once** with a fresh login.
  - An empty password means "no auth", so no `X-FTL-SID` header is sent.
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
- **Load per open dashboard:** every status poll makes 2 sequential Pi-hole calls. With the default 5 s timeout, a dead Pi-hole makes `/api/adblock` take up to about 10 s, plus a login attempt.
- **Cancellation:** a client abort (the tab closes) is *not* reported as "unreachable". The catch filter checks `!ct.IsCancellationRequested`.
- **The session store does not watch configuration.** If the Pi-hole password changes while NodePilot runs, the old SID is used until Pi-hole rejects it, then the retry logs in with the new password. Changing `BaseUrl` requires a restart anyway.
- **Pi-hole with 2FA:** use an **app password** (Pi-hole → Settings → Web interface/API → *Configure app password*). App passwords bypass TOTP.
- **Validation at startup:** `BaseUrl` must be an absolute URI if it is set, and `RequestTimeoutSeconds` must be 1–60.

### Configuration

| Key | Default | Notes |
|---|---|---|
| `PiHole__BaseUrl` | empty | Empty disables the integration. Example: `http://192.168.1.2` (with or without a trailing `/`) |
| `PiHole__Password` | empty | Pi-hole app password, or empty if the API has no password |
| `PiHole:RequestTimeoutSeconds` | `5` | 1–60, per HTTP call |

### API

| Method | Path | Body | Result |
|---|---|---|---|
| GET | `/api/adblock` | — | `200 AdBlockerStatus`, always |
| POST | `/api/adblock/blocking` | `{ enabled, durationSeconds? }` | `200 AdBlockerStatus`, `400`, or `502` |

### Tests

`PiHoleClientTests` run against a fake Pi-hole API and cover status mapping, session caching and the re-login on `401`, timer handling and failure descriptions. The integration test `AdBlock_NotConfigured_ReportsStatusAndRejectsToggle` covers the unconfigured case.

### Key files

- `apps/backend/src/NodePilot.Infrastructure/AdBlocking/PiHoleClient.cs`
- `apps/backend/src/NodePilot.Infrastructure/AdBlocking/PiHoleSessionStore.cs`
- `apps/backend/src/NodePilot.Infrastructure/AdBlocking/PiHoleContracts.cs`
- `apps/backend/src/NodePilot.Application/AdBlocking/Models/AdBlockerStatus.cs`
- `apps/backend/src/NodePilot.Api/Controllers/AdBlockController.cs`
- `apps/web/src/components/dashboard/adblock-card.tsx`
