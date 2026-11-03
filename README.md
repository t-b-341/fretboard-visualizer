# Fretboard Visualizer

UI rebuild in progress on branch ui-v2. See docs/ui-spec.md.

Fretboard and piano keyboard for scales, chords, and progressions on 6-string bass and 7- and 8-string guitars.

## Features

### Instruments

6-string bass presets are Bb standard and standard. 7- and 8-string presets are standard and half-step down. Each string can be retuned by pitch class. Show the fretboard, the keyboard, the grand staff, or any combination. The staff stays off for setups saved before it existed. Concert pitch is sounding pitch on the grand staff. Written pitch is the instrument's part, an octave higher than it sounds: guitar on one treble staff with an 8 under the clef, 6-string bass on one bass staff with an 8 under the clef. The Concert / Standard label control does not move the notes; with Standard on, a line under the staff says the names are a semitone higher. A note more than four ledger lines from its staff is written an octave closer and marked 8va or 8vb. Treble and bass clefs are outlines from Bravura by Steinberg Media Technologies, used under the SIL Open Font License 1.1 (`licenses/Bravura-OFL.txt`). The keyboard span is 1 octave, 2 octaves, or 37 keys. The neck is 12 to 24 frets.

### Scales

`SCALE_FAMILIES` has eight families:

- Major: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian.
- Melodic minor: Melodic Minor, Dorian b2, Lydian Augmented, Lydian Dominant, Mixolydian b6, Locrian ♮2, Altered.
- Harmonic minor: Harmonic Minor, Locrian ♮6, Ionian ♯5, Dorian ♯4, Phrygian Dominant, Lydian ♯2, Ultralocrian.
- Harmonic major: Harmonic Major, Dorian b5, Phrygian b4, Lydian b3, Mixolydian b2, Lydian Augmented ♯2, Locrian bb7.
- Pentatonic: major, suspended, b6, mode 4, minor.
- Blues: minor blues, major blues.
- Diminished: half-whole, whole-half.
- Whole tone.

A second scale can be overlaid. Shared notes only draws tones that belong to both. Labels are note names or scale degrees. Concert shows the sounding pitch. Standard adds one semitone to the displayed name. Fret positions stay the same. The staff keeps concert pitch either way.

### Chords

Diatonic triads for the current key are shown on the neck. The progression bar can build those degrees as sevenths. The chord builder groups qualities as Triads, Suspended, Sixths, Sevenths, Extended, and Altered dominant. Chords view can light every chord tone, or one grip at a time. Identify takes one note per string and lists the closest catalog names, including inversions and a missing fifth.

### Progressions

Templates are Pop (I–V–vi–IV), 50s (I–vi–IV–V), Pachelbel, jazz ii–V–I, 12-bar blues, Andalusian, and a secondary-dominant turnaround. Random walks tonic, subdominant, and dominant. With Borrowed / secondary on, a step can become the secondary dominant of the next chord, or a borrowed iv, ♭VII, ♭VI, or ♭III. With Voice leading on, Play and Export .mid follow a path of grips. The weights for that path are adjustable, and Reset restores the defaults. Position window limits grips to a fret range and dims notes outside it. Open strings stay available when the window starts at fret 0.

### Practice

Quiz mode starts with a blank neck and asks for one tone of a chord. The first click scores the question. Next deals another.

### Sound and sharing

A built-in synth plays in the browser. Web MIDI sends notes to a chosen output. Export .mid downloads the progression as a Standard MIDI file. The address bar stores the neck setup (tuning, key, scale, view, labels, comparison, and position window). Copy link copies that URL.

## Voice leading

Each chord keeps up to 60 candidate grips, ranked by how close the lowest fret sits to `anchorFret`. A step charges `roleMotion` per semitone by the departing tone’s role, `handShift` per fret of hand movement (skipped when either grip is all open strings), and `omissionPenalty` for an unpaired voice. `commonToneBonus` is subtracted for each note held on the same string and fret, and `resolutionBonus` when a seventh falls one or two semitones onto a third or a third rises one semitone onto a root. `registerAnchor` charges the distance from the destination’s lowest fret to `anchorFret`. `leadProgression` runs a Viterbi search over those candidates and returns the cheapest path through the whole progression. Defaults are `roleMotion` root 0.5, third 1.5, fifth 1.0, seventh 1.5, ext 1.0; `handShift` 0.8; `commonToneBonus` 2; `resolutionBonus` 3; `omissionPenalty` 6; `registerAnchor` 0.3; `anchorFret` 5.

## Getting started

```bash
npm install
npm run dev
```

Open the localhost URL Vite prints.

## Scripts

- `npm run dev` starts the Vite dev server.
- `npm run build` builds the app and writes `fretboard-visualizer.html`.
- `npm run preview` serves that build.
- `npm run typecheck` runs `tsc --noEmit`.
- `npm run test` runs Vitest.

## Project layout

| File | What it holds |
| --- | --- |
| `src/App.tsx` | Page composition: the state hook, derived values, and the views |
| `src/state/useAppState.ts` | Saved UI state, its setters, and save/restore |
| `src/state/appState.ts` | `AppState` shape, defaults, and the localStorage merge |
| `src/state/derive.ts` | Scale intervals, pitch-class index, spelling, active chord, highlight evaluator, and voicings |
| `src/state/setups.ts` | Last session and named setups in `localStorage` (`fretboard-visualizer:setups:v1`) |
| `src/components` | Fretboard, keyboard, grand staff, controls, legend, progression bar, sound controls, and the setup, formula, quiz, and identify panels |
| `src/music` | Scales, chords, voicings, voice leading, staff notation, quiz, identify, tunings, and the fretboard grid |
| `src/audio` | Built-in synth, Web MIDI output, playback, and `.mid` export |
| `src/urlState.ts` | Address-bar encoding of the neck setup |
