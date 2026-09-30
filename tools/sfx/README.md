# The kids' screens' sounds

The kids' screens use a small palette of named sounds (`palette.json`): `tap`, `key`, `erase`, `open`, `close`, `select`, `unselect`, `paint`, `pick`, `place`, `correct`, `wrong`, `done`, `stars`, `spend`, `send`, `nope`, `owl` and `page`. They are chosen and made here, at development time, and ship as short WAVs in `frontend/public/sfx/` (about 1 MB in all).

```bash
tools/sfx/fetch.sh     # the Kenney packs, CC0 (interface, UI, digital, casino, impact, RPG), into packs/
docker run --rm --gpus all -v help-voice-cache:/root/.cache -v "$PWD:/repo" -w /repo/tools/sfx help-voice python pick.py
```

`pick.py` runs in the `tools/help-voice` image.

## How a sound is chosen

For each name, `pick.py` goes through every candidate file in the packs its entry lists, and scores it:

- **CLAP:** `laion/larger_clap_general`, a model that matches sound with words. It scores the candidate:
  - against what the sound should sound like ("a happy bright sparkling chime of success"),
  - against every other sound's description, so each sound stays recognisably itself,
  - and against what a kid's screen should never sound like ("a harsh loud buzzer", "a scary sound").
- **Direction** (`traits.py`): a yes or an opening must rise, and a no, a closing or an erase must fall. The rise is measured as the change in brightness from the first half of the sound to the second.
- **Length:** each sound has a maximum. A `key` gets 0.15 s, and `done` gets 2 s.

The best candidate that passes is then prepared and written out:
- The silence before it is cut to 2 ms, so a tap answers at once, and its tail is faded.
- Its loudness is set by its loudest 50 ms, not by the average over the whole clip (which punishes a short tick). A soft limiter keeps spiky sounds (coins, cards) from clipping.
- `done` (a celesta-like major arpeggio with sparkles) and the twinkle over `stars`' coins are made rather than found (`synth.py`).

`report.json` records, for each sound, the file chosen, its scores and the runners-up. `out/listen.html` puts every sound and its runners-up on one page to listen through. To prefer another candidate, narrow its `from` in `palette.json`.

## The screens

`src/sound/sfx.ts` plays the palette through Web Audio. The sounds are decoded ahead, so they play the moment she taps. Small taps vary a little in pitch.

`SoundProvider` (on the kids' route only) makes everything pressable sound by itself:
- a button taps;
- an element names another sound with `{...sound('open')}`, or `sound('none')` when its handler plays its own;
- a disabled button answers `nope`;
- a list selects, and typing ticks.

Outcomes are played where they happen: `sfx('correct')`, `sfx('stars')`.

`npm run check-sound` (in `npm run lint`) parses the kids' screens and fails if something she can touch makes no sound, or if something she drags is silent.

Only what she does on the screen makes a sound. Nothing plays yet for what happens elsewhere (a parent's approval, a chore running out); see Known gaps in CLAUDE.md.

## Credits

The sounds come from Kenney (www.kenney.nl) and are CC0. Credit isn't required, but it is given here.
