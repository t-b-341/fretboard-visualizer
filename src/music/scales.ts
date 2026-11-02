// Scale families, their modes, and helpers for turning a root + interval set
// into concrete pitch classes and proper scale-degree labels.

import { chromaticDegreeLabel, mod } from './notes';

export type FamilyKey =
  | 'major'
  | 'melodicMinor'
  | 'harmonicMinor'
  | 'harmonicMajor'
  | 'pentatonic'
  | 'blues'
  | 'diminished'
  | 'wholeTone';

export interface ModeDef {
  /** Stable internal key, e.g. "Dorian". */
  key: string;
  /** Display name shown in the UI. */
  name: string;
  /** Semitones from the root, ascending, starting at 0. */
  intervals: number[];
}

export interface FamilyDef {
  key: FamilyKey;
  name: string;
  modes: ModeDef[];
}

export const SCALE_FAMILIES: FamilyDef[] = [
  {
    key: 'major',
    name: 'Major',
    modes: [
      { key: 'Ionian', name: 'Ionian (Major)', intervals: [0, 2, 4, 5, 7, 9, 11] },
      { key: 'Dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
      { key: 'Phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
      { key: 'Lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
      { key: 'Mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
      { key: 'Aeolian', name: 'Aeolian (Natural Minor)', intervals: [0, 2, 3, 5, 7, 8, 10] },
      { key: 'Locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
    ],
  },
  {
    key: 'melodicMinor',
    name: 'Melodic Minor',
    modes: [
      { key: 'MelodicMinor', name: 'Melodic Minor', intervals: [0, 2, 3, 5, 7, 9, 11] },
      { key: 'Dorianb2', name: 'Dorian b2 (Phrygian \u266f6)', intervals: [0, 1, 3, 5, 7, 9, 10] },
      { key: 'LydianAugmented', name: 'Lydian Augmented', intervals: [0, 2, 4, 6, 8, 9, 11] },
      { key: 'LydianDominant', name: 'Lydian Dominant', intervals: [0, 2, 4, 6, 7, 9, 10] },
      { key: 'Mixolydianb6', name: 'Mixolydian b6', intervals: [0, 2, 4, 5, 7, 8, 10] },
      { key: 'LocrianNat2', name: 'Locrian \u266e2', intervals: [0, 2, 3, 5, 6, 8, 10] },
      { key: 'Altered', name: 'Altered (Super Locrian)', intervals: [0, 1, 3, 4, 6, 8, 10] },
    ],
  },
  {
    key: 'harmonicMinor',
    name: 'Harmonic Minor',
    modes: [
      { key: 'HarmonicMinor', name: 'Harmonic Minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
      { key: 'LocrianNat6', name: 'Locrian \u266e6', intervals: [0, 1, 3, 5, 6, 9, 10] },
      { key: 'IonianSharp5', name: 'Ionian \u266f5 (Augmented Major)', intervals: [0, 2, 4, 5, 8, 9, 11] },
      { key: 'DorianSharp4', name: 'Dorian \u266f4 (Ukrainian)', intervals: [0, 2, 3, 6, 7, 9, 10] },
      { key: 'PhrygianDominant', name: 'Phrygian Dominant', intervals: [0, 1, 4, 5, 7, 8, 10] },
      { key: 'LydianSharp2', name: 'Lydian \u266f2', intervals: [0, 3, 4, 6, 7, 9, 11] },
      { key: 'Ultralocrian', name: 'Ultralocrian (Altered bb7)', intervals: [0, 1, 3, 4, 6, 8, 9] },
    ],
  },
  {
    key: 'harmonicMajor',
    name: 'Harmonic Major',
    // Major scale with a lowered 6th: 1 2 3 4 5 b6 7.
    modes: [
      { key: 'HarmonicMajor', name: 'Harmonic Major', intervals: [0, 2, 4, 5, 7, 8, 11] },
      { key: 'Dorianb5', name: 'Dorian b5', intervals: [0, 2, 3, 5, 6, 9, 10] },
      { key: 'Phrygianb4', name: 'Phrygian b4', intervals: [0, 1, 3, 4, 7, 8, 10] },
      { key: 'Lydianb3', name: 'Lydian b3 (Lydian Diminished)', intervals: [0, 2, 3, 6, 7, 9, 11] },
      { key: 'Mixolydianb2', name: 'Mixolydian b2', intervals: [0, 1, 4, 5, 7, 9, 10] },
      { key: 'LydianAugmentedSharp2', name: 'Lydian Augmented \u266f2', intervals: [0, 3, 4, 6, 8, 9, 11] },
      { key: 'Locrianbb7', name: 'Locrian bb7 (Diminished)', intervals: [0, 1, 3, 5, 6, 8, 9] },
    ],
  },
  {
    key: 'pentatonic',
    name: 'Pentatonic',
    modes: [
      { key: 'MajorPent', name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
      { key: 'SuspendedPent', name: 'Suspended pentatonic', intervals: [0, 2, 5, 7, 10] },
      { key: 'Pentb6', name: 'Pentatonic b6', intervals: [0, 3, 5, 8, 10] },
      { key: 'PentMode4', name: 'Pentatonic mode 4', intervals: [0, 2, 5, 7, 9] },
      { key: 'MinorPent', name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
    ],
  },
  {
    key: 'blues',
    name: 'Blues',
    modes: [
      { key: 'MinorBlues', name: 'Minor blues', intervals: [0, 3, 5, 6, 7, 10] },
      { key: 'MajorBlues', name: 'Major blues', intervals: [0, 2, 3, 4, 7, 9] },
    ],
  },
  {
    key: 'diminished',
    name: 'Diminished',
    modes: [
      { key: 'HalfWhole', name: 'Half-whole (dominant)', intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
      { key: 'WholeHalf', name: 'Whole-half', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
    ],
  },
  {
    key: 'wholeTone',
    name: 'Whole Tone',
    modes: [{ key: 'WholeTone', name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10] }],
  },
];

export function getFamily(key: FamilyKey): FamilyDef {
  const found = SCALE_FAMILIES.find((f) => f.key === key);
  return found ?? SCALE_FAMILIES[0];
}

/** Concrete pitch classes of a scale given a root (0-11) and interval set. */
export function getScaleNotes(rootPc: number, intervals: number[]): number[] {
  return intervals.map((i) => mod(rootPc + i, 12));
}

// Major-scale reference interval for each generic degree (degree 1..7 -> index 0..6).
const MAJOR_REF = [0, 2, 4, 5, 7, 9, 11];

/**
 * Proper scale-degree label for the n-th tone (0-based) of a scale.
 * Heptatonic scales are spelled against the major scale ("1", "b3", "#4", "bb7").
 * Other sizes are spelled from the interval itself ("1", "b3", "5", "6"), because
 * there is no generic 4th or 7th slot to alter.
 */
export function scaleDegreeLabel(intervals: number[], index: number): string {
  const semi = intervals[index];
  if (semi === undefined) return '';
  if (intervals.length !== 7 || index > 6) return chromaticDegreeLabel(semi);
  const degreeNumber = index + 1; // 1..7
  const diff = semi - MAJOR_REF[index];
  const acc = diff === 0 ? '' : diff < 0 ? 'b'.repeat(-diff) : '#'.repeat(diff);
  return `${acc}${degreeNumber}`;
}

/** Degree spelling of a scale, one label per tone, in ascending order. */
export function scaleFormulaLabels(intervals: number[]): string[] {
  return intervals.map((_, i) => scaleDegreeLabel(intervals, i));
}

/**
 * Heptatonic scale used for diatonic triads and progression templates.
 * Seven-note modes use themselves. Pentatonic, blues, diminished, and whole-tone
 * sets borrow the parallel major (if the scale has a major third) or natural minor.
 */
export function parentScale(intervals: number[]): { intervals: number[]; name: string | null } {
  if (intervals.length === 7) return { intervals, name: null };
  const minorish = intervals.includes(3) && !intervals.includes(4);
  return minorish
    ? { intervals: [0, 2, 3, 5, 7, 8, 10], name: 'natural minor' }
    : { intervals: [0, 2, 4, 5, 7, 9, 11], name: 'major' };
}

export function parentIntervals(intervals: number[]): number[] {
  return parentScale(intervals).intervals;
}
