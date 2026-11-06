# Native deployment with systemd

This document covers what systemd is, why NodePilot needs it, what is currently broken or missing for a native install, and what has to be fixed before the unit files are written.

## What systemd is

systemd is the init system on most Linux distributions (Debian, Ubuntu, Raspberry Pi OS, Fedora, Arch). It runs as PID 1 and starts and supervises every other long-running process on the machine.

A program is registered with systemd through a **unit file** (`<name>.service`) in `/etc/systemd/system/`. The unit describes how to start the program, as which user, in which directory, with which environment, and what to do when it exits. systemd then handles:

- **Start at boot**, ordered against other units (e.g. after the network is up).
- **Restart on failure.**
- **Running as a dedicated user**, not root and not the admin's login user.
- **Logging.** stdout/stderr go to the journal (`journalctl -u <name>`).
- **Control** through `systemctl start|stop|restart|status`.
- **Sandboxing**: a read-only filesystem except for listed paths, a private `/tmp`, no privilege escalation, a restricted umask.

Common commands:

```bash
sudo systemctl daemon-reload            # after adding or editing a unit file
sudo systemctl enable --now <name>      # start now and on every boot
systemctl status <name>                 # state, PID, memory, last log lines
journalctl -u <name> -f                 # follow logs
sudo systemctl restart <name>           # after deploying a new version
```

## Why systemd is needed

The current ways to run NodePilot are `./start.sh` and running the parts by hand with `dotnet run` / `npm run dev`. Both are development setups:

- they are tied to a terminal session: closing SSH or rebooting stops NodePilot;
- they run debug/dev servers (Next.js dev server, `dotnet run` builds from source);
- they run as the user who started them, with that user's full filesystem access;
- nothing restarts them if they crash;
- logs only exist in the terminal scrollback.

A home server panel is expected to start with the machine and stay up. On Linux the standard way to make a program a permanent service is a systemd unit. Without it, the README has no real "install on the host" path.

## What it gives the end user

- NodePilot starts automatically when the server boots, with no terminal open.
- A crash is recovered automatically (`Restart=on-failure`).
- One familiar interface to manage it: `systemctl status nodepilot-backend`, `systemctl restart nodepilot-web`.
- Persistent, searchable logs: `journalctl -u nodepilot-backend --since "1 hour ago"`.
- Correct host data on the dashboard: hostname, the real `/` filesystem, real CPU temperature sensors.
- Uploaded files belong to a known service user (or group) instead of whoever started the dev server.
- Isolation for free: if NodePilot is compromised, it can only write to its data folder and the files root.
- One HTTPS address (`https://nodepilot.home`) through nginx, with the app ports not reachable from the LAN.
- Updates become a predictable sequence: replace files in `/opt/nodepilot`, `systemctl restart`. Data in `/var/lib/nodepilot` is not touched.

## How it maps to NodePilot

NodePilot is two processes, so it becomes two services. The recommended setup puts nginx (already a systemd service, configured by `deploy/nginx/nodepilot.conf`) in front of both, so a native install is three units on one machine:

```
browser ──HTTPS:443──► nginx.service ─┬─ /api/, /health ──► nodepilot-backend.service  127.0.0.1:5000
                                      └─ everything else ─► nodepilot-web.service      127.0.0.1:3000
```

| | Backend | Web |
|---|---|---|
| Unit | `nodepilot-backend.service` | `nodepilot-web.service` |
| Build | `dotnet publish -c Release` | `NEXT_PUBLIC_API_URL=/ npm run build` (Next.js `output: "standalone"`) |
| Installed to | `/opt/nodepilot/backend` | `/opt/nodepilot/web` (`.next/standalone` + `.next/static` + `public`) |
| ExecStart | `/opt/nodepilot/backend/NodePilot.Api` | `/usr/bin/node /opt/nodepilot/web/server.js` |
| Writable data | `/var/lib/nodepilot` (`data/nodepilot.db`, `data/keys`) + files root | none |
| Listens on | `127.0.0.1:5000` | `127.0.0.1:3000` |

`nodepilot.conf` needs no changes for a native install: it already proxies to `127.0.0.1:5000` and `127.0.0.1:3000`. Binding both services to `127.0.0.1` means the direct ports are not reachable from the LAN, without a firewall rule.

### With and without nginx

