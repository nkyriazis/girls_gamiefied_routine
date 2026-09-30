"""Chooses the owl's voice. Designs candidate voices from descriptions, then tries each as
the voice of a few real lines (cloned from it, two ways), and reports how they fare:
what Whisper hears, how alike the lines sound to the voice, how lively the pitch is.
Writes out/pick/*.wav and out/pick/report.json."""
import json
import os
import sys

import numpy as np
import soundfile as sf

from voice import embed, judge, say

DESCRIPTIONS = {
    'playful': "A young woman, warm, playful and cheerful voice, smiling as she speaks, like a friendly presenter of a children's TV show",
    'bright': 'A young woman with a bright, lively, sweet voice, energetic and kind, speaking to a child',
}
REF_TEXT = 'Γεια σου! Είμαι η κουκουβάγια σου. Θα σου δείξω πώς δουλεύουν όλα εδώ μέσα, και θα περάσουμε τέλεια μαζί!'
STYLE = 'cheerful, playful, smiling, friendly'
LINES = [
    'Ένα πρόβλημα! Θα το λύσουμε βήμα βήμα, όπως στο βιβλίο. Έλα να σου δείξω.',
    'Τα πλήκτρα. Με το βελάκι πίσω σβήνεις, και με το γυριστό βελάκι πας στο επόμενο κουτάκι.',
    'Περιμένει γονιό. Την έκανες! Τώρα ένας γονιός πρέπει να την επιβεβαιώσει για να πάρεις τα αστέρια.',
    'Κλείσιμο. Από εδώ γυρνάς στην αρχική οθόνη.',
]
SEEDS = range(1, 7)
out = 'out/pick'
os.makedirs(out, exist_ok=True)
report = []

for name, desc in DESCRIPTIONS.items():
    for seed in SEEDS:
        ref = f'{out}/{name}-{seed}.wav'
        wav, sr = say(REF_TEXT, seed, style=desc)
        sf.write(ref, wav, sr)
        r = judge(ref, REF_TEXT)
        cand = {'voice': f'{name}-{seed}', 'ref': r, 'modes': {}}
        if r['cer'] > 0.03:
            print(json.dumps(cand, ensure_ascii=False), flush=True)
            report.append(cand)
            continue
        e = embed(ref)
        for mode in ('styled', 'carried'):
            takes = []
            for i, line in enumerate(LINES):
                wav, sr = say(line, 100 + i, style=STYLE if mode == 'styled' else None, ref=ref,
                              ref_text=REF_TEXT if mode == 'carried' else None)
                p = f'{out}/{name}-{seed}-{mode}-{i}.wav'
                sf.write(p, wav, sr)
                takes.append(judge(p, line, e))
            cand['modes'][mode] = {k: round(float(np.mean([t[k] for t in takes])), 3) for k in ('cer', 'same_voice', 'lively', 'f0', 'greek')}
            cand['modes'][mode]['worst_cer'] = max(t['cer'] for t in takes)
        print(json.dumps(cand, ensure_ascii=False), flush=True)
        report.append(cand)
json.dump(report, open(f'{out}/report.json', 'w'), ensure_ascii=False, indent=1)
