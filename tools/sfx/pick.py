"""Chooses the kids' sounds (palette.json) from the Kenney packs (fetch.sh), and makes them.
For each sound, CLAP (a model that matches audio with words) scores every candidate
against what it should sound like, against the other sounds' descriptions (so each is
recognisably itself) and against what no kid's screen should sound like. The best
candidate that fits its length is trimmed so it starts at once, and set to its loudness.
Writes frontend/public/sfx/<name>.wav, frontend/src/sound/sounds.json, report.json and
out/listen.html (every sound with its runners-up)."""
import glob
import html
import json
import os

import librosa
import numpy as np
import soundfile as sf
import torch
from transformers import ClapModel, ClapProcessor

from synth import SYNTHS
from traits import traits

FRONT = '../../frontend'
OUT_DIR = f'{FRONT}/public/sfx'
SR = 48000
UNWANTED = ['a harsh loud buzzer', 'an annoying high pitched screech', 'a scary sound', 'static noise', 'a gunshot']

palette = {k: v for k, v in json.load(open('palette.json')).items() if not k.startswith('_')}
model = ClapModel.from_pretrained('laion/larger_clap_general').cuda().eval()
proc = ClapProcessor.from_pretrained('laion/larger_clap_general')


def features(out):
    # transformers 5 returns the (projected) embedding as pooler_output
    return out if torch.is_tensor(out) else out.pooler_output


def texts(ts):
    with torch.no_grad():
        e = model.get_text_features(**proc(text=ts, return_tensors='pt', padding=True).to('cuda'))
    return torch.nn.functional.normalize(features(e), dim=-1)


def audio_embedding(y):
    with torch.no_grad():
        inp = proc(audio=[librosa.resample(y, orig_sr=SR, target_sr=48000)], sampling_rate=48000, return_tensors='pt').to('cuda')
        e = model.get_audio_features(**inp)
    return torch.nn.functional.normalize(features(e), dim=-1)[0]


def start_now(y):
    """Cut the silence before the sound (a tap must answer at once), fade the tail"""
    idx = np.flatnonzero(np.abs(y) > 10 ** (-45 / 20) * np.abs(y).max())
    y = y[max(0, idx[0] - int(0.002 * SR)): idx[-1] + int(0.01 * SR)]
    fade = min(len(y) // 4, int(0.02 * SR))
    y[-fade:] *= np.linspace(1, 0, fade)
    return y


def loudest(y, win=0.05):
    """How loud a short sound seems: its loudest 50 ms (a whole-clip average punishes a short tick)"""
    n = max(1, int(win * SR))
    power = np.convolve(y ** 2, np.ones(n) / n, mode='same')
    return float(np.sqrt(power.max()))


def loud(y, db):
    y = y * (10 ** (db / 20) / max(loudest(y), 1e-9))
    # A soft limiter keeps spiky sounds (coins, cards) from clipping at that loudness
    ceiling = 10 ** (-1 / 20)
    return ceiling * np.tanh(y / ceiling)


names = list(palette)
os.makedirs(OUT_DIR, exist_ok=True)
wanted = texts([palette[n]['sounds_like'] for n in names])
unwanted = texts(UNWANTED)
used, report = set(), {}
for i, name in enumerate(names):
    p = palette[name]
    if 'synth' in p:
        y = loud(SYNTHS[p['synth']](SR), p['rms'])
        sf.write(f'{OUT_DIR}/{name}.wav', y, SR, subtype='PCM_16')
        e = audio_embedding(y)
        chosen = {'file': f'synth.py:{p["synth"]}', 'secs': round(len(y) / SR, 3), 'clap': round(float(wanted[i] @ e), 3), **traits(y, SR)}
        report[name] = {'for': p['for'], 'sounds_like': p['sounds_like'], 'chosen': chosen, 'runners_up': [], 'candidates': 0}
        print(f'[{i + 1}/{len(names)}] {name}: {chosen["file"]} clap {chosen["clap"]} {chosen["secs"]}s', flush=True)
        continue
    files = sorted({f for g in p['from'] for f in glob.glob(f'packs/{g}.ogg')})
    cands = []
    for f in files:
        y, _ = librosa.load(f, sr=SR, mono=True)
        y = start_now(y)
        secs = len(y) / SR
        e = audio_embedding(y)
        sims = (wanted @ e).tolist()
        bad = float((unwanted @ e).max())
        own = sims[i]
        others = max(s for j, s in enumerate(sims) if j != i)
        # What it should be, more than anything else in the palette, and nothing it shouldn't
        score = own + 0.5 * (own - others) - 0.5 * max(0.0, bad - own)
        tr = traits(y, SR)
        goes = p.get('goes')
        heads = goes is None or (tr['rise'] >= 1 if goes == 'up' else tr['rise'] <= -1)
        cands.append({'file': f[len('packs/'):], 'secs': round(secs, 3), 'clap': round(own, 3), 'margin': round(own - others, 3),
                      'unwanted': round(bad, 3), 'score': round(score, 3), 'rise': tr['rise'],
                      'fits': secs <= p['max'] and f not in used and heads})
    cands.sort(key=lambda c: -c['score'])
    best = next(c for c in cands if c['fits'])
    used.add(f'packs/{best["file"]}')
    y, _ = librosa.load(f'packs/{best["file"]}', sr=SR, mono=True)
    y = start_now(y)
    if 'add' in p:
        extra = SYNTHS[p['add']](SR)
        y = np.pad(y, (0, max(0, len(extra) - len(y))))
        y[:len(extra)] += extra * 0.5 * np.abs(y).max() / np.abs(extra).max()
        best['file'] += f' + synth.py:{p["add"]}'
    y = loud(y, p['rms'])
    best.update(traits(y, SR))
    sf.write(f'{OUT_DIR}/{name}.wav', y, SR, subtype='PCM_16')
    report[name] = {'for': p['for'], 'sounds_like': p['sounds_like'], 'chosen': best, 'runners_up': [c for c in cands if c is not best][:4],
                    'candidates': len(cands), 'kb': round(os.path.getsize(f'{OUT_DIR}/{name}.wav') / 1024, 1)}
    print(f'[{i + 1}/{len(names)}] {name}: {best["file"]} clap {best["clap"]} rise {best["rise"]} loud {20*np.log10(loudest(y)):.1f} peak {best["peak_db"]} {best["secs"]}s', flush=True)

json.dump(report, open('report.json', 'w'), ensure_ascii=False, indent=1)
os.makedirs(f'{FRONT}/src/sound', exist_ok=True)
json.dump({n: {'file': f'sfx/{n}.wav', 'secs': report[n]['chosen']['secs']} for n in names},
          open(f'{FRONT}/src/sound/sounds.json', 'w'), indent=1)
os.makedirs('out', exist_ok=True)
with open('out/listen.html', 'w') as f:
    f.write('<!doctype html><meta charset="utf-8"><title>Sounds</title><style>body{font:15px system-ui;margin:2rem}td{padding:.3rem .6rem;border-bottom:1px solid #ddd}</style><table>')
    for n, r in report.items():
        alts = ''.join(f'<br><small>{html.escape(c["file"])} ({c["score"]})</small><audio controls preload=none src="../packs/{c["file"]}"></audio>' for c in r['runners_up'][:3])
        f.write(f'<tr><td><b>{n}</b><br>{html.escape(r["for"])}<br><i>{html.escape(r["sounds_like"])}</i></td>'
                f'<td><audio controls src="../{OUT_DIR}/{n}.wav"></audio><br><small>{r["chosen"]["file"]}</small></td><td>{alts}</td></tr>')
    f.write('</table>')
