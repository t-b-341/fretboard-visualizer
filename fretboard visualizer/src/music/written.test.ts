import { describe, expect, it } from 'vitest';
import { buildChord, CHORD_QUALITIES } from './chords';
import { midiOf } from './fretboard';
import { mod } from './notes';
import { getFamily } from './scales';
import { NATURAL, spellChordTone, spellScale } from './spelling';
import { defaultPresetForStrings } from './tunings';
import {
  enharmonicEqual,
  formatNoteName,
  parseNoteName,
  spellMidiInChord,
  spellMidiInScale,
  writeMidi,
  type WrittenNote,
} from './written';

const major = getFamily('major').modes.find((mode) => mode.key === 'Ionian')!.intervals;
const harmonicMinor = getFamily('harmonicMinor').modes.find((mode) => mode.key === 'HarmonicMinor')!.intervals;

function sounded(note: WrittenNote): number {
  return NATURAL[note.letter] + note.accidental + (note.octave + 1) * 12;
}

describe('writeMidi', () => {
  it('keeps the written octave when the accidental crosses the MIDI octave', () => {
    expect(writeMidi(59, 0, -1)).toMatchObject({ name: 'Cb4', octave: 4, midi: 59, letter: 0, accidental: -1 });
    expect(writeMidi(60, 6, 1)).toMatchObject({ name: 'B#3', octave: 3, midi: 60, letter: 6, accidental: 1 });
    expect(writeMidi(65, 2, 1)).toMatchObject({ name: 'E#4', octave: 4, midi: 65, letter: 2, accidental: 1 });
    expect(writeMidi(64, 3, -1)).toMatchObject({ name: 'Fb4', octave: 4, midi: 64, letter: 3, accidental: -1 });
    expect(writeMidi(0, 0, 0).name).toBe('C-1');
  });

  it('throws when the letter cannot spell that MIDI note', () => {
    expect(() => writeMidi(60, 0, 1)).toThrow(/disagree/);
  });
});

describe('staffStep', () => {
  it('counts lines and spaces, and ignores the accidental', () => {
    const e4 = writeMidi(64, 2, 0);
    const f4 = writeMidi(65, 3, 0);
    const b3 = writeMidi(59, 6, 0);
    const c4 = writeMidi(60, 0, 0);
    const cb4 = writeMidi(59, 0, -1);

    expect(e4.staffStep).toBe(2 + 7 * 4);
    expect(f4.staffStep - e4.staffStep).toBe(1);
    expect(b3.staffStep).toBe(6 + 7 * 3);
    expect(c4.staffStep - b3.staffStep).toBe(1);
    expect(cb4.staffStep).toBe(c4.staffStep);
    expect(enharmonicEqual(cb4, b3)).toBe(true);
    expect(enharmonicEqual(cb4, c4)).toBe(false);
  });
});

