# Authentication & access control

Local user accounts stored in SQLite protect the panel. The first administrator is created in a first-start setup wizard; everyone else joins through invite links (see [users-and-invitations.md](users-and-invitations.md)). Signing in issues an HTTP-only session cookie, and every API endpoint except a few public ones requires it. Two roles, **Admin** and **Member**, decide who can manage users and service settings. CORS rules decide which web origins in the home network may call the API from a browser.

## User perspective

### What it does

- **First start.** While no account exists, every page redirects to a setup wizard (`/setup`) that creates the administrator account and optionally connects Pi-hole. Nothing has to be configured in `.env`.
- **Sign-in** with username and password. Usernames are case-insensitive (`Admin` and `admin` are the same account).
- **Keep me signed in** makes the session survive a browser restart. Without it, the session ends when the browser closes.
- Sessions last `Auth:SessionLifetimeHours` (default 168 h, i.e. 7 days) and are extended while you use the panel.
- **Change password** in *Settings → Account*, for every user. The current password is required.
- After `Auth:LoginAttemptsPerMinute` (default 5) attempts per minute from the same IP address, sign-in, setup and invite acceptance are blocked until that minute is over.
- If the session expires while the panel is open, you are sent back to the sign-in page. After signing in again, you return to the page you were on.
- **Roles take effect immediately.** A removed user is signed out on their next request, on every device. A promoted or demoted user gets the new rights without signing in again.

| | Admin | Member |
|---|:-:|:-:|
| Dashboard, Files & Media, ad-blocking switch | ✓ | ✓ |
| Change own password | ✓ | ✓ |
| Users page: invite links, roles, removing accounts | ✓ | – |
| Settings → Pi-hole connection | ✓ | – |

### Usage scenarios

- **Household LAN panel.** The owner creates the admin account on first start and invites family members as *Member*s.
- **Shared screen.** Turn off *Keep me signed in* on a shared device so the session ends with the browser.
- **Remote access over VPN.** Use WireGuard or Tailscale to reach the panel. The panel itself has no hardening for direct internet exposure.

### Limitations

- **Setup is open until it is done.** Until the first account exists, anyone who can reach the web app can create the administrator. Do the setup right after installing.
- **Only two roles.** There is no read-only role and no per-folder file permissions: every member can upload and delete in the whole file root.
- **Signing out does not revoke anything on the server.** Sessions are self-contained encrypted cookies. Logout deletes the cookie in your browser, but a copy of the cookie stays valid until it expires.
- **Changing the password does not end other sessions.** Other devices that are signed in stay signed in. Only removing the account ends them.
- **An open dashboard keeps the session alive.** The dashboard polls every few seconds and the session uses sliding expiration, so a tab left open never expires.
- **Forgotten password.** There is no reset flow. Another admin can remove the account and send a new invite. If the only admin forgets the password, the database has to be deleted (see the README), which also removes metric history and settings.
- **Deleting `data/keys` signs everyone out.** The cookie encryption keys live in `data/keys` next to the database. Deleting that folder invalidates all sessions and also the stored Pi-hole password.
- **There is no HTTPS of its own.** The cookie is marked `Secure` only when the request uses HTTPS. On plain HTTP in the LAN, anyone who can see the traffic can read the password and the cookie. Use the nginx setup in the README for HTTPS.
- **No 2FA and no lockout.** The rate limit slows down guessing but never locks the account.
- **The rate limit is per IP and in memory.** The counters reset when the backend restarts. Behind a reverse proxy, `ReverseProxy:Enabled` must be on; otherwise all clients share the proxy's IP, and one user's failed attempts block everyone.

## Developer perspective

### How it works

```
Browser ── GET  /api/auth/status ───► AuthController → { setupRequired, authenticated, username, role }
Browser ── POST /api/auth/setup ────► rate limiter "login" → AccountService.CreateInitialAdminAsync → cookie
Browser ── POST /api/auth/login ────► rate limiter "login" → AccountService.ValidateCredentialsAsync
                                        └─ IdentityPasswordHasher.Verify → SignInAsAsync → Set-Cookie: nodepilot.session
Browser ── any /api/* with cookie ──► cookie handler
                                        ├─ OnValidatePrincipal: account still exists? role unchanged?
                                        └─ fallback policy (RequireAuthenticatedUser) / "Admin" policy
```

