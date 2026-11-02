import { describe, expect, it } from 'vitest';
import { chordColorTitle, classifyChord } from './chordColor';
import { buildChord, buildDiatonicChord } from './chords';
import { getFamily } from './scales';

const ionian = getFamily('major').modes.find((m) => m.key === 'Ionian')!.intervals;
const harmonicMinor = getFamily('harmonicMinor').modes.find((m) => m.key === 'HarmonicMinor')!.intervals;
const majorPent = getFamily('pentatonic').modes.find((m) => m.key === 'MajorPent')!.intervals;
const minorPent = getFamily('pentatonic').modes.find((m) => m.key === 'MinorPent')!.intervals;

function expectDiatonic(rootPc: number, intervals: number[]) {
  for (let degree = 0; degree < 7; degree++) {
    for (const seventh of [false, true]) {
      const chord = buildDiatonicChord(rootPc, intervals, degree, seventh);
      expect(classifyChord(chord, rootPc, intervals)).toEqual({
        status: 'diatonic',
        degreeIndex: degree,
      });
    }
  }
}

describe('classifyChord', () => {
  it('marks every diatonic triad and seventh of C major', () => {
    expectDiatonic(0, ionian);
  });

  it('marks every diatonic triad and seventh of A harmonic minor', () => {
    expectDiatonic(9, harmonicMinor);
  });

  it('borrows A7 and Fm in C major, and leaves Bb and Db outside', () => {
    expect(classifyChord(buildChord(9, '7'), 0, ionian)).toEqual({
      status: 'borrowed',
      degreeIndex: 5,
    });
    expect(classifyChord(buildChord(5, 'min'), 0, ionian)).toEqual({
      status: 'borrowed',
      degreeIndex: 3,
    });
    expect(classifyChord(buildChord(10, 'maj'), 0, ionian)).toEqual({
      status: 'outside',
      degreeIndex: null,
    });
    expect(classifyChord(buildChord(1, 'maj'), 0, ionian)).toEqual({
      status: 'outside',
      degreeIndex: null,
    });
  });

  it('judges a pentatonic key by its heptatonic parent', () => {
    // F is not in C major pentatonic, but IV is diatonic to C major.
    expect(classifyChord(buildChord(5, 'maj'), 0, majorPent)).toEqual({
      status: 'diatonic',
      degreeIndex: 3,
    });
    expect(classifyChord(buildChord(9, '7'), 0, majorPent)).toEqual({
      status: 'borrowed',
      degreeIndex: 5,
    });
    // F is not in A minor pentatonic, but bVI is diatonic to A natural minor.
    expect(classifyChord(buildChord(5, 'maj'), 9, minorPent)).toEqual({
      status: 'diatonic',
      degreeIndex: 5,
    });
  });

  it('does not assume the key of C', () => {
    const eb = 3;
    expectDiatonic(eb, ionian);
    expect(classifyChord(buildChord(8, 'min'), eb, ionian)).toEqual({
      status: 'borrowed',
      degreeIndex: 3,
    });
    expect(classifyChord(buildChord(1, 'maj'), eb, ionian)).toEqual({
      status: 'outside',
      degreeIndex: null,
    });
  });
});

describe('chordColorTitle', () => {
  it('lists outside tones spelled from the chord root', () => {
    expect(chordColorTitle(buildChord(9, '7'), 0, ionian)).toBe('VI7 \u2014 borrowed: C# outside C major');
    expect(chordColorTitle(buildChord(5, 'min'), 0, ionian)).toBe('iv \u2014 borrowed: Ab outside C major');
    expect(chordColorTitle(buildChord(10, 'maj'), 0, ionian)).toBe('bVII \u2014 outside: Bb outside C major');
    expect(chordColorTitle(buildChord(1, 'maj'), 0, ionian)).toBe('bII \u2014 outside: Db, Ab outside C major');
    expect(chordColorTitle(buildChord(0, 'maj'), 0, ionian)).toBe('I \u2014 diatonic');
  });

  it('names a non-C key from concert pitch', () => {
    expect(chordColorTitle(buildChord(8, 'min'), 3, ionian)).toBe('iv \u2014 borrowed: Cb outside Eb major');
    expect(chordColorTitle(buildChord(9, '7'), 0, majorPent)).toBe(
      'VI7 \u2014 borrowed: C# outside C major',
    );
  });
});
