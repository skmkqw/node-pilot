#!/usr/bin/env bash
#
# Creates the HTTPS certificate used by deploy/nginx/nodepilot.conf:
#   /etc/nginx/ssl/nodepilot.crt and /etc/nginx/ssl/nodepilot.key
#
# With mkcert installed, the certificate comes from a local CA that this computer trusts
# (install the CA on phones too, see `mkcert -CAROOT`). Without it, openssl creates a
# self-signed certificate and browsers show a warning once.
#
# Usage:  sudo deploy/nginx/make-cert.sh [hostname]     (default: nodepilot.home)

set -euo pipefail

HOST="${1:-nodepilot.home}"
OUT_DIR=/etc/nginx/ssl
CRT="$OUT_DIR/nodepilot.crt"
KEY="$OUT_DIR/nodepilot.key"

info() { printf '\033[1;36m▸\033[0m %s\n' "$*"; }
fail() {
	printf '\033[1;31m✖ %s\033[0m\n' "$*" >&2
	exit 1
}

[ "$(id -u)" -eq 0 ] || fail "Run as root: sudo $0 $*"

# The address of the interface used for the default route (same as start.sh), so the panel
# can also be opened as https://<lan-ip>.
LAN_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}' || true)"
NAMES=("$HOST" localhost 127.0.0.1 ::1)
[ -n "$LAN_IP" ] && NAMES+=("$LAN_IP")

mkdir -p "$OUT_DIR"

if command -v mkcert >/dev/null 2>&1; then
	info "Creating a certificate with mkcert for: ${NAMES[*]}"
	mkcert -install
	mkcert -cert-file "$CRT" -key-file "$KEY" "${NAMES[@]}"
elif command -v openssl >/dev/null 2>&1; then
	SAN="DNS:$HOST,DNS:localhost,IP:127.0.0.1,IP:::1"
	[ -n "$LAN_IP" ] && SAN="$SAN,IP:$LAN_IP"

	info "Creating a self-signed certificate for: $SAN"
	openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
		-subj "/CN=$HOST" \
		-addext "subjectAltName=$SAN" \
		-keyout "$KEY" -out "$CRT"
else
	fail "Install mkcert (recommended) or openssl first."
fi

chmod 600 "$KEY"
chmod 644 "$CRT"

info "Done: $CRT"
echo "  Reload nginx:  sudo nginx -t && sudo systemctl reload nginx"
[ -n "$LAN_IP" ] && echo "  Name lookup:   add \"$LAN_IP $HOST\" to /etc/hosts (or your router's DNS)"
