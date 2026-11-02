// Cost of moving from one grip to the next.
// Guide tones are expensive to drag, held notes and tendency resolutions are cheap.

import { chordSymbol, type Chord, type ChordToneRole } from './chords';
import type { GuitarString } from './tunings';
import { generateVoicings, type VoicedNote, type Voicing, type VoicingOptions } from './voicings';

export interface Weights {
  /** Cost per semitone a voice moves, by its role in the FROM chord. */
  roleMotion: Record<ChordToneRole, number>;
  /** Cost per fret of change in minFret between voicings. */
  handShift: number;
  /** Subtracted per note held on the same string and fret. */
  commonToneBonus: number;
  /** Subtracted per tendency resolution. */
  resolutionBonus: number;
  /** Multiplied by the role weight for each unpaired voice. */
  omissionPenalty: number;
  /** Cost per fret the destination minFret sits from anchorFret. */
  registerAnchor: number;
  anchorFret: number;
}

export const DEFAULT_WEIGHTS: Weights = {
  roleMotion: { root: 0.5, third: 1.5, fifth: 1.0, seventh: 1.5, ext: 1.0 },
  handShift: 0.8,
  commonToneBonus: 2.0,
  resolutionBonus: 3.0,
  omissionPenalty: 6,
  registerAnchor: 0.3,
  anchorFret: 5,
};

function byMidi(a: VoicedNote, b: VoicedNote): number {
  return a.midi - b.midi || a.stringIndex - b.stringIndex;
}

/** Every sounding note is an open string. Muted strings are ignored. */
function isAllOpen(voicing: Voicing): boolean {
  return voicing.notes.every((note) => note.fret === 0);
}

/**
 * Sort both grips by MIDI and pair index i with index i.
 * A leftover on the longer side looks for a still-unpaired partner.
 * Index pairing already uses the whole shorter side, so leftovers are unpaired.
 */
function pairVoices(aNotes: readonly VoicedNote[], bNotes: readonly VoicedNote[]): {
  pairs: { from: VoicedNote; to: VoicedNote }[];
  unpaired: VoicedNote[];
} {
  const a = [...aNotes].sort(byMidi);
  const b = [...bNotes].sort(byMidi);
  const shared = Math.min(a.length, b.length);
  const usedA = new Set<number>();
  const usedB = new Set<number>();
  const pairs: { from: VoicedNote; to: VoicedNote }[] = [];
  for (let i = 0; i < shared; i++) {
    pairs.push({ from: a[i], to: b[i] });
    usedA.add(i);
    usedB.add(i);
  }

  const unpaired: VoicedNote[] = [];
  for (let i = shared; i < a.length; i++) {
    const match = nearestUnused(a[i], b, usedB);
    if (match < 0) unpaired.push(a[i]);
    else {
      usedB.add(match);
      pairs.push({ from: a[i], to: b[match] });
    }
  }
  for (let i = shared; i < b.length; i++) {
    const match = nearestUnused(b[i], a, usedA);
    if (match < 0) unpaired.push(b[i]);
    else {
      usedA.add(match);
      pairs.push({ from: a[match], to: b[i] });
    }
  }
  return { pairs, unpaired };
}

