"""Records the owl's lines (from frontend/scripts/help-lines.mjs) in the owl's voice
(voice/), listens to every take and keeps the best one that passes, and writes:
  frontend/public/help-voice/<id>.mp3     the clips the kids' screens play
  frontend/src/help/voice/clips.json      what the owl says -> its clip
  report.json                             what was heard in each clip, and how it scored
  out/listen.html                         every clip on one page, to listen through
A line already recorded in this voice is kept; with --retry, one Whisper didn't hear
perfectly gets more takes, and the best of old and new is kept.
Usage: python record.py lines.json [--retry]"""
import hashlib
import html
import json
import os
import re
import subprocess
import sys

import librosa
import numpy as np
import soundfile as sf

from audit import distance, listen, plain
from voice import embed, judge, say

FRONT = '../../frontend'
CLIPS_DIR = f'{FRONT}/public/help-voice'
MANIFEST = f'{FRONT}/src/help/voice/clips.json'
VOICE = json.load(open('voice/voice.json'))
REF, REF_TEXT = 'voice/owl.wav', open('voice/owl.txt').read().strip()
MIN_TAKES, MAX_TAKES = 3, 8

# A take passes when Whisper hears what was written, in Greek, in the owl's voice, at a pace a kid
# follows, and it sounds clean (SQUIM's estimates)
PASS = {'cer': 0.03, 'greek': 0.9, 'same_voice': 0.8, 'rate': (9, 19), 'pesq': 3.3, 'si_sdr': 20}


def passes(r):
    return (r['cer'] <= PASS['cer'] and r['greek'] >= PASS['greek'] and r['same_voice'] >= PASS['same_voice']
            and PASS['rate'][0] <= r['rate'] <= PASS['rate'][1] and r['peak'] < 0.999
            and r['clean']['pesq'] >= PASS['pesq'] and r['clean']['si_sdr'] >= PASS['si_sdr'])


def tidy(wav, sr):
    """Silence off both ends, a breath of it back"""
    _, (a, b) = librosa.effects.trim(wav, top_db=38, frame_length=1024, hop_length=256)
    return np.concatenate([np.zeros(int(0.12 * sr)), wav[a:b], np.zeros(int(0.25 * sr))])


LUFS, LUFS_OFF = -16.0, 1.0  # every clip as loud as the others: within 1 LU of -16


def loudness(path):
    """Integrated loudness (EBU R128), in LUFS"""
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])


def encode(wav_path, mp3_path):
    """Measured, then turned up or down to -16 LUFS, peaks held under -1.5 dBTP. (ffmpeg's
    one-pass loudnorm can't measure a clip under 3 s: those came out 20 dB quiet.)"""
    gain = LUFS - loudness(wav_path)
    for _ in range(4):  # the limiter takes back some of the gain: measure the mp3, make up the rest
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav_path, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.84:level=false',
                        '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', mp3_path], check=True)
        got = loudness(mp3_path)
        if abs(got - LUFS) <= 0.3:
            break
        gain += LUFS - got
    return round(got, 1)


RETRY = '--retry' in sys.argv
TAKE_KEYS = {'seed', 'heard', 'cer', 'language', 'greek', 'f0', 'lively', 'secs', 'peak', 'rate', 'same_voice', 'clean'}
voice_id = hashlib.sha1(open(REF, 'rb').read() + json.dumps(VOICE, sort_keys=True).encode()).hexdigest()[:8]
lines = json.load(open(sys.argv[1]))
report = {r['say']: r for r in (json.load(open('report.json')) if os.path.exists('report.json') else [])}
cer = lambda said, heard: round(distance(plain(said), plain(heard)) / max(1, len(plain(said))), 4)
for r in report.values():  # scored again as audit.py scores now
    r['cer'] = cer(r['say'], r['heard'])
    if 'shipped_heard' in r:
        r['shipped_cer'] = cer(r['say'], r['shipped_heard'])
os.makedirs(CLIPS_DIR, exist_ok=True)
os.makedirs('out/takes', exist_ok=True)
ref_embedding = embed(REF)

