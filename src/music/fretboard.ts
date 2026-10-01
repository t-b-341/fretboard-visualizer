// Computes the note grid for a tuning across a number of frets.

import { mod } from './notes';
import type { GuitarString } from './tunings';

export interface Cell {
  /** Index into the tuning array; 0 = lowest string. */
  stringIndex: number;
  /** 0 = open string. */
  fret: number;
  /** Pitch class at this position (0-11). */
  pc: number;
  /** MIDI note number (optional audio / ordering). */
  midi: number;
}

/** MIDI note number for an open string plus fret offset. */
export function midiOf(str: GuitarString, fret: number): number {
  return (str.octave + 1) * 12 + str.pc + fret;
}

/** Pitch class at a given string pitch class and fret. */
export function noteAt(stringPc: number, fret: number): number {
  return mod(stringPc + fret, 12);
}

/**
 * Build a grid of cells: one row per string (low -> high), each row holding
 * frets 0..fretCount inclusive (0 = open).
 */
export function buildGrid(tuning: GuitarString[], fretCount: number): Cell[][] {
  return tuning.map((str, stringIndex) => {
    const row: Cell[] = [];
    for (let fret = 0; fret <= fretCount; fret++) {
      row.push({
        stringIndex,
        fret,
        pc: noteAt(str.pc, fret),
        midi: midiOf(str, fret),
      });
    }
    return row;
  });
}
