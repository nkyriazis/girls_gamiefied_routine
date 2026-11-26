#!/usr/bin/env bash
# Check a prepared lesson and zip it into a package for the parents' page (see README.md).
#   tools/lessons/pack.sh tools/lessons/work/istoria-e-14/package tools/lessons/work/istoria-e-14.zip
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -eq 2 ] || { sed -n 2,3p "$0"; exit 2; }
[ -d backend/node_modules/fflate ] || { echo "backend/node_modules has no fflate: run npm install in the backend dev container" >&2; exit 1; }
docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/w -w /w node:24-alpine node tools/lessons/pack.mjs "$1" "$2"
