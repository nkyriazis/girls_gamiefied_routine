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


# Greek numbers in words, without accents, ς as σ: Whisper writes the same «πέντε» as «5» one time and «πέντε» the
# next, so both sides of a comparison read numbers as digits
_UNITS = {'ενα': 1, 'ενασ': 1, 'μια': 1, 'μια': 1, 'δυο': 2, 'τρια': 3, 'τρεισ': 3, 'τεσσερα': 4, 'τεσσερισ': 4,
          'πεντε': 5, 'εξι': 6, 'επτα': 7, 'εφτα': 7, 'οκτω': 8, 'οχτω': 8, 'εννεα': 9, 'εννια': 9, 'δεκα': 10,
          'εντεκα': 11, 'δωδεκα': 12, 'δεκατρια': 13, 'δεκατρεισ': 13, 'δεκατεσσερα': 14, 'δεκατεσσερισ': 14,
          'δεκαπεντε': 15, 'δεκαεξι': 16, 'δεκαεπτα': 17, 'δεκαεφτα': 17, 'δεκαοκτω': 18, 'δεκαοχτω': 18,
          'δεκαεννεα': 19, 'δεκαεννια': 19, 'εικοσι': 20, 'τριαντα': 30, 'σαραντα': 40, 'πενηντα': 50, 'εξηντα': 60,
          'εβδομηντα': 70, 'ογδοντα': 80, 'ενενηντα': 90, 'εκατο': 100, 'εκατον': 100}
for _stem, _n in [('διακοσι', 2), ('τριακοσι', 3), ('τετρακοσι', 4), ('πεντακοσι', 5), ('εξακοσι', 6), ('επτακοσι', 7),
                  ('εφτακοσι', 7), ('οκτακοσι', 8), ('οχτακοσι', 8), ('εννιακοσι', 9), ('εννεακοσι', 9)]:
    for _end in ('α', 'εσ', 'οι'):
        _UNITS[_stem + _end] = _n * 100
_THOUSAND = {'χιλια', 'χιλιεσ', 'χιλιοι', 'χιλιαδεσ'}


def _numbers(s: str) -> str:
    out, run = [], None
    for w in re.findall(r'\w+|\W+', s):
        if w in _UNITS or w in _THOUSAND:
            run = (run or 0)
            run = (max(run, 1) * 1000) if w in _THOUSAND else run + _UNITS[w]
            continue
        if run is not None and not w.strip():
            continue  # the space between two number words
        if run is not None:
            out.append(f'{run} ' if not w.strip() else str(run))
            run = None
        out.append(w)
    if run is not None:
        out.append(str(run))
    return ''.join(out)


def plain(text: str) -> str:
    s = unicodedata.normalize('NFD', text.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = s.replace('ς', 'σ')
    s = _numbers(s)
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
