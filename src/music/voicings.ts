// Close and drop-2 grips on a run of adjacent strings.
//
// "Inversion" is which chord tone sits on the lowest string of the set.
// A close voicing stacks the remaining tones upward inside one octave.
// Drop-2 starts from a close stack and lowers the second voice from the top
// by an octave, which is what puts that grip under one hand.

import type { Chord, ChordToneRole } from './chords';
import { midiOf } from './fretboard';
import { mod } from './notes';
import type { GuitarString } from './tunings';

export type VoicingStyle = 'all' | 'close' | 'drop2';

export interface VoicedNote {
  stringIndex: number;
  fret: number;
  pc: number;
  midi: number;
}

interface VoiceTone {
  pc: number;
  interval: number;
  role: ChordToneRole;
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
    out.push({ pc, interval, role: tone.role });
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
      { stringIndex: start, fret, pc: order[0].pc, midi: midiOf(lowest, fret) },
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
        found = { stringIndex: start + v, fret: f, pc: order[v].pc, midi };
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
