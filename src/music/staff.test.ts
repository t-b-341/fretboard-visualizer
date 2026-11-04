import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { getFamily } from './scales';
import {
  BASS_BOTTOM_STEP,
  BASS_TOP_STEP,
  TREBLE_BOTTOM_STEP,
  TREBLE_SPLIT,
  bassStaffOriginShift,
  emptyKeySignature,
  keySignatureSpots,
  layoutChord,
  layoutScale,
  layoutStaff,
  layoutVoicing,
  measuresPerSystem,
  placeNotes,
  wrapMeasures,
} from './staff';
import { writeMidi } from './written';

const major = getFamily('major').modes.find((mode) => mode.key === 'Ionian')!.intervals;
const harmonicMinor = getFamily('harmonicMinor').modes.find((mode) => mode.key === 'HarmonicMinor')!.intervals;

describe('layoutScale', () => {
  it('places a C major scale on the treble staff with no accidentals', () => {
    const layout = layoutScale(0, major);
    expect(layout.signature.fifths).toBe(0);
    expect(layout.placement).toBe('run');
    expect(layout.notes.map((note) => note.written.name)).toEqual([
      'C4',
      'D4',
      'E4',
      'F4',
      'G4',
      'A4',
      'B4',
      'C5',
    ]);
    expect(layout.notes.map((note) => note.drawStep)).toEqual([28, 29, 30, 31, 32, 33, 34, 35]);
    expect(layout.notes.every((note) => note.staff === 'treble')).toBe(true);
    expect(layout.notes.every((note) => note.accidental === null)).toBe(true);
    expect(layout.notes.every((note) => note.headColumn === 0)).toBe(true);
    expect(layout.notes[0].ledgerSteps).toEqual([28]);
    expect(layout.notes[2].drawStep).toBe(TREBLE_BOTTOM_STEP);
    expect(layout.notes[2].ledgerSteps).toEqual([]);
  });

  it('gives Eb major three flats and no accidentals on the scale', () => {
    const layout = layoutScale(3, major);
    expect(layout.signature.fifths).toBe(-3);
    expect(layout.signature.byLetter).toEqual([0, 0, -1, 0, 0, -1, -1]);
    expect(layout.notes.map((note) => note.written.name)).toEqual([
      'Eb4',
      'F4',
      'G4',
      'Ab4',
      'Bb4',
      'C5',
      'D5',
      'Eb5',
    ]);
    expect(layout.notes.every((note) => note.accidental === null)).toBe(true);
    expect(keySignatureSpots(layout.signature, 'treble').map((spot) => spot.step)).toEqual([34, 37, 33]);
    expect(keySignatureSpots(layout.signature, 'bass').map((spot) => spot.step)).toEqual([20, 23, 19]);
  });

  it('prints a C# on D harmonic minor and keeps the flat in the signature', () => {
    const layout = layoutScale(2, harmonicMinor);
    expect(layout.signature.fifths).toBe(-1);
    expect(keySignatureSpots(layout.signature, 'treble')).toEqual([{ step: 34, accidental: -1 }]);
    const marked = layout.notes.filter((note) => note.accidental !== null);
    expect(marked.map((note) => note.written.name)).toEqual(['C#5']);
    expect(marked[0].accidental).toBe(1);
    expect(layout.notes.find((note) => note.written.name === 'Bb4')?.accidental).toBeNull();
  });

  it('prints explicit accidentals and no signature for a non-heptatonic scale', () => {
    const layout = layoutScale(0, [0, 3, 5, 6, 7, 10]);
    expect(layout.signature.fifths).toBe(0);
    expect(
      layout.notes.filter((note) => note.accidental !== null).map((note) => note.written.name),
    ).toEqual(['Eb4', 'F#4', 'Bb4']);
    expect(layout.notes.every((note) => note.accidentalColumn === 0)).toBe(true);
  });

  it('writes guitar pitch an octave higher on a single treble staff', () => {
    const layout = layoutScale(0, major, true);
    expect(layout.system).toBe('treble');
    expect(layout.notes[0].written.name).toBe('C5');
    expect(layout.notes[0].midi).toBe(60);
    expect(layout.notes.every((note) => note.staff === 'treble')).toBe(true);
  });
});

