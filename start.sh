#!/usr/bin/env bash
#
# Starts NodePilot for local development in one terminal:
#   backend (ASP.NET Core) on port 5000 + web app (Next.js) on port 3000.
#
# Usage:  ./start.sh            start everything
#         ./start.sh --clean    also clear the Next.js cache first (fixes reload loops)
#         ./start.sh --install  reinstall web dependencies first
#
# Press Ctrl+C once to stop both servers.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/apps/backend/src/NodePilot.Api"
WEB_DIR="$ROOT/apps/web"
BACKEND_PORT=5000
WEB_PORT=3000

CLEAN=false
INSTALL=false

for arg in "$@"; do
	case "$arg" in
		--clean) CLEAN=true ;;
		--install) INSTALL=true ;;
		-h | --help)
			sed -n '3,10p' "$0" | sed 's/^# \{0,1\}//'
			exit 0
			;;
		*)
			echo "Unknown option: $arg (see ./start.sh --help)" >&2
			exit 1
			;;
	esac
done

info() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }
fail() {
	printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2
	exit 1
}

# --- Requirements -------------------------------------------------------------

command -v dotnet >/dev/null 2>&1 || fail ".NET SDK 10 is required: https://dotnet.microsoft.com/download/dotnet/10.0"
dotnet --list-sdks | grep -q '^10\.' || fail ".NET SDK 10 is required (installed: $(dotnet --list-sdks | cut -d' ' -f1 | tr '\n' ' '))"

node_ok() {
	command -v node >/dev/null 2>&1 &&
		node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a===20&&b>=9)?0:1)'
}

# Next.js 16 needs Node 20.9+. If the default Node is older, switch through nvm when available.
if ! node_ok; then
	NVM_SCRIPT="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
	if [ -s "$NVM_SCRIPT" ]; then
		# shellcheck disable=SC1090
		set +u && . "$NVM_SCRIPT" && set -u
		info "Switching to Node 22 with nvm"
		set +u
		nvm use 22 >/dev/null 2>&1 || nvm install 22
		set -u
	fi
	node_ok || fail "Node.js 20.9 or newer is required (found: $(node -v 2>/dev/null || echo none)). Install it, e.g. 'nvm install 22'."
fi

for port in "$BACKEND_PORT" "$WEB_PORT"; do
	if ss -ltn 2>/dev/null | grep -q ":$port "; then
		fail "Port $port is already in use. Is NodePilot already running? Stop it first."
	fi
done

# --- Dependencies -------------------------------------------------------------

if $CLEAN; then
	info "Clearing the Next.js cache"
	rm -rf "$WEB_DIR/.next"
fi

if $INSTALL || [ ! -d "$WEB_DIR/node_modules" ]; then
	info "Installing web dependencies (first run takes a minute)"
	(cd "$WEB_DIR" && npm ci --no-audit --no-fund)
fi

info "Building the backend"
dotnet build "$ROOT/apps/backend/NodePilot.slnx" -v quiet -nologo | grep -E "error|Build succeeded" || true

# --- Start ---------------------------------------------------------------------

cleanup() {
	trap - INT TERM EXIT
	echo
	info "Stopping NodePilot"
	kill 0 2>/dev/null || true
}
trap cleanup INT TERM EXIT

info "Starting backend on port $BACKEND_PORT and web app on port $WEB_PORT"

# Info-level logs keep the shared terminal readable (the dev profile logs every metric sample).
(cd "$BACKEND_DIR" && Logging__LogLevel__NodePilot=Information dotnet run --no-build --launch-profile http 2>&1 | sed -u 's/^/[backend] /') &
(cd "$WEB_DIR" && npm run dev 2>&1 | sed -u 's/^/[web]     /') &

for _ in $(seq 1 120); do
	if curl -sf -o /dev/null "http://localhost:$BACKEND_PORT/health" && curl -sf -o /dev/null "http://localhost:$WEB_PORT/api/health"; then
		break
	fi
	sleep 1
done

# A phone connected over USB (with USB debugging) reaches the laptop through the cable.
PHONE=""
if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -qw "device$"; then
	if adb reverse "tcp:$WEB_PORT" "tcp:$WEB_PORT" >/dev/null && adb reverse "tcp:$BACKEND_PORT" "tcp:$BACKEND_PORT" >/dev/null; then
		PHONE="http://localhost:$WEB_PORT"
	fi
fi

# The address of the interface used for the default route, i.e. the real Wi-Fi/Ethernet one
# (not Docker or VM bridges).
LAN_IPS="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' || true)"

echo
printf '\033[1;33m%s\033[0m\n' "================  NodePilot is running  ================"
echo "  This computer:     http://localhost:$WEB_PORT"
for ip in $LAN_IPS; do
	echo "  Phone (Wi-Fi):     http://$ip:$WEB_PORT   (same network)"
done
if [ -n "$PHONE" ]; then
	echo "  Phone (USB cable): $PHONE   (forwarding is set up)"
else
	echo "  Phone (USB cable): plug it in (USB debugging on), then in another terminal run:"
	echo "                     adb reverse tcp:$WEB_PORT tcp:$WEB_PORT && adb reverse tcp:$BACKEND_PORT tcp:$BACKEND_PORT"
	echo "                     and open http://localhost:$WEB_PORT on the phone"
fi
echo "  Stop:              Ctrl+C"
printf '\033[1;33m%s\033[0m\n' "========================================================"
echo

wait
