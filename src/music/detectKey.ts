// Rank keys against a progression, or against notes held on a MIDI keyboard.
//
// Chord fit is the main signal: a chord fully inside the scale counts a lot,
// and a borrowed chord (root inside, a tone outside) counts a little. Ending
// on the tonic, starting on it, and a V or V7 moving to the tonic add points.
// Major and natural minor win ties on a shared note set, because that is how
// the same pitches are usually named.
//
// Held notes, when there are no chords: the fraction of pitch classes inside
// the scale comes first, then fewer extra scale tones.

import type { Chord } from './chords';
import { classifyChord } from './chordColor';
import { keyLabel } from './keyLabel';
import { mod } from './notes';
import { getFamily, getScaleNotes, type FamilyKey } from './scales';
import { pitchSpelling } from './spelling';

export interface DetectedKey {
  rootPc: number;
  familyKey: FamilyKey;
  modeKey: string;
  score: number;
  reason: string;
}

interface Candidate {
  rootPc: number;
  familyKey: FamilyKey;
  modeKey: string;
  intervals: number[];
  order: number;
}

const MINOR_TONIC = new Set(['Aeolian', 'Dorian', 'Phrygian', 'HarmonicMinor', 'MelodicMinor']);

/** Small preference so a shared pitch set resolves to a common key name. */
const PRIOR: Record<string, number> = {
  Ionian: 24,
  Aeolian: 20,
  HarmonicMinor: 8,
  MelodicMinor: 8,
  Dorian: 4,
  Mixolydian: 4,
  Lydian: 0,
  Phrygian: 0,
  Locrian: -4,
};

const CANDIDATES: Candidate[] = buildCandidates();

function buildCandidates(): Candidate[] {
  const major = getFamily('major');
  const harmonic = getFamily('harmonicMinor').modes.find((mode) => mode.key === 'HarmonicMinor');
  const melodic = getFamily('melodicMinor').modes.find((mode) => mode.key === 'MelodicMinor');
  const out: Candidate[] = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const mode of major.modes) {
      out.push({ rootPc, familyKey: 'major', modeKey: mode.key, intervals: mode.intervals, order: out.length });
    }
    if (harmonic) {
      out.push({
        rootPc,
        familyKey: 'harmonicMinor',
        modeKey: harmonic.key,
        intervals: harmonic.intervals,
        order: out.length,
      });
    }
    if (melodic) {
      out.push({
        rootPc,
        familyKey: 'melodicMinor',
        modeKey: melodic.key,
        intervals: melodic.intervals,
        order: out.length,
      });
    }
  }
  return out;
}

function hasDegree(chord: Chord, degree: string): boolean {
  return chord.tones.some((tone) => tone.degree === degree);
}

function isMinorChord(chord: Chord): boolean {
  return hasDegree(chord, 'b3') && !hasDegree(chord, '3');
}

/** Major triad or any dominant seventh (major third, no major seventh). */
function isDominant(chord: Chord): boolean {
  return hasDegree(chord, '3') && !hasDegree(chord, 'b3') && !hasDegree(chord, '7');
}

/** The chord you would call "the tonic" of this mode: major, minor, or diminished. */
function isTonicQuality(chord: Chord, modeKey: string): boolean {
  if (modeKey === 'Locrian') return isMinorChord(chord) && hasDegree(chord, 'b5');
  if (MINOR_TONIC.has(modeKey)) return isMinorChord(chord);
  if (!hasDegree(chord, '3') || hasDegree(chord, 'b3')) return false;
  if (modeKey === 'Mixolydian') return true;
  return !hasDegree(chord, 'b7');
}

function isTonicChord(chord: Chord, rootPc: number, modeKey: string): boolean {
  return mod(chord.rootPc, 12) === mod(rootPc, 12) && isTonicQuality(chord, modeKey);
}

function fiveOneCount(chords: Chord[], rootPc: number, modeKey: string): number {
  const dominant = mod(rootPc + 7, 12);
  let count = 0;
  for (let i = 0; i < chords.length - 1; i++) {
    const five = chords[i];
    const one = chords[i + 1];
    if (!five || !one) continue;
    if (mod(five.rootPc, 12) !== dominant || !isDominant(five)) continue;
    if (isTonicChord(one, rootPc, modeKey)) count += 1;
  }
  return count;
}

