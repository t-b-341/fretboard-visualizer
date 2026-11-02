import { describe, expect, it } from 'vitest';
import { CHORD_QUALITIES, buildChord } from './chords';
import { buildGrid } from './fretboard';
import { candidateDetail, candidateLabel, identifyChord } from './identify';
import { defaultPresetForStrings, getPreset } from './tunings';
import { findVoicings } from './voicings';

function grip(tuningId: string, frets: [number, number][]) {
  const tuning = getPreset(tuningId)!.notes;
  const grid = buildGrid(tuning, 15);
  return frets.map(([stringIndex, fret]) => grid[stringIndex][fret]);
}

describe('identifyChord', () => {
  it('names an open C major', () => {
    // 7-standard strings 1–6 are E A D G B E. Low E muted: x32010.
    const top = identifyChord(grip('7-standard', [[2, 3], [3, 2], [4, 0], [5, 1], [6, 0]]))[0];
    expect(top.chord.quality).toBe('maj');
    expect(top.chord.rootPc).toBe(0);
    expect(top.inversion).toBe('root');
    expect(top.slashName).toBe('C');
    expect(candidateLabel(top)).toBe('C');
    expect(top.missing).toEqual([]);
    expect(top.extra).toEqual([]);
  });

  it('names an open A minor', () => {
    const top = identifyChord(grip('7-standard', [[2, 0], [3, 2], [4, 2], [5, 1], [6, 0]]))[0];
    expect(top.chord.quality).toBe('min');
    expect(top.chord.rootPc).toBe(9);
    expect(top.inversion).toBe('root');
    expect(top.slashName).toBe('Am');
    expect(candidateLabel(top)).toBe('Am');
  });

  it('names an open G7', () => {
    const top = identifyChord(grip('7-standard', [[1, 3], [2, 2], [3, 0], [4, 0], [5, 0], [6, 1]]))[0];
    expect(top.chord.quality).toBe('7');
    expect(top.chord.rootPc).toBe(7);
    expect(top.inversion).toBe('root');
    expect(top.slashName).toBe('G7');
    expect(candidateLabel(top)).toBe('G7');
  });

  it('names Cmaj7 drop-2 in each inversion', () => {
    const tuning = getPreset('7-standard')!.notes;
    const chord = buildChord(0, 'maj7');
    const expected: Record<string, { inversion: string; label: string }> = {
      root: { inversion: 'root', label: 'Cmaj7' },
      third: { inversion: '1st', label: 'Cmaj7/E (1st inversion)' },
      fifth: { inversion: '2nd', label: 'Cmaj7/G (2nd inversion)' },
      seventh: { inversion: '3rd', label: 'Cmaj7/B (3rd inversion)' },
    };

    for (let inversion = 0; inversion < 4; inversion++) {
      let placed = findVoicings(tuning, 24, chord, 'drop2', inversion, 0, 4)[0];
      for (let start = 1; start + 4 <= tuning.length && !placed; start++) {
        placed = findVoicings(tuning, 24, chord, 'drop2', inversion, start, 4)[0];
      }
      expect(placed, `drop-2 inversion ${inversion}`).toBeDefined();
      const bass = placed.reduce((lo, note) => (note.midi < lo.midi ? note : lo));
      const top = identifyChord(placed)[0];
      const want = expected[bass.role];
      expect(top.chord.quality).toBe('maj7');
      expect(top.chord.rootPc).toBe(0);
      expect(top.inversion).toBe(want.inversion);
      expect(candidateLabel(top)).toBe(want.label);
    }
  });

  it('ranks C6 above Am7/C when C is in the bass, and the reverse when A is', () => {
    const withC = identifyChord([
      { pc: 0, midi: 48 },
      { pc: 4, midi: 64 },
      { pc: 7, midi: 67 },
      { pc: 9, midi: 69 },
    ]);
    expect(withC.map((candidate) => candidate.slashName)).toEqual(expect.arrayContaining(['C6', 'Am7/C']));
    expect(withC[0].slashName).toBe('C6');
    expect(withC[0].inversion).toBe('root');
    const am = withC.find((candidate) => candidate.slashName === 'Am7/C');
    expect(am?.inversion).toBe('1st');
    expect(am?.score).toBe(withC[0].score);

    const withA = identifyChord([
      { pc: 9, midi: 45 },
      { pc: 0, midi: 60 },
      { pc: 4, midi: 64 },
      { pc: 7, midi: 67 },
    ]);
    expect(withA.map((candidate) => candidate.slashName)).toEqual(expect.arrayContaining(['Am7', 'C6/A']));
    expect(withA[0].slashName).toBe('Am7');
    expect(withA[0].inversion).toBe('root');
  });

  it('names a 1–3–b7 shell as a dominant 7 with no 5', () => {
    const matches = identifyChord([
      { pc: 0, midi: 48 },
      { pc: 4, midi: 52 },
      { pc: 10, midi: 58 },
    ]);
    expect(matches.length).toBeLessThanOrEqual(3);
    expect(matches.length).toBeGreaterThan(0);
    const top = matches[0];
    expect(top.chord.quality).toBe('7');
    expect(top.chord.rootPc).toBe(0);
    expect(top.slashName).toBe('C7');
    expect(top.missing).toEqual(['5']);
    expect(candidateDetail(top)).toBe('no 5');
  });

  it('names a perfect fifth only when the catalog has a power chord', () => {
    const power = CHORD_QUALITIES.find((quality) => {
      const degrees = quality.tones.map(([, degree]) => degree);
      return degrees.length === 2 && degrees.includes('1') && degrees.includes('5');
    });
    const matches = identifyChord([
      { pc: 0, midi: 48 },
      { pc: 7, midi: 55 },
    ]);
    if (power) {
      expect(matches[0]?.chord.quality).toBe(power.key);
    } else {
      expect(matches).toEqual([]);
    }
  });

  it('names the cowboy C shape as B on the default half-step-down tuning', () => {
    const tuning = defaultPresetForStrings(7);
    expect(tuning.id).toBe('7-half-down');
    const notes = grip(tuning.id, [[2, 3], [3, 2], [4, 0], [5, 1], [6, 0]]);
    const top = identifyChord(notes)[0];
    expect(top.chord.quality).toBe('maj');
    expect(top.chord.rootPc).toBe(11);
    expect(top.slashName).toBe('B');
    expect(candidateLabel(top)).toBe('B');
    // Standard labels read the same frets a half step higher.
    expect(candidateLabel(top, 1)).toBe('C');
  });

  it('names E–G–C with E in the bass as C/E in first inversion', () => {
    const top = identifyChord([
      { pc: 4, midi: 40 },
      { pc: 7, midi: 55 },
      { pc: 0, midi: 60 },
    ])[0];
    expect(top.slashName).toBe('C/E');
    expect(top.inversion).toBe('1st');
    expect(candidateLabel(top)).toBe('C/E (1st inversion)');
    expect(candidateLabel(top, 1)).toBe('Db/F (1st inversion)');
  });

  it('returns nothing for fewer than two distinct pitch classes', () => {
    expect(identifyChord([])).toEqual([]);
    expect(identifyChord([{ pc: 0, midi: 60 }])).toEqual([]);
    expect(identifyChord([
      { pc: 0, midi: 48 },
      { pc: 12, midi: 60 },
    ])).toEqual([]);
  });
});
