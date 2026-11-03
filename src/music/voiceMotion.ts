// How each voice of the current step moves to the next one.
// Equal voice counts pair in pitch order. Unequal counts pair by nearest pitch.

import type { ChordToneRole } from './chords';
import { mod, noteName } from './notes';

export interface MotionPoint {
  midi: number;
  pc: number;
  role?: ChordToneRole;
  stringIndex?: number;
  fret?: number;
}

export interface VoiceLink {
  from: MotionPoint;
  to: MotionPoint;
  semitones: number;
}

/** Signed semitone text. Negative numbers use a minus sign, as in "−2". */
export function signedSemitones(semitones: number): string {
  if (semitones > 0) return `+${semitones}`;
  if (semitones < 0) return `\u2212${Math.abs(semitones)}`;
  return '0';
}

function byPitch(a: MotionPoint, b: MotionPoint): number {
  return a.midi - b.midi || a.pc - b.pc;
}

function pairVoices(from: readonly MotionPoint[], to: readonly MotionPoint[]): {
  pairs: { from: MotionPoint; to: MotionPoint }[];
  dropped: MotionPoint[];
  added: MotionPoint[];
} {
  const left = [...from].sort(byPitch);
  const right = [...to].sort(byPitch);
  const pairs: { from: MotionPoint; to: MotionPoint }[] = [];
  const usedLeft = new Set<number>();
  const usedRight = new Set<number>();

  if (left.length === right.length) {
    for (let index = 0; index < left.length; index++) {
      pairs.push({ from: left[index], to: right[index] });
      usedLeft.add(index);
      usedRight.add(index);
    }
  } else {
    const candidates: { leftIndex: number; rightIndex: number; distance: number }[] = [];
    for (let leftIndex = 0; leftIndex < left.length; leftIndex++) {
      for (let rightIndex = 0; rightIndex < right.length; rightIndex++) {
        candidates.push({
          leftIndex,
          rightIndex,
          distance: Math.abs(left[leftIndex].midi - right[rightIndex].midi),
        });
      }
    }
    candidates.sort(
      (a, b) => a.distance - b.distance || a.leftIndex - b.leftIndex || a.rightIndex - b.rightIndex,
    );
    for (const candidate of candidates) {
      if (usedLeft.has(candidate.leftIndex) || usedRight.has(candidate.rightIndex)) continue;
      usedLeft.add(candidate.leftIndex);
      usedRight.add(candidate.rightIndex);
      pairs.push({ from: left[candidate.leftIndex], to: right[candidate.rightIndex] });
    }
  }

  return {
    pairs,
    dropped: left.filter((_, index) => !usedLeft.has(index)),
    added: right.filter((_, index) => !usedRight.has(index)),
  };
}

/** Pairing of the current voicing onto the next one, including dropped and added voices. */
export function linkVoices(from: readonly MotionPoint[], to: readonly MotionPoint[]): {
  links: VoiceLink[];
  dropped: MotionPoint[];
  added: MotionPoint[];
} {
  const paired = pairVoices(from, to);
  return {
    links: paired.pairs.map((pair) => ({
      from: pair.from,
      to: pair.to,
      semitones: pair.to.midi - pair.from.midi,
    })),
    dropped: paired.dropped,
    added: paired.added,
  };
}

function spelled(pc: number, shift: number): string {
  return noteName(mod(pc + shift, 12));
}

/**
 * One clause per voice.
 * Moves come first, highest pitch first. Holds, dropped voices, and added voices
 * follow, each from the lowest pitch up.
 */
export function formatVoiceMotion(
  from: readonly MotionPoint[],
  to: readonly MotionPoint[],
  shift = 0,
): string {
  const { links, dropped, added } = linkVoices(from, to);
  const moves = links.filter((link) => link.semitones !== 0).sort((a, b) => b.from.midi - a.from.midi);
  const holds = links.filter((link) => link.semitones === 0).sort((a, b) => a.from.midi - b.from.midi);
  const parts: string[] = [];
  for (const link of moves) {
    parts.push(
      `${spelled(link.from.pc, shift)}\u2192${spelled(link.to.pc, shift)} (${signedSemitones(link.semitones)})`,
    );
  }
  for (const link of holds) parts.push(`${spelled(link.from.pc, shift)} holds`);
  for (const note of [...dropped].sort(byPitch)) parts.push(`${spelled(note.pc, shift)} dropped`);
  for (const note of [...added].sort(byPitch)) parts.push(`${spelled(note.pc, shift)} added`);
  return parts.join(', ');
}

/** The step playback moves to. Loop wraps, including a one-step loop. */
export function nextStepIndex(current: number, count: number, loop: boolean): number | null {
  if (count <= 0) return null;
  const index = Math.min(Math.max(current, 0), count - 1);
  if (index < count - 1) return index + 1;
  return loop ? 0 : null;
}
