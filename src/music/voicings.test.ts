import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { getPreset } from './tunings';
import { generateVoicings, type Voicing } from './voicings';

const standard7 = getPreset('7-standard')!.notes;
const halfDown7 = getPreset('7-half-down')!.notes;
const halfDown8 = getPreset('8-half-down')!.notes;

const C_MAJOR_PCS = [0, 4, 7];

function assertMidiSorted(voicing: Voicing): void {
  for (let i = 1; i < voicing.notes.length; i++) {
    expect(voicing.notes[i].midi).toBeGreaterThanOrEqual(voicing.notes[i - 1].midi);
  }
}

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
