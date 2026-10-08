#!/bin/sh
# Points HTTPS_DOMAIN (<name>.duckdns.org) at this host's LAN address, now and every 30 minutes (the
# address a phone on the home Wi-Fi reaches), then runs Caddy, which gets and renews the certificate.
set -u
: "${HTTPS_DOMAIN:?set HTTPS_DOMAIN in .env, e.g. kyriazis-home.duckdns.org}"
: "${DUCKDNS_TOKEN:?set DUCKDNS_TOKEN in .env (duckdns.org, top of the page after signing in)}"
name=${HTTPS_DOMAIN%.duckdns.org}

lan_ip() {
  [ -n "${HTTPS_LAN_IP:-}" ] && { echo "$HTTPS_LAN_IP"; return; }
  ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}

point() {
  ip=$(lan_ip)
  if [ -z "$ip" ]; then echo "https: no LAN address found (set HTTPS_LAN_IP in .env)"; return; fi
  answer=$(wget -qO- "https://www.duckdns.org/update?domains=$name&token=$DUCKDNS_TOKEN&ip=$ip" 2>&1)
  if [ "$answer" = "OK" ]; then echo "https: $HTTPS_DOMAIN → $ip"
  else echo "https: DuckDNS refused the update ($answer): check DUCKDNS_TOKEN and the name in HTTPS_DOMAIN"; fi
}

point
( while sleep 1800; do point >/dev/null; done ) &
exec caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
