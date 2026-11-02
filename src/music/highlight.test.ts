import { describe, expect, it } from 'vitest';
import { buildChord, type Triad } from './chords';
import { createEvaluator, type HighlightContext } from './highlight';

const cMajor: Triad = {
  degree: 0,
  roman: 'I',
  quality: 'maj',
  rootPc: 0,
  pitches: [0, 4, 7],
  intervalIndices: [0, 2, 4],
};

const ionian = new Map<number, number>([
  [0, 0],
  [2, 1],
  [4, 2],
  [5, 3],
  [7, 4],
  [9, 5],
  [11, 6],
]);

function context(over: Partial<HighlightContext> = {}): HighlightContext {
  return {
    rootPc: 0,
    intervals: [0, 2, 4, 5, 7, 9, 11],
    pcToIndex: ionian,
    viewMode: 'chord',
    triad: cMajor,
    activeChord: buildChord(0, '7'),
    displayMode: 'note',
    shift: 0,
    ghostScale: true,
    compareEnabled: false,
    comparePcSet: new Set(),
    compareRootPc: 0,
    sharedOnly: false,
    ...over,
  };
}

describe('createEvaluator identify', () => {
  it('draws picked notes, marks the lowest as root, and hides the rest', () => {
    const evaluate = createEvaluator(context({ viewMode: 'identify', identifyBassMidi: 40 }));
    expect(evaluate(4)).toBeNull();
    expect(evaluate(4, { placed: false, midi: 40 })).toBeNull();
    expect(evaluate(4, { placed: true, midi: 40 })).toEqual({ role: 'root', label: 'E' });
    // Same pitch class an octave higher is not the bass.
    expect(evaluate(4, { placed: true, midi: 52 })).toEqual({ role: 'scale', label: 'E' });
    expect(evaluate(0, { placed: true, midi: 48 })).toEqual({ role: 'scale', label: 'C' });
  });

  it('shifts identify labels with the concert/standard offset', () => {
    const evaluate = createEvaluator(
      context({ viewMode: 'identify', shift: 1, identifyBassMidi: 40 }),
    );
    expect(evaluate(4, { placed: true, midi: 40 })?.label).toBe('F');
  });
});

describe('createEvaluator voicing placement', () => {
  const evaluate = createEvaluator(context());

  it('draws a placed chord tone with its role', () => {
    expect(evaluate(4, { placed: true })?.role).toBe('third');
    expect(evaluate(4)?.role).toBe('third');
  });

  it('ghosts a scale tone that is not in the grip', () => {
    // E is the third of C7 and is in C major. Left out of the grip, it ghosts.
    expect(evaluate(4, { placed: false })?.role).toBe('ghost');
  });

  it('draws nothing for an outside chord tone left out of the grip', () => {
    // Bb is the seventh of C7 and is not in C major.
    expect(evaluate(10, { placed: false })).toBeNull();
    expect(evaluate(10, { placed: true })?.role).toBe('seventh');
  });
});