function endsWithTwoFiveOne(chords: Chord[], rootPc: number, modeKey: string): boolean {
  if (chords.length < 3) return false;
  const two = chords[chords.length - 3];
  const five = chords[chords.length - 2];
  const one = chords[chords.length - 1];
  if (!two || !five || !one) return false;
  return (
    mod(two.rootPc, 12) === mod(rootPc + 2, 12) &&
    isMinorChord(two) &&
    mod(five.rootPc, 12) === mod(rootPc + 7, 12) &&
    isDominant(five) &&
    isTonicChord(one, rootPc, modeKey)
  );
}

function tonicChordName(rootPc: number, modeKey: string, shift: number): string {
  const pitch = pitchSpelling(mod(rootPc + shift, 12));
  if (MINOR_TONIC.has(modeKey)) return `${pitch} minor`;
  if (modeKey === 'Locrian') return `${pitch} diminished`;
  if (modeKey === 'Mixolydian') return `${pitch}7`;
  return `${pitch} major`;
}

function chordReason(chords: Chord[], rootPc: number, modeKey: string): string {
  const last = chords[chords.length - 1];
  const first = chords[0];
  const ends = !!last && isTonicChord(last, rootPc, modeKey);
  const starts = !!first && isTonicChord(first, rootPc, modeKey);
  const cadence = endsWithTwoFiveOne(chords, rootPc, modeKey);
  const resolved = fiveOneCount(chords, rootPc, modeKey) > 0;
  const diatonic = chords.filter((chord) => classifyChord(chord, rootPc, intervalsOf(rootPc, modeKey)).status === 'diatonic').length;
  const count = chords.length;
  const fit =
    count === 1
      ? diatonic === 1
        ? 'The chord is diatonic.'
        : 'The chord leaves the scale.'
      : diatonic === count
        ? `All ${count} chords diatonic.`
        : `${diatonic} of ${count} chords diatonic.`;
  const motion = cadence
    ? 'ii\u2013V\u2013I ends on its tonic.'
    : ends
      ? 'Ends on its tonic.'
      : starts
        ? 'Starts on its tonic.'
        : resolved
          ? 'A V\u2013I points at its tonic.'
          : '';
  return motion ? `${fit} ${motion}` : fit;
}

function intervalsOf(rootPc: number, modeKey: string): number[] {
  const found = CANDIDATES.find((candidate) => candidate.rootPc === rootPc && candidate.modeKey === modeKey);
  return found?.intervals ?? [];
}

