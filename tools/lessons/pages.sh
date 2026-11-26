#!/usr/bin/env bash
# Render pages of a book in materials/ as images, with each page's text beside them, for preparing a lesson.
#   tools/lessons/pages.sh <pdf under materials/pdf> <first page> <last page> <out dir>
#   tools/lessons/pages.sh 10-0118-02_Istoria_E-Dimotikou_Vivlio-Mathiti.pdf 46 47 tools/lessons/work/istoria-e-14
# Pages are the PDF's own (index.py's «σελ. N»), not the numbers printed on them. Writes page-<n>.png (150 dpi)
# and page-<n>.txt (pdftotext -layout). The text keeps the book's spelling; the image shows what belongs where
# (main text, captions, sources, footnotes), which the text alone mixes up. Runs in the edu-materials image.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 4 ] || { sed -n 2,4p "$0"; exit 2; }
pdf="materials/pdf/$1"; first=$2; last=$3; out=$4
[ -f "$pdf" ] || { echo "No $pdf (tools/edu-materials/mirror.sh fetches the books)" >&2; exit 1; }
IMAGE=edu-materials-tools
docker image inspect $IMAGE >/dev/null 2>&1 || docker build -q -t $IMAGE tools/edu-materials >/dev/null
mkdir -p "$out"
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w $IMAGE sh -euc '
  for p in $(seq "$2" "$3"); do
    pdftoppm -f "$p" -l "$p" -r 150 -png -singlefile "$1" "$4/page-$p"
    pdftotext -f "$p" -l "$p" -layout "$1" "$4/page-$p.txt"
    echo "$4/page-$p.png  $4/page-$p.txt"
  done' sh "$pdf" "$first" "$last" "$out"
