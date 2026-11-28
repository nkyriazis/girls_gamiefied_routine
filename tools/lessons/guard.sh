#!/usr/bin/env bash
# The guard of a lesson-making stage: an agent that makes or fixes a lesson changes that lesson's source and nothing
# else. Not the checks, not the scripts, not the briefs, not another lesson, not what the owner signed off.
#   tools/lessons/guard.sh snap  <id or ->     before the agents: remember every protected file (work/<id>/.guard)
#   tools/lessons/guard.sh check <id or -> [--rules-may-grow]
#                                              after: list what changed (exit 1), and run the checks' own test
# Protected: tools/lessons (all but work/), the skill and its briefs (all but corrections.md, which only grows),
# the workflow, the format (shared/lessons.ts, backend/lesson.schema.json), the gendered-words list, every other
# lesson's source, and the speech rules. --rules-may-grow (the apply stage, after apply.mjs has run): rules may be
# added, pending only; no rule or case there before may change or go.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ $# -ge 2 ] || { sed -n 2,11p "$0"; exit 2; }
what=$1; id=$2; grow=${3:-}; work=tools/lessons/work
keep=${LESSON_GUARD_KEEP:-$work/$([ "$id" = - ] && echo "" || echo "$id/").guard}   # (the variable: for trying the guard itself)
rules=tools/lessons/speech/rules.json
sums() {
  { find tools/lessons .claude/skills/lesson-package -type f \
      -not -path "$work/*" -not -path '*/__pycache__/*' -not -name corrections.md -not -path "$rules"
    find "$work" -mindepth 2 -maxdepth 2 -name lesson.src.json -not -path "$work/$id/*" 2>/dev/null
    ls .claude/workflows/lesson.js shared/lessons.ts backend/lesson.schema.json frontend/scripts/gendered.mjs 2>/dev/null || true
  } | LC_ALL=C sort | xargs -d '\n' sha256sum
}
case $what in
  snap)
    mkdir -p "$keep"; sums > "$keep/sums"; cp "$rules" "$keep/rules.json"
    echo "guard: $(wc -l < "$keep/sums") files remembered" ;;
  check)
    [ -f "$keep/sums" ] || { echo "guard: no snapshot for $id (guard.sh snap $id first)" >&2; exit 1; }
    bad=0
    changed=$(diff "$keep/sums" <(sums) | grep '^[<>]' | cut -c69- | sort -u || true)
    [ -z "$changed" ] || { bad=1; echo "guard: changed during the stage, and not this lesson's source:"; echo "$changed" | sed 's/^/  /'; }
    if [ "$grow" = --rules-may-grow ]; then
      docker run --rm -v "$PWD":/w -w /w node:24-alpine node -e '
        const fs = require("fs"), [was, now] = process.argv.slice(1).map(f => JSON.parse(fs.readFileSync(f, "utf8")));
        const same = (a, b) => JSON.stringify(a) === JSON.stringify(b), out = [];
        for (const r of was.rules) if (!same(r, now.rules.find(x => x.id === r.id))) out.push(`rule ${r.id} changed or gone`);
        for (const r of now.rules) if (!was.rules.some(x => x.id === r.id) && r.status !== "pending") out.push(`new rule ${r.id} is ${r.status}, not pending`);
        for (const c of was.cases) if (!now.cases.some(x => same(x, c))) out.push(`case «${c.key}» gone`);
        if (now.cases.length !== was.cases.length) out.push("cases added: only the owner signs a word off (apply.mjs)");
        if (out.length) { console.log("guard: the speech rules changed in a way only the owner may:\n  " + out.join("\n  ")); process.exit(1); }' \
        "$keep/rules.json" "$rules" || bad=1
    else
      cmp -s "$keep/rules.json" "$rules" || { bad=1; echo "guard: $rules changed during the stage"; }
    fi
    docker run --rm -v "$PWD":/w -w /w node:24-alpine node tools/lessons/test/regress.mjs | tail -1 | sed 's/^/guard: the checks: /'
    [ "${PIPESTATUS[0]}" = 0 ] || bad=1
    [ $bad = 0 ] && echo "guard: nothing but the lesson changed" || exit 1 ;;
  *) sed -n 2,11p "$0"; exit 2 ;;
esac
