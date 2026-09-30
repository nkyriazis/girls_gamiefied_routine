"""Shared by the scripts: the model, a take (one try at saying a line), how we judge it."""
import numpy as np
import soundfile as sf
import torch
import librosa

from audit import listen

_tts = _enc = _squim = None


def tts():
    global _tts
    if _tts is None:
        from voxcpm import VoxCPM
        _tts = VoxCPM.from_pretrained('openbmb/VoxCPM2', load_denoiser=False)
    return _tts


def encoder():
    global _enc
    if _enc is None:
        from resemblyzer import VoiceEncoder
        _enc = VoiceEncoder('cuda')
    return _enc


def embed(path: str) -> np.ndarray:
    from resemblyzer import preprocess_wav
    return encoder().embed_utterance(preprocess_wav(path))


def clean(path: str) -> dict:
    """How clean it sounds, from the clip alone (torchaudio SQUIM): hiss and crackle show here"""
    global _squim
    import torchaudio
    if _squim is None:
        from torchaudio.pipelines import SQUIM_OBJECTIVE
        _squim = SQUIM_OBJECTIVE.get_model().cuda().eval()
    wav, sr = torchaudio.load(path)
    wav = torchaudio.functional.resample(wav.mean(0, keepdim=True), sr, 16000).cuda()
    with torch.no_grad():
        stoi, pesq, sisdr = (float(x) for x in _squim(wav))
    return {'pesq': round(pesq, 2), 'stoi': round(stoi, 3), 'si_sdr': round(sisdr, 1)}


def say(text: str, seed: int, style: str | None = None, ref: str | None = None, ref_text: str | None = None) -> tuple[np.ndarray, int]:
    """One take. With `ref`, in that voice (and with `ref_text`, carrying on from it)."""
    torch.manual_seed(seed)
    kw = {}
    if ref:
        kw['reference_wav_path'] = ref
        if ref_text:
            kw.update(prompt_wav_path=ref, prompt_text=ref_text)
    wav = tts().generate(text=f'({style}){text}' if style else text, cfg_value=2.0, inference_timesteps=10, **kw)
    return wav, tts().tts_model.sample_rate


def pitch(path: str) -> dict:
    y, sr = librosa.load(path, sr=16000)
    f0, _, _ = librosa.pyin(y, fmin=80, fmax=700, sr=sr)
    f = f0[~np.isnan(f0)]
    if not len(f):
        return {'f0': 0, 'lively': 0}
    return {'f0': round(float(np.median(f))), 'lively': round(float((12 * np.log2(f / np.median(f))).std()), 2)}


def judge(path: str, text: str, ref_embedding: np.ndarray | None = None) -> dict:
    """What we know about a take: what Whisper heard, its voice, its pitch, its length."""
    info = sf.info(path)
    y, _ = sf.read(path)
    r = {**listen(path, text), **pitch(path), 'secs': round(info.duration, 2),
         'peak': round(float(np.abs(y).max()), 3), 'rate': round(len(text) / max(info.duration, 0.1), 1), 'clean': clean(path)}
    if ref_embedding is not None:
        r['same_voice'] = round(float(np.dot(embed(path), ref_embedding)), 3)
    return r
