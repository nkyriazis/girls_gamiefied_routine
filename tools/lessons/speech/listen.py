"""What the owl says, word by word: the speech rules (rules.json) that turn what the screen shows into what she
says, and a word-level listen of a recorded clip that finds the words Whisper heard otherwise and cuts a short
snippet around each, for a person to judge (tools/lessons/speech/README.md). Used by tools/lessons/read_aloud.py,
in the help-voice image (Whisper, ffmpeg)."""
import difflib
import json
import os
import re
import subprocess
import unicodedata

from audit import _numbers, model

RULES_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rules.json')


def load_rules():
    return json.load(open(RULES_FILE))


def spoken(text, registry):
    """What the owl says for `text`, and the ids of the rules that changed it. A rejected rule is left out."""
    used = []
    for r in registry['rules']:
        if r['status'] == 'rejected':
            continue
        new = re.sub(r['match'], r['say'], text)
        if new != text:
            used.append(r['id'])
            text = new
    return text, used


SAME = {'τον': 'το', 'την': 'τη', 'στον': 'στο', 'στην': 'στη', 'δεν': 'δε', 'μην': 'μη', 'κι': 'και', 'σ': 'σε',
        'απ': 'απο', 'ν': 'να', 'θ': 'θα', 'τ': 'το', 'μ': 'με'}


def phon(s):
    """A word as it sounds, near enough: Greek has many spellings of one sound (ι η υ ει οι, ο ω, αι ε, double
    letters), and Whisper picks any, so only a different sound counts. A diaeresis keeps its vowel apart."""
    s = unicodedata.normalize('NFC', s.lower())
    s = re.sub('[ϊΐϋΰ]', 'Ι', s)  # a vowel of its own (Ταΰγετος: ta-i-), not part of a pair
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').replace('ς', 'σ')
    s = _numbers(s)
    # Words the ear can't tell apart, that Whisper writes either way: a final ν, κι, σ’ and the other elisions
    s = ' '.join(SAME.get(w, w) for w in re.findall(r'\w+', s))
    for a, b in (('ει', 'ι'), ('οι', 'ι'), ('υι', 'ι'), ('αι', 'ε'), ('ου', 'U'), ('αυ', 'αβ'), ('ευ', 'εβ'),
                 ('η', 'ι'), ('υ', 'ι'), ('ω', 'ο'), ('Ι', 'ι')):
        s = s.replace(a, b)
    s = re.sub(r'[^\w]|_', '', s)
    return re.sub(r'(.)\1+', r'\1', s)


def tokens(text):
    """The words of a text, with their character spans, leaving out what makes no sound (punctuation alone)."""
    return [(m.group(), m.span()) for m in re.finditer(r'\S+', text) if phon(m.group())]


def heard_words(path):
    """What Whisper hears, word by word, with times."""
    segments, _ = model().transcribe(path, language='el', beam_size=5, word_timestamps=True,
                                     condition_on_previous_text=False, vad_filter=False)
    out = []
    for seg in segments:
        for w in seg.words or []:
            if phon(w.word):
                out.append({'w': w.word.strip(), 'start': w.start, 'end': w.end})
    return out


def opcodes(a, b, by=phon):
    return difflib.SequenceMatcher(None, [by(x) for x in a], [by(x) for x in b], autojunk=False).get_opcodes()


def mapped(ops, i1, i2):
    """The range of b that a's [i1, i2) lines up with."""
    js = []
    for tag, a1, a2, b1, b2 in ops:
        if a2 <= i1 or a1 >= i2:
            if not (a1 == a2 and i1 <= a1 < i2):
                continue
        if tag == 'equal':
            lo, hi = max(a1, i1), min(a2, i2)
            js += list(range(b1 + lo - a1, b1 + hi - a1))
        else:
            js += list(range(b1, b2))
    return (min(js), max(js) + 1) if js else None


