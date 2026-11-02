// Letter spelling for heptatonic scales.
//
// Each degree takes the next letter. The accidental is whatever makes that
// letter match the pitch, starting from the parallel major of the root.

import { mod } from './notes';

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const NATURAL = [0, 2, 4, 5, 7, 9, 11];

// Preferred major-tonic spelling of each pitch class. Sharps and flats follow
// the shorter key signature (F# and Gb are a tie; F# is the usual major name).
const TONIC_LETTER = [0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
const TONIC_ACC = [0, -1, 0, -1, 0, 0, 1, 0, -1, 0, -1, 0];

export interface SpelledTone {
  name: string;
  /** Pitch class 0–11. */
  pc: number;
  /** Accidental relative to the letter: negative is flat. */
  accidental: number;
}

export function accidentalGlyph(diff: number): string {
  if (diff === 0) return '';
  if (diff > 0) return '#'.repeat(diff);
  return 'b'.repeat(-diff);
}

/** Accidental that places `natural` on `target`, in -6..6. Negative is flat. */
export function nearestAccidental(target: number, natural: number): number {
  let diff = mod(target, 12) - natural;
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return diff;
}

/** Standalone pitch name, using the major-tonic spelling of that pitch class. */
export function pitchSpelling(pc: number): string {
  const p = mod(pc, 12);
  return `${LETTERS[TONIC_LETTER[p]]}${accidentalGlyph(TONIC_ACC[p])}`;
}

/**
 * One letter per degree. Null when the scale is not heptatonic, because a
 * five- or six-note set has no degree for every letter.
 */
export function spellScale(rootPc: number, intervals: number[]): SpelledTone[] | null {
  if (intervals.length !== 7) return null;
  const root = mod(rootPc, 12);
  const letter0 = TONIC_LETTER[root];
  const tones: SpelledTone[] = [];
  for (let i = 0; i < 7; i++) {
    const letter = (letter0 + i) % 7;
    const target = mod(root + intervals[i], 12);
    const accidental = nearestAccidental(target, NATURAL[letter]);
    tones.push({
      name: `${LETTERS[letter]}${accidentalGlyph(accidental)}`,
      pc: target,
      accidental,
    });
  }
  return tones;
}

/** Spell one chord tone from the chord root, using the degree number for its letter. */
export function spellChordTone(rootPc: number, interval: number, degree: string): string {
  const num = Number(degree.replace(/[^0-9]/g, ''));
  const offset = Number.isFinite(num) && num > 0 ? (num - 1) % 7 : 0;
  const root = mod(rootPc, 12);
  const letter = (TONIC_LETTER[root] + offset) % 7;
  const target = mod(root + interval, 12);
  const accidental = nearestAccidental(target, NATURAL[letter]);
  return `${LETTERS[letter]}${accidentalGlyph(accidental)}`;
}

/**
 * Name the pitch `semitones` away from a spelled note, moving `letterSteps`
 * letters. A whole step up is letterSteps 1; a whole step down is -1.
 */
export function spellStep(fromName: string, fromPc: number, semitones: number, letterSteps: number): string {
  const fromLetter = LETTERS.indexOf(fromName[0] ?? 'C');
  const letter = mod(fromLetter + letterSteps, 7);
  const target = mod(fromPc + semitones, 12);
  const accidental = nearestAccidental(target, NATURAL[letter]);
  return `${LETTERS[letter]}${accidentalGlyph(accidental)}`;
}
