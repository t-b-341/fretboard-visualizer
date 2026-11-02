// Neck positions: a fret window is not enough, because a playable box picks
// specific notes on each string (three-notes-per-string, or a CAGED span).

import type { Cell } from './fretboard';

export type ShapeMode = 'all' | 'nps' | 'caged';
export type CagedName = 'E' | 'D' | 'C' | 'A' | 'G';

export interface ShapeCell {
  stringIndex: number;
  fret: number;
}

export interface NeckShape {
  id: string;
  name: string;
  cells: ShapeCell[];
  fretFrom: number;
  fretTo: number;
}

/** How many scale notes belong on each string in one position box. */
export function notesPerString(scaleLength: number): 2 | 3 | 4 {
  if (scaleLength >= 8) return 4;
  if (scaleLength >= 7) return 3;
  return 2;
}

function maxStretch(count: number): number {
  if (count <= 2) return 4;
  if (count === 3) return 5;
  return 6;
}

function runs(frets: number[], count: number): number[][] {
  const out: number[][] = [];
  const stretch = maxStretch(count);
  for (let i = 0; i + count - 1 < frets.length; i++) {
    const slice = frets.slice(i, i + count);
    if (slice[slice.length - 1] - slice[0] <= stretch) out.push(slice);
  }
  return out;
}

function median(frets: number[]): number {
  const mid = Math.floor(frets.length / 2);
  return frets.length % 2 === 0 ? (frets[mid - 1] + frets[mid]) / 2 : frets[mid];
}

/**
 * Slide a playable group of `perString` scale notes up each string, keeping
 * neighbouring strings within a few frets of each other so the box is one hand
 * position. The lowest string's possible groups seed the search.
 */
export function buildNotePerStringShapes(
  grid: Cell[][],
  scalePcs: Set<number>,
  perString: number,
): NeckShape[] {
  const fretsByString = grid.map((row) => row.filter((c) => scalePcs.has(c.pc)).map((c) => c.fret));
  const seeds = runs(fretsByString[0] ?? [], perString);
  const found: NeckShape[] = [];
  const seen = new Set<string>();

  for (const seed of seeds) {
    const cells: ShapeCell[] = seed.map((fret) => ({ stringIndex: 0, fret }));
    let prev = seed;
    let ok = true;
    for (let s = 1; s < fretsByString.length; s++) {
      const next = chooseRun(fretsByString[s], perString, prev);
      if (!next) {
        ok = false;
        break;
      }
      for (const fret of next) cells.push({ stringIndex: s, fret });
      prev = next;
    }
    if (!ok || cells.length === 0) continue;
    const key = cells.map((c) => `${c.stringIndex}:${c.fret}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    const frets = cells.map((c) => c.fret);
    const fretFrom = Math.min(...frets);
    const fretTo = Math.max(...frets);
    found.push({ id: key, name: '', cells, fretFrom, fretTo });
  }

  found.sort((a, b) => a.fretFrom - b.fretFrom || a.fretTo - b.fretTo);
  const diverse: NeckShape[] = [];
  for (const shape of found) {
    const prev = diverse[diverse.length - 1];
    if (prev && shape.fretFrom <= prev.fretFrom + 1 && Math.abs(shape.fretTo - prev.fretTo) <= 1) continue;
    diverse.push(shape);
  }
  return diverse.slice(0, 16).map((shape, i) => ({
    ...shape,
    id: `nps-${i}-${shape.fretFrom}`,
    name: `Pos ${i + 1} · frets ${shape.fretFrom}–${shape.fretTo}`,
  }));
}

function chooseRun(frets: number[], count: number, prev: number[]): number[] | null {
  const prevMed = median(prev);
  let best: number[] | null = null;
  let bestScore = Infinity;
  for (let len = count; len >= Math.max(1, count - 1); len--) {
    for (const run of runs(frets, len)) {
      const shift = Math.abs(median(run) - prevMed);
      if (shift > 4) continue;
      const score = shift * 2 + Math.abs(run[0] - prev[0]) + (count - len) * 3;
      if (score < bestScore) {
        best = run;
        bestScore = score;
      }
    }
    if (best) return best;
  }
  return null;
}

// Fret span of each CAGED box relative to the root fret on the lowest string.
// These are the usual major-scale windows (they overlap, on purpose).
const CAGED_SPANS: Record<CagedName, [number, number]> = {
  E: [0, 3],
  D: [2, 5],
  C: [4, 8],
  A: [5, 9],
  G: [7, 12],
};

const CAGED_ORDER: CagedName[] = ['E', 'D', 'C', 'A', 'G'];

/**
 * Five named fret windows anchored to each root on the lowest string.
 * Inside the window every scale note is kept, so the box reads as that CAGED
 * shape without assuming a particular fingering.
 */
export function buildCagedShapes(grid: Cell[][], scalePcs: Set<number>, rootPc: number): NeckShape[] {
  const fretCount = (grid[0]?.length ?? 1) - 1;
  const rootFrets = (grid[0] ?? []).filter((c) => c.pc === rootPc).map((c) => c.fret);
  const shapes: NeckShape[] = [];
  for (const name of CAGED_ORDER) {
    const [a, b] = CAGED_SPANS[name];
    for (const rootFret of rootFrets) {
      const fretFrom = Math.max(0, rootFret + a);
      const fretTo = Math.min(fretCount, rootFret + b);
      if (fretFrom > fretCount || fretTo < fretFrom) continue;
      const cells: ShapeCell[] = [];
      for (const row of grid) {
        for (const cell of row) {
          if (cell.fret < fretFrom || cell.fret > fretTo) continue;
          if (!scalePcs.has(cell.pc)) continue;
          cells.push({ stringIndex: cell.stringIndex, fret: cell.fret });
        }
      }
      if (cells.length < 3) continue;
      shapes.push({
        id: `caged-${name}-${rootFret}`,
        name: `${name} shape · fret ${rootFret}`,
        cells,
        fretFrom,
        fretTo,
      });
    }
  }
  return shapes;
}
