import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { mod } from './notes';
import { getPreset } from './tunings';
import { findVoicings, generateVoicings, toVoicing, type Voicing } from './voicings';

const standard7 = getPreset('7-standard')!.notes;
const halfDown7 = getPreset('7-half-down')!.notes;
const halfDown8 = getPreset('8-half-down')!.notes;

const C_MAJOR_PCS = [0, 4, 7];

function assertMidiSorted(voicing: Voicing): void {
  for (let i = 1; i < voicing.notes.length; i++) {
    expect(voicing.notes[i].midi).toBeGreaterThanOrEqual(voicing.notes[i - 1].midi);
  }
}

describe('findVoicings', () => {
  it('labels Cmaj7 drop-2 notes with the chord roles on 7-standard', () => {
    const chord = buildChord(0, 'maj7');
    const byPc = new Map(
      chord.tones.map((tone) => [mod(chord.rootPc + tone.interval, 12), tone]),
    );
    const grips = findVoicings(standard7, 12, chord, 'drop2', 0, 1, 4);
    const grip = grips.find((notes) => notes.map((n) => n.fret).join(',') === '8,10,9,9');
    expect(grip?.map((n) => n.role)).toEqual(['root', 'fifth', 'seventh', 'third']);
    expect(grip?.map((n) => n.degree)).toEqual(['1', '5', '7', '3']);

    const all = [];
    for (let inversion = 0; inversion < 4; inversion++) {
      for (let start = 0; start + 4 <= standard7.length; start++) {
        all.push(...findVoicings(standard7, 12, chord, 'drop2', inversion, start, 4));
      }
    }
    expect(all.length).toBeGreaterThan(0);
    for (const notes of all) {
      for (const sounded of notes) {
        const tone = byPc.get(sounded.pc);
        expect(tone).toBeDefined();
        expect(sounded.role).toBe(tone?.role);
        expect(sounded.degree).toBe(tone?.degree);
      }
    }
  });
});

describe('toVoicing', () => {
  it('computes minFret and span from fretted notes, with and without open strings', () => {
    const closed = toVoicing(
      [
        { stringIndex: 4, fret: 7, midi: 62, pc: 2 },
        { stringIndex: 2, fret: 3, midi: 48, pc: 0 },
        { stringIndex: 3, fret: 5, midi: 55, pc: 7 },
      ],
      7,
    );
    expect(closed.frets).toEqual([null, null, 3, 5, 7, null, null]);
    expect(closed.notes.map((n) => n.midi)).toEqual([48, 55, 62]);
    expect(closed.minFret).toBe(3);
    expect(closed.maxFret).toBe(7);
    expect(closed.span).toBe(4);

    const withOpen = toVoicing(
      [
        { stringIndex: 5, fret: 8, midi: 67, pc: 7 },
        { stringIndex: 1, fret: 0, midi: 40, pc: 4 },
        { stringIndex: 3, fret: 5, midi: 55, pc: 7 },
      ],
      7,
    );
    expect(withOpen.frets).toEqual([null, 0, null, 5, null, 8, null]);
    expect(withOpen.notes.map((n) => n.fret)).toEqual([0, 5, 8]);
    expect(withOpen.minFret).toBe(5);
    expect(withOpen.maxFret).toBe(8);
    expect(withOpen.span).toBe(3);

    const allOpen = toVoicing(
      [
        { stringIndex: 4, fret: 0, midi: 55, pc: 7 },
        { stringIndex: 1, fret: 0, midi: 40, pc: 4 },
      ],
      7,
    );
    expect(allOpen.minFret).toBe(0);
    expect(allOpen.maxFret).toBe(0);
    expect(allOpen.span).toBe(0);
    expect(allOpen.notes.map((n) => n.stringIndex)).toEqual([1, 4]);
  });
});

describe('generateVoicings', () => {
  it('returns C major voicings whose pitch classes are the triad', () => {
    const chord = buildChord(0, 'maj');
    for (const tuning of [standard7, halfDown7]) {
      const voicings = generateVoicings(chord, tuning);
      expect(voicings.length).toBeGreaterThan(0);
      for (const voicing of voicings) {
        expect(voicing.frets).toHaveLength(tuning.length);
        assertMidiSorted(voicing);
        for (const note of voicing.notes) {
          expect(C_MAJOR_PCS).toContain(note.pc);
        }
      }
    }
  });

  it('keeps every span inside maxSpan 3 and 4', () => {
    const chord = buildChord(0, 'maj');
    for (const maxSpan of [3, 4]) {
      const voicings = generateVoicings(chord, standard7, { maxSpan });
      expect(voicings.length).toBeGreaterThan(0);
      for (const voicing of voicings) {
        expect(voicing.span).toBeLessThanOrEqual(maxSpan);
      }
    }
  });

  it('puts a third and a seventh in every Cmaj7 voicing', () => {
    const chord = buildChord(0, 'maj7');
    const voicings = generateVoicings(chord, halfDown7);
    expect(voicings.length).toBeGreaterThan(0);
    for (const voicing of voicings) {
      const roles = voicing.notes.map((note) => note.role);
      expect(roles).toContain('third');
      expect(roles).toContain('seventh');
    }
  });

  it('stays inside fretRange when open strings are off', () => {
    const chord = buildChord(0, 'maj');
    const voicings = generateVoicings(chord, standard7, {
      fretRange: [5, 9],
      allowOpen: false,
    });
    expect(voicings.length).toBeGreaterThan(0);
    for (const voicing of voicings) {
      expect(voicing.frets).toHaveLength(standard7.length);
      for (const fret of voicing.frets) {
        if (fret !== null) {
          expect(fret).toBeGreaterThanOrEqual(5);
          expect(fret).toBeLessThanOrEqual(9);
        }
      }
    }
  });

  it('matches tuning length and sorts sounding notes by midi', () => {
    const chord = buildChord(0, 'maj');
    for (const tuning of [standard7, halfDown7]) {
      for (const voicing of generateVoicings(chord, tuning)) {
        expect(voicing.frets).toHaveLength(tuning.length);
        expect(voicing.notes.length).toBe(voicing.frets.filter((fret) => fret !== null).length);
        assertMidiSorted(voicing);
      }
    }
  });

  it('finishes C13 on 8-half-down under 5000 results and 500ms', () => {
    const chord = buildChord(0, '13');
    const started = performance.now();
    const voicings = generateVoicings(chord, halfDown8);
    const elapsed = performance.now() - started;
    expect(voicings.length).toBeLessThan(5000);
    expect(elapsed).toBeLessThan(500);
  });
});