Running without nginx is the fallback (no certificate, two ports, plain HTTP). The differences are all configuration:

| Setting | With nginx (recommended) | Without nginx |
|---|---|---|
| Backend `ASPNETCORE_URLS` | `http://127.0.0.1:5000` | `http://0.0.0.0:5000` |
| Web `HOSTNAME` | `127.0.0.1` | `0.0.0.0` |
| `ReverseProxy__Enabled` | `true` | `false` |
| `NEXT_PUBLIC_API_URL` at build time | `/` | empty (`<host>:5000`) |
| Open ports | 80, 443 | 3000, 5000 |
| Session cookie | `Secure` (HTTPS) | not `Secure` (HTTP) |

`ReverseProxy__Enabled=true` is required behind nginx: every request comes from `127.0.0.1`, so without it all devices share one login rate limit and the cookie is not marked `Secure`. The default `ReverseProxy:KnownProxies` (`127.0.0.1`, `::1`) already matches nginx on the same host.

`/etc/nodepilot/nodepilot.env` for the nginx setup:

```bash
ReverseProxy__Enabled=true
```

nginx does not have to start after NodePilot: until the services are up it answers 502. To order them anyway, add a drop-in (`systemctl edit nginx`) with `After=nodepilot-backend.service nodepilot-web.service`.

### Filesystem layout

```
/opt/nodepilot/backend     binaries + appsettings.json (read-only at runtime)
/opt/nodepilot/web         Next.js standalone build (read-only at runtime)
/etc/nodepilot/            nodepilot.env: environment overrides (ReverseProxy__Enabled, …)
/etc/nginx/sites-available/nodepilot   deploy/nginx/nodepilot.conf
/etc/nginx/ssl/nodepilot.{crt,key}     created by deploy/nginx/make-cert.sh
/var/lib/nodepilot/        working directory of the backend
  data/nodepilot.db        SQLite database (+ -wal, -shm)
  data/keys/               Data Protection key ring (session cookies, Pi-hole password)
  tmp/                     upload buffering (see below)
/srv/media                 FileManager:RootPath (any folder the admin chooses)
```

Things that depend on paths in the code:

- `data/nodepilot.db` is resolved relative to the **working directory** (`DatabaseExtensions.DefaultConnectionString`), unless `NODE_PILOT_DB_CONNECTION_STRING` is set.
- `data/keys` is placed next to the database (`ResolveDataDirectory`).
- `FileManager:RootPath` is resolved relative to the working directory when it is relative.
- `appsettings.json` is resolved relative to the **content root**, which defaults to the working directory too (see the next section).
- `NEXT_PUBLIC_API_URL` is baked in at `npm run build` time; changing it means rebuilding the web app.

### Draft units

Backend (final version after the fixes below). Without nginx, change `ASPNETCORE_URLS` to `http://0.0.0.0:5000`:

```ini
[Unit]
Description=NodePilot backend
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
User=nodepilot
Group=nodepilot
StateDirectory=nodepilot
WorkingDirectory=/var/lib/nodepilot
EnvironmentFile=-/etc/nodepilot/nodepilot.env
Environment=ASPNETCORE_CONTENTROOT=/opt/nodepilot/backend
Environment=ASPNETCORE_URLS=http://127.0.0.1:5000
Environment=ASPNETCORE_TEMP=/var/lib/nodepilot/tmp
Environment=FileManager__RootPath=/srv/media
ExecStart=/opt/nodepilot/backend/NodePilot.Api
Restart=on-failure
RestartSec=3

NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=-/srv/media
PrivateTmp=true
UMask=0077

[Install]
WantedBy=multi-user.target
```

Web. Without nginx, change `HOSTNAME` to `0.0.0.0`:

