"""Listening back: faster-whisper transcribes a clip, and we measure how far it is from
what the owl should have said (character error rate, accents, punctuation and word breaks aside), and
how sure it is that the speech is Greek at all (an accent shows up there)."""
import re
import unicodedata

from faster_whisper import WhisperModel

_model = None


def model():
    global _model
    if _model is None:
        _model = WhisperModel('large-v3', device='cuda', compute_type='float16')
    return _model


def plain(text: str) -> str:
    s = unicodedata.normalize('NFD', text.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('ς', 'σ')
    s = re.sub(r'\bok\b', 'οκει', s)  # «Όκέι» is how she says the OK key
    # Word breaks aside too: Whisper writes «ταξοδεύεις», «στείλτα» for what was said right
    return re.sub(r'[^\w]|_', '', s)


def distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def listen(wav_path: str, expected: str) -> dict:
    segments, info = model().transcribe(wav_path, language=None, beam_size=5, vad_filter=False,
                                        condition_on_previous_text=False)
    heard = ' '.join(s.text.strip() for s in segments)
    if info.language != 'el':
        # Say it again assuming Greek, so the error rate still means something
        segments, _ = model().transcribe(wav_path, language='el', beam_size=5, condition_on_previous_text=False)
        heard = ' '.join(s.text.strip() for s in segments)
    a, b = plain(expected), plain(heard)
    return {
        'heard': heard,
        'cer': round(distance(a, b) / max(1, len(a)), 4),
        'language': info.language,
        'greek': round(dict(info.all_language_probs or []).get('el', 0.0), 4),
    }
