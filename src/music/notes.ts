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
 * Semitones to shift *displayed* note names so a half-step-down fretboard can be
 * read as if it were standard tuning. Concert = 0 (actual sounding pitch),
 * Standard = +1 (names read a half step higher; physical positions unchanged).
 */
export function labelShift(mode: 'concert' | 'standard'): number {
  return mode === 'standard' ? 1 : 0;
}
