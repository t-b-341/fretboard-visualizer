// A note on the staff: letter, accidental, and written octave.
//
// The octave comes from the letter, not from the MIDI number. Cb4 and B3 are
// the same key (MIDI 59) and sit on different lines. staffStep counts those
// lines and spaces, so two spellings of one pitch can be a step apart.

import type { Chord } from './chords';
import { mod, noteName } from './notes';
import {
  LETTERS,
  NATURAL,
  accidentalGlyph,
  nearestAccidental,
  pitchSpelling,
  spellChordTone,
  spellScale,
} from './spelling';

export interface WrittenNote {
  /** C=0, D=1, E=2, F=3, G=4, A=5, B=6. */
  letter: number;
  /** Negative is flat. Ordinary keys stay in -2..+2. */
  accidental: number;
  /** Written octave in scientific numbering. MIDI 60 as C is octave 4. */
  octave: number;
  midi: number;
  /** e.g. "Cb4", "F#3", "Bbb2". */
  name: string;
  /** letter + 7 * octave. One step is one line or space. */
  staffStep: number;
}

export interface ParsedNoteName {
  letter: number;
  accidental: number;
  /** Set when the name included a scientific octave, as in "Cb4". */
  octave?: number;
}

const NOTE_NAME = /^([A-Ga-g])((?:#+|b+))?(-?\d+)?$/;

/** Letter and accidental of a name such as "Eb", "F#3", or "Bbb2". */
export function parseNoteName(name: string): ParsedNoteName {
  const match = NOTE_NAME.exec(name.trim());
  if (!match) throw new Error(`Invalid note name: ${name}`);
  const letter = LETTERS.indexOf(match[1].toUpperCase());
  if (letter < 0) throw new Error(`Invalid note name: ${name}`);
  const token = match[2] ?? '';
  const accidental = token.startsWith('b') ? -token.length : token.length;
  const parsed: ParsedNoteName = { letter, accidental };
  if (match[3] !== undefined) parsed.octave = Number(match[3]);
  return parsed;
}

/** Inverse of parseNoteName. Includes the octave only when one is present. */
export function formatNoteName(note: {
  letter: number;
  accidental: number;
  octave?: number;
}): string {
  const letterName = LETTERS[note.letter];
  if (letterName === undefined) throw new Error(`Invalid letter: ${note.letter}`);
  const body = `${letterName}${accidentalGlyph(note.accidental)}`;
  return note.octave === undefined ? body : `${body}${note.octave}`;
}

function spellingOf(
  value: { letter: number; accidental: number } | string,
): { letter: number; accidental: number } {
  return typeof value === 'string' ? parseNoteName(value) : value;
}

/** True when both spellings are the same pitch class. Octave is ignored. */
export function enharmonicEqual(
  a: { letter: number; accidental: number } | string,
  b: { letter: number; accidental: number } | string,
): boolean {
  const left = spellingOf(a);
  const right = spellingOf(b);
  return mod(NATURAL[left.letter] + left.accidental, 12) === mod(NATURAL[right.letter] + right.accidental, 12);
}

/**
 * Place `midi` on `letter` with `accidental`.
 *
 * Octave is (midi - accidental - NATURAL[letter]) / 12 - 1. Throws when that
 * is not an integer: the letter and the MIDI note are not the same pitch.
 */
export function writeMidi(midi: number, letter: number, accidental: number): WrittenNote {
  if (!Number.isInteger(letter) || letter < 0 || letter > 6) {
    throw new Error(`Invalid letter: ${letter}`);
  }
  if (!Number.isInteger(midi) || !Number.isInteger(accidental)) {
    throw new Error(`Letter and midi disagree: midi ${midi}, letter ${letter}, accidental ${accidental}`);
  }
  const octave = (midi - accidental - NATURAL[letter]) / 12 - 1;
  if (!Number.isInteger(octave)) {
    throw new Error(`Letter and midi disagree: midi ${midi}, letter ${letter}, accidental ${accidental}`);
  }
  const note: WrittenNote = {
    letter,
    accidental,
    octave,
    midi,
    name: formatNoteName({ letter, accidental, octave }),
    staffStep: letter + 7 * octave,
  };
  return note;
}

function fallbackSpelling(pc: number, preferFlats: boolean): { letter: number; accidental: number } {
  return parseNoteName(preferFlats ? noteName(pc, true) : pitchSpelling(pc));
}

/**
 * Letter and accidental of one scale tone.
 *
 * Heptatonic tones come from spellScale(), one letter per degree. preferFlats
 * respells the F#/Gb tie as Gb, and every degree follows that tonic letter.
 * Returns null when the pitch is outside the scale or the scale is not heptatonic.
 */
function scaleSpelling(
  rootPc: number,
  intervals: number[],
  pc: number,
  preferFlats: boolean,
): { letter: number; accidental: number } | null {
  const tones = spellScale(rootPc, intervals);
  if (!tones) return null;
  const index = tones.findIndex((tone) => tone.pc === pc);
  if (index < 0) return null;

  const preferred = fallbackSpelling(mod(rootPc, 12), preferFlats);
  const tonic = parseNoteName(tones[0].name);
  if (preferred.letter === tonic.letter && preferred.accidental === tonic.accidental) {
    return parseNoteName(tones[index].name);
  }

  const letter = (preferred.letter + index) % 7;
  return { letter, accidental: nearestAccidental(pc, NATURAL[letter]) };
}

/**
 * Spell a MIDI note in a scale.
 *
 * Scale tones use spellScale(). Notes outside the scale, and every note of a
 * non-heptatonic scale, fall back to pitchSpelling(). preferFlats uses the
 * flat name instead (Gb rather than F#), including Gb major against F# major.
 */
export function spellMidiInScale(
  midi: number,
  rootPc: number,
  intervals: number[],
  preferFlats = false,
): WrittenNote {
  const pc = mod(midi, 12);
  const spelled = scaleSpelling(rootPc, intervals, pc, preferFlats) ?? fallbackSpelling(pc, preferFlats);
  return writeMidi(midi, spelled.letter, spelled.accidental);
}

/**
 * Spell a MIDI note from a chord tone's degree, the same letters as spellChordTone().
 * A pitch that is not in the chord uses the major-tonic spelling.
 */
export function spellMidiInChord(midi: number, chord: Chord): WrittenNote {
  const pc = mod(midi, 12);
  const tone = chord.tones.find((item) => mod(chord.rootPc + item.interval, 12) === pc);
  const spelled = tone
    ? parseNoteName(spellChordTone(chord.rootPc, tone.interval, tone.degree))
    : fallbackSpelling(pc, false);
  return writeMidi(midi, spelled.letter, spelled.accidental);
}
