#!/usr/bin/env bash
#
# Stops a NodePilot started with ./start.sh, from any terminal:
#   the start script itself, the backend (port 5000) and the web app (port 3000).
#
# Usage:  ./stop.sh
#
# Only processes running from this folder are stopped; another program that happens to use
# port 3000 or 5000 is left alone. For the Docker setup use 'docker compose down'.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTS=(5000 3000)

case "${1:-}" in
	"") ;;
	-h | --help)
		sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*)
		echo "Unknown option: $1 (see ./stop.sh --help)" >&2
		exit 1
		;;
esac

info() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

# True when the process runs from inside this NodePilot folder.
belongs_here() {
	local cwd
	cwd="$(readlink "/proc/$1/cwd" 2>/dev/null)" || return 1
	[[ "$cwd" == "$ROOT" || "$cwd" == "$ROOT"/* ]]
}

port_pids() {
	ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u
}

PIDS=()

# True when the process is a shell running start.sh (not, say, an editor with the file open).
runs_start_script() {
	local args
	mapfile -d '' -t args <"/proc/$1/cmdline" 2>/dev/null || return 1
	[[ "${args[0]##*/}" =~ ^(bash|sh)$ && "${args[1]:-}" == *start.sh ]]
}

# 1. The start script: stopping it runs its own cleanup, exactly like Ctrl+C in its terminal.
for pid in $(pgrep -f 'start\.sh' || true); do
	if belongs_here "$pid" && runs_start_script "$pid"; then
		PIDS+=("$pid")
	fi
done

# 2. Servers still listening on NodePilot's ports (e.g. started by hand or left behind).
for port in "${PORTS[@]}"; do
	for pid in $(port_pids "$port"); do
		if belongs_here "$pid"; then
			PIDS+=("$pid")
		else
			warn "Port $port is used by '$(ps -o comm= -p "$pid" 2>/dev/null)' (pid $pid) from another folder; leaving it alone."
		fi
	done
done

if [ "${#PIDS[@]}" -eq 0 ]; then
	info "NodePilot is not running."
	exit 0
fi

info "Stopping NodePilot"
kill -TERM "${PIDS[@]}" 2>/dev/null || true

# Give the servers up to 10 seconds to shut down cleanly, then force what is left.
for _ in $(seq 1 20); do
	alive=()
	for pid in "${PIDS[@]}"; do
		kill -0 "$pid" 2>/dev/null && alive+=("$pid")
	done
	[ "${#alive[@]}" -eq 0 ] && break
	sleep 0.5
done

if [ "${#alive[@]}" -gt 0 ]; then
	warn "Forcing ${#alive[@]} process(es) to stop"
	kill -KILL "${alive[@]}" 2>/dev/null || true
fi

# Forget the phone's USB port forwarding set up by start.sh, if any.
if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -qw "device$"; then
	adb reverse --remove tcp:3000 >/dev/null 2>&1 || true
	adb reverse --remove tcp:5000 >/dev/null 2>&1 || true
fi

for port in "${PORTS[@]}"; do
	for pid in $(port_pids "$port"); do
		belongs_here "$pid" && warn "Something from NodePilot is still on port $port (pid $pid)."
	done
done

info "NodePilot stopped."
