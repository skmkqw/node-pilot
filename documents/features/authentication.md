# Authentication & access control

A single administrator account protects the whole panel. Signing in issues an HTTP-only session cookie, and every API endpoint except `/health` requires it. CORS rules decide which web origins in the home network may call the API from a browser.

## User perspective

### What it does

- A sign-in screen asks for a username and password. Both are set on the server in `.env`.
- **Keep me signed in** makes the session survive a browser restart. Without it, the session ends when the browser closes.
- Sessions last `Auth:SessionLifetimeHours` (default 168 h, i.e. 7 days) and are extended while you use the panel.
- After 5 failed attempts per minute from the same IP address, sign-in is blocked until that minute is over.
- If the session expires while the panel is open, you are sent back to the sign-in page. After signing in again, you return to the page you were on.

### Usage scenarios

- **Household LAN panel.** One admin account, opened from a laptop or phone on the home Wi-Fi.
- **Shared screen.** Turn off *Keep me signed in* on a shared device so the session ends with the browser.
- **Remote access over VPN.** Use WireGuard or Tailscale to reach the panel. The panel itself has no hardening for direct internet exposure.

### Limitations

- **One user only.** There are no extra accounts, no roles and no read-only access. The username is only displayed in the UI.
- **The password lives in `.env` as plain text.** The UI cannot change it. To change it, edit `Auth__Password` and restart the backend.
- **Signing out does not revoke anything on the server.** Sessions are self-contained encrypted cookies. Logout deletes the cookie in your browser, but a copy of the cookie stays valid until it expires. Changing the password does not end existing sessions either.
- **An open dashboard keeps the session alive.** The dashboard polls every few seconds and the session uses sliding expiration, so a tab left open never expires.
- **Sessions do not survive a container rebuild.** The cookie encryption keys are stored inside the container, not on the data volume. `docker compose up --build` signs everyone out.
- **There is no HTTPS of its own.** The cookie is marked `Secure` only when the request uses HTTPS. On plain HTTP in the LAN, anyone who can see the traffic can read the password and the cookie.
- **No 2FA and no lockout.** The rate limit slows down guessing but never locks the account.
- **The rate limit is per IP and in memory.** Behind a reverse proxy, all clients share the proxy's IP, so one user's failed attempts can block everyone. The counters reset when the backend restarts.

## Developer perspective

### How it works

```
Browser ── POST /api/auth/login ──► AuthController
                                      ├─ rate limiter "login" (5/min per IP)
                                      ├─ FixedTimeEquals(username), FixedTimeEquals(password)
                                      └─ SignInAsync → Set-Cookie: nodepilot.session
Browser ── any /api/* with cookie ─► cookie handler → fallback policy (RequireAuthenticatedUser)
```

- **Cookie authentication** (`AuthenticationExtensions.AddCookieAuthentication`): cookie name `nodepilot.session`, `HttpOnly`, `SameSite=Lax`, `SecurePolicy=SameAsRequest` and sliding expiration. The default redirects to a login page are replaced with plain `401`/`403` responses, because this is a JSON API.
- **Secure by default:** a *fallback authorization policy* requires an authenticated user on every endpoint. Endpoints opt out explicitly with `[AllowAnonymous]` (login and logout) or `.AllowAnonymous()` (`/health`). A new controller is therefore protected automatically.
- **Credential check:** both inputs are SHA-256 hashed first and then compared with `CryptographicOperations.FixedTimeEquals`. Hashing gives equal-length inputs, so the comparison time does not reveal how many characters were correct. The username is checked the same way, and a wrong username returns the same `401` as a wrong password.
- **Persistence:** `rememberMe` maps to `AuthenticationProperties.IsPersistent`. In both cases the authentication ticket expires after `SessionLifetimeHours`.
- **Rate limiting** (`RateLimitingExtensions`): a fixed-window limiter partitioned by `RemoteIpAddress`, 5 permits per minute, no queue, `429` on rejection. It is applied only to the login action through `[EnableRateLimiting("login")]`.
- **CORS** (`OriginPolicy`): an origin is allowed when it is in `Cors:AllowedOrigins`, or when `AllowPrivateNetworkOrigins` is on and the host is `localhost`, `*.local`, loopback, an RFC 1918 IPv4 address, an IPv6 ULA (`fc00::/7`) or an IPv6 link-local address. Credentials are allowed, which the cookie needs.

