// Grand-staff layout: which pitches to write, and where each one sits.
//
// Pitches are chosen here, as MIDI numbers and WrittenNotes. The component
// only turns staff steps into pixels. Middle C (MIDI 60) and above go on the
// treble staff; everything below goes on the bass staff.
//
// A note more than four ledger lines from its staff is written an octave
// closer and marked 8vb below or 8va above (15mb / 15ma past that). The
// sounding MIDI does not change. The bass staff is drawn lower than staffStep
// alone would put it; ledger lines stay on the staffStep they already have.

import type { Chord } from './chords';
import { mod } from './notes';
import { spellScale } from './spelling';
import type { ViewMode } from './types';
import { parseNoteName, spellMidiInChord, spellMidiInScale, writeMidi } from './written';
import type { WrittenNote } from './written';

/** MIDI at or above this is drawn on the treble staff. Middle C, C4. */
export const TREBLE_SPLIT = 60;

/** Ledger lines below a staff before the note is written an octave higher. */
export const MAX_LEDGER_LINES_BELOW = 4;

/** Treble bottom line is E4. One staff step is one line or space. */
export const TREBLE_BOTTOM_STEP = 2 + 7 * 4;
/** Treble top line is F5. */
export const TREBLE_TOP_STEP = TREBLE_BOTTOM_STEP + 8;
/** Bass bottom line is G2. */
export const BASS_BOTTOM_STEP = 4 + 7 * 2;
/** Bass top line is A3. */
export const BASS_TOP_STEP = BASS_BOTTOM_STEP + 8;

/**
 * Line-spaces between the treble bottom line and the bass top line.
 * staffStep already leaves two; the rest is only a bass-origin shift.
 */
export const GRAND_STAFF_GAP = 5;

/**
 * Extra staff steps added to every bass-staff y.
 * One line-space is two staff steps. Ledger steps are not changed.
 */
export function bassStaffOriginShift(): number {
  const naturalSpaces = (TREBLE_BOTTOM_STEP - BASS_TOP_STEP) / 2;
  return (GRAND_STAFF_GAP - naturalSpaces) * 2;
}

/** Measures on one system at desktop width. A narrow screen uses half of these. */
export const MEASURES_PER_SYSTEM = 4;

export function measuresPerSystem(narrow: boolean): number {
  return narrow ? MEASURES_PER_SYSTEM / 2 : MEASURES_PER_SYSTEM;
}

/** Systems of a progression. `end` is exclusive. An empty list stays empty. */
export function wrapMeasures(count: number, perSystem = MEASURES_PER_SYSTEM): { start: number; end: number }[] {
  const size = Math.max(1, Math.floor(perSystem));
  const total = Math.max(0, count);
  const systems: { start: number; end: number }[] = [];
  for (let start = 0; start < total; start += size) {
    systems.push({ start, end: Math.min(total, start + size) });
  }
  return systems;
}

/** Two accidentals closer than this, in staff steps, cannot share a column. */
const ACCIDENTAL_CLEARANCE = 6;

const SHARP_LETTERS = [3, 0, 4, 1, 5, 2, 6] as const; // F C G D A E B
const FLAT_LETTERS = [6, 2, 5, 1, 4, 0, 3] as const; // B E A D G C F

// Key-signature slots on the treble staff, in signature order.
const TREBLE_SHARP_STEPS = [38, 35, 39, 36, 33, 37, 34]; // F5 C5 G5 D5 A4 E5 B4
const TREBLE_FLAT_STEPS = [34, 37, 33, 36, 32, 35, 31]; // B4 E5 A4 D5 G4 C5 F4
const BASS_SIGNATURE_SHIFT = -14;

export type StaffName = 'treble' | 'bass';
export type StaffPlacement = 'run' | 'stack';
export type StaffSystem = 'grand' | 'treble' | 'bass';

export interface KeySignature {
  /** Sharps are positive, flats negative, from -7 to 7. */
  fifths: number;
  /** Accidental on each letter. Index 0 is C. */
  byLetter: number[];
}

export interface LayoutNote {
  /** Spelling used for the notehead. Guitar written is already an octave up. */
  written: WrittenNote;
  /** Sounding MIDI. Playback uses this, not the drawn octave. */
  midi: number;
  staff: StaffName;
  /** Staff step of the notehead. An 8vb note is raised by 7 per octave. */
  drawStep: number;
  /**
   * Octaves the notehead was moved to stay within the ledger limit.
   * Positive is written higher (8vb). Negative is written lower (8va).
   */
  octaveShift: number;
  /** Staff steps of the ledger lines this note needs. */
  ledgerSteps: number[];
  /** 0 is the default side of the stem. 1 is the other side. */
  headColumn: number;
  /**
   * Accidental to print. Null when the key signature already applies.
   * 0 is a natural sign.
   */
  accidental: number | null;
  /** 0 is the column closest to the notehead. */
  accidentalColumn: number;
}

