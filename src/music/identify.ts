// Name a set of pitch classes from the chord catalog.
// Exact set matches rank first; a single omitted fifth is the only inexact match.

import { buildChord, CHORD_QUALITIES, type Chord } from './chords';
import { mod } from './notes';

export interface ChordMatch {
  chord: Chord;
  match: 'exact' | 'subset';
  /** Chord pitch classes absent from the input. Empty for an exact match. */
  missing: number[];
  /** The lowest note, when the caller supplied one. */
  bassPc?: number;
  /** True when a bass pitch class was given and it is not the chord root. */
  inversion: boolean;
}

interface RankedMatch extends ChordMatch {
  order: number;
}

/** Unique pitch classes in 0–11. */
function normalizePcs(pcs: number[]): number[] {
  return [...new Set(pcs.map((pc) => mod(pc, 12)))];
}

/** The omitted pitch class is a fifth (5, b5, or #5) and nothing else. */
function omittedFifth(chord: Chord, missingPc: number): boolean {
  const tones = chord.tones.filter(
    (tone) => mod(chord.rootPc + tone.interval, 12) === missingPc,
  );
  return tones.length > 0 && tones.every((tone) => tone.role === 'fifth');
}

/**
 * Catalog chords that contain every input pitch class.
 * Exact set equality wins; otherwise the input may omit exactly one fifth.
 * At most 8 matches, ranked exact-first, bass-root, fewer tones, catalog order.
 */
export function identifyChord(pcs: number[], bassPc?: number): ChordMatch[] {
  const input = normalizePcs(pcs);
  if (input.length < 2) return [];

  const inputSet = new Set(input);
  const bass = bassPc === undefined ? undefined : mod(bassPc, 12);
  const matches: RankedMatch[] = [];
  let order = 0;

  for (let root = 0; root < 12; root++) {
    for (const quality of CHORD_QUALITIES) {
      const chord = buildChord(root, quality.key);
      if (!input.every((pc) => chord.pcs.includes(pc))) continue;

      const missing = chord.pcs.filter((pc) => !inputSet.has(pc));
      const exact = missing.length === 0;
      if (!exact && (missing.length !== 1 || !omittedFifth(chord, missing[0]))) continue;

      const match: RankedMatch = {
        chord,
        match: exact ? 'exact' : 'subset',
        missing: exact ? [] : missing,
        inversion: bass !== undefined && bass !== chord.rootPc,
        order: order++,
      };
      if (bass !== undefined) match.bassPc = bass;
      matches.push(match);
    }
  }

  matches.sort((a, b) => {
    if (a.match !== b.match) return a.match === 'exact' ? -1 : 1;
    const aBass = bass !== undefined && a.chord.rootPc === bass ? 0 : 1;
    const bBass = bass !== undefined && b.chord.rootPc === bass ? 0 : 1;
    if (aBass !== bBass) return aBass - bBass;
    if (a.chord.tones.length !== b.chord.tones.length) {
      return a.chord.tones.length - b.chord.tones.length;
    }
    return a.order - b.order;
  });

  return matches.slice(0, 8).map(({ order: _order, ...match }) => match);
}
