// Guide-tone voice leading: the 3rd and 7th (or the 5th when there is no 7th)
// of successive chords, each moving to the nearest playable spot on the neck.

import type { Chord, ChordToneRole } from './chords';
import { mod } from './notes';

export interface GuidePoint {
  stringIndex: number;
  fret: number;
  pc: number;
}

export interface GuideVoice {
  point: GuidePoint;
  /** Where this voice sat on the previous chord, when a line should be drawn. */
  from: GuidePoint | null;
}

export function guideTonePcs(chord: Chord): number[] {
  const pcs: number[] = [];
  const add = (role: ChordToneRole) => {
    const tone = chord.tones.find((t) => t.role === role);
    if (!tone) return;
    const pc = mod(chord.rootPc + tone.interval, 12);
    if (!pcs.includes(pc)) pcs.push(pc);
  };
  add('third');
  add('seventh');
  if (pcs.length < 2) add('fifth');
  if (pcs.length === 0) add('root');
  return pcs;
}

function dist(a: { stringIndex: number; fret: number }, b: { stringIndex: number; fret: number }): number {
  return Math.abs(a.fret - b.fret) + Math.abs(a.stringIndex - b.stringIndex) * 3;
}

function closest(origin: { stringIndex: number; fret: number }, group: GuidePoint[]): GuidePoint | null {
  let best: GuidePoint | null = null;
  let bestD = Infinity;
  for (const point of group) {
    const d = dist(origin, point);
    if (d < bestD) {
      best = point;
      bestD = d;
    }
  }
  return best;
}

function permutations(n: number): number[][] {
  const out: number[][] = [];
  const used = new Array<boolean>(n).fill(false);
  const cur: number[] = [];
  const walk = () => {
    if (cur.length === n) {
      out.push([...cur]);
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      cur.push(i);
      walk();
      cur.pop();
      used[i] = false;
    }
  };
  walk();
  return out;
}

function prune(group: GuidePoint[], centerFret: number): GuidePoint[] {
  const near = group.filter((p) => Math.abs(p.fret - centerFret) <= 7);
  return near.length > 0 ? near : group.slice(0, 16);
}

/**
 * One spot per guide-tone pitch class. With a previous placement, each voice
 * moves to the assignment that costs the least fret and string motion.
 */
export function placeGuideVoices(
  candidates: GuidePoint[],
  pcs: number[],
  prev: GuidePoint[] | null,
  centerFret: number,
): GuideVoice[] {
  const groups = pcs.map((pc) => candidates.filter((c) => c.pc === pc));
  const present = groups.map((g, i) => ({ pc: pcs[i], group: g })).filter((g) => g.group.length > 0);
  if (present.length === 0) return [];

  if (prev && prev.length === present.length) {
    const pruned = present.map((g) => prune(g.group, centerFret));
    let bestScore = Infinity;
    let best: GuideVoice[] | null = null;
    for (const perm of permutations(prev.length)) {
      let score = 0;
      const assignment: GuideVoice[] = new Array(prev.length);
      let ok = true;
      for (let i = 0; i < prev.length; i++) {
        const point = closest(prev[i], pruned[perm[i]]);
        if (!point) {
          ok = false;
          break;
        }
        score += dist(prev[i], point);
        assignment[perm[i]] = { point, from: prev[i] };
      }
      if (!ok || score >= bestScore) continue;
      bestScore = score;
      best = assignment;
    }
    if (best) return best;
  }

  return initialCluster(
    present.map((g) => g.group),
    centerFret,
  );
}

function initialCluster(groups: GuidePoint[][], centerFret: number): GuideVoice[] {
  const pruned = groups.map((g) => prune(g, centerFret));
  if (pruned.length > 3) {
    const notes: GuideVoice[] = [];
    let origin = { stringIndex: Math.round((pruned[0][0]?.stringIndex ?? 0) / 2), fret: centerFret };
    for (const group of pruned) {
      const point = closest(origin, group);
      if (!point) continue;
      notes.push({ point, from: null });
      origin = point;
    }
    return notes;
  }

  let best: GuidePoint[] | null = null;
  let bestScore = Infinity;
  const acc: GuidePoint[] = [];
  const walk = (i: number) => {
    if (i === pruned.length) {
      const frets = acc.map((p) => p.fret);
      const strings = acc.map((p) => p.stringIndex);
      const span = Math.max(...frets) - Math.min(...frets);
      const stringSpan = Math.max(...strings) - Math.min(...strings);
      const mid = (Math.max(...frets) + Math.min(...frets)) / 2;
      const sameString = new Set(strings).size < strings.length ? 8 : 0;
      const score = span * 4 + stringSpan * 2 + Math.abs(mid - centerFret) + sameString;
      if (score < bestScore) {
        bestScore = score;
        best = [...acc];
      }
      return;
    }
    for (const point of pruned[i]) {
      acc.push(point);
      walk(i + 1);
      acc.pop();
    }
  };
  walk(0);
  return (best ?? []).map((point) => ({ point, from: null }));
}
