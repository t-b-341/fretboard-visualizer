// Name a grip from the chord catalog.
//
// Every pitch class in the grip is tried as a root against every catalog quality.
// An exact pitch-class match scores highest. Omitting a fifth (the usual guitar
// shortcut) costs a little. Omitting a third or a seventh, or adding a tone the
// quality does not contain, costs more — enough that those readings drop out.
// Ties prefer the bass note as the root. Anything else is a slash chord, with a
// classical inversion when the bass is a chord tone (root, 3rd, 5th, or 7th).
// A two-note grip is named only on an exact catalog match (a power chord, when
// the table has one). The omitted-fifth allowance needs a larger grip.

import { CHORD_QUALITIES, buildChord, chordSymbol, type Chord, type ChordTone } from './chords';
import { chromaticDegreeLabel, mod, noteName } from './notes';

export type Inversion = 'root' | '1st' | '2nd' | '3rd';

export interface ChordCandidate {
  chord: Chord;
  bassPc: number;
  inversion: Inversion | null;
  /** Concert spelling, e.g. "C", "C/E", "Am7/G". */
  slashName: string;
  /** Degree names absent from the grip, e.g. ["5"]. */
  missing: string[];
  /** Degree names (above this root) present in the grip but not the quality. */
  extra: string[];
  score: number;
}

const BASE = 100;
const MISS_FIFTH = 10;
const MISS_THIRD = 50;
const MISS_SEVENTH = 40;
const MISS_EXT = 40;
const EXTRA = 36;
/** Exact matches and omitted fifths stay; a missing third or seventh does not. */
const MIN_SCORE = BASE - MISS_FIFTH - MISS_FIFTH;

const INVERSIONS: Inversion[] = ['root', '1st', '2nd', '3rd'];

interface Ranked extends ChordCandidate {
  catalog: number;
}

function distinctPcs(notes: { pc: number }[]): number[] {
  return [...new Set(notes.map((note) => mod(note.pc, 12)))];
}

function bassPcOf(notes: { pc: number; midi: number }[]): number {
  let best = notes[0];
  for (const note of notes) {
    if (note.midi < best.midi) best = note;
  }
  return mod(best.pc, 12);
}

function penaltyFor(tone: ChordTone): number {
  switch (tone.role) {
    case 'fifth':
      return MISS_FIFTH;
    case 'third':
      return MISS_THIRD;
    case 'seventh':
      return MISS_SEVENTH;
    case 'ext':
      return MISS_EXT;
    default:
      return MISS_THIRD;
  }
}

function inversionFor(chord: Chord, bassPc: number): Inversion | null {
  if (bassPc === chord.rootPc) return 'root';
  const structural = chord.tones.filter((tone) => tone.role !== 'ext');
  let best: ChordTone | null = null;
  for (const tone of structural) {
    if (mod(chord.rootPc + tone.interval, 12) !== bassPc) continue;
    if (!best || tone.interval < best.interval) best = tone;
  }
  if (!best) return null;
  const index = structural.indexOf(best);
  return INVERSIONS[index] ?? null;
}

function slashOf(chord: Chord, bassPc: number): string {
  const symbol = chordSymbol(chord);
  if (bassPc === chord.rootPc) return symbol;
  return `${symbol}/${noteName(bassPc)}`;
}

/** Display name, shifted into the Concert or Standard label system. */
export function candidateLabel(candidate: ChordCandidate, shift = 0): string {
  const symbol = chordSymbol(candidate.chord, shift);
  const bass = mod(candidate.bassPc + shift, 12);
  const root = mod(candidate.chord.rootPc + shift, 12);
  const name = bass === root ? symbol : `${symbol}/${noteName(bass)}`;
  if (candidate.inversion && candidate.inversion !== 'root') {
    return `${name} (${candidate.inversion} inversion)`;
  }
  return name;
}

/** "no 5" / "extra b9", for the line under a candidate. */
export function candidateDetail(candidate: ChordCandidate): string {
  const parts: string[] = [];
  if (candidate.missing.length > 0) parts.push(candidate.missing.map((degree) => `no ${degree}`).join(', '));
  if (candidate.extra.length > 0) parts.push(candidate.extra.map((degree) => `extra ${degree}`).join(', '));
  return parts.join(' · ');
}

/**
 * Rank catalog chords for a grip. Empty when fewer than two distinct pitch classes.
 * At most three candidates.
 */
export function identifyChord(notes: { pc: number; midi: number }[]): ChordCandidate[] {
  const pcs = distinctPcs(notes);
  if (pcs.length < 2) return [];

  const input = new Set(pcs);
  const bassPc = bassPcOf(notes);
  const found: Ranked[] = [];

  for (const root of pcs) {
    CHORD_QUALITIES.forEach((quality, catalog) => {
      const chord = buildChord(root, quality.key);
      const chordPcs = new Set(chord.pcs);
      const missing: string[] = [];
      const penalized = new Set<number>();
      let penalty = 0;

      for (const tone of chord.tones) {
        const pc = mod(root + tone.interval, 12);
        if (input.has(pc)) continue;
        missing.push(tone.degree);
        if (penalized.has(pc)) continue;
        penalized.add(pc);
        penalty += penaltyFor(tone);
      }

      const extra: string[] = [];
      for (const pc of pcs) {
        if (chordPcs.has(pc)) continue;
        extra.push(chromaticDegreeLabel(mod(pc - root, 12)));
        penalty += EXTRA;
      }

      const score = BASE - penalty;
      if (score < MIN_SCORE) return;
      if (pcs.length < 3 && (missing.length > 0 || extra.length > 0)) return;

      found.push({
        chord,
        bassPc,
        inversion: inversionFor(chord, bassPc),
        slashName: slashOf(chord, bassPc),
        missing,
        extra,
        score,
        catalog,
      });
    });
  }

  found.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aBass = a.chord.rootPc === bassPc ? 0 : 1;
    const bBass = b.chord.rootPc === bassPc ? 0 : 1;
    if (aBass !== bBass) return aBass - bBass;
    if (a.catalog !== b.catalog) return a.catalog - b.catalog;
    return a.chord.rootPc - b.chord.rootPc;
  });

  return found.slice(0, 3).map(({ catalog: _catalog, ...candidate }) => candidate);
}
