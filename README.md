# Fretboard Visualizer

Interactive 7- and 8-string fretboard — plus a piano keyboard — for visualizing
scales, modes, and diatonic triads, built for half-step-down tuning.

## Features

- **7 or 8 string**, with half-step-down presets (and standard), plus per-string custom tuning.
- **Keyboard view:** the same scale, mode, triad, or chord on a piano keyboard
  (1 octave, 2 octaves, or a 37-key span). Show the fretboard, the keyboard, or both;
  the two views share colours and labels.
- **Scale families and their modes:** major, melodic minor, harmonic minor, harmonic major,
  pentatonic, blues, diminished, and whole tone.
- **Diatonic triads I–vii** for the selected key, labeled with Roman numeral and quality,
  plus a chord builder and progressions.
- **One voicing:** in Chords view, step through a single playable grip on the neck and keyboard instead of lighting every chord tone.
- **Voice-led playback and export:** with Voice leading on, Play and Export .mid walk a smooth path of grips instead of restacking every chord in root position.
- **Note names or scale-degree labels.**
- **Concert vs Standard labeling:** Standard shifts displayed note names up a semitone so
  shapes read like standard tuning; the physical fret positions are unchanged.
- Up to 24 frets with inlay markers.

## Run it on another computer

Copy `fretboard-visualizer.html` to the other computer and open it in Chrome, Edge, or Firefox.
Nothing else has to be installed. On Windows you can also double-click `Run Fretboard Visualizer.bat`.

After you change the app, rebuild that file (Node.js required):

```bash
npm install
npm run build
```

## Getting started

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL in your browser.

## Build

```bash
npm run build
```

That writes `fretboard-visualizer.html` in this folder. `npm run preview` serves the same build locally.

## Type-check

```bash
npm run typecheck
```

## How the music is stored

The music code is plain data and functions in `src/music/`. A TypeScript `interface` here is a struct. There is no class hierarchy. If you have written C, read these files as a `.c` file plus a header.

Everything is integer arithmetic. A note is a **pitch class**, an integer from 0 to 11, with C as 0 (Db = 1, D = 2, … B = 11). The octave is never part of that number. Sharps and flats are a spelling choice applied only when a number is turned into text. `src/music/notes.ts` holds that model, including `mod`, which is modulo that stays non-negative.

### Fretboard

A string is its open pitch class plus the octave of that open string. Presets live in `src/music/tunings.ts` as concert pitch, low string first. The default 7-string neck is Bb1, Eb2, Ab2, Db3, Gb3, Bb3, Eb4.

`buildGrid` in `src/music/fretboard.ts` builds one row per string and one cell per fret, including fret 0 (the open string). Each cell is four numbers:

| Field | Meaning |
| --- | --- |
| `stringIndex` | 0 is the lowest string |
| `fret` | 0 is the open string |
| `pc` | `(open pitch class + fret) mod 12` |
| `midi` | `(octave + 1) * 12 + pitch class + fret`, so middle C is 60 |

The key does not move those cells. Lighting a note is a separate question. `createEvaluator` in `src/music/highlight.ts` takes a pitch class and returns a colour, a label, and whether to draw it, or `null` to skip it. The fretboard (`src/components/Fretboard.tsx`) and the keyboard (`src/components/Keyboard.tsx`) both call that function, so a given pitch class looks the same on both.

**Concert** shows the sounding pitch. **Standard** adds 1 to the displayed name after the pitch class is chosen, so a half-step-down guitar can be read as if it were in standard tuning. The dots stay put. Left-handed mode mirrors the picture. The grid stays low-string-first, with fret 0 at the nut.

### Key

A key on screen is three fields: `rootPc`, `familyKey`, and `modeKey`.

Families and modes are a table in `src/music/scales.ts`. A mode is a name plus semitone offsets from its own root, always starting at 0. C major is root 0 and `[0, 2, 4, 5, 7, 9, 11]`. D Dorian is root 2 and `[0, 2, 3, 5, 7, 9, 10]`. Those interval lists are already the rotated scale. Drawing does not rotate them again. Sounding pitch classes are `(root + each interval) mod 12`.

Degree labels compare a 7-note mode with the major scale `[0, 2, 4, 5, 7, 9, 11]`. A degree one semitone lower than major gets a `b`. Pentatonic, blues, diminished, and whole-tone sets are stored the same way. They are not 7 notes, so triads and progression templates borrow parallel major or natural minor through `parentScale`.

### Chords

There are two chord shapes.

A **triad** is computed. `getDiatonicTriad` takes the scale intervals and a degree, then stacks every other scale tone (that degree, plus 2, plus 4, wrapping around). The semitone gaps from the root to the third and from the root to the fifth pick major, minor, diminished, or augmented. Modes do not need a hand-written roman-numeral table.

A **general chord** is a root pitch class plus a quality. Qualities are the `CHORD_QUALITIES` table in `src/music/chords.ts`. Each entry is a list of `(semitones above the root, degree name)` pairs. Dominant 7 is `[[0, "1"], [4, "3"], [7, "5"], [10, "b7"]]`. `buildChord(root, quality)` turns one entry into a `Chord`:

- `rootPc`
- `symbol` and `name` for display (`"7"`, `"dominant 7th"`)
- `tones`, each with an interval, a degree string, and a role: `root`, `third`, `fifth`, `seventh`, or `ext`
- `pcs`, the unique pitch classes, so highlighting can test membership

The degree number picks the role. 2, 3, and 4 count as the third, so a sus4’s 4th is the third of a grip. 6 and 7 count as the seventh. 9, 11, and 13 count as extensions. An interval may be larger than 12: a 9th is stored as 14 semitones, then reduced mod 12 when it is placed on the neck.

A progression is a list of `Chord` objects plus tempo, beats per chord, octave, loop, and whether the diatonic buttons build sevenths. That list is React state inside `ProgressionControls` and is copied up to `App` when it changes. Nothing is sent to a server. `src/state/setups.ts` writes the app state and the progression as JSON into the browser’s `localStorage`, under the key `fretboard-visualizer:setups:v1`. Named setups are the same blob with a name, capped at 24. Reopening the page restores the last session. The portable HTML file uses that same storage in the browser that opens it.

### Where to read next

| File | What it owns |
| --- | --- |
| `src/music/notes.ts` | Pitch classes, names, the concert/standard shift |
| `src/music/tunings.ts` | Open strings |
| `src/music/fretboard.ts` | The neck grid |
| `src/music/scales.ts` | Families, modes, degree labels |
| `src/music/chords.ts` | Triad builder and the quality catalog |
| `src/music/highlight.ts` | Whether a pitch class is drawn, and how |
| `src/music/reading.ts` | The sentence above the neck: origin, pulls, sit / color / lean |
| `src/state/setups.ts` | Saving and loading |
| `src/App.tsx` | UI state, and the values derived from it |

`notes.ts`, `fretboard.ts`, `tunings.ts`, and the tables in `scales.ts` and `chords.ts` are the readable core. The pitch-class integer is the one idea to learn. Wrapping it in a `Note` class would touch almost every file and make the arithmetic longer.

The hard files are the shell. `App.tsx` holds UI state, saving, and every derived value the neck needs. `Controls.tsx` and `ProgressionControls.tsx` mix layout with playback. `highlight.ts` and `reading.ts` are correct and dense: several rules share one function, and locals are short (`pc`, `idx`, `rel`).

A split of `App.tsx` into saved state, derived music, and layout, plus one function per view in the highlight and reading code, is a few days of moving code with no behavior change. That would make the shell as direct as the neck math. A ground-up rewrite would take weeks and would not make the fretboard easier to follow.