function uniquePcs(pcs: readonly number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const pc of pcs) {
    if (!Number.isFinite(pc)) continue;
    const next = mod(pc, 12);
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function samePcs(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((pc) => set.has(pc));
}

/** Pitch classes of the mode's tonic seventh, used only to break held-note ties. */
function tonicSeventh(rootPc: number, modeKey: string): number[] {
  const third = MINOR_TONIC.has(modeKey) || modeKey === 'Locrian' ? 3 : 4;
  const fifth = modeKey === 'Locrian' ? 6 : 7;
  const seventh =
    modeKey === 'Ionian' || modeKey === 'Lydian' || modeKey === 'HarmonicMinor' || modeKey === 'MelodicMinor'
      ? 11
      : 10;
  return [0, third, fifth, seventh].map((interval) => mod(rootPc + interval, 12));
}

function tonicTriad(rootPc: number, modeKey: string): number[] {
  return tonicSeventh(rootPc, modeKey).slice(0, 3);
}

interface Scored {
  rootPc: number;
  familyKey: FamilyKey;
  modeKey: string;
  score: number;
  prior: number;
  order: number;
  pcs: number[];
  reason: string;
  hasTonic: boolean;
  tonicName: string;
}

function scoreChords(chords: Chord[], shift: number): Scored[] {
  return CANDIDATES.map((candidate) => {
    let score = PRIOR[candidate.modeKey] ?? 0;
    for (const chord of chords) {
      const status = classifyChord(chord, candidate.rootPc, candidate.intervals).status;
      if (status === 'diatonic') score += 100;
      else if (status === 'borrowed') score += 15;
    }
    const first = chords[0];
    const last = chords[chords.length - 1];
    if (first && isTonicChord(first, candidate.rootPc, candidate.modeKey)) score += 30;
    if (last && isTonicChord(last, candidate.rootPc, candidate.modeKey)) score += 20;
    score += fiveOneCount(chords, candidate.rootPc, candidate.modeKey) * 50;
    return {
      rootPc: candidate.rootPc,
      familyKey: candidate.familyKey,
      modeKey: candidate.modeKey,
      score,
      prior: PRIOR[candidate.modeKey] ?? 0,
      order: candidate.order,
      pcs: getScaleNotes(candidate.rootPc, candidate.intervals),
      reason: chordReason(chords, candidate.rootPc, candidate.modeKey),
      hasTonic: chords.some((chord) => isTonicChord(chord, candidate.rootPc, candidate.modeKey)),
      tonicName: tonicChordName(candidate.rootPc, candidate.modeKey, shift),
    };
  });
}

function scoreHeld(held: number[], shift: number): Scored[] {
  return CANDIDATES.map((candidate) => {
    const scale = new Set(getScaleNotes(candidate.rootPc, candidate.intervals));
    const matched = held.filter((pc) => scale.has(pc)).length;
    const extra = candidate.intervals.length - matched;
    const seventh = tonicSeventh(candidate.rootPc, candidate.modeKey);
    const triad = tonicTriad(candidate.rootPc, candidate.modeKey);
    let score = matched * 10000 - extra * 100;
    if (scale.has(mod(candidate.rootPc, 12)) && held.includes(mod(candidate.rootPc, 12))) score += 1;
    if (triad.every((pc) => scale.has(pc) && held.includes(pc))) score += 3;
    if (seventh.every((pc) => scale.has(pc)) && samePcs(held, seventh)) score += 5;
    const prior = candidate.modeKey === 'Ionian' ? 2 : candidate.modeKey === 'Aeolian' ? 1 : 0;
    score += prior;
    const fit =
      matched === held.length
        ? `All ${held.length} held notes are in the scale.`
        : `${matched} of ${held.length} held notes are in the scale.`;
    return {
      rootPc: candidate.rootPc,
      familyKey: candidate.familyKey,
      modeKey: candidate.modeKey,
      score,
      prior,
      order: candidate.order,
      pcs: [...scale],
      reason: fit,
      hasTonic: false,
      tonicName: tonicChordName(candidate.rootPc, candidate.modeKey, shift),
    };
  });
}

function rank(scored: Scored[], limit: number, shift: number, fromChords: boolean): DetectedKey[] {
  const ordered = [...scored].sort(
    (a, b) => b.score - a.score || b.prior - a.prior || a.rootPc - b.rootPc || a.order - b.order,
  );
  return ordered.slice(0, limit).map((item, index) => {
    const better = ordered.slice(0, index).find((other) => samePcs(other.pcs, item.pcs));
    let reason = item.reason;
    if (better && fromChords && !item.hasTonic) {
      reason = `Same notes as ${keyLabel(better.rootPc, better.modeKey, shift)}. No ${item.tonicName} chord yet, so weaker.`;
    } else if (better && !fromChords) {
      reason = `Same notes as ${keyLabel(better.rootPc, better.modeKey, shift)}.`;
    }
    return {
      rootPc: item.rootPc,
      familyKey: item.familyKey,
      modeKey: item.modeKey,
      score: item.score,
      reason,
    };
  });
}

/**
 * Top keys for these chords, or for held pitch classes when there are no chords.
 * An empty input returns []. `shift` is only the Concert/Standard spelling offset.
 */
export function detectKeys(
  chords: Chord[] | null,
  heldPcs: number[] | null,
  limit = 3,
  shift = 0,
): DetectedKey[] {
  const count = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 3;
  if (count === 0) return [];
  const list = chords ?? [];
  const held = uniquePcs(heldPcs ?? []);
  if (list.length === 0 && held.length === 0) return [];
  if (list.length > 0) return rank(scoreChords(list, shift), count, shift, true);
  return rank(scoreHeld(held, shift), count, shift, false);
}
