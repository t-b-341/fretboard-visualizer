import { describe, expect, it } from 'vitest';
import {
  CHORD_QUALITIES,
  buildChord,
  buildDiatonicChord,
  getAllDiatonicTriads,
  romanForChord,
} from './chords';
import { mod } from './notes';
import { SCALE_FAMILIES, getFamily } from './scales';

const HEPTATONIC_FAMILIES = ['major', 'melodicMinor', 'harmonicMinor', 'harmonicMajor'];

const ionian = getFamily('major').modes.find((m) => m.key === 'Ionian')!.intervals;

describe('diatonic chords in C Ionian', () => {
  it('triads have the expected romans and roots', () => {
    const triads = getAllDiatonicTriads(0, ionian);
    expect(triads.map((t) => t.roman)).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii\u00b0']);
    expect(triads.map((t) => t.rootPc)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it('degree 5 seventh is G7', () => {
    const chord = buildDiatonicChord(0, ionian, 4, true);
    expect(chord.symbol).toBe('7');
    expect(new Set(chord.pcs)).toEqual(new Set([7, 11, 2, 5]));
  });

  it('degree 1 seventh is Cmaj7', () => {
    expect(buildDiatonicChord(0, ionian, 0, true).symbol).toBe('maj7');
  });
});

describe('every heptatonic mode', () => {
  for (const family of SCALE_FAMILIES.filter((f) => HEPTATONIC_FAMILIES.includes(f.key))) {
    for (const mode of family.modes) {
      it(`${family.key}/${mode.key} yields 7 triads and 7 seventh chords`, () => {
        expect(getAllDiatonicTriads(0, mode.intervals)).toHaveLength(7);
        const sevenths = [0, 1, 2, 3, 4, 5, 6].map((d) =>
          buildDiatonicChord(0, mode.intervals, d, true),
        );
        expect(sevenths).toHaveLength(7);
        for (const chord of sevenths) {
          expect(chord.tones).toHaveLength(4);
        }
      });
    }
  }
});

describe('buildChord', () => {
  it('7alt pcs match the catalog intervals above C', () => {
    const def = CHORD_QUALITIES.find((q) => q.key === '7alt')!;
    const expected = def.tones.map(([interval]) => mod(interval, 12));
    expect(buildChord(0, '7alt').pcs).toEqual(expected);
  });
});

describe('romanForChord in C', () => {
  it('Bb major is bVII', () => {
    expect(romanForChord(0, buildChord(10, 'maj'))).toBe('bVII');
  });

  it('F minor is iv', () => {
    expect(romanForChord(0, buildChord(5, 'min'))).toBe('iv');
  });

  it('G7 is V7', () => {
    expect(romanForChord(0, buildChord(7, '7'))).toBe('V7');
  });
});