export interface StaffLayout {
  system: StaffSystem;
  /** Written part: an 8 under the clef, and noteheads an octave above sounding. */
  clefEight: boolean;
  signature: KeySignature;
  placement: StaffPlacement;
  notes: LayoutNote[];
}

export interface StaffSource {
  notes: readonly WrittenNote[];
  placement: StaffPlacement;
  signature: KeySignature;
  /** Written part, an octave above sounding, with an 8 under the clef. */
  guitarWritten: boolean;
  /** Which staff the written part uses. Guitar is treble; 6-string bass is bass. */
  writtenStaff?: StaffName;
}

export interface PlaceOptions {
  placement: StaffPlacement;
  system: StaffSystem;
  signature: KeySignature;
}

/** "8va" / "8vb", then "15ma" / "15mb". Null when the notehead is unshifted. */
export function octaveMark(octaveShift: number): string | null {
  if (octaveShift === 0) return null;
  const above = octaveShift < 0;
  const count = Math.abs(octaveShift);
  if (count === 1) return above ? '8va' : '8vb';
  return `${count * 7 + 1}${above ? 'ma' : 'mb'}`;
}

export function emptyKeySignature(): KeySignature {
  return { fifths: 0, byLetter: [0, 0, 0, 0, 0, 0, 0] };
}

function signatureForFifths(fifths: number): KeySignature {
  const count = Math.max(-7, Math.min(7, fifths));
  const byLetter = [0, 0, 0, 0, 0, 0, 0];
  if (count > 0) {
    for (let i = 0; i < count; i++) byLetter[SHARP_LETTERS[i]] = 1;
  } else {
    for (let i = 0; i < -count; i++) byLetter[FLAT_LETTERS[i]] = -1;
  }
  return { fifths: count, byLetter };
}

/**
 * Key signature of a heptatonic scale.
 *
 * The signature is the standard sharp or flat set that leaves the fewest
 * notes needing their own accidental. A tie prefers fewer signature
 * accidentals, then flats. Non-heptatonic scales get an empty signature,
 * so every sharp and flat is printed on the note.
 */
export function keySignatureForScale(rootPc: number, intervals: readonly number[]): KeySignature {
  const tones = spellScale(rootPc, [...intervals]);
  if (!tones) return emptyKeySignature();
  const byLetter = [0, 0, 0, 0, 0, 0, 0];
  for (const tone of tones) {
    const parsed = parseNoteName(tone.name);
    byLetter[parsed.letter] = parsed.accidental;
  }

  let best = signatureForFifths(0);
  let bestDiff = Infinity;
  for (let fifths = -7; fifths <= 7; fifths++) {
    const candidate = signatureForFifths(fifths);
    let diff = 0;
    for (let letter = 0; letter < 7; letter++) {
      if (byLetter[letter] !== candidate.byLetter[letter]) diff += 1;
    }
    const fewerAccidentals = Math.abs(fifths) < Math.abs(best.fifths);
    const sameSizePrefersFlats = Math.abs(fifths) === Math.abs(best.fifths) && fifths < best.fifths;
    if (diff < bestDiff || (diff === bestDiff && (fewerAccidentals || sameSizePrefersFlats))) {
      best = candidate;
      bestDiff = diff;
    }
  }
  return best;
}

/** Where each signature accidental sits on one staff. */
export function keySignatureSpots(
  signature: KeySignature,
  staff: StaffName,
): { step: number; accidental: number }[] {
  if (signature.fifths === 0) return [];
  const shift = staff === 'bass' ? BASS_SIGNATURE_SHIFT : 0;
  const steps = signature.fifths > 0 ? TREBLE_SHARP_STEPS : TREBLE_FLAT_STEPS;
  const accidental = signature.fifths > 0 ? 1 : -1;
  return steps.slice(0, Math.abs(signature.fifths)).map((step) => ({ step: step + shift, accidental }));
}

/**
 * MIDI of the scale root in octave 3 or 4, whichever is closer to middle C.
 * A tie (F#) uses octave 4, so the root stays in the middle of the grand staff.
 */
export function scaleRootMidi(rootPc: number): number {
  const pc = mod(rootPc, 12);
  const low = (3 + 1) * 12 + pc;
  const high = (4 + 1) * 12 + pc;
  return Math.abs(high - TREBLE_SPLIT) <= Math.abs(low - TREBLE_SPLIT) ? high : low;
}

