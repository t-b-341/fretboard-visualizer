// Suggest a progression from the templates and the functional generator,
// then lay it over the steps the player has already locked.

import { classifyChord } from '../../music/chordColor';
import type { Chord } from '../../music/chords';
import { generateProgression, getTemplate, type KeyContext } from '../../music/progression';
import { getFamily, type FamilyKey } from '../../music/scales';
import type { Step } from './types';

export type SuggestStyle = 'jazz' | 'pop' | 'free';

export function modeIntervals(familyKey: FamilyKey, modeKey: string): number[] {
  const family = getFamily(familyKey);
  const mode = family.modes.find((item) => item.key === modeKey) ?? family.modes[0];
  return mode.intervals;
}

/** Template or generator output. Locked steps are applied afterwards. */
export function suggestChords(
  ctx: KeyContext,
  style: SuggestStyle,
  borrowed: boolean,
  length: number | null,
  seed: number,
): Chord[] {
  if (style === 'free') {
    return generateProgression(ctx, {
      length: length ?? undefined,
      sevenths: false,
      chromaticism: borrowed ? 0.35 : 0,
      seed,
    });
  }
  const template = getTemplate(style === 'jazz' ? 'jazz251' : 'pop');
  const base = template ? template.build(ctx) : [];
  if (!borrowed || base.length === 0) return base;
  const spicy = generateProgression(ctx, {
    length: base.length,
    sevenths: style === 'jazz',
    chromaticism: 0.55,
    seed,
  });
  return base.map((chord, index) => {
    const alt = spicy[index];
    if (!alt) return chord;
    return classifyChord(alt, ctx.rootPc, ctx.intervals).status === 'diatonic' ? chord : alt;
  });
}

function freshStep(chord: Chord, id: string): Step {
  return { id, chord, locked: false, voicingIndex: 0, source: 'suggested' };
}

/**
 * Locked steps stay at their index. Unlocked steps are replaced. A longer
 * suggestion appends steps; a shorter one still covers every unlocked slot.
 */
export function mergeSuggestion(existing: readonly Step[], generated: readonly Chord[], idAt: (n: number) => string): Step[] {
  if (existing.length === 0) return generated.map((chord, index) => freshStep(chord, idAt(index)));
  if (generated.length === 0) return [...existing];
  const count = Math.max(existing.length, generated.length);
  const next: Step[] = [];
  let created = 0;
  for (let index = 0; index < count; index++) {
    const prev = existing[index];
    if (prev?.locked) {
      next.push(prev);
      continue;
    }
    const chord = generated[index] ?? generated[index % generated.length];
    if (!chord) continue;
    if (prev) {
      next.push({
        id: prev.id,
        chord,
        locked: false,
        voicingIndex: 0,
        source: 'suggested',
      });
    } else {
      next.push(freshStep(chord, idAt(created)));
      created += 1;
    }
  }
  return next;
}
