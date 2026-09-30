# The owl's voice

Every help bubble (the tours in `frontend/src/**/*.help.ts`) is said aloud by the owl. The
clips are recorded here, at development time, and ship with the frontend
(`frontend/public/help-voice/*.mp3`, about 30 KB each). Nothing is spoken at runtime, and the
Pi needs no model and no network.

```bash
tools/help-voice/run.sh            # everything, on the dev machine (NVIDIA GPU + Docker; nothing needs to be running)
tools/help-voice/run.sh --retry    # …and try again the lines Whisper didn't hear perfectly
```

One command does it all, in 5 steps:
1. It builds the tools image.
2. It lists the owl's lines, in a one-off frontend container.
3. It records every line that has no clip yet or has changed, and listens to every take.
4. It checks that the screens have a clip for every bubble.
5. It prints the audit: what was heard differently, what failed, and what to commit.

Lines already recorded are kept, so a run after editing one bubble takes about a minute. A line fails the audit only if every take failed; then reword it or run again with `--retry`.

Then commit what it lists: `frontend/public/help-voice/`, `frontend/src/help/voice/clips.json` and `tools/help-voice/report.json`. Neither the Pi nor GitHub makes audio; the clips ship in the frontend image like any other file.

`npm run check-voice` (part of `npm run lint`) fails while a bubble has no clip, or has symbols the voice can't read.

The spoken line needn't be word for word what the bubble shows. A step's `say` replaces symbols, or wording that reads well but sounds odd.

## How it works

1. **The lines.** `frontend/scripts/help-lines.mjs` loads every tour in every variant
   (`src/help/allTours.ts`) and says what the owl says for each step (`src/help/speech.ts`):
   the title and the text, or the step's own `say` when the bubble leans on symbols
   (🟢, ⌫, ✅). A clip is keyed by that text, so an edited bubble is silent until it's
   recorded again, and `run.sh` records only what changed.
2. **The voice.** [VoxCPM2](https://github.com/OpenBMB/VoxCPM) (OpenBMB, Apache-2.0),
   run locally. It speaks Greek, and it can make a voice from a description. The owl's voice
   was designed once (`voice/voice.json`: "a young woman, warm, playful and cheerful…") and
   kept as `voice/owl.wav`, with what it says in `voice/owl.txt`. Every line carries on from
   that clip, so every line is the same voice. `pick.py` auditions voices (descriptions ×
   seeds × two ways of cloning) and reports on each. To change the voice, swap `voice/`;
   every clip is then recorded again.
3. **The audit.** Every take is listened back (`audit.py`, faster-whisper large-v3) and
   passes only if all of these hold:
   - Whisper hears what was written: character error rate ≤ 3%, ignoring accents and punctuation.
   - Whisper is sure the speech is Greek (≥ 0.9). This catches an accent or another language.
   - It's the owl's voice: cosine similarity ≥ 0.8 to `owl.wav`, measured with the resemblyzer speaker embedding.
   - It goes at a pace a kid can follow (9–19 characters a second).
   - It doesn't clip, and it sounds clean: torchaudio SQUIM estimates PESQ ≥ 3.3 and SI-SDR ≥ 20 dB from the clip alone.
   - It is as loud as the others: −16 LUFS within 1 LU. The gain is measured and applied, then the mp3 is measured again. (ffmpeg's one-pass loudnorm can't measure a clip under 3 s; those came out 20 dB quiet.)

   `record.py` makes at least 3 takes of a line and at most 8, and keeps the passing take that sounds most like the owl and is the liveliest (spread of pitch). The kept take is trimmed, normalised to −16 LUFS, encoded as mp3, and listened to again as it ships.
4. **The report.** `report.json` records, for every clip, what Whisper heard, its scores and
   how many takes it took. `out/listen.html` (not committed) puts every clip on one page, to
   listen through.

## The screens

`src/help/voice.ts` plays a step's clip when its bubble opens and stops it when the bubble
closes. In the bubble, 🔊/🔇 turns the voice on or off (this device remembers the choice),
and tapping the owl says the line again. The clips are precached by the PWA.
