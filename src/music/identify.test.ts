import { describe, expect, it } from 'vitest';
import { chordSymbol } from './chords';
import { identifyChord } from './identify';

describe('identifyChord', () => {
  it('names [0,4,7] as C major, exact, first', () => {
    const matches = identifyChord([0, 4, 7]);
    const first = matches[0];
    expect(first.match).toBe('exact');
    expect(first.chord.rootPc).toBe(0);
    expect(first.chord.quality).toBe('maj');
    expect(chordSymbol(first.chord)).toBe('C');
    expect(first.missing).toEqual([]);
    expect(first.inversion).toBe(false);
  });

  it('names [4,7,0] with bass 4 as C major in inversion', () => {
    const first = identifyChord([4, 7, 0], 4)[0];
    expect(first.match).toBe('exact');
    expect(first.chord.rootPc).toBe(0);
    expect(first.chord.quality).toBe('maj');
    expect(chordSymbol(first.chord)).toBe('C');
    expect(first.bassPc).toBe(4);
    expect(first.inversion).toBe(true);
  });

  it('includes C7 as a subset of [0,4,10] missing the fifth', () => {
    const match = identifyChord([0, 4, 10]).find(
      (m) => m.chord.rootPc === 0 && m.chord.quality === '7',
    );
    expect(match?.match).toBe('subset');
    expect(match?.missing).toEqual([7]);
    expect(chordSymbol(match!.chord)).toBe('C7');
  });

  it('includes exact dim7 on roots 0, 3, 6 and 9 for [0,3,6,9]', () => {
    const dim7s = identifyChord([0, 3, 6, 9]).filter(
      (m) => m.chord.quality === 'dim7' && m.match === 'exact',
    );
    expect(dim7s.map((m) => m.chord.rootPc).sort((a, b) => a - b)).toEqual([0, 3, 6, 9]);
  });

  it('names [0,4,7,11] as Cmaj7, exact, first', () => {
    const first = identifyChord([0, 4, 7, 11])[0];
    expect(first.match).toBe('exact');
    expect(first.chord.rootPc).toBe(0);
    expect(first.chord.quality).toBe('maj7');
    expect(chordSymbol(first.chord)).toBe('Cmaj7');
  });

  it('returns nothing for a single pitch class', () => {
    expect(identifyChord([0])).toEqual([]);
  });

  it('treats duplicates and values above 11 like the reduced set', () => {
    expect(identifyChord([12, 4, 7, 7])).toEqual(identifyChord([0, 4, 7]));
  });

  it('returns nothing when no catalog chord contains every input note', () => {
    expect(identifyChord([0, 1, 2])).toEqual([]);
  });
});
