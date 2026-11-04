import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { defaultPresetForStrings } from './tunings';
import { voicingPlacement, voicingsFor } from './voicingSet';

const tuning = defaultPresetForStrings(7).notes;
const cm7 = buildChord(0, 'm7');
const STRINGS_3_TO_6 = 2;

function pitchClasses(notes: { pc: number }[]): number[] {
  return [...new Set(notes.map((note) => note.pc))].sort((a, b) => a - b);
}

function lowestFret(notes: { fret: number }[]): number {
  return Math.min(...notes.map((note) => note.fret));
}

function bassMidi(notes: { midi: number }[]): number {
  return Math.min(...notes.map((note) => note.midi));
}

describe('voicingsFor', () => {
  it('returns every Cm7 drop-2 on strings 3–6 of the default 7-string', () => {
    const voicings = voicingsFor(cm7, tuning, { shape: 'drop2', stringSet: STRINGS_3_TO_6 });
    expect(voicings.length).toBeGreaterThan(1);
    for (const voicing of voicings) {
      expect(voicing.notes).toHaveLength(4);
      expect(pitchClasses(voicing.notes)).toEqual([0, 3, 7, 10]);
      for (const note of voicing.notes) {
        expect(note.stringIndex).toBeGreaterThanOrEqual(2);
        expect(note.stringIndex).toBeLessThanOrEqual(5);
        expect(note).toEqual(expect.objectContaining({ fret: expect.any(Number), midi: expect.any(Number), role: expect.any(String) }));
      }
    }
    for (let index = 1; index < voicings.length; index++) {
      const prev = voicings[index - 1].notes;
      const next = voicings[index].notes;
      const fret = lowestFret(prev) - lowestFret(next);
      expect(fret < 0 || (fret === 0 && bassMidi(prev) <= bassMidi(next))).toBe(true);
    }
  });

  it('keeps only voicings inside fretRange', () => {
    const all = voicingsFor(cm7, tuning, { shape: 'drop2', stringSet: STRINGS_3_TO_6 });
    const range = { min: 5, max: 12 };
    const limited = voicingsFor(cm7, tuning, { shape: 'drop2', stringSet: STRINGS_3_TO_6, fretRange: range });
    const expected = all.filter((voicing) => voicing.notes.every((note) => note.fret >= 5 && note.fret <= 12));
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(all.length);
    expect(limited).toEqual(expected);
  });

  it('plays a triad as close when drop-2 is asked for', () => {
    const triad = buildChord(0, 'maj');
    expect(voicingPlacement(triad, 'drop2')).toEqual({ style: 'close', width: 3, fellBack: true });
    const dropped = voicingsFor(triad, tuning, { shape: 'drop2', stringSet: STRINGS_3_TO_6 });
    const close = voicingsFor(triad, tuning, { shape: 'close', stringSet: STRINGS_3_TO_6 });
    expect(dropped.length).toBeGreaterThan(0);
    expect(dropped).toEqual(close);
    expect(dropped.every((voicing) => voicing.notes.length === 3)).toBe(true);
  });

  it('keeps slash voicings with that bass, and keeps all of them when none match', () => {
    const all = voicingsFor(cm7, tuning, { shape: 'drop2', stringSet: STRINGS_3_TO_6 });
    const eb = voicingsFor(cm7, tuning, { shape: 'drop2', stringSet: STRINGS_3_TO_6, bassPc: 3 });
    expect(eb.length).toBeGreaterThan(0);
    expect(eb.length).toBeLessThan(all.length);
    for (const voicing of eb) {
      const bass = [...voicing.notes].sort((a, b) => a.midi - b.midi)[0];
      expect(bass.pc).toBe(3);
    }
    const missing = voicingsFor(cm7, tuning, { shape: 'drop2', stringSet: STRINGS_3_TO_6, bassPc: 1 });
    expect(missing).toEqual(all);
  });

  it('returns no voicing for all tones', () => {
    expect(voicingsFor(cm7, tuning, { shape: 'all', stringSet: STRINGS_3_TO_6 })).toEqual([]);
  });
});