```ini
[Unit]
Description=NodePilot web
After=network-online.target nodepilot-backend.service
Wants=network-online.target

[Service]
User=nodepilot
Group=nodepilot
WorkingDirectory=/opt/nodepilot/web
Environment=NODE_ENV=production
Environment=HOSTNAME=127.0.0.1
Environment=PORT=3000
ExecStart=/usr/bin/node /opt/nodepilot/web/server.js
Restart=on-failure
RestartSec=3

NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

## What breaks the install

These were checked by publishing the backend and running it from a different working directory, the way the unit runs it.

### 1. The backend does not find `appsettings.json`

`WebApplication.CreateBuilder` uses the current working directory as the content root. With `WorkingDirectory=/var/lib/nodepilot`, `appsettings.json` in `/opt/nodepilot/backend` is never loaded, and startup fails:

```
Unhandled exception. Microsoft.Extensions.Options.OptionsValidationException:
FileManager:RootPath must be configured.; FileManager:MaxUploadMegabytes must be between 1 and 102400.
```

Fix: set `Environment=ASPNETCORE_CONTENTROOT=/opt/nodepilot/backend` in the unit. With it set, the backend starts, `/health` is Healthy, and `data/` is created in the working directory as intended.

Do not fix it in code with `ContentRootPath = AppContext.BaseDirectory`: under `dotnet run` the content root would become `bin/Debug/net10.0`, and edits to the source `appsettings.json` would no longer reload.

Settings should not be changed by editing `/opt/nodepilot/backend/appsettings.json`: it needs root and is overwritten on every update. Overrides go into `/etc/nodepilot/nodepilot.env` as environment variables (`Monitoring__Collection__IntervalSeconds=30`). See also task 9 (settings reload).

### 2. Runtimes installed in a home folder

`start.sh` gets Node through nvm (`~/.nvm`), and .NET is often installed with `dotnet-install.sh` into `~/.dotnet`. The `nodepilot` user cannot read either, and `ProtectHome=` would hide them anyway.

- Backend: publish self-contained (`dotnet publish -c Release -r linux-arm64 --self-contained`, or `linux-x64`). No .NET runtime is needed on the server.
- Web: Node must be installed system-wide (distro package or NodeSource) so `/usr/bin/node` exists.

### 3. Listen addresses are implicit

Without `ASPNETCORE_URLS` or `--urls`, Kestrel binds `http://localhost:5000`. Behind nginx this happens to work, but it depends on a default; without nginx the browser calls `<host>:5000` directly and every device on the LAN gets connection errors.

The web app's `server.js` binds to `$HOSTNAME`. systemd does not set it, and the fallback in `server.js` is `0.0.0.0`, so behind nginx port 3000 stays open to the LAN unless `HOSTNAME` is set.

Fix: set both explicitly in the units (`ASPNETCORE_URLS`, `HOSTNAME`, `PORT`). Values for each setup are in the table under "With and without nginx".

### 4. The web build and the backend disagree about nginx

Behind nginx three settings must match, and a mismatch shows up only in the browser:

- web built without `NEXT_PUBLIC_API_URL=/`: the page calls `<host>:5000`, which is bound to `127.0.0.1` and unreachable;
- `ReverseProxy__Enabled` not set: login works, but one device's wrong passwords lock out every device, and the cookie is not `Secure`;
- `client_max_body_size` in `nodepilot.conf` lower than `FileManager:MaxUploadMegabytes`: large uploads fail with 413 from nginx.

`scripts/publish.sh` should take the mode as an argument (e.g. `--behind-proxy`) and set `NEXT_PUBLIC_API_URL` accordingly, since it cannot be changed after the build.

## What has to be done before creating the services

### Data folder permissions

Observed after the first start:

```
755  data/
755  data/keys/
644  data/nodepilot.db
600  data/keys/key-*.xml
```

The database holds password hashes and the encrypted Pi-hole password, and the key ring decrypts every session cookie. Neither folder should be readable by other local users.

- Use `StateDirectory=nodepilot` in the unit. systemd creates `/var/lib/nodepilot` owned by the service user with mode `0700`, and makes it writable under `ProtectSystem=strict` without listing it in `ReadWritePaths`.
- Still create `data/keys` with `File.SetUnixFileMode(path, UserRead | UserWrite | UserExecute)` in `AddInfrastructure` (task 1 leftover), so the keys are protected regardless of how the folder was set up.

On first start the log shows `XmlKeyManager[35]: No XML encryptor configured. Key may be persisted to storage in unencrypted form.` This is expected; the file permissions are the protection. Document it.

### Validate the files root at startup

`FileManagerService` is a lazily created singleton, and its constructor calls `Directory.CreateDirectory(root)`. If the root is not writable (missing from `ReadWritePaths`, wrong owner, mount not present), the backend starts and reports Healthy, and every `/api/files` request returns 500 from an exception in that constructor.

