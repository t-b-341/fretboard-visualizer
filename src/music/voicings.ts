// Close and drop-2 grips on a run of adjacent strings.
//
// "Inversion" is which chord tone sits on the lowest string of the set.
// A close voicing stacks the remaining tones upward inside one octave.
// Drop-2 starts from a close stack and lowers the second voice from the top
// by an octave, which is what puts that grip under one hand.

import type { Chord, ChordToneRole } from './chords';
import { midiOf, noteAt } from './fretboard';
import { mod } from './notes';
import type { GuitarString } from './tunings';

export type VoicingStyle = 'all' | 'close' | 'drop2';

export interface VoicedNote {
  stringIndex: number;
  fret: number;
  midi: number;
  pc: number;
  role?: ChordToneRole;
  degree?: string;
}

interface VoiceTone {
  pc: number;
  interval: number;
  role: ChordToneRole;
  degree: string;
}

const ROLE_RANK: Record<ChordToneRole, number> = {
  root: 0,
  third: 1,
  fifth: 2,
  seventh: 3,
  ext: 4,
};

function uniqueTones(chord: Chord): VoiceTone[] {
  const out: VoiceTone[] = [];
  const seen = new Set<number>();
  for (const tone of chord.tones) {
    const interval = mod(tone.interval, 12);
    const pc = mod(chord.rootPc + interval, 12);
    if (seen.has(pc)) continue;
    seen.add(pc);
    out.push({ pc, interval, role: tone.role, degree: tone.degree });
  }
  return out;
}

/** The tones a grip of `width` strings should play, low interval to high. */
export function selectVoicingTones(chord: Chord, width: number): VoiceTone[] {
  const all = uniqueTones(chord);
  const byRole = (role: ChordToneRole) => all.find((t) => t.role === role);
  const root = byRole('root');
  const third = byRole('third');
  const fifth = byRole('fifth');
  const seventh = byRole('seventh');
  let chosen: VoiceTone[] = [];
  if (width >= 4) {
    chosen = [root, third, fifth, seventh].filter((t): t is VoiceTone => !!t);
  } else {
    chosen = [root, third, seventh ?? fifth].filter((t): t is VoiceTone => !!t);
  }
  for (const tone of [...all].sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])) {
    if (chosen.length >= width) break;
    if (!chosen.includes(tone)) chosen.push(tone);
  }
  return chosen
    .slice(0, width)
    .sort((a, b) => a.interval - b.interval);
}

function rotate<T>(items: T[], start: number): T[] {
  const n = items.length;
  if (n === 0) return [];
  const s = mod(start, n);
  return [...items.slice(s), ...items.slice(0, s)];
}

export function voicingStringSets(
  stringCount: number,
  width: number,
): { start: number; label: string }[] {
  const sets = [];
  for (let start = 0; start + width <= stringCount; start++) {
    const nums = Array.from({ length: width }, (_, k) => start + k + 1);
    const label = nums.length === 1 ? `${nums[0]}` : `${nums[0]}–${nums[nums.length - 1]}`;
    sets.push({ start, label });
  }
  return sets;
}

/**
 * Every place this inversion fits on `stringSetStart` and the next
 * `width - 1` strings, within the fretboard. Frets of one grip stay inside
 * a one-hand stretch.
 */