- **Accounts** (`UserAccount`, table `users`): `username` (unique, `NOCASE` collation), `password_hash`, `role` (`Admin`/`Member`), `created_at_utc`, `password_changed_at_utc`.
- **Password hashing** (`IdentityPasswordHasher`): the ASP.NET Core Identity hasher, format v3 (PBKDF2-HMAC-SHA512, 128-bit salt, 100 000 iterations). `SuccessRehashNeeded` re-hashes the password on the next successful login.
- **First-start setup** (`AccountService.CreateInitialAdminAsync`): allowed only while the `users` table is empty, otherwise `409 Accounts.SetupAlreadyCompleted`. A static `SemaphoreSlim` plus a second "any account?" check inside it stops two concurrent requests from both creating an admin. On success the new admin is signed in with a persistent cookie.
- **Cookie authentication** (`AuthenticationExtensions.AddCookieAuthentication`): cookie name `nodepilot.session`, `HttpOnly`, `SameSite=Lax`, `SecurePolicy=SameAsRequest` and sliding expiration. The default redirects to a login page are replaced with plain `401`/`403` responses, because this is a JSON API.
- **Claims** (`AccountPrincipal`): `NameIdentifier` = account id, `Name` = username, `Role` = role.
- **Per-request account check** (`OnValidatePrincipal` → `ValidateAccountAsync`): every request with a cookie loads the account by id. A missing account rejects the principal and clears the cookie (`401`). A role that differs from the cookie's claim replaces the principal and renews the cookie, so role changes apply at once. This costs one indexed SQLite lookup per authenticated request.
- **Authorization:** a *fallback policy* requires an authenticated user on every endpoint. Endpoints opt out explicitly with `[AllowAnonymous]` (`status`, `setup`, `login`, `logout`, the public invite endpoints) or `.AllowAnonymous()` (`/health`, `/health/ready`, `/health/live`). A second policy, `Admin` (`RequireRole("Admin")`), protects `UsersController`, `InvitationsController` and `SettingsController`. Members get `403` there.
- **Credential check:** an unknown username is verified against a dummy hash, so a login attempt takes the same time whether or not the account exists. Wrong username and wrong password return the same `401 Accounts.InvalidCredentials`.
- **Persistence:** `rememberMe` maps to `AuthenticationProperties.IsPersistent`. In both cases the authentication ticket expires after `SessionLifetimeHours`.
- **Data Protection keys** (`Infrastructure/DependencyInjection.cs`): `SetApplicationName("NodePilot")` and `PersistKeysToFileSystem(<data dir>/keys)`, where the data dir is the folder of the SQLite file. The same key ring encrypts the session cookie and the stored Pi-hole password. In Docker the folder is on the `nodepilot-data` volume, so sessions survive rebuilds.
- **Rate limiting** (`RateLimitingExtensions`): a fixed-window limiter named `login`, partitioned by `RemoteIpAddress`, `LoginAttemptsPerMinute` permits per minute, no queue, `429` on rejection. It is applied to `setup`, `login` and `POST /api/invite/{token}/accept` (all three share one counter per IP).
- **CORS** (`OriginPolicy`): an origin is allowed when it is in `Cors:AllowedOrigins`, or when `AllowPrivateNetworkOrigins` is on and the host is `localhost`, `*.local`, loopback, an RFC 1918 IPv4 address, an IPv6 ULA (`fc00::/7`) or an IPv6 link-local address. Credentials are allowed, which the cookie needs.

### Implementation details & gotchas

- **Validation rules:** usernames are 3–32 characters from `A–Z a–z 0–9 . _ -` (trimmed); passwords are 8–128 characters and not only whitespace. The same rules apply to setup and to invite acceptance (`AccountService.ValidateNewAccount`).
- **Configuration is checked at startup** with `ValidateOnStart`: `SessionLifetimeHours` must be 1–720 and `LoginAttemptsPerMinute` 1–10000. There are no credentials in configuration any more.
- **`.env` loading:** `DatabaseExtensions.LoadDotEnv()` walks up from the working directory to the nearest `.env` file and loads it with no-clobber, so real environment variables (Docker, tests) take precedence. It runs before `WebApplication.CreateBuilder`, so the values become part of the configuration.
- **`password_changed_at_utc` is stored but not used** for session invalidation yet. Comparing it with the cookie's issue time in `ValidateAccountAsync` would end other sessions after a password change.
- **Same-site requirement.** The web app (`:3000`) and the API (`:5000`) on the same host are *same-site*, so the `Lax` cookie is sent with `fetch(..., { credentials: "include" })`. If `NEXT_PUBLIC_API_URL` uses a different host than the page (for example the page is opened as `nas.local` but the API URL is `192.168.1.2`), the requests become cross-site and the cookie is **not sent**: sign-in appears to succeed, but every following call returns `401`.
- **Other apps on the same LAN host can call the API.** A web app served from another port on the same IP is same-site and matches the private-network CORS rule, so it can make credentialed requests to this API. If you host untrusted web apps on the same machine, turn off `AllowPrivateNetworkOrigins` and list origins explicitly.
- **Behind a reverse proxy** (`ReverseProxy/ForwardedHeadersExtensions.cs`): with `ReverseProxy:Enabled`, `UseForwardedHeaders` runs first in the pipeline. It replaces `RemoteIpAddress` with `X-Forwarded-For` and `Request.Scheme` with `X-Forwarded-Proto`, so the rate limiter partitions by the real client and `SameAsRequest` marks the cookie `Secure` on HTTPS.
  - The headers are honoured **only when the connection comes from `KnownProxies` / `KnownNetworks`** (default `127.0.0.1`, `::1`). The framework's loopback defaults are cleared, so the config is the whole list. Otherwise any client could send its own `X-Forwarded-For` and get unlimited login attempts.
  - `ForwardLimit = 1`: only the last hop is used. nginx overwrites the header with `$remote_addr` instead of appending, so a forged value from the client never reaches the backend.
  - Invalid entries stop the startup (`ValidateOnStart`), so a typo doesn't silently trust nobody.
  - A backend in Docker behind host nginx sees the bridge gateway (`172.x.0.1`), not loopback. Add the network to `KnownNetworks`.
  - Behind the proxy the web app and API share one origin (`NEXT_PUBLIC_API_URL=/`), so CORS doesn't apply to the panel's requests.
