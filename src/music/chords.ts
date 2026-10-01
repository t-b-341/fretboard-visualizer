// Diatonic triads built by stacking scale thirds.
//
// For a selected scale (root + interval set), the triad on scale degree `d`
// uses the scale tones at indices d, d+2, d+4 (mod 7). Measuring the semitone
// spans of the stacked third and fifth yields the chord quality automatically,
// so every mode of every family produces the correct chords.

import { mod } from './notes';

export type TriadQuality = 'maj' | 'min' | 'dim' | 'aug';

export interface Triad {
  /** Scale degree index, 0-6. */
  degree: number;
  /** Roman numeral with quality decoration, e.g. "I", "ii", "vii\u00b0", "III+". */
  roman: string;
  quality: TriadQuality;
  /** Pitch class of the chord root. */
  rootPc: number;
  /** Pitch classes [root, third, fifth]. */
  pitches: number[];
  /** Scale indices [root, third, fifth]. */
  intervalIndices: number[];
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function qualityFromSpans(thirdSemis: number, fifthSemis: number): TriadQuality {
  if (thirdSemis === 4 && fifthSemis === 8) return 'aug';
  if (thirdSemis === 3 && fifthSemis === 6) return 'dim';
  if (thirdSemis === 4) return 'maj';
  if (thirdSemis === 3) return 'min';
  // Non-tertian edge cases in exotic modes: fall back by the fifth, else major.
  if (fifthSemis === 6) return 'dim';
  if (fifthSemis === 8) return 'aug';
  return 'maj';
}

function romanLabel(degree: number, quality: TriadQuality): string {
  const base = ROMAN[degree];
  if (quality === 'maj') return base;
  if (quality === 'aug') return base + '+';
  const lower = base.toLowerCase();
  return quality === 'dim' ? lower + '\u00b0' : lower;
}

export function getDiatonicTriad(rootPc: number, intervals: number[], degree: number): Triad {
  const d = mod(degree, 7);
  const i1 = d;
  const i3 = mod(d + 2, 7);
  const i5 = mod(d + 4, 7);

  const rootInt = intervals[i1];
  // Raise wrapped upper tones by an octave to measure true stacked-third spans.
  const thirdInt = intervals[i3] + (intervals[i3] < rootInt ? 12 : 0);
  const fifthInt = intervals[i5] + (intervals[i5] < rootInt ? 12 : 0);

  const thirdSemis = thirdInt - rootInt;
  const fifthSemis = fifthInt - rootInt;
  const quality = qualityFromSpans(thirdSemis, fifthSemis);

  return {
    degree: d,
    roman: romanLabel(d, quality),
    quality,
    rootPc: mod(rootPc + rootInt, 12),
    pitches: [
      mod(rootPc + intervals[i1], 12),
      mod(rootPc + intervals[i3], 12),
      mod(rootPc + intervals[i5], 12),
    ],
    intervalIndices: [i1, i3, i5],
  };
}

export function getAllDiatonicTriads(rootPc: number, intervals: number[]): Triad[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => getDiatonicTriad(rootPc, intervals, d));
}

export function qualityName(q: TriadQuality): string {
  const names: Record<TriadQuality, string> = {
    maj: 'major',
    min: 'minor',
    dim: 'diminished',
    aug: 'augmented',
  };
  return names[q];
}

export function qualitySuffix(q: TriadQuality): string {
  const suffixes: Record<TriadQuality, string> = {
    maj: '',
    min: 'm',
    dim: '\u00b0',
    aug: '+',
  };
  return suffixes[q];
}
