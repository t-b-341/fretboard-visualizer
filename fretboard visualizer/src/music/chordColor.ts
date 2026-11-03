// Color a chord from its root's degree in the key, and flag chords that
// leave that key. The reference set is the heptatonic parent, so pentatonic,
// blues, and whole-tone keys are judged against major or natural minor.
//
// keyRootPc and chord.rootPc are concert pitch classes. Do not apply the
// Concert/Standard label shift before calling these functions.

import type { Chord } from './chords';
import { romanForChord } from './chords';
import { mod } from './notes';
import { getScaleNotes, parentIntervals, parentScale, SCALE_FAMILIES } from './scales';
import { pitchSpelling, spellChordTone } from './spelling';

export type ChordColorStatus = 'diatonic' | 'borrowed' | 'outside';

export interface ChordClassification {
  status: ChordColorStatus;
  /** Index of the chord root in the parent scale, or null when the root is outside it. */
  degreeIndex: number | null;
}

const SHORT_NAME: Record<string, string> = {
  Ionian: 'major',
  Aeolian: 'natural minor',
  MelodicMinor: 'melodic minor',
  HarmonicMinor: 'harmonic minor',
  HarmonicMajor: 'harmonic major',
};

function sameIntervals(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i]);
}

function parentPcs(keyRootPc: number, scaleIntervals: number[]): number[] {
  return getScaleNotes(mod(keyRootPc, 12), parentIntervals(scaleIntervals));
}

/** Concert name of the reference key, e.g. "C major" or "A harmonic minor". */
export function referenceKeyName(keyRootPc: number, scaleIntervals: number[]): string {
  const parent = parentIntervals(scaleIntervals);
  for (const family of SCALE_FAMILIES) {
    for (const mode of family.modes) {
      if (!sameIntervals(mode.intervals, parent)) continue;
      const label = SHORT_NAME[mode.key] ?? mode.name;
      return `${pitchSpelling(keyRootPc)} ${label}`;
    }
  }
  const fallback = parentScale(scaleIntervals).name ?? 'scale';
  return `${pitchSpelling(keyRootPc)} ${fallback}`;
}

export function classifyChord(
  chord: Chord,
  keyRootPc: number,
  scaleIntervals: number[],
): ChordClassification {
  const scalePcs = parentPcs(keyRootPc, scaleIntervals);
  const indexByPc = new Map<number, number>();
  scalePcs.forEach((pc, index) => {
    if (!indexByPc.has(pc)) indexByPc.set(pc, index);
  });
  const degreeIndex = indexByPc.get(mod(chord.rootPc, 12)) ?? null;
  if (degreeIndex === null) return { status: 'outside', degreeIndex: null };
  const inScale = new Set(scalePcs);
  const diatonic = chord.pcs.every((pc) => inScale.has(mod(pc, 12)));
  return { status: diatonic ? 'diatonic' : 'borrowed', degreeIndex };
}

/** Chord tones whose pitch class is outside the parent scale, in chord order. */
export function outsideToneNames(chord: Chord, keyRootPc: number, scaleIntervals: number[]): string[] {
  const inScale = new Set(parentPcs(keyRootPc, scaleIntervals));
  const seen = new Set<number>();
  const names: string[] = [];
  for (const tone of chord.tones) {
    const pc = mod(chord.rootPc + tone.interval, 12);
    if (inScale.has(pc) || seen.has(pc)) continue;
    seen.add(pc);
    names.push(spellChordTone(chord.rootPc, tone.interval, tone.degree));
  }
  return names;
}

/** Tooltip for a colored chord, e.g. "VI7 — borrowed: C# outside C major". */
export function chordColorTitle(chord: Chord, keyRootPc: number, scaleIntervals: number[]): string {
  const classification = classifyChord(chord, keyRootPc, scaleIntervals);
  const roman = romanForChord(keyRootPc, chord);
  if (classification.status === 'diatonic') return `${roman} \u2014 diatonic`;
  const outside = outsideToneNames(chord, keyRootPc, scaleIntervals);
  const keyName = referenceKeyName(keyRootPc, scaleIntervals);
  const detail = outside.length > 0 ? `: ${outside.join(', ')} outside ${keyName}` : '';
  return `${roman} \u2014 ${classification.status}${detail}`;
}
