// Tuning presets. All open-string pitches are stored as *actual sounding*
// (concert) pitch classes, low string first.
//
// Pitch classes (flats): C=0 Db=1 D=2 Eb=3 E=4 F=5 Gb=6 G=7 Ab=8 A=9 Bb=10 B=11

export interface GuitarString {
  /** Open-string pitch class (0-11), actual sounding pitch. */
  pc: number;
  /** Octave number, used for optional audio / ordering. */
  octave: number;
}

export interface TuningPreset {
  id: string;
  name: string;
  strings: number;
  /** Low -> high. */
  notes: GuitarString[];
}

function s(pc: number, octave: number): GuitarString {
  return { pc, octave };
}

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: '7-half-down',
    name: '7-string \u00b7 half step down',
    strings: 7,
    // Bb1 Eb2 Ab2 Db3 Gb3 Bb3 Eb4
    notes: [s(10, 1), s(3, 2), s(8, 2), s(1, 3), s(6, 3), s(10, 3), s(3, 4)],
  },
  {
    id: '8-half-down',
    name: '8-string \u00b7 half step down',
    strings: 8,
    // F1 Bb1 Eb2 Ab2 Db3 Gb3 Bb3 Eb4
    notes: [s(5, 1), s(10, 1), s(3, 2), s(8, 2), s(1, 3), s(6, 3), s(10, 3), s(3, 4)],
  },
  {
    id: '7-standard',
    name: '7-string \u00b7 standard',
    strings: 7,
    // B1 E2 A2 D3 G3 B3 E4
    notes: [s(11, 1), s(4, 2), s(9, 2), s(2, 3), s(7, 3), s(11, 3), s(4, 4)],
  },
  {
    id: '8-standard',
    name: '8-string \u00b7 standard',
    strings: 8,
    // F#1 B1 E2 A2 D3 G3 B3 E4
    notes: [s(6, 1), s(11, 1), s(4, 2), s(9, 2), s(2, 3), s(7, 3), s(11, 3), s(4, 4)],
  },
];

export function getPreset(id: string): TuningPreset | undefined {
  return TUNING_PRESETS.find((p) => p.id === id);
}

export function defaultPresetForStrings(strings: number): TuningPreset {
  return strings === 8 ? getPreset('8-half-down')! : getPreset('7-half-down')!;
}
