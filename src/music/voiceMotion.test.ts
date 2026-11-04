import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { defaultPresetForStrings } from './tunings';
import { DEFAULT_WEIGHTS } from './voiceLeading';
import { formatVoiceMotion, linkVoices, nextStepIndex, signedSemitones } from './voiceMotion';
import { chooseVoicings } from '../state/v2/voicingChoice';
import type { Step } from '../state/v2/types';

function step(rootPc: number, quality: 'm7' | '7' | 'maj7' | 'maj'): Step {
  return {
    id: `${rootPc}-${quality}`,
    chord: buildChord(rootPc, quality),
    locked: false,
    voicingIndex: 0,
    source: 'manual',
  };
}

describe('formatVoiceMotion', () => {
  it('describes the default drop-2 path from Cm7 to F7', () => {
    const tuning = defaultPresetForStrings(7).notes;
    const choices = chooseVoicings({
      steps: [step(0, 'm7'), step(5, '7'), step(10, 'maj7')],
      shape: 'drop2',
      stringSet: 4,
      smooth: true,
      tuning,
      weights: DEFAULT_WEIGHTS,
    });
    const from = choices[0].voicings[choices[0].index].notes;
    const to = choices[1].voicings[choices[1].index].notes;
    expect(formatVoiceMotion(from, to)).toBe('Bb\u2192A (\u22121), G\u2192F (\u22122), C holds, Eb holds');
  });

  it('pairs a shorter chord by nearest pitch and names the voice that leaves', () => {
    const from = [
      { midi: 60, pc: 0 },
      { midi: 64, pc: 4 },
      { midi: 67, pc: 7 },
    ];
    const to = [
      { midi: 60, pc: 0 },
      { midi: 65, pc: 5 },
    ];
    expect(formatVoiceMotion(from, to)).toBe('E\u2192F (+1), C holds, G dropped');
    expect(linkVoices(from, to).added).toEqual([]);
  });

  it('names a voice the next chord adds', () => {
    const text = formatVoiceMotion(
      [{ midi: 60, pc: 0 }],
      [
        { midi: 60, pc: 0 },
        { midi: 67, pc: 7 },
      ],
    );
    expect(text).toBe('C holds, G added');
  });

  it('spells names with the Standard shift', () => {
    const text = formatVoiceMotion([{ midi: 70, pc: 10 }], [{ midi: 69, pc: 9 }], 1);
    expect(text).toBe('B\u2192Bb (\u22121)');
  });

  it('signs an upward move with a plus', () => {
    expect(signedSemitones(2)).toBe('+2');
    expect(signedSemitones(-2)).toBe('\u22122');
  });
});

describe('nextStepIndex', () => {
  it('wraps only when loop is on', () => {
    expect(nextStepIndex(0, 3, false)).toBe(1);
    expect(nextStepIndex(2, 3, false)).toBeNull();
    expect(nextStepIndex(2, 3, true)).toBe(0);
    expect(nextStepIndex(0, 1, true)).toBe(0);
    expect(nextStepIndex(0, 1, false)).toBeNull();
    expect(nextStepIndex(0, 0, true)).toBeNull();
  });
});
