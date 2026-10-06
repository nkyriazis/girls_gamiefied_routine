#!/bin/bash
# mix.sh <out>: lays what the page played (<out>.sound.json, from kit.mjs) over <out>.webm -> <out>.mp4.
# Clips and sounds come from frontend/public; Web Audio tones (/tone/<wave>/<Hz>) are made with ffmpeg.
# The page's clock and the video's differ (frames come late under load), so each clip is
# placed by the corner square: it flips every second, logged in page time, seen in video time.
# The video is sped back to the page's pace (it runs slow), and each clip lands where it played.
set -e
out=$1
PUB=${PUB:-/pub}   # frontend/public, mounted by record.sh
ffmpeg -v error -i "$out.webm" -vf "crop=6:6:iw-7:ih-7,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=$out.corner.txt" -f null -
args=(-y -v error -i "$out.webm"); filt=""; n=0
while IFS=$'\t' read -r src at dur; do
  n=$((n+1))
  if [[ $src == /tone/* ]]; then
    # A Web Audio tone (kit.mjs): made again, at the page's level (gain 0.15, fading out)
    IFS=/ read -r _ _ wave freq <<< "$src"
    wav="sin(2*PI*$freq*t)"; [ "$wave" = square ] && wav="sgn(sin(2*PI*$freq*t))"
    args+=(-f lavfi -i "aevalsrc=0.15*$wav*exp(-2.7*t/$dur):s=48000:d=$dur")
  else args+=(-i "$PUB$src"); fi
  filt+="[$n:a]atrim=0:${dur},adelay=${at}:all=1[a$n];"
done < <(python3 - "$out" <<'PY'
import json, re, sys
out = sys.argv[1]
d = json.load(open(f'{out}.sound.json'))
# When the square flipped in the video
flips, t, prev = [], None, None
for l in open(f'{out}.corner.txt'):
    m = re.search(r'pts_time:([\d.]+)', l)
    if m: t = float(m.group(1))
    m = re.search(r'YAVG=([\d.]+)', l)
    if m:
        on = float(m.group(1)) > 128
        # The square starts black and flips to white first: anything before is the page loading
        if prev is not None and on != prev and (flips or on): flips.append(t * 1000)
        prev = on
# A navigation can show something else in the corner for a frame or two: a flip undone at once is not one
i = 0
while i < len(flips) - 1:
    if flips[i + 1] - flips[i] < 250: del flips[i:i + 2]
    else: i += 1
page = d['sync'][:len(flips)]
r = (flips[-1] - flips[0]) / (page[-1] - page[0])
print(f'{len(flips)} flips seen, {len(d["sync"])} made; video/page = {r:.3f}', file=sys.stderr)
open(f'{out}.speed', 'w').write(f'{r:.5f}')
def video_ms(p):
    for i in range(1, len(page)):
        if p <= page[i] or i == len(page) - 1:
            a, b = page[i-1], page[i]
            return flips[i-1] + (p - a) * (flips[i] - flips[i-1]) / (b - a)
    return flips[0] + p - page[0]
ev = d['said']
for i, e in enumerate(ev):
    if e['ev'] != 'play': continue
    # A clip stops where it was stopped, or where the next one began; a sound plays out
    if e.get('tone'):
        start = video_ms(e['at']) / r
        print(f"{e['src']}\t{max(0, round(start))}\t{e['tone']['secs']:.3f}")
        continue
    stop = None if e.get('sfx') else next((f['at'] for f in ev[i+1:] if (f['src'] == e['src'] and f['ev'] == 'stop') or (f['ev'] == 'play' and not f.get('sfx'))), None)
    start = video_ms(e['at']) / r
    dur = (video_ms(stop) / r - start) / 1000 if stop else 60
    print(f"{e['src']}\t{max(0, round(start))}\t{dur:.3f}")
PY
)
speed=$(cat "$out.speed")
if [ $n -eq 0 ]; then ffmpeg -y -v error -i "$out.webm" -vf "setpts=PTS/$speed" -c:v libx264 -pix_fmt yuv420p -crf 23 "$out.mp4"; exit; fi
filt="[0:v]setpts=PTS/$speed[v];$filt"
for i in $(seq 1 $n); do filt+="[a$i]"; done
filt+="amix=inputs=$n:normalize=0:dropout_transition=0:duration=longest,apad[aout]"
len=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out.webm")
len=$(python3 -c "print(f'{$len / $speed:.2f}')")
ffmpeg "${args[@]}" -filter_complex "$filt" -map "[v]" -map "[aout]" -t "$len" -c:v libx264 -pix_fmt yuv420p -crf 23 -c:a aac -b:a 128k "$out.mp4"