/** One ascending octave from the key root, including the upper root. */
export function scaleWrittenNotes(rootPc: number, intervals: readonly number[]): WrittenNote[] {
  const start = scaleRootMidi(rootPc);
  const degrees = [...new Set(intervals.map((interval) => mod(interval, 12)))].sort((a, b) => a - b);
  const span = degrees[0] === 0 ? [...degrees, 12] : [0, ...degrees, 12];
  const scale = [...intervals];
  return span.map((interval) => spellMidiInScale(start + interval, rootPc, scale));
}

/** Root-position chord in the same middle register as a scale on that root. */
export function chordWrittenNotes(chord: Chord): WrittenNote[] {
  const root = scaleRootMidi(chord.rootPc);
  const midis = [...new Set(chord.tones.map((tone) => root + tone.interval))].sort((a, b) => a - b);
  return midis.map((midi) => spellMidiInChord(midi, chord));
}

/** A grip, low to high, spelled from the chord. */
export function voicingWrittenNotes(midis: readonly number[], chord: Chord): WrittenNote[] {
  return [...midis]
    .filter((midi) => Number.isInteger(midi))
    .sort((a, b) => a - b)
    .map((midi) => spellMidiInChord(midi, chord));
}

function printedAccidental(note: WrittenNote, signature: KeySignature): number | null {
  const signed = signature.byLetter[note.letter] ?? 0;
  return note.accidental === signed ? null : note.accidental;
}

function ledgerStepsFor(step: number, bottom: number, top: number): number[] {
  const lines: number[] = [];
  if (step < bottom) {
    for (let line = bottom - 2; line >= step; line -= 2) lines.push(line);
  } else if (step > top) {
    for (let line = top + 2; line <= step; line += 2) lines.push(line);
  }
  return lines;
}

function ledgerLinesPast(lines: readonly number[], edge: number, above: boolean): number {
  let count = 0;
  for (const line of lines) {
    if (above ? line > edge : line < edge) count += 1;
  }
  return count;
}

function fitToStaff(
  step: number,
  bottom: number,
  top: number,
): { drawStep: number; octaveShift: number; ledgerSteps: number[] } {
  let drawStep = step;
  let octaveShift = 0;
  let ledgerSteps = ledgerStepsFor(drawStep, bottom, top);
  while (ledgerLinesPast(ledgerSteps, bottom, false) > MAX_LEDGER_LINES_BELOW && octaveShift < 5) {
    drawStep += 7;
    octaveShift += 1;
    ledgerSteps = ledgerStepsFor(drawStep, bottom, top);
  }
  while (ledgerLinesPast(ledgerSteps, top, true) > MAX_LEDGER_LINES_BELOW && octaveShift > -5) {
    drawStep -= 7;
    octaveShift -= 1;
    ledgerSteps = ledgerStepsFor(drawStep, bottom, top);
  }
  return { drawStep, octaveShift, ledgerSteps };
}

function staffOf(system: StaffSystem, midi: number): StaffName {
  if (system === 'treble') return 'treble';
  if (system === 'bass') return 'bass';
  return midi >= TREBLE_SPLIT ? 'treble' : 'bass';
}

function staffBounds(staff: StaffName): { bottom: number; top: number } {
  return staff === 'treble'
    ? { bottom: TREBLE_BOTTOM_STEP, top: TREBLE_TOP_STEP }
    : { bottom: BASS_BOTTOM_STEP, top: BASS_TOP_STEP };
}

/**
 * The higher of two notes a second apart goes to the other side of the stem.
 * C–D–E puts D across and leaves C and E together: each note a second from
 * the previous one flips side, and a wider interval returns to the default.
 */
function assignHeadColumns(notes: readonly LayoutNote[]) {
  const ordered = [...notes].sort((a, b) => a.drawStep - b.drawStep || a.midi - b.midi);
  let prev: LayoutNote | null = null;
  for (const note of ordered) {
    if (prev && note.drawStep - prev.drawStep <= 1) note.headColumn = prev.headColumn === 0 ? 1 : 0;
    else note.headColumn = 0;
    prev = note;
  }
}

/** Higher accidentals take the column nearest the notehead. */
function assignAccidentalColumns(notes: readonly LayoutNote[]) {
  const ordered = notes
    .filter((note) => note.accidental !== null)
    .sort((a, b) => b.drawStep - a.drawStep || a.midi - b.midi);
  const columns: number[][] = [];
  for (const note of ordered) {
    let column = 0;
    for (;;) {
      const used = columns[column] ?? [];
      const collides = used.some((step) => Math.abs(step - note.drawStep) < ACCIDENTAL_CLEARANCE);
      if (!collides) {
        (columns[column] ??= []).push(note.drawStep);
        note.accidentalColumn = column;
        break;
      }
      column += 1;
    }
  }
}

