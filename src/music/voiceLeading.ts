// Cost of moving from one grip to the next.
// Guide tones are expensive to drag, held notes and tendency resolutions are cheap.

import type { ChordToneRole } from './chords';
import type { VoicedNote, Voicing } from './voicings';

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
