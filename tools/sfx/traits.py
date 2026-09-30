"""What a sound does, measured: does it rise or fall (a yes rises, a no falls), how bright
it is, how rough (harsh sounds are rough), how long, how loud. Used by pick.py to check
every chosen sound against what it's for."""
import librosa
import numpy as np


def traits(y, sr):
    S = np.abs(librosa.stft(y, n_fft=1024, hop_length=256)) + 1e-9
    energy = S.sum(0)
    live = energy > 0.1 * energy.max()
    cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    c = np.log2(cent[live])
    # Rise or fall: the brightness where the sound is loud, first half against second, in semitones
    half = max(1, len(c) // 2)
    slope = float(12 * (np.median(c[half:]) - np.median(c[:half]))) if len(c) > 3 else 0.0
    flat = librosa.feature.spectral_flatness(S=S)[0][live]
    return {
        'rise': round(slope, 1),
        'bright_hz': round(float(np.median(cent[live]))),
        'noisy': round(float(np.median(flat)), 3),
        'secs': round(len(y) / sr, 3),
        'rms_db': round(float(20 * np.log10(np.sqrt(np.mean(y ** 2)) + 1e-9)), 1),
        'peak_db': round(float(20 * np.log10(np.abs(y).max() + 1e-9)), 1),
    }
