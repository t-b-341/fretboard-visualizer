// What a chord is doing in the key, in a line or two.
//
// Degrees follow the usual map (I, iii, vi tonic; ii, IV subdominant; V, vii°
// dominant) on whatever chords the key's parent scale actually builds.
// Secondary dominants are dominant. Borrowed chords keep the job they have
// in the parallel minor.

import { classifyChord } from './chordColor';
import { buildChord, buildDiatonicChord, getDiatonicTriad, romanForChord, type Chord, type ChordQuality } from './chords';
import { mod } from './notes';
import { parentIntervals } from './scales';
import { pitchSpelling } from './spelling';

export type HarmonicFunction = 'T' | 'SD' | 'D';

export interface AnalysisKey {
  rootPc: number;
  /** The mode's intervals. Degrees are read from its heptatonic parent. */
  intervals: number[];
}

const DEGREE_FN: readonly HarmonicFunction[] = ['T', 'SD', 'T', 'SD', 'D', 'T', 'D'];

/** Chromatic roots that usually come from the parallel minor, and the job they do. */
const BORROWED_FN: Readonly<Record<number, HarmonicFunction>> = {
  1: 'SD',
  3: 'T',
  8: 'T',
  10: 'D',
};

function hasInterval(chord: Chord, semi: number): boolean {
  return chord.tones.some((tone) => mod(tone.interval, 12) === semi);
}

function isMinorish(chord: Chord): boolean {
  return hasInterval(chord, 3) && !hasInterval(chord, 4);
}

/** Dominant 7th, or a major/augmented triad that can act as V of something. */
function isDominantQuality(chord: Chord): boolean {
  if (!hasInterval(chord, 4) || hasInterval(chord, 3)) return false;
  if (hasInterval(chord, 10)) return true;
  const extra = chord.tones.some((tone) => {
    const semi = mod(tone.interval, 12);
    return semi !== 0 && semi !== 4 && semi !== 7 && semi !== 8;
  });
  if (extra) return false;
  return hasInterval(chord, 7) || hasInterval(chord, 8);
}

function isDominantSeventh(chord: Chord): boolean {
  return hasInterval(chord, 4) && hasInterval(chord, 10);
}

function degreeOf(rootPc: number, key: AnalysisKey): number | null {
  const semi = mod(rootPc - key.rootPc, 12);
  const index = parentIntervals(key.intervals).indexOf(semi);
  return index >= 0 ? index : null;
}

interface Secondary {
  label: string;
  targetRoman: string;
  targetName: string;
}

function matchesDiatonic(chord: Chord, key: AnalysisKey): boolean {
  const degree = degreeOf(chord.rootPc, key);
  if (degree === null) return false;
  const parent = parentIntervals(key.intervals);
  return [false, true].some((seventh) => {
    const built = buildDiatonicChord(key.rootPc, parent, degree, seventh);
    return built.symbol === chord.symbol || samePcs(built, chord);
  });
}

function samePcs(a: Chord, b: Chord): boolean {
  if (a.pcs.length !== b.pcs.length) return false;
  const pcs = new Set(b.pcs.map((pc) => mod(pc, 12)));
  return a.pcs.every((pc) => pcs.has(mod(pc, 12)));
}

function secondaryOf(chord: Chord, key: AnalysisKey): Secondary | null {
  if (matchesDiatonic(chord, key) || !isDominantQuality(chord)) return null;
  const parent = parentIntervals(key.intervals);
  const targetPc = mod(chord.rootPc - 7, 12);
  const targetDegree = degreeOf(targetPc, key);
  if (targetDegree === null) return null;
  const selfDegree = degreeOf(chord.rootPc, key);
  if (targetDegree === 0 && selfDegree === 4) return null;
  const triad = getDiatonicTriad(key.rootPc, parent, targetDegree);
  const target = buildDiatonicChord(key.rootPc, parent, targetDegree, false);
  const prefix = isDominantSeventh(chord) || chord.tones.some((tone) => /7/.test(tone.degree)) ? 'V7' : 'V';
  return {
    label: `${prefix}/${triad.roman}`,
    targetRoman: triad.roman,
    targetName: `${pitchSpelling(target.rootPc)}${target.symbol}`,
  };
}

function isTritoneSub(chord: Chord, key: AnalysisKey): boolean {
  return isDominantSeventh(chord) && mod(chord.rootPc - key.rootPc, 12) === 1;
}

/** Tonic, subdominant, dominant, or null when the chord has no usual job here. */
export function functionOf(chord: Chord, key: AnalysisKey): HarmonicFunction | null {
  if (secondaryOf(chord, key)) return 'D';
  if (isTritoneSub(chord, key)) return 'D';
  const degree = degreeOf(chord.rootPc, key);
  if (degree !== null) return DEGREE_FN[degree] ?? null;
  const semi = mod(chord.rootPc - key.rootPc, 12);
  return BORROWED_FN[semi] ?? null;
}

function borrowedDetail(chord: Chord, key: AnalysisKey): string {
  const semi = mod(chord.rootPc - key.rootPc, 12);
  if (semi === 5 && isMinorish(chord)) return 'Darkens the IV.';
  if (semi === 0 && isMinorish(chord)) return 'Darkens the I.';
  if (semi === 8) return 'Darkens the vi.';
  if (semi === 3) return 'Brightens the tonic.';
  if (semi === 10) return 'Loosens the V.';
  if (semi === 1) return 'The Neapolitan softens the approach to V.';
  if (semi === 7 && isMinorish(chord)) return 'Softens the V.';
  return 'From the parallel minor.';
}

