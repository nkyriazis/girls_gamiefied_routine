#!/usr/bin/env bash
# The owl's voice for several lessons: tools/lessons/build.sh for each (record what is new, listen, the gate, the
# zip), as many at once as the GPU has room for right now. The GPU is shared with other projects, so the count comes
# from its free memory (nvidia-smi), never a fixed number: a job starts while VOICE_MIB (6000; a job takes ~5.5 GB)
# is free, and is given VOICE_SETTLE seconds (90) to take its memory before the next is measured. A job that dies of
# «CUDA out of memory» is put back in the queue (3 times): that is the GPU's state, not the lesson's fault. With
# nothing of ours running and no room for 15 minutes, the lessons left are reported as "nogpu".
#   tools/lessons/voices.sh <id>…
# Prints one line per lesson: signed (every word heard by the owner; the zip is made) | waits (words wait for the
# owner's ear: tools/lessons/signoff.sh page) | failed (with the end of its log) | nogpu; and "listen <id>: …" for
# each clip under the bar (CHECK). Each lesson's whole log: tools/lessons/work/<id>/.voice.log. Exits 1 on a
# failed or nogpu.
set -uo pipefail
cd "$(dirname "$0")/../.."
[ $# -ge 1 ] || { sed -n 2,13p "$0"; exit 2; }
work=tools/lessons/work; need=${VOICE_MIB:-6000}; settle=${VOICE_SETTLE:-90}; patience=${VOICE_PATIENCE:-900}
# (for trying this script without a GPU: VOICE_BUILD, VOICE_FREE and VOICE_LOGS stand in for the build, nvidia-smi and work/)
build=${VOICE_BUILD:-tools/lessons/build.sh}; logs=${VOICE_LOGS:-$work}
free() { ${VOICE_FREE:-nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits} | head -1; }
for id in "$@"; do [ -f "$work/$id/lesson.src.json" ] || { echo "No $work/$id/lesson.src.json" >&2; exit 2; }; done

queue=("$@"); declare -A lesson tries; bad=0; waited=0
while [ ${#queue[@]} -gt 0 ] || [ ${#lesson[@]} -gt 0 ]; do
  if [ ${#queue[@]} -gt 0 ] && [ "$(free)" -ge "$need" ]; then
    id=${queue[0]}; queue=("${queue[@]:1}"); waited=0
    mkdir -p "$logs/$id"; $build "$id" > "$logs/$id/.voice.log" 2>&1 &
    lesson[$!]=$id; echo "start  $id ($(free) MiB free, ${#lesson[@]} running)"
    sleep "$settle"; continue
  fi
  if [ ${#lesson[@]} -eq 0 ]; then   # no room, and none of ours to wait for: someone else holds the GPU
    if [ "$waited" -ge "$patience" ]; then
      for id in "${queue[@]}"; do echo "nogpu  $id ($(free) MiB free, $need needed)"; done; bad=1; break
    fi
    sleep 30; waited=$((waited + 30)); continue
  fi
  pid=; wait -n -p pid "${!lesson[@]}"; code=$?
  [ -n "$pid" ] || continue
  id=${lesson[$pid]}; unset "lesson[$pid]"; log=$logs/$id/.voice.log
  if [ $code -ne 0 ] && grep -qiE 'CUDA out of memory|OutOfMemoryError|CUDA error: out of memory' "$log"; then
    tries[$id]=$(( ${tries[$id]:-0} + 1 ))
    if [ "${tries[$id]}" -le 3 ]; then echo "again  $id (the GPU ran out of memory; try ${tries[$id]} of 3)"; queue+=("$id"); continue; fi
    echo "nogpu  $id (out of GPU memory 4 times)"; bad=1; continue
  fi
  grep -E '\bCHECK\b' "$log" | sed "s/^/listen $id: /" || true
  if [ $code -eq 0 ]; then echo "signed $id"
  elif grep -q "The owl's words wait for the owner" "$log"; then echo "waits  $id"
  else echo "failed $id"; tail -15 "$log" | sed 's/^/    /'; bad=1; fi
done
exit $bad
