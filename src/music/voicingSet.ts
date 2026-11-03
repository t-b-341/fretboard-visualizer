// One list of voicings for a chord. Close and drop-2 come from findVoicings
// on a single string set; "all tones" is not a voicing.

import type { Chord } from './chords';
import { mod } from './notes';
import type { GuitarString } from './tunings';
import { findVoicings, toVoicing, type VoicedNote, type Voicing } from './voicings';

/** Highest fret findVoicings is asked to search when no window is given. */
const NECK_FRETS = 24;

export type VoicingShape = 'all' | 'close' | 'drop2';

export interface VoicingQuery {
  shape: VoicingShape;
  /** Index of the lowest string in the set. 0 is the lowest string on the instrument. */
  stringSet: number;
  /** Inclusive fret window. Every note of a voicing must sit inside it. */
  fretRange?: { min: number; max: number };
  /**
   * Slash bass. Keep voicings whose lowest note is this pitch class.
   * When none are, the unfiltered list is returned.
   */
  bassPc?: number;
}

export interface VoicingPlacement {
  style: 'close' | 'drop2';
  width: number;
  /** Drop-2 was asked for, and the chord does not have four distinct notes. */
  fellBack: boolean;
}

function toneCount(chord: Chord): number {
  return new Set(chord.pcs).size;
}

/** How this shape is actually played. Drop-2 on a triad becomes close. */
export function voicingPlacement(chord: Chord, shape: VoicingShape): VoicingPlacement {
  const tones = toneCount(chord);
  if (shape === 'drop2' && tones >= 4) return { style: 'drop2', width: 4, fellBack: false };
  if (shape === 'drop2') {
    return { style: 'close', width: Math.min(3, Math.max(tones, 1)), fellBack: true };
  }
  return { style: 'close', width: tones >= 4 ? 4 : Math.max(1, Math.min(3, tones)), fellBack: false };
}

function lowestFret(notes: readonly VoicedNote[]): number {
  let min = notes[0]?.fret ?? 0;
  for (const note of notes) if (note.fret < min) min = note.fret;
  return min;
}

function bassNote(notes: readonly VoicedNote[]): VoicedNote | null {
  let bass: VoicedNote | null = null;
  for (const note of notes) {
    if (!bass || note.midi < bass.midi || (note.midi === bass.midi && note.stringIndex < bass.stringIndex)) {
      bass = note;
    }
  }
  return bass;
}

function inRange(notes: readonly VoicedNote[], range: { min: number; max: number }): boolean {
  const lo = Math.min(range.min, range.max);
  const hi = Math.max(range.min, range.max);
  return notes.every((note) => note.fret >= lo && note.fret <= hi);
}

/**
 * Every voicing of `chord` for this shape and string set, lowest fret first,
 * then lowest bass note. Shape `all` is every chord tone, so the list is empty.
 */
export function voicingsFor(
  chord: Chord,
  tuning: readonly GuitarString[],
  query: VoicingQuery,
): Voicing[] {
  if (query.shape === 'all') return [];
  const placement = voicingPlacement(chord, query.shape);
  const { style, width } = placement;
  if (width <= 0 || tuning.length < width) return [];
  const strings = tuning.slice();
  const start = Math.max(0, Math.min(query.stringSet, strings.length - width));
  const fretCount = Math.max(NECK_FRETS, query.fretRange ? Math.max(query.fretRange.min, query.fretRange.max) : 0);

  const seen = new Set<string>();
  const found: Voicing[] = [];
  for (let inversion = 0; inversion < width; inversion++) {
    for (const notes of findVoicings(strings, fretCount, chord, style, inversion, start, width)) {
      if (query.fretRange && !inRange(notes, query.fretRange)) continue;
      const key = notes.map((note) => `${note.stringIndex}:${note.fret}`).join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      found.push(toVoicing(notes, tuning.length));
    }
  }

  found.sort((a, b) => {
    const fret = lowestFret(a.notes) - lowestFret(b.notes);
    if (fret !== 0) return fret;
    const bass = (bassNote(a.notes)?.midi ?? 0) - (bassNote(b.notes)?.midi ?? 0);
    if (bass !== 0) return bass;
    return a.notes[0]?.stringIndex - b.notes[0]?.stringIndex;
  });

  if (query.bassPc === undefined) return found;
  const bassPc = mod(query.bassPc, 12);
  const slashed = found.filter((voicing) => bassNote(voicing.notes)?.pc === bassPc);
  return slashed.length > 0 ? slashed : found;
}
