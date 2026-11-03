import { describe, expect, it } from 'vitest';
import { buildChord, buildDiatonicChord } from './chords';
import { explainStep, functionOf, rerollChord, type AnalysisKey } from './explain';
import { mulberry32 } from './progression';
import { getFamily } from './scales';

const IONIAN = getFamily('major').modes.find((mode) => mode.key === 'Ionian')!.intervals;
const C: AnalysisKey = { rootPc: 0, intervals: IONIAN };
const Bb: AnalysisKey = { rootPc: 10, intervals: IONIAN };

function line(rootPc: number, degrees: number[], sevenths = false) {
  return degrees.map((degree) => ({ chord: buildDiatonicChord(rootPc, IONIAN, degree, sevenths) }));
}

describe('functionOf', () => {
  it('maps the diatonic degrees', () => {
    expect(functionOf(buildDiatonicChord(0, IONIAN, 0, false), C)).toBe('T');
    expect(functionOf(buildDiatonicChord(0, IONIAN, 2, false), C)).toBe('T');
    expect(functionOf(buildDiatonicChord(0, IONIAN, 5, false), C)).toBe('T');
    expect(functionOf(buildDiatonicChord(0, IONIAN, 1, false), C)).toBe('SD');
    expect(functionOf(buildDiatonicChord(0, IONIAN, 3, false), C)).toBe('SD');
    expect(functionOf(buildDiatonicChord(0, IONIAN, 4, false), C)).toBe('D');
    expect(functionOf(buildDiatonicChord(0, IONIAN, 6, false), C)).toBe('D');
  });

  it('calls a secondary dominant dominant and a borrowed iv subdominant', () => {
    expect(functionOf(buildChord(7, '7'), Bb)).toBe('D');
    expect(functionOf(buildChord(3, 'min'), Bb)).toBe('SD');
  });
});

describe('explainStep', () => {
  it('explains a ii–V–I', () => {
    const steps = line(0, [1, 4, 0]);
    expect(explainStep(steps, 0, C)).toMatch(/subdominant/i);
    expect(explainStep(steps, 0, C)).toMatch(/Sets up the dominant/);
    expect(explainStep(steps, 1, C)).toMatch(/Resolves to I/);
    expect(explainStep(steps, 2, C)).toMatch(/tonic/i);
    expect(explainStep(steps, 2, C)).toMatch(/resolves here/i);
  });

  it('explains a pop I–V–vi–IV', () => {
    const steps = line(0, [0, 4, 5, 3]);
    expect(functionOf(steps[0].chord, C)).toBe('T');
    expect(functionOf(steps[1].chord, C)).toBe('D');
    expect(functionOf(steps[2].chord, C)).toBe('T');
    expect(functionOf(steps[3].chord, C)).toBe('SD');
    expect(explainStep(steps, 0, C)).toMatch(/starts here/);
    expect(explainStep(steps, 1, C)).toMatch(/Moves to vi/);
    expect(explainStep(steps, 2, C)).toMatch(/tonic/i);
    expect(explainStep(steps, 3, C)).toMatch(/subdominant/i);
  });

  it('names a borrowed iv', () => {
    const iv = buildChord(3, 'min');
    expect(explainStep([{ chord: iv }], 0, Bb)).toBe('iv: borrowed from Bb minor. Darkens the IV.');
  });

  it('names a secondary dominant', () => {
    const dominant = buildChord(7, '7');
    expect(explainStep([{ chord: dominant }], 0, Bb)).toBe('V7/ii: dominant of Cm. Pulls to ii.');
  });
});

describe('rerollChord', () => {
  it('changes the chord and keeps its function', () => {
    const steps = line(10, [1, 4, 0], true);
    for (const seed of [1, 2, 3, 9, 42]) {
      const index = 2;
      const next = rerollChord(steps[index].chord, steps, index, Bb, mulberry32(seed));
      expect(`${next.rootPc}:${next.symbol}`).not.toBe(`${steps[index].chord.rootPc}:${steps[index].chord.symbol}`);
      expect(functionOf(next, Bb)).toBe(functionOf(steps[index].chord, Bb));
      expect(next.rootPc).not.toBe(steps[1].chord.rootPc);
    }
  });
});
