// Which voicing each step shows. Smooth voice leading fills in the steps
// the player has not picked by hand.

import type { GuitarString } from '../../music/tunings';
import { voicingPlacement, voicingsFor } from '../../music/voicingSet';
import type { Voicing } from '../../music/voicings';
import { leadIndices, type Weights } from '../../music/voiceLeading';
import type { Step, VoicingShape } from './types';

export interface VoicingChoice {
  voicings: Voicing[];
  /** Index into `voicings`, already clamped. 0 when the list is empty. */
  index: number;
  /** Drop-2 was asked for and this chord is not a four-note chord. */
  fellBack: boolean;
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.max(0, Math.min(count - 1, Math.floor(index)));
}

/**
 * Voicing list and chosen index for every step.
 * With smooth voice leading on, steps the player has not marked by hand take
 * their index from the voice-leading path. A hand-picked step stays put, and
 * the path routes through it.
 */
export function chooseVoicings(args: {
  steps: readonly Step[];
  shape: VoicingShape;
  stringSet: number;
  smooth: boolean;
  tuning: readonly GuitarString[];
  fretRange?: { min: number; max: number };
  weights: Weights;
}): VoicingChoice[] {
  const lists = args.steps.map((step) =>
    voicingsFor(step.chord, args.tuning, {
      shape: args.shape,
      stringSet: args.stringSet,
      fretRange: args.fretRange,
      bassPc: step.bassPc,
    }),
  );
  const indices = lists.map((list, index) => clampIndex(args.steps[index].voicingIndex, list.length));

  if (args.smooth && args.shape !== 'all') {
    let start = 0;
    while (start < args.steps.length) {
      while (start < args.steps.length && lists[start].length === 0) start += 1;
      let end = start;
      while (end < args.steps.length && lists[end].length > 0) end += 1;
      if (end > start) {
        const candidates = [];
        for (let index = start; index < end; index++) {
          const list = lists[index];
          const step = args.steps[index];
          candidates.push(step.voicingManual ? [list[clampIndex(step.voicingIndex, list.length)]] : list);
        }
        const picked = leadIndices(candidates, args.weights);
        for (let index = start; index < end; index++) {
          const step = args.steps[index];
          indices[index] = step.voicingManual
            ? clampIndex(step.voicingIndex, lists[index].length)
            : picked[index - start];
        }
      }
      start = end;
    }
  }

  return args.steps.map((step, index) => ({
    voicings: lists[index],
    index: indices[index],
    fellBack: args.shape === 'drop2' && voicingPlacement(step.chord, 'drop2').fellBack,
  }));
}
