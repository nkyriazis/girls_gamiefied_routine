"""Judge every lesson's clips again from what Whisper already heard (speech.json keeps it), after a change to the
rules' statuses or to the comparison: no voice model, no new listen. A clip whose spoken text changed needs
voice.sh instead (it is recorded again). In the help-voice image, from tools/help-voice:
  python ../lessons/speech/rejudge.py /repo/tools/lessons/work/<id> …"""
import json
import os
import sys

sys.path.insert(0, os.getcwd())  # tools/help-voice: audit.py
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from listen import judge_words, load_rules, spoken  # noqa: E402

registry = load_rules()
for d in sys.argv[1:]:
    f = os.path.join(d, 'speech.json')
    speech = json.load(open(f))
    stale = 0
    for rel, c in speech['clips'].items():
        if c.get('words') is None or spoken(c['text'], registry)[0] != c['spoken']:
            stale += 1
            continue
        speech['clips'][rel] = judge_words(c['text'], os.path.join(d, 'package', rel), registry, os.path.join(d, 'speech'),
                                           os.path.basename(rel)[:-4], c['words'])
    json.dump(speech, open(f, 'w'), ensure_ascii=False, indent=1)
    print(f'{os.path.basename(d)}: {sum(len(c["odd"]) for c in speech["clips"].values())} odd'
          + (f', {stale} to record again (voice.sh)' if stale else ''))