kept = []
for n, line in enumerate(lines, 1):
    text = line['say']
    cid = hashlib.sha1(f'{voice_id}:{text}'.encode()).hexdigest()[:12]
    mp3 = f'{CLIPS_DIR}/{cid}.mp3'
    old = report.get(text)
    recorded = old and old.get('ok') and old.get('clip') == f'help-voice/{cid}.mp3' and os.path.exists(mp3)
    if recorded and 'clean' in old and not (old['clean']['pesq'] >= PASS['pesq'] and old['clean']['si_sdr'] >= PASS['si_sdr']):
        recorded = False  # it doesn't sound clean enough: recorded again
    if recorded and not (RETRY and old['cer'] > 0):
        old['where'] = line['where']
        if abs(old.get('lufs', 0) - LUFS) > LUFS_OFF:
            take = f'out/takes/{cid}-{old["seed"]}.wav'
            if not os.path.exists(take):
                recorded = False  # its take is gone: recorded again
            else:
                old['lufs'] = encode(take, mp3)
                print(f'[{n}/{len(lines)}] loudness fixed ({old["lufs"]} LUFS) {text[:50]}', flush=True)
    if recorded and not (RETRY and old['cer'] > 0):
        kept.append(old)
        print(f'[{n}/{len(lines)}] kept {text[:60]}', flush=True)
        continue
    # A retry carries on from the takes made before, and the one kept then competes again
    first = old['tried'] + 1 if old and 'tried' in old else old['takes'] + 1 if old else 1
    takes = [{k: v for k, v in old.items() if k in TAKE_KEYS} | {'pass': True}] if recorded else []
    for seed in range(first, first + MAX_TAKES):
        wav, sr = say(text, seed, style=VOICE.get('style'), ref=REF, ref_text=REF_TEXT if VOICE.get('carry') else None)
        path = f'out/takes/{cid}-{seed}.wav'
        sf.write(path, tidy(wav, sr), sr)
        r = {'seed': seed, **judge(path, text, ref_embedding)}
        r['pass'] = passes(r)
        takes.append(r)
        print(f'[{n}/{len(lines)}] take {seed}: cer {r["cer"]} voice {r["same_voice"]} {"pass" if r["pass"] else "fail"} {text[:50]}', flush=True)
        # Enough once a take is heard perfectly; else keep trying
        if seed - first + 1 >= MIN_TAKES and any(t['pass'] and t['cer'] == 0 for t in takes):
            break
    good = [t for t in takes if t['pass']]
    # What Whisper heard best; of those, the most like the owl, and the liveliest
    good.sort(key=lambda t: (t['cer'], -(t['same_voice'] + 0.03 * t['lively'])))
    best = good[0] if good else min(takes, key=lambda t: t['cer'])
    entry = {'say': text, 'where': line['where'], 'id': cid, 'ok': bool(good), 'takes': len(takes), 'tried': seed,
             **{k: v for k, v in best.items() if k != 'pass'}}
    # Listened to once more as it ships (an mp3); if that fails, the next best take
    for t in good:
        lufs = encode(f'out/takes/{cid}-{t["seed"]}.wav', mp3)
        shipped = listen(mp3, text)
        entry.update({k: v for k, v in t.items() if k != 'pass'}, clip=f'help-voice/{cid}.mp3', shipped_cer=shipped['cer'],
                     shipped_heard=shipped['heard'], kb=round(os.path.getsize(mp3) / 1024, 1), lufs=lufs,
                     ok=shipped['cer'] <= PASS['cer'] and abs(lufs - LUFS) <= LUFS_OFF)
        if entry['ok']:
            break
    kept.append(entry)
    print(f'[{n}/{len(lines)}] {"ok" if entry["ok"] else "FAILED"} {text[:60]}', flush=True)

# Clips no line uses any more go
used = {os.path.basename(e['clip']) for e in kept if e.get('clip')}
for f in os.listdir(CLIPS_DIR):
    if f.endswith('.mp3') and f not in used:
        os.remove(f'{CLIPS_DIR}/{f}')

json.dump(kept, open('report.json', 'w'), ensure_ascii=False, indent=1)
json.dump({e['say']: e['clip'] for e in kept if e['ok']}, open(MANIFEST, 'w'), ensure_ascii=False, indent=1, sort_keys=True)
with open('out/listen.html', 'w') as f:
    f.write('<!doctype html><meta charset="utf-8"><title>Owl voice</title><style>body{font:15px system-ui;margin:2rem}'
            'td{padding:.3rem .6rem;border-bottom:1px solid #ddd;vertical-align:top}.bad{background:#fdd}</style><table>')
    for e in kept:
        player = f'<audio controls preload=none src="../{FRONT}/public/{e["clip"]}"></audio>' if e.get('clip') else ''
        f.write(f'<tr class="{"" if e["ok"] else "bad"}"><td>{html.escape(e["say"])}<br><small>heard: {html.escape(e.get("shipped_heard", e["heard"]))}</small></td>'
                f'<td>cer {e.get("shipped_cer", e["cer"])}<br>voice {e["same_voice"]}<br>{e["secs"]}s</td>'
                f'<td>{player}</td></tr>')
    f.write('</table>')
bad = [e for e in kept if not e['ok']]
print(f'done: {len(kept) - len(bad)}/{len(kept)} lines recorded' + (f'; FAILED: {[e["say"] for e in bad]}' if bad else ''), flush=True)
sys.exit(1 if bad else 0)