describe('spellMidiInScale', () => {
  it('spells Gb major with Cb and F# major with E#', () => {
    expect(spellScale(6, major)?.map((tone) => tone.name)).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);

    expect(spellMidiInScale(59, 6, major).name).toBe('B3');
    expect(spellMidiInScale(65, 6, major).name).toBe('E#4');
    expect(spellMidiInScale(59, 6, major, true).name).toBe('Cb4');
    expect(spellMidiInScale(65, 6, major, true).name).toBe('F4');

    const names = (preferFlats: boolean) =>
      major.map((interval) => {
        const pc = mod(6 + interval, 12);
        const note = spellMidiInScale(60 + pc, 6, major, preferFlats);
        return formatNoteName({ letter: note.letter, accidental: note.accidental });
      });
    expect(names(false)).toEqual(['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#']);
    expect(names(true)).toEqual(['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F']);
  });

  it('spells the raised 7th of D harmonic minor as C#', () => {
    expect(spellScale(2, harmonicMinor)?.map((tone) => tone.name)).toEqual(['D', 'E', 'F', 'G', 'A', 'Bb', 'C#']);
    expect(spellMidiInScale(61, 2, harmonicMinor)).toMatchObject({
      name: 'C#4',
      letter: 0,
      accidental: 1,
      octave: 4,
      midi: 61,
    });
  });

  it('falls back to the major-tonic spelling outside a heptatonic scale', () => {
    expect(spellMidiInScale(66, 0, major).name).toBe('F#4');
    expect(spellMidiInScale(66, 0, major, true).name).toBe('Gb4');
    const blues = [0, 3, 5, 6, 7, 10];
    expect(spellMidiInScale(66, 0, blues).name).toBe('F#4');
    expect(spellMidiInScale(66, 0, blues, true).name).toBe('Gb4');
    expect(spellMidiInScale(64, 0, [0, 2, 4, 7, 9]).name).toBe('E4');
  });

  it('spells the default low string Bb1 on MIDI 34', () => {
    const low = defaultPresetForStrings(7).notes[0];
    const midi = midiOf(low, 0);
    expect(midi).toBe(34);
    const note = spellMidiInScale(midi, low.pc, major);
    expect(note).toMatchObject({
      letter: 6,
      accidental: -1,
      octave: 1,
      midi: 34,
      name: 'Bb1',
      staffStep: 13,
    });
    expect(note.staffStep - writeMidi(33, 5, 0).staffStep).toBe(1);
    expect(writeMidi(36, 0, 0).staffStep - note.staffStep).toBe(1);
  });

  it('round-trips every MIDI 21–108 in every major and harmonic-minor key', () => {
    const keys = [
      { name: 'major', intervals: major },
      { name: 'harmonic minor', intervals: harmonicMinor },
    ];
    const failures: string[] = [];
    for (const key of keys) {
      for (let root = 0; root < 12; root++) {
        for (const preferFlats of [false, true]) {
          for (let midi = 21; midi <= 108; midi++) {
            const label = `${key.name} root ${root} preferFlats=${preferFlats} midi ${midi}`;
            let note: WrittenNote;
            try {
              note = spellMidiInScale(midi, root, key.intervals, preferFlats);
            } catch (error) {
              failures.push(`${label} threw ${error}`);
              continue;
            }
            const parsed = parseNoteName(note.name);
            const problems = [
              note.midi !== midi ? `midi field ${note.midi}` : '',
              sounded(note) !== midi ? `sounds as ${sounded(note)}` : '',
              note.staffStep !== note.letter + 7 * note.octave ? `staffStep ${note.staffStep}` : '',
              note.accidental < -2 || note.accidental > 2 ? `accidental ${note.accidental}` : '',
              parsed.letter !== note.letter || parsed.accidental !== note.accidental || parsed.octave !== note.octave
                ? `name ${note.name}`
                : '',
              note.name !== formatNoteName(note) ? `format ${formatNoteName(note)}` : '',
            ].filter(Boolean);
            if (problems.length) failures.push(`${label} ${note.name}: ${problems.join(', ')}`);
          }
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([]);
  });
});

describe('parseNoteName', () => {
  it('reads a letter and accidental, and formats them back', () => {
    expect(parseNoteName('Eb')).toEqual({ letter: 2, accidental: -1 });
    expect(parseNoteName('F#3')).toEqual({ letter: 3, accidental: 1, octave: 3 });
    expect(parseNoteName('Bbb2')).toEqual({ letter: 6, accidental: -2, octave: 2 });
    expect(parseNoteName('C-1')).toEqual({ letter: 0, accidental: 0, octave: -1 });
    expect(formatNoteName(parseNoteName('Eb'))).toBe('Eb');
    expect(formatNoteName(parseNoteName('F#3'))).toBe('F#3');
    expect(formatNoteName(parseNoteName('Bbb2'))).toBe('Bbb2');
    expect(formatNoteName(parseNoteName('C-1'))).toBe('C-1');
    expect(() => parseNoteName('H')).toThrow(/Invalid note name/);
    expect(() => parseNoteName('C#b')).toThrow(/Invalid note name/);
  });

  it('treats enharmonic spellings as the same pitch class', () => {
    expect(enharmonicEqual('Cb4', 'B3')).toBe(true);
    expect(enharmonicEqual('E#4', 'F4')).toBe(true);
    expect(enharmonicEqual('F#', 'Gb')).toBe(true);
    expect(enharmonicEqual('C4', 'C5')).toBe(true);
    expect(enharmonicEqual('C', 'C#')).toBe(false);
    expect(enharmonicEqual(writeMidi(59, 0, -1), writeMidi(59, 6, 0))).toBe(true);
  });
});

describe('spellMidiInChord', () => {
  it('uses the chord tone degree for the letter', () => {
    expect(spellMidiInChord(63, buildChord(0, '7s9')).name).toBe('D#4');
    expect(spellMidiInChord(57, buildChord(0, 'dim7')).name).toBe('Bbb3');
    expect(spellMidiInChord(52, buildChord(0, 'maj')).name).toBe('E3');
    expect(spellMidiInChord(61, buildChord(0, 'maj')).name).toBe('Db4');

    const sharp = buildChord(6, 'maj');
    expect(spellMidiInChord(66, sharp).name).toBe('F#4');
    expect(spellMidiInChord(70, sharp).name).toBe('A#4');
    expect(spellMidiInChord(61, sharp).name).toBe('C#4');
  });

  it('round-trips every catalog chord tone', () => {
    const failures: string[] = [];
    for (const quality of CHORD_QUALITIES) {
      for (let root = 0; root < 12; root++) {
        const chord = buildChord(root, quality.key);
        for (const tone of chord.tones) {
          const pc = mod(root + tone.interval, 12);
          const first = chord.tones.find((item) => mod(root + item.interval, 12) === pc);
          if (first !== tone) continue;
          const midi = 60 + pc;
          const label = `${root} ${quality.key} ${tone.degree} midi ${midi}`;
          const note = spellMidiInChord(midi, chord);
          const bare = formatNoteName({ letter: note.letter, accidental: note.accidental });
          const problems = [
            bare !== spellChordTone(root, tone.interval, tone.degree) ? `spelled ${bare}` : '',
            note.midi !== midi ? `midi field ${note.midi}` : '',
            sounded(note) !== midi ? `sounds as ${sounded(note)}` : '',
          ].filter(Boolean);
          if (problems.length) failures.push(`${label}: ${problems.join(', ')}`);
        }
      }
    }
    expect(failures.slice(0, 8)).toEqual([]);
  });
});
