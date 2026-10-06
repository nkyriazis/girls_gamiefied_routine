#!/bin/bash
# publish.sh <issue>: the evidence .evidence/<issue>/PR.md cites goes to the pr-evidence branch under <issue>/,
# and .evidence/<issue>/PR.published.md is the description with links that GitHub shows (images inline).
# Outward-facing (it pushes): run it when the owner says to ship.
set -e
n=$1; [ -n "$n" ] || { echo "usage: publish.sh <issue>" >&2; exit 1; }
repo=$(cd "$(dirname "$0")/../.." && pwd); dir="$repo/.evidence/$n"
[ -f "$dir/PR.md" ] || { echo "no $dir/PR.md" >&2; exit 1; }
slug=$(git -C "$repo" remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')
base="https://raw.githubusercontent.com/$slug/pr-evidence/$n"
# The files PR.md links by bare name, that exist
mapfile -t files < <(grep -oE '\]\([^)/:]+\)' "$dir/PR.md" | sed -E 's/^\]\(|\)$//g' | sort -u | while read -r f; do [ -f "$dir/$f" ] && echo "$f"; done)
[ ${#files[@]} -gt 0 ] || { echo "PR.md cites no evidence files" >&2; exit 1; }
wt=$(mktemp -d)
trap 'git -C "$repo" worktree remove --force "$wt" >/dev/null 2>&1 || true; rm -rf "$wt"' EXIT
if git -C "$repo" fetch -q origin pr-evidence 2>/dev/null; then
  git -C "$repo" worktree add -q --detach "$wt" FETCH_HEAD
else
  git -C "$repo" worktree add -q --detach "$wt" HEAD
  git -C "$wt" switch -q --orphan pr-evidence-new
  printf '# PR evidence\n\nScreenshots and videos linked from the PRs, one folder per issue (tools/evidence).\n' > "$wt/README.md"
  git -C "$wt" add README.md
fi
mkdir -p "$wt/$n"
for f in "${files[@]}"; do cp "$dir/$f" "$wt/$n/$f"; git -C "$wt" add "$n/$f"; done
git -C "$wt" commit -q -m "chore: evidence for #$n" || echo "evidence unchanged"
git -C "$wt" push -q origin HEAD:refs/heads/pr-evidence
# The description, with each bare name pointing at the published file
cp "$dir/PR.md" "$dir/PR.published.md"
for f in "${files[@]}"; do sed -i "s#](${f//./\\.})#]($base/$f)#g" "$dir/PR.published.md"; done
echo "published ${#files[@]} files to $base/"; echo "$dir/PR.published.md"