- Add a `ValidateOnStart` check for `FileManagerSettings`: resolve the root, create it, check that it is a directory and writable, and fail with a clear message.
- Put the system root check in the same place: refuse `/` (and optionally `/etc`, `/boot`, `/usr`, …) unless `FileManager:AllowSystemRoot=true`. Add a unit test.
- If a path listed in `ReadWritePaths` does not exist, systemd refuses to start the service (`status=226/NAMESPACE`). Create it in the install script, or prefix it with `-` (`ReadWritePaths=-/srv/media`).

### Upload buffering location

nginx streams uploads straight through (`proxy_request_buffering off` on `/api/files/upload`), so the only buffering happens in the backend.

`Request.ReadFormAsync` buffers every uploaded file over 64 KB to `ASPNETCORE_TEMP`, or to `/tmp` when that is unset. On Debian 13, Fedora and Arch `/tmp` is tmpfs, so with `PrivateTmp=true` a 4 GB video is buffered in RAM. On a Raspberry Pi the upload fails or the process is OOM-killed.

- Set `Environment=ASPNETCORE_TEMP=/var/lib/nodepilot/tmp`, ideally on the same disk as the files root, and create the folder.
- Better: stream the multipart body straight to the target with `MultipartReader` instead of `ReadFormAsync`. This also removes the second full write of every upload.

### Interrupted uploads

`FileManagerService.SaveAsync` writes directly to the final file name. Cleanup of partial files only runs in the `catch` block. `proxy_read_timeout 1h` keeps long uploads alive through nginx, but not through a backend restart: if the process is stopped mid-upload (`systemctl restart`, an update, SIGKILL after `TimeoutStopSec`), the partial file stays under the real name, looks complete in the listing, and blocks a retry with 409.

Fix: write to `.<name>.partial` in the same folder and `File.Move` it to the final name when the copy finishes. Listings already skip dotfiles. Task 7 (replace on conflict) needs the same temp-then-move pattern.

### Ownership and umask of uploaded files

With `UMask=0077` uploads are created `600` and owned by `nodepilot`. If the files root is also used by Samba, a media server or the admin's own user, they cannot read the files.

If the folder is shared, use a group instead:

```ini
Group=media
UMask=0007
```

and `chmod 2775 /srv/media` so new files inherit the group. The data folder stays private through `StateDirectory` and the explicit `data/keys` mode, independent of the umask.

### `.env` lookup

`DatabaseExtensions.LoadDotEnv()` walks up from the working directory to the filesystem root and loads the first `.env` it finds. Under systemd that means `/var/lib/nodepilot/.env`, then `/var/lib/.env`, `/var/.env`, `/.env`. This is surprising behaviour for a service and duplicates `EnvironmentFile=`.

- Only look in the working directory, or skip loading when running under systemd (`INVOCATION_ID` is set).
- The comment in `Program.cs` still mentions `Auth__Password`, which no longer exists.

### systemd integration and logging

- Add `Microsoft.Extensions.Hosting.Systemd` and call `builder.Host.UseSystemd()`, then use `Type=notify`. `systemctl start` then waits until migrations are applied and Kestrel is listening, log levels map to journal priorities, and SIGTERM triggers a clean shutdown.
- `appsettings.json` sets `"NodePilot": "Debug"`, which logs every metric sample (every 15 s) into the journal. `start.sh` already overrides it for this reason. Set it to `Information` in the shipped file.

### Hardening options to avoid

- `ProcSubset=pid` and `ProtectProc=invisible` hide `/proc/stat` and `/proc/meminfo`; CPU and RAM metrics stop working.
- `ProtectHome=true` hides `/home`; only use it if the files root is not under `/home`.
- `ProtectSystem=strict`, `PrivateTmp=true` and `NoNewPrivileges=true` are fine: `/proc`, `/sys/class/thermal`, `/sys/class/hwmon` and `DriveInfo("/")` stay readable.
- Check the temperature sensor on the target board as the service user (`sudo -u nodepilot cat /sys/class/thermal/thermal_zone*/temp`).

### First start

The setup wizard is open to anyone on the LAN until the admin account exists (`auth-architecture-proposal.md` §2.2 describes a setup code). The install docs must say to open the panel and create the admin account immediately after `systemctl enable --now`.

### Docs to update

