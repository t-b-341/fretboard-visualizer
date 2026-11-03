import { describe, expect, it } from 'vitest';
import { buildChord } from '../../music/chords';
import { defaultPresetForStrings } from '../../music/tunings';
import { DEFAULT_WEIGHTS } from '../../music/voiceLeading';
import type { Step } from './types';
import { chooseVoicings } from './voicingChoice';

const tuning = defaultPresetForStrings(7).notes;

function step(chord: ReturnType<typeof buildChord>, voicingIndex = 0, voicingManual = false): Step {
  return {
    id: chord.symbol + chord.rootPc,
    chord,
    locked: false,
    voicingIndex,
    ...(voicingManual ? { voicingManual: true } : {}),
    source: 'manual',
  };
}

function motion(from: number[], to: number[]): number {
  const a = [...from].sort((x, y) => x - y);
  const b = [...to].sort((x, y) => x - y);
  let sum = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index++) sum += Math.abs(a[index] - b[index]);
  return sum;
}

function midis(choice: ReturnType<typeof chooseVoicings>[number]): number[] {
  return choice.voicings[choice.index]?.notes.map((note) => note.midi) ?? [];
}

describe('chooseVoicings', () => {
  const steps = [step(buildChord(0, 'm7')), step(buildChord(5, '7')), step(buildChord(10, 'maj7'))];
  const shared = {
    steps,
    shape: 'drop2' as const,
    stringSet: 2,
    tuning,
    weights: DEFAULT_WEIGHTS,
  };

  it('uses the stored index until smooth voice leading is on', () => {
    const plain = chooseVoicings({ ...shared, smooth: false });
    expect(plain.map((choice) => choice.index)).toEqual([0, 0, 0]);
    const smooth = chooseVoicings({ ...shared, smooth: true });
    for (let index = 1; index < steps.length; index++) {
      expect(motion(midis(smooth[index - 1]), midis(smooth[index]))).toBeLessThanOrEqual(
        motion(midis(plain[index - 1]), midis(plain[index])),
      );
    }
  });

  it('leaves a hand-picked step on its index', () => {
    const picked = [steps[0], { ...steps[1], voicingIndex: 3, voicingManual: true }, steps[2]];
    const smooth = chooseVoicings({ ...shared, steps: picked, smooth: true });
    expect(smooth[1].index).toBe(3);
    const again = chooseVoicings({ ...shared, steps: picked, smooth: true, shape: 'close' });
    expect(again[1].index).toBeLessThanOrEqual(again[1].voicings.length - 1);
    expect(again[1].index).toBe(Math.min(3, again[1].voicings.length - 1));
  });
});
