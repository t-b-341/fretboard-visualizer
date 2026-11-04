import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES, buildChord } from './chords';
import { chordWrittenNotes } from './staff';
import { mod } from './notes';
import { parseChordSymbol, placeBassLowest } from './parseChord';

const ALIASES: [string, string, number?][] = [
  ['Cm7', 'm7'],
  ['C-7', 'm7'],
  ['Cmin7', 'm7'],
  ['Cmaj7', 'maj7'],
  ['CΔ', 'maj7'],
  ['CM7', 'maj7'],
  ['Cdim', 'dim'],
  ['C°', 'dim'],
  ['Cø7', 'm7b5'],
  ['Cm7b5', 'm7b5'],
  ['Caug', 'aug'],
  ['C+', 'aug'],
  ['Csus2', 'sus2'],
  ['Csus4', 'sus4'],
  ['C7sus4', '7sus4'],
  ['C6', '6'],
  ['C9', '9'],
  ['Cadd9', 'add9'],
];

describe('parseChordSymbol', () => {
  it('reads every catalog symbol from C', () => {
    for (const def of CHORD_QUALITIES) {
      expect(parseChordSymbol(`C${def.symbol}`)?.quality, def.symbol || 'major').toBe(def.key);
    }
  });

  it('reads the common aliases', () => {
    for (const [text, quality] of ALIASES) {
      expect(parseChordSymbol(text), text).toMatchObject({ rootPc: 0, quality });
    }
  });

  it('reads a slash bass and sharp or flat roots', () => {
    expect(parseChordSymbol('Eb/G')).toEqual({ rootPc: 3, quality: 'maj', bassPc: 7 });
    expect(parseChordSymbol('E♭/G')).toEqual({ rootPc: 3, quality: 'maj', bassPc: 7 });
    expect(parseChordSymbol('F#m7')).toMatchObject({ rootPc: 6, quality: 'm7' });
    expect(parseChordSymbol('Bbmaj7')).toMatchObject({ rootPc: 10, quality: 'maj7' });
    expect(parseChordSymbol('C6/9')?.quality).toBe('69');
    expect(parseChordSymbol('C6/9')?.bassPc).toBeUndefined();
    expect(parseChordSymbol('Cm7/Bb')).toEqual({ rootPc: 0, quality: 'm7', bassPc: 10 });
  });

  it('rejects junk', () => {
    expect(parseChordSymbol('H7')).toBeNull();
    expect(parseChordSymbol('')).toBeNull();
    expect(parseChordSymbol('   ')).toBeNull();
    expect(parseChordSymbol('C/')).toBeNull();
    expect(parseChordSymbol('C/H')).toBeNull();
  });
});

describe('placeBassLowest', () => {
  it('drops the slash bass below the rest of the chord', () => {
    const placed = placeBassLowest(buildChord(3, 'maj'), 7);
    const notes = chordWrittenNotes(placed);
    expect(mod(notes[0].midi, 12)).toBe(7);
    expect(notes[0].midi).toBeLessThan(notes[1].midi);
  });

  it('leaves a chord alone when there is no slash bass', () => {
    const chord = buildChord(0, 'maj');
    expect(placeBassLowest(chord)).toBe(chord);
    expect(placeBassLowest(chord, 0)).toBe(chord);
  });
});