export function findVoicings(
  tuning: GuitarString[],
  fretCount: number,
  chord: Chord,
  style: 'close' | 'drop2',
  inversion: number,
  stringSetStart: number,
  width: number,
): VoicedNote[][] {
  const voices = selectVoicingTones(chord, width);
  if (voices.length < width) return [];
  const start = stringSetStart;
  if (start < 0 || start + width > tuning.length) return [];

  const order =
    style === 'drop2' && width === 4
      ? drop2Order(voices, inversion)
      : rotate(voices, inversion);

  const maxSpan = style === 'drop2' ? 6 : 5;
  // Close stays inside about an octave. Drop-2 lowers one voice by an octave,
  // so the top note can sit a little past that (a maj7 drop-2 spans 16).
  const maxMidiSpan = style === 'drop2' ? 24 : 15;
  const shapes: VoicedNote[][] = [];
  const seen = new Set<string>();
  const lowest = tuning[start];

  for (let fret = 0; fret <= fretCount; fret++) {
    if (mod(lowest.pc + fret, 12) !== order[0].pc) continue;
    const placed: VoicedNote[] = [
      {
        stringIndex: start,
        fret,
        midi: midiOf(lowest, fret),
        pc: order[0].pc,
        role: order[0].role,
        degree: order[0].degree,
      },
    ];
    let prevMidi = placed[0].midi;
    let ok = true;
    for (let v = 1; v < order.length; v++) {
      const str = tuning[start + v];
      const open = midiOf(str, 0);
      let found: VoicedNote | null = null;
      for (let f = 0; f <= fretCount; f++) {
        const midi = open + f;
        if (midi <= prevMidi) continue;
        if (mod(str.pc + f, 12) !== order[v].pc) continue;
        if (midi - placed[0].midi > maxMidiSpan) break;
        if (Math.abs(f - placed[0].fret) > maxSpan) continue;
        found = {
          stringIndex: start + v,
          fret: f,
          midi,
          pc: order[v].pc,
          role: order[v].role,
          degree: order[v].degree,
        };
        break;
      }
      if (!found) {
        ok = false;
        break;
      }
      placed.push(found);
      prevMidi = found.midi;
    }
    if (!ok) continue;
    const frets = placed.map((p) => p.fret);
    if (Math.max(...frets) - Math.min(...frets) > maxSpan) continue;
    const key = placed.map((p) => `${p.stringIndex}:${p.fret}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    shapes.push(placed);
  }
  return shapes;
}

/** The chord tone that sits on the lowest string of this inversion. */
export function voicingBassRole(
  chord: Chord,
  style: 'close' | 'drop2',
  inversion: number,
  width: number,
): ChordToneRole | null {
  const voices = selectVoicingTones(chord, width);
  if (voices.length === 0) return null;
  const order =
    style === 'drop2' && width === 4 ? drop2Order(voices, inversion) : rotate(voices, inversion);
  return order[0]?.role ?? null;
}

/** Low-to-high pitch classes of a drop-2 grip with `inversion` in the bass. */
function drop2Order(voices: VoiceTone[], inversion: number): VoiceTone[] {
  const bass = mod(inversion, voices.length);
  // The tone two steps below the desired bass is the bottom of the close
  // stack whose second-from-the-top voice, once dropped, becomes the bass.
  const close = rotate(voices, bass - 2);
  return [close[2], close[0], close[1], close[3]];
}

export interface Voicing {
  /** Index = string, low to high. null = muted. */
  frets: (number | null)[];
  /** Sounding notes, low to high by MIDI. */
  notes: VoicedNote[];
  /** Lowest fretted note. Opens are excluded. 0 when every sounding note is open. */
  minFret: number;
  maxFret: number;
  /** maxFret - minFret across fretted notes. */
  span: number;
}

/** Pack sounding notes into a grip. Open strings (fret 0) do not set minFret, maxFret, or span. */
export function toVoicing(notes: VoicedNote[], stringCount: number): Voicing {
  const frets: (number | null)[] = new Array(stringCount).fill(null);
  let minFret = 0;
  let maxFret = 0;
  let fretted = false;
  for (const note of notes) {
    if (note.stringIndex >= 0 && note.stringIndex < stringCount) {
      frets[note.stringIndex] = note.fret;
    }
    if (note.fret > 0) {
      if (!fretted || note.fret < minFret) minFret = note.fret;
      if (!fretted || note.fret > maxFret) maxFret = note.fret;
      fretted = true;
    }
  }
  return {
    frets,
    notes: [...notes].sort((a, b) => a.midi - b.midi || a.stringIndex - b.stringIndex),
    minFret,
    maxFret,
    span: maxFret - minFret,
  };
}

export interface VoicingOptions {
  /** Highest allowed maxFret - minFret across fretted notes. */
  maxSpan: number;
  /** Inclusive fret window. Open strings ignore this when allowOpen is set. */
  fretRange: [number, number];
  /** Roles that must each appear at least once. */
  required: ChordToneRole[];
  minNotes: number;
  maxNotes: number;
  /** Open strings ignore span and fretRange. */
  allowOpen: boolean;
}

const ROLE_BIT: Record<ChordToneRole, number> = {
  root: 1,
  third: 2,
  fifth: 4,
  seventh: 8,
  ext: 16,
};

interface Placement {
  fret: number;
  midi: number;
  pc: number;
  role: ChordToneRole;
  degree: string;
  bit: number;
}

function resolveVoicingOptions(chord: Chord, opts?: Partial<VoicingOptions>): VoicingOptions {
  const hasSeventh = chord.tones.some((tone) => tone.role === 'seventh');
  const fallback: ChordToneRole[] = hasSeventh ? ['third', 'seventh'] : ['root', 'third'];
  let required = [...(opts?.required ?? fallback)];
  if (!hasSeventh) required = required.filter((role) => role !== 'seventh');
  return {
    maxSpan: opts?.maxSpan ?? 4,
    fretRange: opts?.fretRange ?? [0, 15],
    required,
    minNotes: opts?.minNotes ?? 3,
    maxNotes: opts?.maxNotes ?? 6,
    allowOpen: opts?.allowOpen ?? true,
  };
}

function labelsForChord(chord: Chord): Map<number, { role: ChordToneRole; degree: string }> {
  const labels = new Map<number, { role: ChordToneRole; degree: string }>();
  for (const tone of chord.tones) {
    const pc = mod(chord.rootPc + tone.interval, 12);
    if (!labels.has(pc)) labels.set(pc, { role: tone.role, degree: tone.degree });
  }
  return labels;
}

function placementsOnString(
  str: GuitarString,
  pcs: Set<number>,
  labels: Map<number, { role: ChordToneRole; degree: string }>,
  allowOpen: boolean,
  fretRange: [number, number],
): Placement[] {
  const [lo, hi] = fretRange;
  const out: Placement[] = [];
  const push = (fret: number) => {
    const pc = noteAt(str.pc, fret);
    const label = labels.get(pc);
    if (!label || !pcs.has(pc)) return;
    out.push({
      fret,
      midi: midiOf(str, fret),
      pc,
      role: label.role,
      degree: label.degree,
      bit: ROLE_BIT[label.role],
    });
  };
  if (allowOpen) push(0);
  const start = Math.max(allowOpen ? 1 : 0, lo);
  for (let fret = start; fret <= hi; fret++) push(fret);
  return out;
}

function mutedCount(frets: (number | null)[]): number {
  let count = 0;
  for (const fret of frets) if (fret === null) count++;
  return count;
}

/**
 * Every playable grip of `chord` on `tuning`. Strings are decided low to high:
 * mute, or one in-chord fret. Fretted notes stay inside maxSpan; opens do not
 * count toward that stretch. Each pitch class is used once, and each sounding
 * string sits above the previous one in pitch.
 */
export function generateVoicings(
  chord: Chord,
  tuning: GuitarString[],
  opts?: Partial<VoicingOptions>,
): Voicing[] {
  const options = resolveVoicingOptions(chord, opts);
  const labels = labelsForChord(chord);
  const pcs = new Set(chord.pcs);
  const byString = tuning.map((str) =>
    placementsOnString(str, pcs, labels, options.allowOpen, options.fretRange),
  );
  const stringCount = tuning.length;
  const requiredMask = options.required.reduce((mask, role) => mask | ROLE_BIT[role], 0);
  const suffix = new Array<number>(stringCount + 1).fill(0);
  for (let i = stringCount - 1; i >= 0; i--) {
    let mask = 0;
    for (const placement of byString[i]) mask |= placement.bit;
    suffix[i] = suffix[i + 1] | mask;
  }

  const chosen: (Placement | null)[] = new Array(stringCount).fill(null);
  const results: Voicing[] = [];

  const emit = () => {
    const frets: (number | null)[] = new Array(stringCount);
    const notes: VoicedNote[] = [];
    let minFret = 0;
    let maxFret = 0;
    let fretted = false;
    for (let i = 0; i < stringCount; i++) {
      const placement = chosen[i];
      if (!placement) {
        frets[i] = null;
        continue;
      }
      frets[i] = placement.fret;
      notes.push({
        stringIndex: i,
        fret: placement.fret,
        midi: placement.midi,
        pc: placement.pc,
        role: placement.role,
        degree: placement.degree,
      });
      if (placement.fret > 0) {
        if (!fretted || placement.fret < minFret) minFret = placement.fret;
        if (!fretted || placement.fret > maxFret) maxFret = placement.fret;
        fretted = true;
      }
    }
    notes.sort((a, b) => a.midi - b.midi || a.stringIndex - b.stringIndex);
    results.push({
      frets,
      notes,
      minFret,
      maxFret,
      span: maxFret - minFret,
    });
  };

  const search = (
    index: number,
    sounded: number,
    fretted: boolean,
    minF: number,
    maxF: number,
    gap: number,
    heard: boolean,
    roleMask: number,
    usedPcs: number,
    prevMidi: number,
  ) => {
    if (sounded + (stringCount - index) < options.minNotes) return;
    if ((requiredMask & ~roleMask & ~suffix[index]) !== 0) return;

    if (index === stringCount) {
      if (sounded < options.minNotes) return;
      if ((roleMask & requiredMask) !== requiredMask) return;
      emit();
      return;
    }

    // A two-string mute already separates us from the last note, so anything
    // further would be an illegal hole. A full grip can't add another note.
    const closed = sounded === options.maxNotes || (heard && gap >= 2);
    if (closed) {
      if (sounded < options.minNotes) return;
      if ((roleMask & requiredMask) !== requiredMask) return;
      for (let j = index; j < stringCount; j++) chosen[j] = null;
      emit();
      return;
    }

    if (sounded < options.maxNotes) {
      for (const placement of byString[index]) {
        if (sounded > 0 && placement.midi <= prevMidi) continue;
        const pcBit = 1 << placement.pc;
        if (usedPcs & pcBit) continue;
        let nextFretted = fretted;
        let nextMin = minF;
        let nextMax = maxF;
        if (placement.fret > 0) {
          nextMin = fretted ? Math.min(minF, placement.fret) : placement.fret;
          nextMax = fretted ? Math.max(maxF, placement.fret) : placement.fret;
          if (nextMax - nextMin > options.maxSpan) continue;
          nextFretted = true;
        }
        chosen[index] = placement;
        search(
          index + 1,
          sounded + 1,
          nextFretted,
          nextMin,
          nextMax,
          0,
          true,
          roleMask | placement.bit,
          usedPcs | pcBit,
          placement.midi,
        );
      }
    }

    chosen[index] = null;
    search(
      index + 1,
      sounded,
      fretted,
      minF,
      maxF,
      heard ? gap + 1 : 0,
      heard,
      roleMask,
      usedPcs,
      prevMidi,
    );
  };

  search(0, 0, false, 0, 0, 0, false, 0, 0, 0);

  results.sort(
    (a, b) => a.minFret - b.minFret || mutedCount(a.frets) - mutedCount(b.frets) || a.span - b.span,
  );
  return results;
}
