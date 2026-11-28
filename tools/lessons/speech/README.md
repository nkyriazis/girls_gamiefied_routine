# What the owl says: speech rules and the owner's sign-off

The owl's voice (VoxCPM2) gets some spellings wrong, and a check by machine can't tell a right name from a wrong
one: Whisper heard «Ταΰγετος» as «Τατήγετος», and only a person could say the owl was wrong, not Whisper. So the
machines only pick out what a person should hear, the owner judges it once, and the build refuses a lesson with a
word nobody heard.

`rules.json` (committed: names and patterns, never the book's text) holds:

- **rules**: a pattern (Python regex) and what the owl says instead, applied in order before she speaks. The screen
  still shows the book's text; only the recording changes. A rule is a kind of spelling, not a word, wherever
  that fits («[ΰΐ]» → «ή»; abbreviations; a unit after a number), so one sign-off covers lessons not written yet.
  `status` is `pending` until the owner hears it, then `approved` for that voice (`voice`: a new voice or model
  asks again), or `rejected` (left out; its words come back as cases).
- **cases**: words Whisper heard otherwise that the owner heard and found right as written (`key`, `voice`).

## How it runs

1. `tools/lessons/voice.sh` (in `build.sh`) applies the rules, records what is new, and listens to every clip word
   by word (`listen.py`): a word whose sound differs from what Whisper heard (spelling aside: ι/η/υ/ει/οι, ο/ω,
   αι/ε and double letters count as one sound) and that no rule made is an **odd** word; where a rule changed
   what she says is a **use**. Each gets a snippet of the clip around it. Written to
   `work/<id>/speech.json` and `work/<id>/speech/`; a clip already listened to is not listened to again.
2. `tools/lessons/speech/review.sh <out dir> [<id>…]` gathers what waits across every lesson: each rule in use
   and not signed off, with up to 4 uses from different lessons, and each odd word no case covers, with up to 3
   places. One self-contained page (`review.html`, the snippets inside) and its cards (`items.json`). A short word
   («το») is named with its neighbour, so signing it off once doesn't pass it everywhere.
3. The owner signs off on that page, published as a private Artifact with a `db` (an agent publishes it to the
   same link each round): ✓ sounds right, ✎ say it as… (a respelling), ✗ (a rule) sounds wrong.
4. The agent reads the page's `verdicts` into a file and runs
   `node tools/lessons/speech/apply.mjs <verdicts.json> <items.json>`: ✓ approves the rule or adds the case,
   ✗ rejects the rule, ✎ adds a word rule (`word-<key>`), pending, so the owner hears it next round. Then the
   affected lessons are built again (only the clips whose spoken text changed are recorded again), and step 2
   repeats until the page is empty.
5. `gate.mjs` (last in `build.sh`) fails while any clip of the lesson uses a rule not approved for its voice, or
   has an odd word no case covers.

A respelled word is better made a pattern when it is one: if «ΐ» also fails in another word, the rule is the
diaeresis, not the word. The agent proposes that rule (pending) and the owner hears it.
