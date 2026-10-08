# https on the LAN with a real certificate, no per-device setup (#113). Caddy with the DuckDNS DNS plugin:
# Let's Encrypt checks a TXT record on DuckDNS, so nothing has to reach the house (CGNAT is fine).
# The binary is cross-compiled on the build machine (Go needs no emulation); the per-arch stage runs nothing.
FROM --platform=$BUILDPLATFORM caddy:2-builder AS builder
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:2-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY https/Caddyfile /etc/caddy/Caddyfile
COPY https/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