export function placeNotes(notes: readonly WrittenNote[], options: PlaceOptions): LayoutNote[] {
  const placed = notes.map((written) => {
    const staff = staffOf(options.system, written.midi);
    const bounds = staffBounds(staff);
    const fitted = fitToStaff(written.staffStep, bounds.bottom, bounds.top);
    const note: LayoutNote = {
      written,
      midi: written.midi,
      staff,
      drawStep: fitted.drawStep,
      octaveShift: fitted.octaveShift,
      ledgerSteps: fitted.ledgerSteps,
      headColumn: 0,
      accidental: printedAccidental(written, options.signature),
      accidentalColumn: 0,
    };
    return note;
  });
  if (options.placement === 'stack') {
    assignHeadColumns(placed);
    assignAccidentalColumns(placed);
  }
  return placed;
}

export function layoutStaff(source: StaffSource): StaffLayout {
  const system: StaffSystem = source.guitarWritten ? (source.writtenStaff ?? 'treble') : 'grand';
  const display = source.guitarWritten
    ? source.notes.map((note) => writeMidi(note.midi + 12, note.letter, note.accidental))
    : source.notes;
  const placed = placeNotes(display, {
    placement: source.placement,
    system,
    signature: source.signature,
  });
  for (let i = 0; i < placed.length; i++) placed[i].midi = source.notes[i].midi;
  return {
    system,
    clefEight: source.guitarWritten,
    signature: source.signature,
    placement: source.placement,
    notes: placed,
  };
}

export function layoutScale(
  rootPc: number,
  intervals: readonly number[],
  guitarWritten = false,
): StaffLayout {
  return layoutStaff({
    notes: scaleWrittenNotes(rootPc, intervals),
    placement: 'run',
    signature: keySignatureForScale(rootPc, intervals),
    guitarWritten,
  });
}

export function layoutChord(
  chord: Chord,
  keyRootPc: number,
  intervals: readonly number[],
  guitarWritten = false,
): StaffLayout {
  return layoutStaff({
    notes: chordWrittenNotes(chord),
    placement: 'stack',
    signature: keySignatureForScale(keyRootPc, intervals),
    guitarWritten,
  });
}

export function layoutVoicing(
  midis: readonly number[],
  chord: Chord,
  keyRootPc: number,
  intervals: readonly number[],
  guitarWritten = false,
): StaffLayout {
  return layoutStaff({
    notes: voicingWrittenNotes(midis, chord),
    placement: 'stack',
    signature: keySignatureForScale(keyRootPc, intervals),
    guitarWritten,
  });
}

export interface StaffRequest {
  viewMode: ViewMode;
  rootPc: number;
  intervals: readonly number[];
  chord: Chord | null;
  /** Sounding MIDIs of the one grip on the neck, when a grip is selected. */
  voicingMidis: readonly number[] | null;
  pickedMidis: readonly number[];
  guitarWritten: boolean;
  /** Written staff. Guitar is treble; 6-string bass is bass. Ignored for concert pitch. */
  writtenStaff?: StaffName;
}

/** Notes for the current view. The scale's key signature is used in every view. */
export function staffLayoutFor(request: StaffRequest): StaffLayout {
  const signature = keySignatureForScale(request.rootPc, request.intervals);
  const guitarWritten = request.guitarWritten;
  const writtenStaff = request.writtenStaff;
  if (request.viewMode === 'scale') {
    return layoutStaff({
      notes: scaleWrittenNotes(request.rootPc, request.intervals),
      placement: 'run',
      signature,
      guitarWritten,
      writtenStaff,
    });
  }
  if ((request.viewMode === 'chord' || request.viewMode === 'triad') && request.chord) {
    const midis = (request.voicingMidis ?? []).filter((midi) => Number.isInteger(midi));
    return layoutStaff({
      notes: midis.length > 0 ? voicingWrittenNotes(midis, request.chord) : chordWrittenNotes(request.chord),
      placement: 'stack',
      signature,
      guitarWritten,
      writtenStaff,
    });
  }
  if (request.viewMode === 'identify' && request.pickedMidis.length > 0) {
    const midis = [...request.pickedMidis].filter((midi) => Number.isInteger(midi)).sort((a, b) => a - b);
    return layoutStaff({
      notes: midis.map((midi) => spellMidiInScale(midi, request.rootPc, [...request.intervals])),
      placement: 'stack',
      signature,
      guitarWritten,
      writtenStaff,
    });
  }
  return layoutStaff({ notes: [], placement: 'stack', signature, guitarWritten, writtenStaff });
}
