// Pitch-class utilities and note naming.
//
// A pitch class is an integer 0-11 where 0 = C, 1 = Db/C#, ... 11 = B.

export type PitchClass = number;

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Always-positive modulo. */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/**
 * Human-readable name for a pitch class. We prefer flats by default because
 * half-step-down tunings spell naturally with flats (Eb, Ab, Bb, ...).
 */
export function noteName(pc: number, preferFlats = true): string {
  const names = preferFlats ? FLAT_NAMES : SHARP_NAMES;
  return names[mod(pc, 12)];
}

/**
 * Scientific name of a MIDI note, using the app's octave numbering
 * (MIDI 60 → "C4", middle C). Same numbering as the sound-octave control.
 */
export function pitchName(midi: number, preferFlats = true): string {
  const n = Math.max(0, Math.min(127, Math.round(midi)));
  return `${noteName(n, preferFlats)}${Math.floor(n / 12) - 1}`;
}

/**
 * Semitones to shift *displayed* note names so a half-step-down fretboard can be
 * read as if it were standard tuning. Concert = 0 (actual sounding pitch),
 * Standard = +1 (names read a half step higher; physical positions unchanged).
 */
export function labelShift(mode: 'concert' | 'standard'): number {
  return mode === 'standard' ? 1 : 0;
}

// Flat-based chromatic degree names for an interval (0-11 semitones) above a root.
const CHROMATIC_DEGREES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7'];

/**
 * Degree label for any chromatic interval above a reference root. Used to label
 * notes that are not diatonic to the reference scale (for example an overlaid
 * scale's unique tones), measured relative to the primary root.
 */
export function chromaticDegreeLabel(interval: number): string {
  return CHROMATIC_DEGREES[mod(interval, 12)];
}