- README: a "Native install" section (publish, create user, copy units, enable, set up nginx). The "Behind nginx" section starts the backend with `ReverseProxy__Enabled=true dotnet run`; for the native install point to `/etc/nodepilot/nodepilot.env` instead.
- `system-monitoring.md`: hostname and the `/` filesystem are the host's real values in a native install.
- `files-and-media.md`: files belong to the service user (or the shared group); the private `/tmp` and `ASPNETCORE_TEMP` need space for the largest upload.

### Optional

- The disk metric only reports `/`. If the media lives on a separate disk (`/srv/media` on a USB drive), its usage is not shown. Report the drive that holds the files root as well.
- Backups: copy `/var/lib/nodepilot/data` as a whole. While the service runs, copy the database with `sqlite3 nodepilot.db ".backup backup.db"` instead of `cp`, because of the WAL files.

### Suggested order

1. `ASPNETCORE_CONTENTROOT`, `ASPNETCORE_URLS` and `HOSTNAME` in the units; self-contained publish; `--behind-proxy` in the publish script.
2. Startup validation of the files root, including the system root check.
3. Data folder permissions (`StateDirectory`, `data/keys` mode).
4. `ASPNETCORE_TEMP` and partial-file uploads.
5. `UseSystemd()` and the log level.
6. `.env` lookup, unit files, `scripts/publish.sh`, docs.

## What it opens up

Once NodePilot runs as a regular systemd service with a fixed filesystem layout, it can be distributed the way other Linux server software is.

### Install script

A single `scripts/install.sh` that downloads a release archive, creates the `nodepilot` user, copies files to `/opt/nodepilot`, installs the units and runs `systemctl enable --now`. Updating is the same script with a newer archive. This is the smallest step and a prerequisite for everything below.

### Release archives from CI

CI builds self-contained backends per architecture (`linux-x64`, `linux-arm64`, `linux-arm` for 32-bit Pi OS) plus the web build, and attaches `nodepilot-<version>-<arch>.tar.gz` to GitHub releases. Users no longer need the .NET SDK or `npm` on the server.

### Debian / Ubuntu / Raspberry Pi OS packages (`.deb`)

The layout above is already what a Debian package expects:

- files in `/opt/nodepilot` (or `/usr/lib/nodepilot`), units in `/lib/systemd/system/`, config in `/etc/nodepilot/` marked as a conffile so upgrades keep local edits;
- `postinst` creates the system user (`adduser --system`), runs `systemctl daemon-reload` and enables the services;
- `prerm`/`postrm` stop and disable the services; `purge` removes `/var/lib/nodepilot`;
- `Depends: nodejs (>= 20)`, with no .NET dependency because the backend is self-contained;
- `Recommends: nginx`, with `nodepilot.conf` installed to `/etc/nginx/sites-available/` and `make-cert.sh` run from `postinst` when no certificate exists. A separate `nodepilot-nginx` package is an alternative for users who run their own proxy.

Tools: `dpkg-deb` directly, or `nfpm` / `fpm` to build `.deb` and `.rpm` from one config. Publishing an APT repository (GitHub Pages, Cloudsmith, packagecloud) then allows:

```bash
sudo apt install nodepilot
sudo apt upgrade        # updates NodePilot with the rest of the system
```

On a Raspberry Pi this is the most natural install path.

### Other package formats

- **RPM** (Fedora, openSUSE): same units, built from the same `nfpm` config.
- **AUR** (Arch): a `PKGBUILD` that downloads the release archive and installs the units.
- **Nix**: a NixOS module can declare the service, user and hardening options.

### Further systemd features

- `DynamicUser=yes`: systemd allocates the service user on the fly, so the package does not need to create one. Works together with `StateDirectory`.
- Socket activation, or a `nodepilot.target` that groups both services so `systemctl restart nodepilot.target` restarts everything.
- Timers instead of in-process background loops (e.g. a `nodepilot-backup.timer` for nightly database backups).
- `systemd-analyze security nodepilot-backend` to score and tighten the sandbox.
- Unix sockets instead of TCP ports between nginx and the services (`ListenUnixSocket` in Kestrel, `proxy_pass http://unix:/run/nodepilot/backend.sock`), so no local port is open at all. `ReverseProxy:KnownProxies` would then need adjusting, since there is no remote IP.
