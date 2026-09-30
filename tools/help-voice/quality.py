"""A second listen, for sound rather than words: torchaudio's SQUIM estimates, from the clip
alone, how clean it is (PESQ, STOI, SI-SDR). Whisper forgives a crackle or a hiss; this
doesn't. Adds the scores to report.json and names the clips far below the rest."""
import json

import numpy as np
import torch
import torchaudio
from torchaudio.pipelines import SQUIM_OBJECTIVE

FRONT = '../../frontend/public'
model = SQUIM_OBJECTIVE.get_model().cuda().eval()
report = json.load(open('report.json'))
for e in report:
    if not e.get('clip'):
        continue
    wav, sr = torchaudio.load(f'{FRONT}/{e["clip"]}')
    wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, 16000).cuda()
    with torch.no_grad():
        stoi, pesq, sisdr = (float(x) for x in model(wav))
    e['clean'] = {'pesq': round(pesq, 2), 'stoi': round(stoi, 3), 'si_sdr': round(sisdr, 1)}
# Kept clips are scored as they ship (an mp3); a take was scored as a wav
pesqs = np.array([e['clean']['pesq'] for e in report if 'clean' in e])
low = pesqs.mean() - 2.5 * pesqs.std()
for e in report:
    if 'clean' in e:
        e['clean']['outlier'] = bool(e['clean']['pesq'] < min(low, 3.3) or e['clean']['si_sdr'] < 20)
json.dump(report, open('report.json', 'w'), ensure_ascii=False, indent=1)
print(f'PESQ {pesqs.min():.2f}..{pesqs.max():.2f} (mean {pesqs.mean():.2f}); STOI min {min(e["clean"]["stoi"] for e in report if "clean" in e):.3f}')
for e in report:
    if e.get('clean', {}).get('outlier'):
        print('outlier:', e['clean'], e['say'])
