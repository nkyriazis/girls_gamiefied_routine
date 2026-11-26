"""The owl reads a lesson aloud: every line of lines.json (tools/lessons/lines.mjs: the pieces' titles, sentences and
hard words, the questions, the prompts) in the owl's voice (tools/help-voice/voice), each take listened back by Whisper
as the help bubbles are (tools/help-voice/README.md), the best passing take kept as package/audio/<id>.mp3, and
lesson.json's `audio` filled (text -> clip). A line already recorded in this voice is kept.
Usage (in the help-voice image, from tools/help-voice): python ../lessons/read_aloud.py <package dir> <lines.json>"""
import hashlib
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.getcwd())  # tools/help-voice: the owl's voice and the listening

import librosa
import numpy as np
import soundfile as sf

from voice import embed, judge, say

pkg, lines_file = sys.argv[1], sys.argv[2]
VOICE = json.load(open('voice/voice.json'))
REF, REF_TEXT = 'voice/owl.wav', open('voice/owl.txt').read().strip()
voice_id = hashlib.sha1(open(REF, 'rb').read() + json.dumps(VOICE, sort_keys=True).encode()).hexdigest()[:8]
# The bubbles' bar, with room for a long sentence read at a calm pace
PASS = {'cer': 0.04, 'greek': 0.9, 'same_voice': 0.78, 'rate': (8, 19)}
MAX_TAKES = 5
LUFS = -16.0


# What the owl says for what the screen shows: abbreviations in full (VoxCPM read «μ.Χ.» as noise)
SPOKEN = [('μ.Χ.', 'μετά Χριστόν'), ('π.Χ.', 'προ Χριστού'), ('κ.ά.', 'και άλλα'), ('π.χ.', 'για παράδειγμα'), ('κεφ.', 'κεφάλαιο')]


def spoken(text):
    for a, b in SPOKEN:
        text = text.replace(a, b)
    return text


def passes(r):
    return (r['cer'] <= PASS['cer'] and r['greek'] >= PASS['greek'] and r['same_voice'] >= PASS['same_voice']
            and PASS['rate'][0] <= r['rate'] <= PASS['rate'][1] and r['peak'] < 0.999)


def tidy(wav, sr):
    _, (a, b) = librosa.effects.trim(wav, top_db=38, frame_length=1024, hop_length=256)
    return np.concatenate([np.zeros(int(0.10 * sr)), wav[a:b], np.zeros(int(0.30 * sr))])


def loudness(path):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'],
                         capture_output=True, text=True).stderr
    return float(re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1])


def encode(wav_path, mp3_path):
    gain = LUFS - loudness(wav_path)
    for _ in range(4):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav_path, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.84:level=false',
                        '-ar', '44100', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', mp3_path], check=True)
        got = loudness(mp3_path)
        if abs(got - LUFS) <= 0.3:
            break
        gain += LUFS - got


lesson_path = os.path.join(pkg, 'lesson.json')
lesson = json.load(open(lesson_path))
lines = json.load(open(lines_file))
os.makedirs(os.path.join(pkg, 'audio'), exist_ok=True)
os.makedirs('out/lesson-takes', exist_ok=True)
ref_embedding = embed(REF)
audio, report = {}, []
for n, text in enumerate(lines, 1):
    cid = hashlib.sha1(f'{voice_id}:{spoken(text)}'.encode()).hexdigest()[:12]
    rel = f'audio/{cid}.mp3'
    mp3 = os.path.join(pkg, rel)
    if os.path.exists(mp3):
        audio[text] = rel
        print(f'[{n}/{len(lines)}] kept {text[:60]}', flush=True)
        continue
    takes = []
    for seed in range(1, MAX_TAKES + 1):
        wav, sr = say(spoken(text), seed, style=VOICE.get('style'), ref=REF, ref_text=REF_TEXT if VOICE.get('carry') else None)
        path = f'out/lesson-takes/{cid}-{seed}.wav'
        sf.write(path, tidy(wav, sr), sr)
        r = {'seed': seed, 'path': path, **judge(path, spoken(text), ref_embedding)}
        r['pass'] = passes(r)
        takes.append(r)
        print(f'[{n}/{len(lines)}] take {seed}: cer {r["cer"]} voice {r["same_voice"]} rate {r["rate"]} {"pass" if r["pass"] else "fail"} {text[:50]}', flush=True)
        if r['pass'] and r['cer'] == 0:
            break
    good = sorted([t for t in takes if t['pass']], key=lambda t: (t['cer'], -t['same_voice']))
    best = good[0] if good else min(takes, key=lambda t: t['cer'])
    encode(best['path'], mp3)
    audio[text] = rel
    report.append({'say': text, 'clip': rel, 'ok': bool(good), 'cer': best['cer'], 'heard': best['heard'], 'takes': len(takes)})

lesson['audio'] = audio
json.dump(lesson, open(lesson_path, 'w'), ensure_ascii=False, indent=2)
json.dump(report, open(os.path.join(pkg, '..', 'voice-report.json'), 'w'), ensure_ascii=False, indent=1)
bad = [r for r in report if not r['ok']]
print(f'{len(audio)} clips ({len(report)} new); {len(bad)} below the bar')
for r in bad:
    print(f'  CHECK: «{r["say"]}» heard «{r["heard"]}» (cer {r["cer"]})')
