// Diatonic triads built by stacking scale thirds.
//
// For a selected scale (root + interval set), the triad on scale degree `d`
// uses the scale tones at indices d, d+2, d+4 (mod 7). Measuring the semitone
// spans of the stacked third and fifth yields the chord quality automatically,
// so every mode of every family produces the correct chords.

import { chromaticDegreeLabel, mod, noteName } from './notes';

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
  const base = ROMAN[degree] ?? String(degree + 1);
  if (quality === 'maj') return base;
  if (quality === 'aug') return base + '+';
  const lower = base.toLowerCase();
  return quality === 'dim' ? lower + '\u00b0' : lower;
}

export function getDiatonicTriad(rootPc: number, intervals: number[], degree: number): Triad {
  const n = Math.max(1, intervals.length);
  const d = mod(degree, n);
  const i1 = d;
  const i3 = mod(d + 2, n);
  const i5 = mod(d + 4, n);

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

// ---------------------------------------------------------------------------
// General chord model
//
// Beyond diatonic triads: an arbitrary chord is a root pitch class plus a
// quality, where a quality is a fixed set of (interval, degree) tones. This
// covers triads, sixths, sevenths, extensions (9/11/13) and altered dominants,
// and lets the builder / progression tools place any chord in or out of key.
// ---------------------------------------------------------------------------

const FLAT = '\u266d';
const SHARP = '\u266f';
const DIM = '\u00b0';

export type ChordToneRole = 'root' | 'third' | 'fifth' | 'seventh' | 'ext';

export interface ChordTone {
  /** Semitones above the chord root. May exceed 12 for upper extensions. */
  interval: number;
  /** Degree relative to the chord root, e.g. "1", "b3", "5", "b7", "9", "#11". */
  degree: string;
  role: ChordToneRole;
}

export interface Chord {
  rootPc: number;
  /** Quality suffix without the root, e.g. "", "m", "maj7", "7\u266d9". */
  symbol: string;
  /** Human-readable quality name, e.g. "dominant 7th". */
  name: string;
  /** Catalog quality key when built from the palette (lets the UI round-trip). */
  quality?: ChordQuality;
  /** Ordered chord tones (root first), with intervals suitable for voicing. */
  tones: ChordTone[];
  /** Unique pitch classes in the chord. */
  pcs: number[];
}

export type ChordQuality =
  | 'maj' | 'min' | 'dim' | 'aug'
  | 'sus2' | 'sus4'
  | '6' | 'm6' | '69'
  | 'maj7' | '7' | 'm7' | 'm7b5' | 'dim7' | 'mMaj7'
  | 'maj9' | '9' | 'm9' | 'add9' | 'madd9'
  | 'm11' | 'maj9s11'
  | '13' | 'maj13' | 'm13'
  | '7b5' | '7s5' | '7b9' | '7s9' | '7s11' | '7alt';

export interface ChordQualityDef {
  key: ChordQuality;
  name: string;
  /** Suffix shown after the root, e.g. "maj7". */
  symbol: string;
  /** Group heading for the picker's optgroups. */
  group: string;
  /** (interval, degree) pairs, root first; role is derived from the degree. */
  tones: [number, string][];
}

export const CHORD_QUALITIES: ChordQualityDef[] = [
  // Triads
  { key: 'maj', name: 'major', symbol: '', group: 'Triads', tones: [[0, '1'], [4, '3'], [7, '5']] },
  { key: 'min', name: 'minor', symbol: 'm', group: 'Triads', tones: [[0, '1'], [3, 'b3'], [7, '5']] },
  { key: 'dim', name: 'diminished', symbol: DIM, group: 'Triads', tones: [[0, '1'], [3, 'b3'], [6, 'b5']] },
  { key: 'aug', name: 'augmented', symbol: '+', group: 'Triads', tones: [[0, '1'], [4, '3'], [8, '#5']] },
  // Suspended
  { key: 'sus2', name: 'suspended 2nd', symbol: 'sus2', group: 'Suspended', tones: [[0, '1'], [2, '2'], [7, '5']] },
  { key: 'sus4', name: 'suspended 4th', symbol: 'sus4', group: 'Suspended', tones: [[0, '1'], [5, '4'], [7, '5']] },
  // Sixths
  { key: '6', name: 'major 6th', symbol: '6', group: 'Sixths', tones: [[0, '1'], [4, '3'], [7, '5'], [9, '6']] },
  { key: 'm6', name: 'minor 6th', symbol: 'm6', group: 'Sixths', tones: [[0, '1'], [3, 'b3'], [7, '5'], [9, '6']] },
  { key: '69', name: 'six-nine', symbol: '6/9', group: 'Sixths', tones: [[0, '1'], [4, '3'], [7, '5'], [9, '6'], [14, '9']] },
  // Sevenths
  { key: 'maj7', name: 'major 7th', symbol: 'maj7', group: 'Sevenths', tones: [[0, '1'], [4, '3'], [7, '5'], [11, '7']] },
  { key: '7', name: 'dominant 7th', symbol: '7', group: 'Sevenths', tones: [[0, '1'], [4, '3'], [7, '5'], [10, 'b7']] },
  { key: 'm7', name: 'minor 7th', symbol: 'm7', group: 'Sevenths', tones: [[0, '1'], [3, 'b3'], [7, '5'], [10, 'b7']] },
  { key: 'm7b5', name: 'half-diminished 7th', symbol: 'm7' + FLAT + '5', group: 'Sevenths', tones: [[0, '1'], [3, 'b3'], [6, 'b5'], [10, 'b7']] },
  { key: 'dim7', name: 'diminished 7th', symbol: DIM + '7', group: 'Sevenths', tones: [[0, '1'], [3, 'b3'], [6, 'b5'], [9, 'bb7']] },
  { key: 'mMaj7', name: 'minor-major 7th', symbol: 'm(maj7)', group: 'Sevenths', tones: [[0, '1'], [3, 'b3'], [7, '5'], [11, '7']] },
  // Ninths / Elevenths / Thirteenths
  { key: 'maj9', name: 'major 9th', symbol: 'maj9', group: 'Extended', tones: [[0, '1'], [4, '3'], [7, '5'], [11, '7'], [14, '9']] },
  { key: '9', name: 'dominant 9th', symbol: '9', group: 'Extended', tones: [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [14, '9']] },
  { key: 'm9', name: 'minor 9th', symbol: 'm9', group: 'Extended', tones: [[0, '1'], [3, 'b3'], [7, '5'], [10, 'b7'], [14, '9']] },
  { key: 'add9', name: 'added 9th', symbol: 'add9', group: 'Extended', tones: [[0, '1'], [4, '3'], [7, '5'], [14, '9']] },
  { key: 'madd9', name: 'minor added 9th', symbol: 'm(add9)', group: 'Extended', tones: [[0, '1'], [3, 'b3'], [7, '5'], [14, '9']] },
  { key: 'm11', name: 'minor 11th', symbol: 'm11', group: 'Extended', tones: [[0, '1'], [3, 'b3'], [7, '5'], [10, 'b7'], [14, '9'], [17, '11']] },
  { key: 'maj9s11', name: 'major 9th ' + SHARP + '11 (lydian)', symbol: 'maj9' + SHARP + '11', group: 'Extended', tones: [[0, '1'], [4, '3'], [7, '5'], [11, '7'], [14, '9'], [18, '#11']] },
  { key: '13', name: 'dominant 13th', symbol: '13', group: 'Extended', tones: [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [14, '9'], [21, '13']] },
  { key: 'maj13', name: 'major 13th', symbol: 'maj13', group: 'Extended', tones: [[0, '1'], [4, '3'], [7, '5'], [11, '7'], [14, '9'], [21, '13']] },
  { key: 'm13', name: 'minor 13th', symbol: 'm13', group: 'Extended', tones: [[0, '1'], [3, 'b3'], [7, '5'], [10, 'b7'], [14, '9'], [21, '13']] },
  // Altered dominants
  { key: '7b5', name: 'dominant 7th ' + FLAT + '5', symbol: '7' + FLAT + '5', group: 'Altered dominant', tones: [[0, '1'], [4, '3'], [6, 'b5'], [10, 'b7']] },
  { key: '7s5', name: 'dominant 7th ' + SHARP + '5', symbol: '7' + SHARP + '5', group: 'Altered dominant', tones: [[0, '1'], [4, '3'], [8, '#5'], [10, 'b7']] },
  { key: '7b9', name: 'dominant 7th ' + FLAT + '9', symbol: '7' + FLAT + '9', group: 'Altered dominant', tones: [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [13, 'b9']] },
  { key: '7s9', name: 'dominant 7th ' + SHARP + '9', symbol: '7' + SHARP + '9', group: 'Altered dominant', tones: [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [15, '#9']] },
  { key: '7s11', name: 'dominant 7th ' + SHARP + '11', symbol: '7' + SHARP + '11', group: 'Altered dominant', tones: [[0, '1'], [4, '3'], [7, '5'], [10, 'b7'], [18, '#11']] },
  { key: '7alt', name: 'altered dominant', symbol: '7alt', group: 'Altered dominant', tones: [[0, '1'], [4, '3'], [10, 'b7'], [13, 'b9'], [15, '#9'], [18, '#11'], [20, 'b13']] },
];

const CHORD_BY_KEY: Record<string, ChordQualityDef> = Object.fromEntries(
  CHORD_QUALITIES.map((q) => [q.key, q]),
);

export function getChordQuality(key: ChordQuality): ChordQualityDef {
  return CHORD_BY_KEY[key] ?? CHORD_QUALITIES[0];
}

/** Which colour slot a chord tone occupies, derived from its degree label. */
export function roleForDegree(degree: string): ChordToneRole {
  const base = degree.replace(/[b#]/g, '');
  switch (base) {
    case '1':
      return 'root';
    case '2':
    case '3':
    case '4':
      return 'third';
    case '5':
      return 'fifth';
    case '6':
    case '7':
      return 'seventh';
    default:
      return 'ext'; // 9, 11, 13
  }
}

function unique(nums: number[]): number[] {
  return Array.from(new Set(nums));
}

/** Build a chord from any root (0-11) and a catalog quality. */
export function buildChord(rootPc: number, quality: ChordQuality): Chord {
  const def = getChordQuality(quality);
  const tones: ChordTone[] = def.tones.map(([interval, degree]) => ({
    interval,
    degree,
    role: roleForDegree(degree),
  }));
  return {
    rootPc: mod(rootPc, 12),
    symbol: def.symbol,
    name: def.name,
    quality: def.key,
    tones,
    pcs: unique(tones.map((t) => mod(rootPc + t.interval, 12))),
  };
}

/** Full chord symbol including the root, e.g. "B\u266dmaj7" (shift = label offset). */
export function chordSymbol(chord: Chord, shift = 0): string {
  return `${noteName(mod(chord.rootPc + shift, 12))}${chord.symbol}`;
}

// A diatonic triad/seventh's tones can only span these semitone values, and the
// ranges are disjoint, so the span alone fixes the spelling.
const DIATONIC_DEGREE: Record<number, string> = {
  0: '1', 3: 'b3', 4: '3', 6: 'b5', 7: '5', 8: '#5', 9: 'bb7', 10: 'b7', 11: '7',
};

function diatonicSymbol(
  thirdSpan: number,
  fifthSpan: number,
  seventhSpan: number | null,
): { symbol: string; name: string } {
  const triad = qualityFromSpans(thirdSpan, fifthSpan);
  if (seventhSpan === null) {
    return { symbol: qualitySuffix(triad), name: qualityName(triad) };
  }
  if (triad === 'maj') {
    return seventhSpan === 11
      ? { symbol: 'maj7', name: 'major 7th' }
      : { symbol: '7', name: 'dominant 7th' };
  }
  if (triad === 'min') {
    return seventhSpan === 11
      ? { symbol: 'm(maj7)', name: 'minor-major 7th' }
      : { symbol: 'm7', name: 'minor 7th' };
  }
  if (triad === 'dim') {
    return seventhSpan === 9
      ? { symbol: DIM + '7', name: 'diminished 7th' }
      : { symbol: 'm7' + FLAT + '5', name: 'half-diminished 7th' };
  }
  // augmented
  return seventhSpan === 11
    ? { symbol: 'maj7' + SHARP + '5', name: 'augmented major 7th' }
    : { symbol: '7' + SHARP + '5', name: 'augmented 7th' };
}

/**
 * Build the chord on scale degree `degree` by stacking scale thirds (triad, or
 * a four-note seventh). Because it uses the actual scale intervals, it yields
 * the correct quality in every mode/family, including exotic ones.
 */
export function buildDiatonicChord(
  keyRootPc: number,
  intervals: number[],
  degree: number,
  withSeventh: boolean,
): Chord {
  const n = Math.max(1, intervals.length);
  const d = mod(degree, n);
  const rootInt = intervals[d];
  const chordRootPc = mod(keyRootPc + rootInt, 12);

  const spanAt = (k: number) => mod(intervals[mod(d + k, n)] - rootInt, 12);
  const thirdSpan = spanAt(2);
  const fifthSpan = spanAt(4);
  const seventhSpan = withSeventh ? spanAt(6) : null;

  const spans = seventhSpan === null ? [0, thirdSpan, fifthSpan] : [0, thirdSpan, fifthSpan, seventhSpan];
  const tones: ChordTone[] = spans.map((semi) => {
    const degreeLabel = DIATONIC_DEGREE[semi] ?? chromaticDegreeLabel(semi);
    return { interval: semi, degree: degreeLabel, role: roleForDegree(degreeLabel) };
  });
  const { symbol, name } = diatonicSymbol(thirdSpan, fifthSpan, seventhSpan);
  return {
    rootPc: chordRootPc,
    symbol,
    name,
    tones,
    pcs: unique(tones.map((t) => mod(chordRootPc + t.interval, 12))),
  };
}

const ROMAN_BY_SEMITONE = ['I', 'bII', 'II', 'bIII', 'III', 'IV', '#IV', 'V', 'bVI', 'VI', 'bVII', 'VII'];

function chordIsMinorish(chord: Chord): boolean {
  const hasMaj3 = chord.tones.some((t) => t.degree === '3');
  const hasMin3 = chord.tones.some((t) => t.degree === 'b3');
  return hasMin3 && !hasMaj3;
}

/**
 * Pragmatic Roman numeral for a chord relative to a key centre: scale-degree of
 * the root (with accidental), cased by quality, decorated with +, \u00b0 and a 7.
 * This is a readable label, not a full functional analysis.
 */
export function romanForChord(keyRootPc: number, chord: Chord): string {
  const semi = mod(chord.rootPc - keyRootPc, 12);
  let roman = ROMAN_BY_SEMITONE[semi];
  if (chordIsMinorish(chord)) roman = roman.toLowerCase();
  const hasDim5 = chord.tones.some((t) => t.degree === 'b5');
  const hasAug5 = chord.tones.some((t) => t.degree === '#5');
  if (hasDim5 && chordIsMinorish(chord)) roman += DIM;
  else if (hasAug5) roman += '+';
  if (chord.tones.some((t) => /7/.test(t.degree))) roman += '7';
  return roman;
}

/** True when every chord tone belongs to the given scale (i.e. in key). */
export function chordInKey(scalePcs: number[] | Set<number>, chord: Chord): boolean {
  const set = scalePcs instanceof Set ? scalePcs : new Set(scalePcs);
  return chord.pcs.every((pc) => set.has(pc));
}