describe('placeNotes', () => {
  const bare = { placement: 'stack' as const, system: 'grand' as const, signature: emptyKeySignature() };

  it('lands Cb4 on the C4 step below the treble split', () => {
    const c4 = writeMidi(60, 0, 0);
    const cb4 = writeMidi(59, 0, -1);
    const [placed] = placeNotes([cb4], bare);
    expect(cb4.staffStep).toBe(c4.staffStep);
    expect(placed.drawStep).toBe(c4.staffStep);
    expect(placed.staff).toBe('bass');
    expect(placed.midi).toBe(59);
  });

  it('splits the grand staff at middle C', () => {
    expect(TREBLE_SPLIT).toBe(60);
    const placed = placeNotes([writeMidi(59, 6, 0), writeMidi(60, 0, 0)], {
      ...bare,
      placement: 'run',
    });
    expect(placed.map((note) => note.staff)).toEqual(['bass', 'treble']);
  });

  it('offsets D in a C–D–E cluster', () => {
    const [c, d, e] = placeNotes(
      [writeMidi(60, 0, 0), writeMidi(62, 1, 0), writeMidi(64, 2, 0)],
      bare,
    );
    expect(d.headColumn).toBe(1);
    expect(c.headColumn).toBe(0);
    expect(e.headColumn).toBe(c.headColumn);
  });

  it('puts seconds of accidentals in separate columns', () => {
    const [c, d] = placeNotes([writeMidi(61, 0, 1), writeMidi(63, 1, 1)], bare);
    expect(c.accidental).toBe(1);
    expect(d.accidental).toBe(1);
    expect(d.accidentalColumn).toBe(0);
    expect(c.accidentalColumn).toBe(1);
  });

  it('keeps Bb1 on ledger lines and lifts a note past the fourth ledger with 8vb', () => {
    const [bb1] = placeNotes([writeMidi(34, 6, -1)], bare);
    expect(bb1.written.name).toBe('Bb1');
    expect(bb1.staff).toBe('bass');
    expect(bb1.octaveShift).toBe(0);
    expect(bb1.ledgerSteps).toEqual([16, 14]);
    expect(bb1.ledgerSteps.every((step) => step < BASS_BOTTOM_STEP)).toBe(true);

    const [f1] = placeNotes([writeMidi(29, 3, 0)], bare);
    expect(f1.written.name).toBe('F1');
    expect(f1.octaveShift).toBe(0);
    expect(f1.ledgerSteps).toEqual([16, 14, 12, 10]);

    const [bb0] = placeNotes([writeMidi(22, 6, -1)], bare);
    expect(bb0.written.name).toBe('Bb0');
    expect(bb0.octaveShift).toBe(1);
    expect(bb0.drawStep).toBe(bb1.drawStep);
    expect(bb0.ledgerSteps.filter((step) => step < BASS_BOTTOM_STEP).length).toBeLessThanOrEqual(4);
  });
});

describe('chords and voicings', () => {
  it('stacks Cmaj7 in root position on the treble staff', () => {
    const layout = layoutChord(buildChord(0, 'maj7'), 0, major);
    expect(layout.placement).toBe('stack');
    expect(layout.notes.map((note) => note.written.name)).toEqual(['C4', 'E4', 'G4', 'B4']);
    expect(layout.notes.every((note) => note.staff === 'treble')).toBe(true);
    expect(layout.notes.every((note) => note.headColumn === 0)).toBe(true);
    expect(layout.notes.every((note) => note.accidental === null)).toBe(true);
  });

  it('stacks a drop-2 G7 at the grip pitches and naturals the F against one sharp', () => {
    const chord = buildChord(7, '7');
    const layout = layoutVoicing([50, 55, 59, 65], chord, 7, major);
    expect(layout.notes.map((note) => note.midi)).toEqual([50, 55, 59, 65]);
    expect(layout.notes.map((note) => note.written.name)).toEqual(['D3', 'G3', 'B3', 'F4']);
    expect(layout.notes.map((note) => note.staff)).toEqual(['bass', 'bass', 'bass', 'treble']);
    expect(layout.signature.fifths).toBe(1);
    expect(layout.notes.find((note) => note.written.name === 'F4')?.accidental).toBe(0);
    expect(layout.notes.filter((note) => note.written.name !== 'F4').every((note) => note.accidental === null)).toBe(
      true,
    );
  });

  it('draws a guitar-written low note up again when the treble staff still cannot reach it', () => {
    const layout = layoutStaff({
      notes: [writeMidi(34, 6, -1)],
      placement: 'stack',
      signature: emptyKeySignature(),
      guitarWritten: true,
    });
    const note = layout.notes[0];
    expect(layout.system).toBe('treble');
    expect(note.midi).toBe(34);
    expect(note.written.name).toBe('Bb2');
    expect(note.staff).toBe('treble');
    expect(note.octaveShift).toBe(1);
    expect(note.drawStep).toBe(27);
    expect(note.ledgerSteps).toEqual([28]);
  });

  it('writes a 6-string bass Bb2 an octave up on the bass staff with an 8', () => {
    const layout = layoutStaff({
      notes: [writeMidi(46, 6, -1)],
      placement: 'stack',
      signature: emptyKeySignature(),
      guitarWritten: true,
      writtenStaff: 'bass',
    });
    const note = layout.notes[0];
    expect(layout.system).toBe('bass');
    expect(layout.clefEight).toBe(true);
    expect(note.midi).toBe(46);
    expect(note.written.name).toBe('Bb3');
    expect(note.written.octave).toBe(3);
    expect(note.staff).toBe('bass');
  });
});

describe('grand staff spacing and systems', () => {
  it('puts the bass staff origin at least 4 spaces below the treble', () => {
    const shift = bassStaffOriginShift();
    const spaces = (TREBLE_BOTTOM_STEP - BASS_TOP_STEP + shift) / 2;
    expect(shift).toBeGreaterThan(0);
    expect(spaces).toBeGreaterThanOrEqual(4);
  });

  it('wraps a progression at 4 measures per system', () => {
    expect(measuresPerSystem(false)).toBe(4);
    expect(measuresPerSystem(true)).toBe(2);
    expect(wrapMeasures(9)).toEqual([
      { start: 0, end: 4 },
      { start: 4, end: 8 },
      { start: 8, end: 9 },
    ]);
    expect(wrapMeasures(4)).toEqual([{ start: 0, end: 4 }]);
    expect(wrapMeasures(5, measuresPerSystem(true))).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 5 },
    ]);
  });
});