- **Web client:**
  - `AuthProvider` calls `GET /api/auth/status` once when the app loads and maps it to `setup`, `anonymous`, `authenticated` or `offline` (backend unreachable). `isAdmin` is derived from the role.
  - The `(app)` layout redirects `setup` → `/setup` and `anonymous` → `/login?next=…`, and shows `OfflineScreen` with a retry button when offline.
  - Any `401` from another endpoint fires a `nodepilot:unauthorized` window event, which flips the state to `anonymous`. `401`s from `login`, `setup` and `password` are excluded, because there they mean "wrong credentials".
  - `safeNextPath` accepts only same-app relative paths, which prevents open redirects.
  - Admin-only navigation items (*Users*) and the Pi-hole settings section are hidden for members. The backend enforces the same rules independently.

### Configuration

| Key | Default | Notes |
|---|---|---|
| `Auth:SessionLifetimeHours` | `168` | 1–720 |
| `Auth:LoginAttemptsPerMinute` | `5` | 1–10000, per IP, shared by setup, login and invite acceptance |
| `Cors:AllowedOrigins` | `["http://localhost:3000"]` | Exact origin match, case-insensitive |
| `Cors:AllowPrivateNetworkOrigins` | `true` | Allows LAN, `localhost` and `.local` origins |
| `NODE_PILOT_DB_CONNECTION_STRING` | `Data Source=data/nodepilot.db` | Accounts live in this database; the keys go to `keys/` next to it |

### API

| Method | Path | Auth | Result |
|---|---|---|---|
| GET | `/api/auth/status` | anonymous | `200 { setupRequired, authenticated, username, role }` |
| POST | `/api/auth/setup` | anonymous, rate limited | `201 { username, role }` and cookie, `400`, `409` once an account exists, or `429` |
| POST | `/api/auth/login` | anonymous, rate limited | `200 { username, role }` and cookie, `401`, or `429` |
| POST | `/api/auth/logout` | anonymous | `204` and the cookie is cleared |
| GET | `/api/auth/me` | required | `200 { username, role }` or `401` |
| POST | `/api/auth/password` | required | `{ currentPassword, newPassword }` → `204`, or `400` (wrong current password, weak new one) |

User and invitation endpoints are described in [users-and-invitations.md](users-and-invitations.md).

### Tests

- `AccountServiceTests` (unit): setup hashes the password and can run only once, invalid username and weak password are rejected, login ignores username case and returns the same error for a wrong user or password, password change requires the current password.
- `SetupAndSettingsTests` (integration): a fresh install requires setup and blocks the API, setup signs in and closes itself, the old password stops working after a change, settings endpoints require sign-in.
- `ApiTests` (integration): protected endpoints return `401` without a session, a wrong password returns `401` with no cookie, `/me` works after login, and logout clears the session.
- `UsersAndInvitationsTests` (integration): members get `403` on admin endpoints, a removed user is signed out on the next request, a promoted member gets admin access without signing in again.
- `OriginPolicyTests` (unit) cover the private-network origin rules.

### Key files

- `apps/backend/src/NodePilot.Api/Auth/AuthenticationExtensions.cs`
- `apps/backend/src/NodePilot.Api/Auth/AccountPrincipal.cs`
- `apps/backend/src/NodePilot.Api/Auth/RateLimitingExtensions.cs`
- `apps/backend/src/NodePilot.Api/Auth/AuthSettings.cs`
- `apps/backend/src/NodePilot.Api/Controllers/AuthController.cs`
- `apps/backend/src/NodePilot.Api/Cors/OriginPolicy.cs`
- `apps/backend/src/NodePilot.Application/Accounts/Services/AccountService.cs`
- `apps/backend/src/NodePilot.Infrastructure/Security/IdentityPasswordHasher.cs`
- `apps/backend/src/NodePilot.Infrastructure/DependencyInjection.cs` (Data Protection)
- `apps/web/src/components/auth/auth-provider.tsx`
- `apps/web/src/app/setup/page.tsx`
- `apps/web/src/app/login/page.tsx`
- `apps/web/src/app/(app)/layout.tsx`
- `apps/web/src/components/settings/change-password-form.tsx`