def cut(mp3, heard, j, out):
    """A snippet of the clip around heard words [j0, j1), one word more each side, or the gap where nothing was heard."""
    j0, j1 = j
    if j1 > j0:
        a = heard[max(0, j0 - 1)]['start']
        b = heard[min(len(heard), j1 + 1) - 1]['end']
    else:
        a = heard[j0 - 1]['start'] if j0 > 0 else 0
        b = heard[j0]['end'] if j0 < len(heard) else (heard[-1]['end'] if heard else 2)
    a, b = max(0, a - 0.15), b + 0.2
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ss', f'{a:.2f}', '-to', f'{b:.2f}', '-c:a', 'libmp3lame',
                    '-b:a', '32k', '-ac', '1', out], check=True)


def key(words):
    """How a case is named in the registry: the words as written, lower case, without the punctuation around them."""
    return ' '.join(re.sub(r'^[^\w]+|[^\w.]+$', '', w) for w in words).lower()


def judge_words(text, mp3, registry, snip_dir, cid, heard=None):
    """The words of a recorded line a person should hear: `odd`, words Whisper heard otherwise that no rule made,
    and `uses`, where each rule changed what she says. Each with a snippet."""
    said, used = spoken(text, registry)
    orig, sp = tokens(text), tokens(said)
    heard = heard if heard is not None else heard_words(mp3)
    # By spelling, not sound: «Ταΰγετος» → «Ταήγετος» sounds the same on paper, and is still the rule's word
    o2s = opcodes([w for w, _ in orig], [w for w, _ in sp], by=str.lower)
    made = set()  # the spoken words a rule made: the rule's sign-off judges them, not a case
    for tag, a1, a2, b1, b2 in o2s:
        if tag != 'equal':
            made.update(range(b1, b2))
    s2h = opcodes([w for w, _ in sp], [h['w'] for h in heard])
    os.makedirs(snip_dir, exist_ok=True)
    odd, uses = [], []
    for tag, a1, a2, b1, b2 in s2h:
        if tag in ('equal', 'insert'):
            continue
        mine = [k for k in range(a1, a2) if k not in made]
        said_w, heard_w = [sp[k][0] for k in range(a1, a2)], [h['w'] for h in heard[b1:b2]]
        if not mine or phon(' '.join(said_w)) == phon(' '.join(heard_w)):
            continue
        snip = os.path.join(snip_dir, f'{cid}-o{len(odd)}.mp3')
        cut(mp3, heard, (b1, b2), snip)
        # A short word («το») is named with its neighbour, so signing it off once doesn't pass it everywhere
        named = mine
        if len(''.join(sp[k][0] for k in named)) < 4:
            named = [k for k in [mine[0] - 1, *mine, mine[-1] + 1] if 0 <= k < len(sp)]
        odd.append({'key': key([sp[k][0] for k in named]), 'said': ' '.join(said_w), 'heard': ' '.join(heard_w),
                    'at': [sp[a1][1][0], sp[a2 - 1][1][1]],
                    'snip': os.path.basename(snip)})
    for rid in used:
        rule = next(r for r in registry['rules'] if r['id'] == rid)
        for m in re.finditer(rule['match'], text):
            oi = [k for k, (_, (s, e)) in enumerate(orig) if s < m.end() and e > m.start()]
            if not oi:
                continue
            si = mapped(o2s, oi[0], oi[-1] + 1)
            hj = si and mapped(s2h, *si)
            if not hj:
                continue
            snip = os.path.join(snip_dir, f'{cid}-u{len(uses)}.mp3')
            cut(mp3, heard, hj, snip)
            uses.append({'rule': rid, 'shown': ' '.join(w for w, _ in orig[oi[0]:oi[-1] + 1]),
                         'said': ' '.join(w for w, _ in sp[si[0]:si[1]]), 'at': [sp[si[0]][1][0], sp[si[1] - 1][1][1]],
                         'heard': ' '.join(h['w'] for h in heard[hj[0]:hj[1]]), 'snip': os.path.basename(snip)})
    return {'text': text, 'spoken': said, 'rules': used, 'heard': ' '.join(h['w'] for h in heard), 'words': heard,
            'odd': odd, 'uses': uses}
