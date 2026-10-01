# Fretboard Visualizer

Interactive 7- and 8-string fretboard for visualizing scales, modes, and diatonic
triads, built for half-step-down tuning.

## Features

- **7 or 8 string**, with half-step-down presets (and standard), plus per-string custom tuning.
- **Three scale families and all their modes:**
  - Major: Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian
  - Melodic minor: Melodic Minor, Dorian b2, Lydian Augmented, Lydian Dominant, Mixolydian b6, Locrian natural 2, Altered
  - Harmonic minor: Harmonic Minor, Locrian natural 6, Ionian #5, Dorian #4, Phrygian Dominant, Lydian #2, Ultralocrian
- **Diatonic triads I-vii** for the selected key, auto-labeled with Roman numeral + quality.
- **Note names or scale-degree labels.**
- **Concert vs Standard labeling:** Standard shifts displayed note names up a semitone so
  shapes read like standard tuning; the physical fret positions are unchanged.
- Up to 24 frets with inlay markers.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed `localhost` URL in your browser.

## Build

```bash
npm run build
npm run preview
```

## Type-check

```bash
npm run typecheck
```
