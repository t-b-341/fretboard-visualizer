// Chord-progression tools: a small library of common templates instantiated in
// the current key, plus a functional ("random") generator that moves through
// tonic / subdominant / dominant and can sprinkle in secondary dominants and
// borrowed chords for real out-of-key colour.

import { buildChord, buildDiatonicChord } from './chords';
import type { Chord, ChordQuality } from './chords';
import { mod } from './notes';
import { parentIntervals } from './scales';

export interface KeyContext {
  /** Key centre (concert pitch class). */
  rootPc: number;
  /** Current scale intervals. Templates use the heptatonic parent when this is not 7 notes. */
  intervals: number[];
}

export interface ProgressionTemplate {
  id: string;
  name: string;
  /** Roman-ish summary for the menu, e.g. "I\u2013V\u2013vi\u2013IV". */
  hint: string;
  build: (ctx: KeyContext) => Chord[];
}

// Compact step helpers.
const deg = (c: KeyContext, degree: number, seventh = false): Chord =>
  buildDiatonicChord(c.rootPc, parentIntervals(c.intervals), degree, seventh);
const abs = (c: KeyContext, semisFromKey: number, quality: ChordQuality): Chord =>
  buildChord(mod(c.rootPc + semisFromKey, 12), quality);

export const PROGRESSION_TEMPLATES: ProgressionTemplate[] = [
  {
    id: 'pop',
    name: 'Pop',
    hint: 'I\u2013V\u2013vi\u2013IV',
    build: (c) => [deg(c, 0), deg(c, 4), deg(c, 5), deg(c, 3)],
  },
  {
    id: 'fifties',
    name: '50s / doo-wop',
    hint: 'I\u2013vi\u2013IV\u2013V',
    build: (c) => [deg(c, 0), deg(c, 5), deg(c, 3), deg(c, 4)],
  },
  {
    id: 'pachelbel',
    name: 'Pachelbel',
    hint: 'I\u2013V\u2013vi\u2013iii\u2013IV\u2013I\u2013IV\u2013V',
    build: (c) => [0, 4, 5, 2, 3, 0, 3, 4].map((d) => deg(c, d)),
  },
  {
    id: 'jazz251',
    name: 'Jazz ii\u2013V\u2013I',
    hint: 'ii7\u2013V7\u2013Imaj7',
    build: (c) => [deg(c, 1, true), deg(c, 4, true), deg(c, 0, true)],
  },
  {
    id: 'blues12',
    name: '12-bar blues',
    hint: 'I7\u2013IV7\u2013V7 (dominant)',
    build: (c) => [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((s) => abs(c, s, '7')),
  },
  {
    id: 'andalusian',
    name: 'Andalusian (minor)',
    hint: 'i\u2013\u266dVII\u2013\u266dVI\u2013V',
    build: (c) => [abs(c, 0, 'min'), abs(c, 10, 'maj'), abs(c, 8, 'maj'), abs(c, 7, 'maj')],
  },
  {
    id: 'secondary',
    name: 'Secondary dominant',
    hint: 'I\u2013V7/V\u2013V7\u2013I',
    build: (c) => [deg(c, 0), abs(c, 2, '7'), abs(c, 7, '7'), deg(c, 0)],
  },
];

export function getTemplate(id: string): ProgressionTemplate | undefined {
  return PROGRESSION_TEMPLATES.find((t) => t.id === id);
}

// --- Functional random generator ------------------------------------------

export interface GenerateOptions {
  length?: number; // default 4-8
  sevenths?: boolean; // build diatonic seventh chords
  chromaticism?: number; // 0-1: chance of a secondary-dominant / borrowed substitution
  seed?: number;
}

// Small deterministic PRNG so a given seed reproduces a progression.
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function weightedPick<T>(entries: [T, number][], rnd: () => number): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of entries) {
    if ((r -= w) <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

type Fn = 'T' | 'S' | 'D';

/**
 * Generate a progression by walking a tonic/subdominant/dominant skeleton over
 * the current scale's diatonic chords, then optionally recolouring a few steps
 * with secondary dominants (a fifth above the next chord) or borrowed chords.
 */
export function generateProgression(ctx: KeyContext, opts: GenerateOptions = {}): Chord[] {
  const rnd = mulberry32(opts.seed ?? ((Math.random() * 2 ** 32) >>> 0));
  const length = Math.max(2, opts.length ?? 4 + Math.floor(rnd() * 5)); // 4-8
  const sevenths = opts.sevenths ?? false;
  const chroma = opts.chromaticism ?? 0.25;

  // Functional groups expressed as scale-degree indices (major-oriented, but
  // applied to whatever diatonic chords the current scale produces).
  const groups: Record<Fn, number[]> = { T: [0, 5, 2], S: [1, 3], D: [4, 6] };
  const transitions: Record<Fn, [Fn, number][]> = {
    T: [['S', 0.5], ['D', 0.3], ['T', 0.2]],
    S: [['D', 0.6], ['S', 0.2], ['T', 0.2]],
    D: [['T', 0.7], ['D', 0.2], ['S', 0.1]],
  };

  const fns: Fn[] = ['T'];
  for (let i = 1; i < length - 1; i++) fns.push(weightedPick(transitions[fns[i - 1]], rnd));
  if (length > 1) fns.push('T'); // resolve home

  const diatonic = parentIntervals(ctx.intervals);
  const chords: Chord[] = fns.map((f) =>
    buildDiatonicChord(ctx.rootPc, diatonic, pick(groups[f], rnd), sevenths),
  );

  // Recolour interior chords for out-of-key motion.
  const borrowed: [number, ChordQuality][] = [
    [5, 'min'], // iv
    [10, 'maj'], // bVII
    [8, 'maj'], // bVI
    [3, 'maj'], // bIII
  ];
  for (let i = 0; i < chords.length - 1; i++) {
    if (rnd() >= chroma) continue;
    if (rnd() < 0.6) {
      // Secondary dominant of the following chord (dominant a fifth above it).
      const domRoot = mod(chords[i + 1].rootPc + 7, 12);
      chords[i] = buildChord(domRoot, '7');
    } else {
      const [semis, quality] = pick(borrowed, rnd);
      chords[i] = buildChord(mod(ctx.rootPc + semis, 12), quality);
    }
  }
  return chords;
}
