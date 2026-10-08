# https on the home network

The Pi serves the app on plain `http://<pi>/`. That works everywhere, but browsers allow some features only on https: the service worker (offline start, «Add to Home Screen» as an app) and the clipboard (#108 has a fallback). `https/` adds an optional Caddy container that serves the same app at `https://<name>.duckdns.org` with a real Let's Encrypt certificate, so phones and tablets need no setup at all (#113).

Nothing comes in from the internet. The name points at the Pi's **LAN** address, so only devices on the home Wi-Fi reach it. Let's Encrypt checks the certificate through a DNS record on DuckDNS, not by connecting to the house, so CGNAT and closed ports don't matter.

## Turn it on (once)

1. Sign in at <https://www.duckdns.org> (Google or GitHub), add a name (e.g. `kyriazis-home`), and copy the **token** shown at the top of the page. Leave the IP field alone: the Pi sets it.
2. Add three lines to the Pi's `.env`:
   ```
   COMPOSE_PROFILES=https
   HTTPS_DOMAIN=kyriazis-home.duckdns.org
   DUCKDNS_TOKEN=<the token>
   ```
3. Deploy (`./deploy-rpi.sh`). Then `docker logs routine-https-1` (or `docker-compose ... logs https`) shows `https: kyriazis-home.duckdns.org → 192.168.x.y`, and within a minute Caddy logs `certificate obtained successfully`.

Open `https://kyriazis-home.duckdns.org` on any device on the home Wi-Fi. `http://<pi>/` keeps working as before; nothing redirects to https.

## What it does

- Every 30 minutes, and at start, it sets the DuckDNS name to the Pi's LAN address (the source address of its default route; `HTTPS_LAN_IP` in `.env` overrides it).
- Caddy gets the certificate through DuckDNS (DNS-01), renews it by itself, and keeps it in `./https-data` (git-ignored, not backed up: it is remade at will).
- It forwards everything to the frontend's nginx on `127.0.0.1:${FRONTEND_PORT:-80}`, so `/api`, `/ws` (as `wss://`) and `/uploads` work exactly as on http. It listens on 443 (`HTTPS_PORT` to change it). nginx keeps port 80.

## If it doesn't work

- **The name doesn't resolve at home, but does on mobile data:** the router's DNS rebinding protection refuses public names that point at a home address. Allow `duckdns.org` in it (FRITZ!Box: Heimnetz → Netzwerk → Netzwerkeinstellungen → DNS-Rebind-Schutz; others usually have a similar list), or set the phones' DNS to 1.1.1.1.
- **`DuckDNS refused the update (KO)`:** the token or the name in `HTTPS_DOMAIN` is wrong.
- **No certificate:** `docker logs` shows Caddy's reason. Let's Encrypt allows only a few failed tries an hour, so fix the cause before restarting it repeatedly.

The image is `ghcr.io/nkyriazis/routine-https`, built by `build.sh` with the other two. `deploy-rpi.sh`'s rollback lines cover the backend and frontend only; this container holds no data, and an older `sha-` tag in `docker-compose.release.yml` brings it back.