### Implementation details & gotchas

- **Configuration is checked at startup** with `ValidateOnStart`. The backend refuses to start if the username is empty, the password is shorter than 8 characters, or the lifetime is outside 1–720 h.
- **`.env` loading:** `DatabaseExtensions.LoadDotEnv()` walks up from the working directory to the nearest `.env` file and loads it with no-clobber, so real environment variables (Docker, tests) take precedence. It runs before `WebApplication.CreateBuilder`, so the values become part of the configuration.
- **Same-site requirement.** The web app (`:3000`) and the API (`:5000`) on the same host are *same-site*, so the `Lax` cookie is sent with `fetch(..., { credentials: "include" })`. If `NEXT_PUBLIC_API_URL` uses a different host than the page (for example the page is opened as `nas.local` but the API URL is `192.168.1.2`), the requests become cross-site and the cookie is **not sent**: sign-in appears to succeed, but every following call returns `401`.
- **Other apps on the same LAN host can call the API.** A web app served from another port on the same IP is same-site and matches the private-network CORS rule, so it can make credentialed requests to this API. If you host untrusted web apps on the same machine, turn off `AllowPrivateNetworkOrigins` and list origins explicitly.
- **Data Protection keys** use the ASP.NET Core default: `~/.aspnet/DataProtection-Keys`, which is `/root/...` in the container. To keep sessions across rebuilds, persist the keys with `PersistKeysToFileSystem` on the data volume.
- **Rate limiter behind a proxy:** forwarded headers are not configured. To get the real client IP, add `UseForwardedHeaders` with known proxies.
- **Web client:** `AuthProvider` calls `GET /api/auth/me` once when the app loads. Any `401` from another endpoint fires a `nodepilot:unauthorized` window event, which flips the state to `anonymous`. The `(app)` layout then redirects to `/login?next=…`. `safeNextPath` accepts only same-app relative paths, which prevents open redirects.

### Configuration

| Key | Default | Notes |
|---|---|---|
| `Auth__Username` | `admin` | Required, non-empty |
| `Auth__Password` | — | Required, ≥ 8 characters. Put it in `.env`, never in `appsettings.json` |
| `Auth:SessionLifetimeHours` | `168` | 1–720 |
| `Cors:AllowedOrigins` | `["http://localhost:3000"]` | Exact origin match, case-insensitive |
| `Cors:AllowPrivateNetworkOrigins` | `true` | Allows LAN, `localhost` and `.local` origins |

### API

| Method | Path | Auth | Result |
|---|---|---|---|
| POST | `/api/auth/login` | anonymous, rate limited | `200 { username }` and cookie, `401`, or `429` |
| POST | `/api/auth/logout` | anonymous | `204` and the cookie is cleared |
| GET | `/api/auth/me` | required | `200 { username }` or `401` |

### Tests

`ApiTests` (integration): protected endpoints return `401` without a session, a wrong password returns `401` with no cookie, `/me` works after login, and logout clears the session. `OriginPolicyTests` (unit) cover the private-network origin rules.

### Key files

- `apps/backend/src/NodePilot.Api/Auth/AuthenticationExtensions.cs`
- `apps/backend/src/NodePilot.Api/Auth/RateLimitingExtensions.cs`
- `apps/backend/src/NodePilot.Api/Auth/AuthSettings.cs`
- `apps/backend/src/NodePilot.Api/Controllers/AuthController.cs`
- `apps/backend/src/NodePilot.Api/Cors/OriginPolicy.cs`
- `apps/web/src/components/auth/auth-provider.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/(app)/layout.tsx`
