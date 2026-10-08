#!/bin/bash
# The deploy's secrets, encrypted in the repo (secrets.env.age at the root): a dotenv fragment that
# deploy-rpi.sh copies into .env. age (age-encryption.org) in passphrase mode, run in a throwaway
# Alpine container, so neither machine installs anything. The repo is public: only the passphrase
# opens the file, so make it a long one.
#
#   tools/secrets/vault.sh edit        (dev machine) decrypt, edit, encrypt again; asks the passphrase
#   tools/secrets/vault.sh provision   (deploy-rpi.sh) copy the vault into .env, asking the passphrase
#                                      only when the vault is new or changed since the last copy
#
# In .env the copy is one marked block, stamped with the vault's sha256; deploy-rpi.sh never touches
# anything else there. Change a secret with `edit`, commit, deploy: the new stamp makes it ask again.
set -euo pipefail

cd "$(dirname "$0")/../.."
VAULT=secrets.env.age
ENV=.env
BEGIN='# >>> secrets.env.age'
END='# <<< secrets.env.age'
AGE_IMAGE=alpine:3.20

# age inside the container: $1 = what to run after `age` is installed; the work dir is mounted at /w
age_run() {
    local work=$1; shift
    docker run --rm -it -v "$PWD":/repo -v "$work":/w -w /repo "$AGE_IMAGE" \
        sh -c "apk add -q --no-progress age >/dev/null && $* && chown -R $(id -u):$(id -g) /w"
}

stamp() { sha256sum "$VAULT" | cut -c1-64; }

edit() {
    local work; work=$(mktemp -d); chmod 700 "$work"
    trap 'rm -rf "$work"' EXIT
    if [ -f "$VAULT" ]; then
        echo "🔐 Decrypting $VAULT (its passphrase)..."
        age_run "$work" "age -d -o /w/secrets.env $VAULT"
    else
        # A new vault, prefilled; the DuckDNS token from ~/.routine-duckdns-token if it is there
        local token=""; [ -f ~/.routine-duckdns-token ] && token=$(tr -d ' \r\n' < ~/.routine-duckdns-token)
        cat > "$work/secrets.env" <<EOF
# The Pi's secrets, copied into .env by deploy-rpi.sh. KEY=value lines; # comments are fine.
# https on the home network (HTTPS.md)
COMPOSE_PROFILES=https
HTTPS_DOMAIN=<name>.duckdns.org
DUCKDNS_TOKEN=$token
EOF
    fi
    local before; before=$(sha256sum "$work/secrets.env")
    "${EDITOR:-nano}" "$work/secrets.env"
    if [ -f "$VAULT" ] && [ "$(sha256sum "$work/secrets.env")" = "$before" ]; then
        echo "Nothing changed; $VAULT left as it was."; return
    fi
    echo "🔐 Encrypting (choose the passphrase; age asks twice)..."
    age_run "$work" "age -p -o /w/secrets.env.age /w/secrets.env"
    mv "$work/secrets.env.age" "$VAULT"
    echo "✅ $VAULT written. Commit it; the next deploy asks the passphrase once and copies it into .env."
}

provision() {
    [ -f "$VAULT" ] || { echo "🔐 No $VAULT: no secrets to copy."; return; }
    local now; now=$(stamp)
    if grep -qsF "$BEGIN sha256=$now " "$ENV"; then
        echo "🔐 Secrets: .env already has this vault (no passphrase needed)."; return
    fi
    if ! [ -t 0 ]; then
        echo "⚠️  $VAULT is new or changed, but nobody is at the keyboard to give its passphrase."
        echo "   Deploying with the secrets .env has now; run tools/secrets/vault.sh provision to copy them."
        return
    fi
    echo "🔐 $VAULT is new or changed: its passphrase, to copy it into .env."
    local work; work=$(mktemp -d); chmod 700 "$work"
    local tries=0
    until age_run "$work" "age -d -o /w/secrets.env $VAULT"; do
        tries=$((tries + 1))
        if [ $tries -ge 3 ]; then rm -rf "$work"; echo "⛔ Could not decrypt $VAULT. Nothing was stopped: the site is still up."; exit 1; fi
        echo "   Wrong passphrase? Try again ($tries of 3)."
    done
    # .env without the old block, then the new one; only KEY=value lines go in
    touch "$ENV"
    {
        awk -v b="$BEGIN" -v e="$END" 'index($0, b) == 1 { skip = 1; next } index($0, e) == 1 { skip = 0; next } !skip' "$ENV"
        echo "$BEGIN sha256=$now (written by deploy-rpi.sh: change the vault, not these lines)"
        grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$work/secrets.env" || true
        echo "$END"
    } > "$work/env.new"
    chmod 600 "$work/env.new"
    mv "$work/env.new" "$ENV"
    local keys; keys=$(grep -cE '^[A-Za-z_][A-Za-z0-9_]*=' "$work/secrets.env" || true)
    rm -rf "$work"
    echo "✅ Copied $keys settings from $VAULT into .env."
}

case "${1:-}" in
    edit) edit ;;
    provision) provision ;;
    *) echo "usage: $0 edit | provision"; exit 2 ;;
esac
