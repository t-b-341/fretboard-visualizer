import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { getFamily } from './scales';
import { nameAfterShift, spellScale } from './spelling';

const ionian = getFamily('major').modes.find((mode) => mode.key === 'Ionian')!.intervals;

describe('nameAfterShift', () => {
  it('spells concert D major as Eb G Bb under Standard names', () => {
    const triad = [0, 4, 7];
    const asKey = triad.map((interval) => nameAfterShift(2 + interval, 1, 2, ionian, null));
    expect(asKey.join(' ')).toBe('Eb G Bb');
    expect(spellScale(3, ionian)?.map((tone) => tone.name).join(' ')).toBe('Eb F G Ab Bb C D');

    // Bb major shifted up is B major, which would spell these pitches D# and A#.
    const chord = buildChord(2, 'maj');
    const asChord = triad.map((interval) => nameAfterShift(2 + interval, 1, 10, ionian, chord));
    expect(asChord.join(' ')).toBe('Eb G Bb');
  });
});