function nearestUnused(note: VoicedNote, other: VoicedNote[], used: Set<number>): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < other.length; i++) {
    if (used.has(i)) continue;
    const dist = Math.abs(other[i].midi - note.midi);
    if (best < 0 || dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

/** Seventh falls 1 or 2 semitones onto a third. Third rises 1 semitone onto a root. */
function resolves(from: VoicedNote, to: VoicedNote): boolean {
  const rise = to.midi - from.midi;
  if (from.role === 'seventh' && to.role === 'third') return rise === -1 || rise === -2;
  if (from.role === 'third' && to.role === 'root') return rise === 1;
  return false;
}

function commonToneCount(a: Voicing, b: Voicing): number {
  let count = 0;
  for (const note of a.notes) {
    for (const other of b.notes) {
      if (other.stringIndex === note.stringIndex && other.fret === note.fret) {
        count++;
        break;
      }
    }
  }
  return count;
}

function anchorCost(minFret: number, w: Weights): number {
  return Math.abs(minFret - w.anchorFret) * w.registerAnchor;
}

/** Anchor term only. Used when a progression has no previous grip. */
export function voicingCost(v: Voicing, w: Weights = DEFAULT_WEIGHTS): number {
  return anchorCost(v.minFret, w);
}

export function transitionCost(a: Voicing, b: Voicing, w: Weights = DEFAULT_WEIGHTS): number {
  const { pairs, unpaired } = pairVoices(a.notes, b.notes);
  let cost = 0;
  for (const { from, to } of pairs) {
    cost += Math.abs(to.midi - from.midi) * w.roleMotion[from.role];
    if (resolves(from, to)) cost -= w.resolutionBonus;
  }
  for (const note of unpaired) {
    cost += w.omissionPenalty * w.roleMotion[note.role];
  }
  if (!isAllOpen(a) && !isAllOpen(b)) {
    cost += Math.abs(b.minFret - a.minFret) * w.handShift;
  }
  cost -= commonToneCount(a, b) * w.commonToneBonus;
  cost += anchorCost(b.minFret, w);
  return cost;
}

export interface LeadOptions extends Partial<VoicingOptions> {
  /** Grips kept per chord, the ones with the lowest voicingCost. Default 60. */
  maxCandidates?: number;
}

const DEFAULT_MAX_CANDIDATES = 60;

function voicingOptions(opts: LeadOptions): Partial<VoicingOptions> {
  const { maxCandidates: _maxCandidates, ...rest } = opts;
  return rest;
}

/** Lowest voicingCost first. Equal costs keep generateVoicings order. */
function rankCandidates(voicings: Voicing[], maxCandidates: number, w: Weights): Voicing[] {
  const ranked = voicings.map((voicing, order) => ({
    voicing,
    order,
    cost: voicingCost(voicing, w),
  }));
  ranked.sort((a, b) => a.cost - b.cost || a.order - b.order);
  return ranked.slice(0, maxCandidates).map((item) => item.voicing);
}

function candidatesFor(
  chord: Chord,
  index: number,
  tuning: GuitarString[],
  w: Weights,
  opts: LeadOptions,
): Voicing[] {
  const base = voicingOptions(opts);
  let found = generateVoicings(chord, tuning, base);
  if (found.length === 0) {
    found = generateVoicings(chord, tuning, { ...base, required: ['root'], maxSpan: 5 });
  }
  if (found.length === 0) {
    throw new Error(`No playable voicing for chord ${index + 1} (${chordSymbol(chord)})`);
  }
  return rankCandidates(found, opts.maxCandidates ?? DEFAULT_MAX_CANDIDATES, w);
}

/**
 * Cheapest voice-leading path. Each chord keeps a back-pointer to the
 * predecessor that made arriving there cheapest, so a locally expensive
 * grip can still win if it saves cost later.
 */
export function leadProgression(
  chords: Chord[],
  tuning: GuitarString[],
  w: Weights = DEFAULT_WEIGHTS,
  opts: LeadOptions = {},
): Voicing[] {
  if (chords.length === 0) return [];
  const candidates = chords.map((chord, index) => candidatesFor(chord, index, tuning, w, opts));
  const best: number[][] = [candidates[0].map((voicing) => voicingCost(voicing, w))];
  const back: number[][] = [candidates[0].map(() => -1)];

  for (let i = 1; i < candidates.length; i++) {
    const prev = candidates[i - 1];
    const curr = candidates[i];
    const row = new Array<number>(curr.length);
    const from = new Array<number>(curr.length);
    for (let j = 0; j < curr.length; j++) {
      let minCost = Infinity;
      let arg = 0;
      for (let k = 0; k < prev.length; k++) {
        const cost = best[i - 1][k] + transitionCost(prev[k], curr[j], w);
        if (cost < minCost) {
          minCost = cost;
          arg = k;
        }
      }
      row[j] = minCost;
      from[j] = arg;
    }
    best.push(row);
    back.push(from);
  }

  const last = candidates.length - 1;
  let chosen = 0;
  for (let j = 1; j < best[last].length; j++) {
    if (best[last][j] < best[last][chosen]) chosen = j;
  }

  const path = new Array<Voicing>(candidates.length);
  for (let i = last; i >= 0; i--) {
    path[i] = candidates[i][chosen];
    chosen = back[i][chosen];
  }
  return path;
}

/** Cheapest first grip, then the cheapest step at every chord. Same candidates as leadProgression. */
export function leadGreedy(
  chords: Chord[],
  tuning: GuitarString[],
  w: Weights = DEFAULT_WEIGHTS,
  opts: LeadOptions = {},
): Voicing[] {
  if (chords.length === 0) return [];
  const candidates = chords.map((chord, index) => candidatesFor(chord, index, tuning, w, opts));
  let index = 0;
  for (let j = 1; j < candidates[0].length; j++) {
    if (voicingCost(candidates[0][j], w) < voicingCost(candidates[0][index], w)) index = j;
  }
  const path: Voicing[] = [candidates[0][index]];
  for (let i = 1; i < candidates.length; i++) {
    let nextIndex = 0;
    let nextCost = transitionCost(path[i - 1], candidates[i][0], w);
    for (let j = 1; j < candidates[i].length; j++) {
      const cost = transitionCost(path[i - 1], candidates[i][j], w);
      if (cost < nextCost) {
        nextCost = cost;
        nextIndex = j;
      }
    }
    path.push(candidates[i][nextIndex]);
  }
  return path;
}

/** voicingCost of the first grip, plus each transition into the next. */
export function pathCost(path: Voicing[], w: Weights = DEFAULT_WEIGHTS): number {
  if (path.length === 0) return 0;
  let cost = voicingCost(path[0], w);
  for (let i = 1; i < path.length; i++) cost += transitionCost(path[i - 1], path[i], w);
  return cost;
}
