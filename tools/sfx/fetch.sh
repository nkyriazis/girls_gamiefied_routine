#!/bin/sh
# Downloads the Kenney sound packs (CC0) the palette is chosen from, into packs/
set -e
cd "$(dirname "$0")"
mkdir -p packs
for p in interface-sounds ui-audio digital-audio casino-audio impact-sounds rpg-audio; do
  [ -d "packs/$p" ] && continue
  url=$(curl -sL "https://kenney.nl/assets/$p" | grep -oE 'https://kenney.nl/media/pages/assets/[^"]+\.zip' | head -1)
  curl -sL -o "packs/$p.zip" "$url"
  unzip -qo "packs/$p.zip" -d "packs/$p" && rm "packs/$p.zip" && chmod -R u+w "packs/$p"
  echo "$p"
done
