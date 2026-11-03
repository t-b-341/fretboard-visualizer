import { describe, expect, it } from 'vitest';
import { buildChord, type Triad } from './chords';
import { createEvaluator, type HighlightContext } from './highlight';
import { chromaticDegreeLabel } from './notes';

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

describe('createEvaluator quiz', () => {
  it('draws only right and wrong marks, with no label', () => {
    const evaluate = createEvaluator(
      context({
        viewMode: 'quiz',
        quizMarks: { '0:3': 'right', '1:5': 'wrong' },
      }),
    );
    expect(evaluate(4)).toBeNull();
    expect(evaluate(4, { cellKey: '2:1' })).toBeNull();
    expect(evaluate(7, { cellKey: '0:3' })).toEqual({ role: 'right', label: '' });
    expect(evaluate(10, { cellKey: '1:5' })).toEqual({ role: 'wrong', label: '' });
  });
});

describe('createEvaluator reference pitch', () => {
  const major = [0, 2, 4, 5, 7, 9, 11];
  const scale = context({
    viewMode: 'scale',
    displayMode: 'degree',
    activeChord: null,
    intervals: major,
    pcToIndex: ionian,
  });

  // Locked before the reference option existed. A null reference must match.
  const degreeLabels = { 0: '1', 5: '4', 7: '5', 11: '7' } as const;
  const noteLabels = { 0: 'C', 5: 'F', 7: 'G', 11: 'B' } as const;

  it('leaves labels unchanged when referencePc is null', () => {
    const degrees = createEvaluator({ ...scale, referencePc: null });
    const notes = createEvaluator({ ...scale, displayMode: 'note', referencePc: null });
    const omitted = createEvaluator(scale);
    expect(degrees(0)).toEqual({ role: 'root', label: degreeLabels[0], degreeIndex: 0 });
    expect(degrees(5)).toEqual({ role: 'scale', label: degreeLabels[5], degreeIndex: 3 });
    expect(degrees(7)).toEqual({ role: 'scale', label: degreeLabels[7], degreeIndex: 4 });
    expect(degrees(11)).toEqual({ role: 'scale', label: degreeLabels[11], degreeIndex: 6 });
    expect(degrees(1)).toBeNull();
    expect(notes(0)?.label).toBe(noteLabels[0]);
    expect(notes(5)?.label).toBe(noteLabels[5]);
    expect(notes(11)?.label).toBe(noteLabels[11]);
    expect(omitted(5)).toEqual(degrees(5));
    expect(omitted(0)?.role).toBe('root');
  });

  it('labels C major from G as b7 on F and 3 on B', () => {
    const evaluate = createEvaluator({ ...scale, referencePc: 7 });
    expect(evaluate(5)).toEqual({ role: 'scale', label: 'b7', degreeIndex: 3 });
    expect(evaluate(11)).toEqual({ role: 'scale', label: '3', degreeIndex: 6 });
    expect(evaluate(7)).toEqual({ role: 'scale', label: '1', degreeIndex: 4, reference: true });
    expect(evaluate(0)).toEqual({ role: 'root', label: '4', degreeIndex: 0 });
    expect(evaluate(1)).toBeNull();
    expect(evaluate(7)?.ring).toBeUndefined();
  });

  it('spells F from B as b5, and B from F as #4', () => {
    const fromB = createEvaluator({ ...scale, referencePc: 11 });
    expect(fromB(5)?.label).toBe('b5');
    const fromF = createEvaluator({ ...scale, referencePc: 5 });
    expect(fromF(11)?.label).toBe('#4');
  });

  it('uses chromatic labels when the scale is pentatonic', () => {
    const intervals = [0, 2, 4, 7, 9];
    const evaluate = createEvaluator(
      context({
        viewMode: 'scale',
        displayMode: 'degree',
        activeChord: null,
        intervals,
        pcToIndex: new Map(intervals.map((semi, index) => [semi, index])),
        referencePc: 7,
      }),
    );
    // E is 9 semitones above G. The chromatic label for that interval is 6.
    expect(evaluate(4)).toEqual({ role: 'scale', label: chromaticDegreeLabel(9), degreeIndex: 2 });
    expect(evaluate(4)?.label).toBe('6');
    expect(evaluate(0)).toEqual({ role: 'root', label: chromaticDegreeLabel(5), degreeIndex: 0 });
    expect(evaluate(7)).toEqual({ role: 'scale', label: '1', degreeIndex: 3, reference: true });
    expect(evaluate(5)).toBeNull();
  });

  it('keeps chord colour, the gold root ring, and outside notes while relabeling', () => {
    const evaluate = createEvaluator(context({ displayMode: 'note', referencePc: 7 }));
    expect(evaluate(0)).toEqual({
      role: 'root',
      label: '4',
      ring: true,
      outside: false,
      degreeIndex: 0,
    });
    expect(evaluate(7)).toEqual({
      role: 'fifth',
      label: '1',
      ring: false,
      outside: false,
      degreeIndex: 4,
      reference: true,
    });
    expect(evaluate(10)).toEqual({ role: 'seventh', label: 'b3', ring: false, outside: true });
    expect(evaluate(2)).toEqual({ role: 'ghost', label: '' });
  });

  it('does not change the interval when the label shift changes', () => {
    const concert = createEvaluator({ ...scale, displayMode: 'note', referencePc: 7 });
    const standard = createEvaluator({ ...scale, displayMode: 'note', referencePc: 7, shift: 1 });
    expect(concert(5)?.label).toBe('b7');
    expect(standard(5)?.label).toBe('b7');
    expect(concert(11)?.label).toBe('3');
    expect(standard(11)?.label).toBe('3');
  });

  it('labels an overlay-only pitch chromatically and keeps its colour', () => {
    const evaluate = createEvaluator({
      ...scale,
      compareEnabled: true,
      comparePcSet: new Set([3]),
      compareRootPc: 0,
      referencePc: 7,
    });
    expect(evaluate(3)).toEqual({ role: 'overlayOnly', label: 'b6', ring: false });
    expect(evaluate(5)).toMatchObject({ role: 'primaryOnly', label: 'b7' });
    expect(evaluate(1)).toBeNull();
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
