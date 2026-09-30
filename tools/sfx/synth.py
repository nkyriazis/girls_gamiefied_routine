"""The two sounds made rather than found: a celebration when something is finished and a
twinkle over the coins when stars come in. Celesta-like notes (harmonic partials, a quick
attack, a ringing decay) on a major chord, going up, with a few sparkles over the top."""
import numpy as np

C6, E6, G6, C7, E7, G7, B6 = 1046.5, 1318.5, 1568.0, 2093.0, 2637.0, 3136.0, 1975.5


def note(f, dur, sr, decay=0.35, amp=1.0):
    t = np.arange(int(dur * sr)) / sr
    y = sum(a * np.sin(2 * np.pi * f * k * t) for k, a in ((1, 1.0), (2, 0.3), (3, 0.1), (4, 0.04)))
    env = np.minimum(1, t / 0.004) * np.exp(-t / decay)
    return amp * y * env


def place(buf, y, at, sr):
    i = int(at * sr)
    buf[i:i + len(y)] += y[:len(buf) - i]


def fanfare(sr, seed=7):
    rng = np.random.default_rng(seed)
    buf = np.zeros(int(1.6 * sr))
    for k, f in enumerate((C6, E6, G6)):
        place(buf, note(f, 0.7, sr, decay=0.22, amp=0.8), 0.085 * k, sr)
    for f, a in ((C7, 0.9), (E7, 0.5), (G6, 0.4)):  # the chord it lands on
        place(buf, note(f, 1.3, sr, decay=0.5, amp=a), 0.26, sr)
    for _ in range(9):  # sparkles
        place(buf, note(rng.uniform(3000, 5200), 0.25, sr, decay=0.05, amp=rng.uniform(0.12, 0.25)), rng.uniform(0.3, 1.1), sr)
    return buf


def twinkle(sr):
    buf = np.zeros(int(0.6 * sr))
    place(buf, note(B6, 0.5, sr, decay=0.12, amp=0.6), 0.0, sr)
    place(buf, note(E7, 0.55, sr, decay=0.16, amp=0.7), 0.075, sr)
    return buf


SYNTHS = {'fanfare': fanfare, 'twinkle': twinkle}