function isMixture(chord: Chord, key: AnalysisKey): boolean {
  if (secondaryOf(chord, key) || isTritoneSub(chord, key)) return false;
  const painted = classifyChord(chord, key.rootPc, key.intervals);
  if (painted.status === 'borrowed') {
    const degree = degreeOf(chord.rootPc, key);
    // A major V in a minor key is the real dominant, even with a leading tone from outside.
    if (degree === 4 && isDominantQuality(chord)) return false;
    return true;
  }
  const semi = mod(chord.rootPc - key.rootPc, 12);
  return degreeOf(chord.rootPc, key) === null && BORROWED_FN[semi] !== undefined;
}

function diatonicSentence(
  chord: Chord,
  steps: readonly { chord: Chord }[],
  index: number,
  key: AnalysisKey,
  fn: HarmonicFunction,
): string {
  const roman = romanForChord(key.rootPc, chord);
  const next = steps[index + 1]?.chord;
  const prev = steps[index - 1]?.chord;
  const nextFn = next ? functionOf(next, key) : null;
  const prevFn = prev ? functionOf(prev, key) : null;
  if (fn === 'SD') {
    if (nextFn === 'D') return `${roman} is subdominant. Sets up the dominant.`;
    if (!next) return `${roman} is subdominant. It can return to I.`;
    return `${roman} is subdominant. Moves toward the tonic.`;
  }
  if (fn === 'D') {
    if (next && degreeOf(next.rootPc, key) === 0) return `${roman} is dominant. Resolves to I.`;
    if (next && nextFn === 'T') return `${roman} is dominant. Moves to ${romanForChord(key.rootPc, next)}.`;
    return `${roman} is dominant. It wants to resolve to the tonic.`;
  }
  if (prevFn === 'D' && degreeOf(chord.rootPc, key) === 0) return `${roman} is tonic. The dominant resolves here.`;
  if (prevFn === 'D') return `${roman} is tonic. It stands in for I.`;
  if (index === 0) return `${roman} is tonic. The progression starts here.`;
  if (index === steps.length - 1) return `${roman} is tonic. The progression arrives here.`;
  return `${roman} is tonic. It rests in the key.`;
}

/** One or two short sentences about this step. Empty when the index is missing. */
export function explainStep(steps: readonly { chord: Chord }[], index: number, key: AnalysisKey): string {
  const chord = steps[index]?.chord;
  if (!chord) return '';
  const secondary = secondaryOf(chord, key);
  if (secondary) {
    return `${secondary.label}: dominant of ${secondary.targetName}. Pulls to ${secondary.targetRoman}.`;
  }
  if (isTritoneSub(chord, key)) {
    return `${romanForChord(key.rootPc, chord)} is dominant. It stands in for V and pulls to ${pitchSpelling(key.rootPc)}.`;
  }
  if (isMixture(chord, key)) {
    return `${romanForChord(key.rootPc, chord)}: borrowed from ${pitchSpelling(key.rootPc)} minor. ${borrowedDetail(chord, key)}`;
  }
  const fn = functionOf(chord, key);
  if (!fn) return 'Outside the key.';
  return diatonicSentence(chord, steps, index, key, fn);
}

function chordKey(chord: Chord): string {
  return `${chord.rootPc}:${chord.symbol}`;
}

function sameChord(a: Chord, b: Chord): boolean {
  return a.rootPc === b.rootPc && a.symbol === b.symbol;
}

/**
 * A different chord with the same function. Prefers one whose root is not
 * already sounding in a neighbor, and a fifth away from the next chord when
 * that is available.
 */
export function rerollChord(
  chord: Chord,
  steps: readonly { chord: Chord }[],
  index: number,
  key: AnalysisKey,
  rnd: () => number = Math.random,
): Chord {
  const fn = functionOf(chord, key);
  const parent = parentIntervals(key.intervals);
  const candidates: Chord[] = [];
  if (fn) {
    for (let degree = 0; degree < 7; degree++) {
      for (const seventh of [false, true]) {
        const built = buildDiatonicChord(key.rootPc, parent, degree, seventh);
        if (functionOf(built, key) === fn) candidates.push(built);
      }
    }
    const borrowed: [number, ChordQuality][] = [
      [0, 'min'],
      [1, 'maj'],
      [3, 'maj'],
      [5, 'min'],
      [8, 'maj'],
      [10, 'maj'],
    ];
    for (const [semi, quality] of borrowed) {
      const chordBuilt = buildChord(mod(key.rootPc + semi, 12), quality);
      if (functionOf(chordBuilt, key) === fn) candidates.push(chordBuilt);
    }
  }
  const unique = new Map<string, Chord>();
  for (const item of candidates) {
    if (!sameChord(item, chord)) unique.set(chordKey(item), item);
  }
  const pool = [...unique.values()];
  if (pool.length === 0) return chord;
  const prev = steps[index - 1]?.chord;
  const next = steps[index + 1]?.chord;
  const score = (item: Chord) => {
    let value = 0;
    if (!prev || item.rootPc !== prev.rootPc) value += 1;
    if (!next || item.rootPc !== next.rootPc) value += 1;
    if (next) {
      const motion = mod(next.rootPc - item.rootPc, 12);
      if (motion === 5 || motion === 7) value += 2;
    }
    return value;
  };
  const best = Math.max(...pool.map(score));
  const fitting = pool.filter((item) => score(item) === best);
  return fitting[Math.floor(rnd() * fitting.length)] ?? fitting[0];
}
