import { describe, expect, it } from 'vitest';
import { buildChord, type Chord, type ChordToneRole } from './chords';
import { midiOf, noteAt } from './fretboard';
import { mod } from './notes';
import { getPreset, type GuitarString } from './tunings';
import type { Voicing, VoicedNote } from './voicings';
import { DEFAULT_WEIGHTS, transitionCost, voicingCost, type Weights } from './voiceLeading';

// 7-string standard, low to high: B1 E2 A2 D3 G3 B3 E4.
// Open MIDI: 35, 40, 45, 50, 55, 59, 64.
const standard7 = getPreset('7-standard')!.notes;

const g7 = buildChord(7, '7');
const cmaj7 = buildChord(0, 'maj7');
const cmaj = buildChord(0, 'maj');

const ZERO_ROLES: Weights['roleMotion'] = {
  root: 0,
  third: 0,
  fifth: 0,
  seventh: 0,
  ext: 0,
};

/** Every coefficient off. Role motion is part of the omission product, so isolation turns it back on when that term is the one under test. */
const SILENT: Weights = {
  roleMotion: ZERO_ROLES,
  handShift: 0,
  commonToneBonus: 0,
  resolutionBonus: 0,
  omissionPenalty: 0,
  registerAnchor: 0,
  anchorFret: DEFAULT_WEIGHTS.anchorFret,
};

function makeVoicing(tuning: GuitarString[], frets: (number | null)[], chord: Chord): Voicing {
  if (frets.length !== tuning.length) {
    throw new Error(`frets length ${frets.length} does not match tuning length ${tuning.length}`);
  }
  const labels = new Map<number, { role: ChordToneRole; degree: string }>();
  for (const tone of chord.tones) {
    const pc = mod(chord.rootPc + tone.interval, 12);
    if (!labels.has(pc)) labels.set(pc, { role: tone.role, degree: tone.degree });
  }

  const notes: VoicedNote[] = [];
  let minFret = 0;
  let maxFret = 0;
  let fretted = false;
  frets.forEach((fret, stringIndex) => {
    if (fret === null) return;
    const str = tuning[stringIndex];
    const pc = noteAt(str.pc, fret);
    const label = labels.get(pc);
    if (!label) {
      throw new Error(`string ${stringIndex} fret ${fret} is pitch class ${pc}, which is not in the chord`);
    }
    notes.push({
      stringIndex,
      fret,
      midi: midiOf(str, fret),
      pc,
      role: label.role,
      degree: label.degree,
    });
    if (fret > 0) {
      if (!fretted || fret < minFret) minFret = fret;
      if (!fretted || fret > maxFret) maxFret = fret;
      fretted = true;
    }
  });
  notes.sort((a, b) => a.midi - b.midi || a.stringIndex - b.stringIndex);
  return { frets, notes, minFret, maxFret, span: maxFret - minFret };
}

// G7 guide grip, minFret 3. Sorted: D3 50 fifth, F3 53 seventh, G3 55 root, B3 59 third.
const g7Guide = makeVoicing(standard7, [null, null, 5, 3, 0, 0, null], g7);
// Cmaj7 resolution, minFret 1. Sorted: C3 48 root, E3 52 third, G3 55 fifth, C4 60 root.
// F falls 1 to E. B rises 1 to C. Open G is held on string 4.
const cmaj7Guide = makeVoicing(standard7, [null, null, 3, 2, 0, 1, null], cmaj7);
// Same G7 into a Cmaj7 whose top note is E3 52, seven semitones under B3 59.
// Sorted: C2 36 root, G2 43 fifth, B2 47 seventh, E3 52 third. minFret 1.
const cmaj7Leap = makeVoicing(standard7, [1, 3, 2, 2, null, null, null], cmaj7);

// C major barre at fret 5, minFret 5. G3 55 fifth, C4 60 root, E4 64 third.
const cMajorBar = makeVoicing(standard7, [null, null, null, 5, 5, 5, null], cmaj);

// C4 60 root plus G4 67 fifth, against the C alone. Both minFret 5.
const cAndG = makeVoicing(standard7, [null, null, null, null, 5, 8, null], cmaj7);
const cAlone = makeVoicing(standard7, [null, null, null, null, 5, null, null], cmaj7);

describe('transitionCost', () => {
  it('costs at most zero for a voicing into itself', () => {
    // Three held notes, position unchanged, minFret sits on the anchor:
    // motion 0 + hand 0 + common 3 × -2 + resolution 0 + omission 0 + anchor |5-5| × 0.3
    // = -6
    const cost = transitionCost(cMajorBar, cMajorBar);
    expect(cost).toBeCloseTo(-6);
    expect(cost).toBeLessThanOrEqual(0);
  });

  it('prefers G7 to Cmaj7 guide-tone motion over a 7-semitone top-voice leap', () => {
    expect(g7Guide.notes.map((note) => [note.midi, note.role])).toEqual([
      [50, 'fifth'],
      [53, 'seventh'],
      [55, 'root'],
      [59, 'third'],
    ]);
    expect(g7Guide.minFret).toBe(3);
    expect(cmaj7Guide.notes.map((note) => [note.midi, note.role])).toEqual([
      [48, 'root'],
      [52, 'third'],
      [55, 'fifth'],
      [60, 'root'],
    ]);
    expect(cmaj7Guide.minFret).toBe(1);
    expect(cmaj7Leap.notes.map((note) => [note.midi, note.role])).toEqual([
      [36, 'root'],
      [43, 'fifth'],
      [47, 'seventh'],
      [52, 'third'],
    ]);
    expect(cmaj7Leap.minFret).toBe(1);
    expect(g7Guide.notes[3].midi - cmaj7Leap.notes[3].midi).toBe(7);

    // Smooth pairs, weight by the G7 role:
    // D50→C48 fifth  2 × 1.0 = 2
    // F53→E52 seventh 1 × 1.5 = 1.5, and the 7th falls 1 onto a 3rd
    // G55→G55 root   0 × 0.5 = 0, held at string 4 fret 0
    // B59→C60 third  1 × 1.5 = 1.5, and the 3rd rises 1 onto the root
    // motion 5
    // hand |1-3| × 0.8 = 1.6
    // common 1 × -2 = -2
    // resolution 2 × -3 = -6
    // omission 0
    // anchor |1-5| × 0.3 = 1.2
    // total -0.2
    const smooth = transitionCost(g7Guide, cmaj7Guide);
    expect(smooth).toBeCloseTo(-0.2);

    // Leap pairs. The top voice is the last of each sorted list, B59→E52 = 7.
    // No pair is a 7th falling to a 3rd or a 3rd rising to a root, and no string/fret is shared.
    // D50→C36 fifth   14 × 1.0 = 14
    // F53→G43 seventh 10 × 1.5 = 15
    // G55→B47 root     8 × 0.5 = 4
    // B59→E52 third    7 × 1.5 = 10.5
    // motion 43.5 + hand 1.6 + common 0 + resolution 0 + omission 0 + anchor 1.2 = 46.3
    const leap = transitionCost(g7Guide, cmaj7Leap);
    expect(leap).toBeCloseTo(46.3);
    expect(smooth).toBeLessThan(leap);
  });

  it('charges a doubled handShift on a 5-fret jump and not on a same-position move', () => {
    // Both grips are a single Cmaj7 tone. G2 is string 1 fret 3 (midi 43, fifth).
    const low = makeVoicing(standard7, [null, 3, null, null, null, null, null], cmaj7);
    // C3 is string 2 fret 3 (midi 48, root). minFret stays 3.
    const samePosition = makeVoicing(standard7, [null, null, 3, null, null, null, null], cmaj7);
    // C3 is string 1 fret 8 (midi 48, root). minFret 8, five frets above the G.
    const jumped = makeVoicing(standard7, [null, 8, null, null, null, null, null], cmaj7);
    expect(low.minFret).toBe(3);
    expect(samePosition.minFret).toBe(3);
    expect(jumped.minFret).toBe(8);

    const doubled: Weights = { ...DEFAULT_WEIGHTS, handShift: DEFAULT_WEIGHTS.handShift * 2 };

    // Same minFret: the hand term is 0, so doubling its weight changes nothing.
    // Motion |48-43| × fifth 1 = 5, anchor |3-5| × 0.3 = 0.6, total 5.6 either way.
    expect(transitionCost(low, samePosition)).toBeCloseTo(5.6);
    expect(transitionCost(low, samePosition, doubled)).toBeCloseTo(5.6);

    // Jump: hand |8-3| × 0.8 = 4. Motion is still 5, anchor |8-5| × 0.3 = 0.9, total 9.9.
    // Doubling handShift adds another 5 × 0.8 = 4, total 13.9.
    expect(transitionCost(low, jumped)).toBeCloseTo(9.9);
    expect(transitionCost(low, jumped, doubled)).toBeCloseTo(13.9);
  });

  it('drops exactly one term when that weight is set to 0', () => {
    // Smooth total -0.2 = motion 5 + hand 1.6 + common -2 + resolution -6 + omission 0 + anchor 1.2.
    // Four notes on each side, so the omission term is already 0.
    expect(transitionCost(g7Guide, cmaj7Guide, { ...DEFAULT_WEIGHTS, roleMotion: ZERO_ROLES })).toBeCloseTo(-5.2);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...DEFAULT_WEIGHTS, handShift: 0 })).toBeCloseTo(-1.8);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...DEFAULT_WEIGHTS, commonToneBonus: 0 })).toBeCloseTo(1.8);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...DEFAULT_WEIGHTS, resolutionBonus: 0 })).toBeCloseTo(5.8);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...DEFAULT_WEIGHTS, registerAnchor: 0 })).toBeCloseTo(-1.4);

    // C+G → C at fret 5. Defaults:
    // motion 0, hand 0, common -2, resolution 0, unpaired fifth 6 × 1 = 6, anchor 0. Total 4.
    // omissionPenalty 0 leaves the held-note bonus: -2.
    expect(transitionCost(cAndG, cAlone)).toBeCloseTo(4);
    expect(transitionCost(cAndG, cAlone, { ...DEFAULT_WEIGHTS, omissionPenalty: 0 })).toBeCloseTo(-2);
  });

  it('equals one hand-computed term when every other weight is 0', () => {
    // Smooth pair, one coefficient restored at a time.
    expect(transitionCost(g7Guide, cmaj7Guide, { ...SILENT, roleMotion: DEFAULT_WEIGHTS.roleMotion })).toBeCloseTo(5);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...SILENT, handShift: 0.8 })).toBeCloseTo(1.6);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...SILENT, commonToneBonus: 2 })).toBeCloseTo(-2);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...SILENT, resolutionBonus: 3 })).toBeCloseTo(-6);
    expect(transitionCost(g7Guide, cmaj7Guide, { ...SILENT, registerAnchor: 0.3 })).toBeCloseTo(1.2);

    // Omission is omissionPenalty × roleMotion[role]. The paired C does not move,
    // so restoring both factors and nothing else is just the unpaired G: 6 × fifth 1 = 6.
    expect(
      transitionCost(cAndG, cAlone, {
        ...SILENT,
        roleMotion: DEFAULT_WEIGHTS.roleMotion,
        omissionPenalty: 6,
      }),
    ).toBeCloseTo(6);
  });

  it('charges omissionPenalty for unequal note counts and does not throw', () => {
    // Index alignment, not nearest pitch. G7 minFret 3: G2 43 root, D3 50 fifth, B3 59 third.
    // Cmaj7 minFret 1: C3 48 root, C4 60 root.
    // G43→C48 root  5 × 0.5 = 2.5
    // D50→C60 fifth 10 × 1.0 = 10
    // B59 unpaired third = 6 × 1.5 = 9
    // Pairing B59 with C60 and omitting D would be motion 1 × 1.5 + omission 6 × 1 = 7.5, not this.
    // hand |1-3| × 0.8 = 1.6, common 0, resolution 0, anchor |1-5| × 0.3 = 1.2
    // total 2.5 + 10 + 9 + 1.6 + 1.2 = 24.3
    const from3 = makeVoicing(standard7, [null, 3, 5, null, null, 0, null], g7);
    const to2 = makeVoicing(standard7, [null, null, 3, null, null, 1, null], cmaj7);
    expect(() => transitionCost(from3, to2)).not.toThrow();
    expect(transitionCost(from3, to2)).toBeCloseTo(24.3);

    // Extra voice on the destination. C → C+G, both minFret 5.
    // Held C is -2. Unpaired G uses its own fifth weight: 6 × 1 = 6. Total 4.
    expect(() => transitionCost(cAlone, cAndG)).not.toThrow();
    expect(transitionCost(cAlone, cAndG)).toBeCloseTo(4);
  });

  it('skips hand shift when either voicing is all open strings', () => {
    // Open B, G7 third, minFret 0. C at fret 5, minFret 5.
    // |5-0| × 0.8 = 4 if the term applied. An all-open grip skips it.
    const openB = makeVoicing(standard7, [0, null, null, null, null, null, null], g7);
    const frettedC = makeVoicing(standard7, [null, null, null, null, 5, null, null], cmaj7);
    expect(openB.minFret).toBe(0);
    expect(frettedC.minFret).toBe(5);
    const onlyHand: Weights = { ...SILENT, handShift: 0.8 };
    expect(transitionCost(openB, frettedC, onlyHand)).toBeCloseTo(0);
    expect(transitionCost(frettedC, openB, onlyHand)).toBeCloseTo(0);
  });

  it('rewards a seventh falling by one or two semitones and a leading tone rising by one', () => {
    const onlyResolution: Weights = { ...SILENT, resolutionBonus: 3 };
    // F3 53 (G7 seventh) → Eb3 51 (C minor third). Drop of 2. Bonus -3.
    const f3 = makeVoicing(standard7, [null, null, null, 3, null, null, null], g7);
    const eb3 = makeVoicing(standard7, [null, null, null, 1, null, null, null], buildChord(0, 'min'));
    expect(f3.notes[0].midi - eb3.notes[0].midi).toBe(2);
    expect(transitionCost(f3, eb3, onlyResolution)).toBeCloseTo(-3);

    // F3 53 → D3 50 (Bb major third). Drop of 3, outside the window. 0.
    const d3 = makeVoicing(standard7, [null, null, null, 0, null, null, null], buildChord(10, 'maj'));
    expect(f3.notes[0].midi - d3.notes[0].midi).toBe(3);
    expect(transitionCost(f3, d3, onlyResolution)).toBeCloseTo(0);

    // E3 52 (C# minor third) → F#3 54 (F# root). Rise of 2, not a leading tone. 0.
    const e3 = makeVoicing(standard7, [null, null, null, 2, null, null, null], buildChord(1, 'min'));
    const fs3 = makeVoicing(standard7, [null, null, null, 4, null, null, null], buildChord(6, 'maj'));
    expect(fs3.notes[0].midi - e3.notes[0].midi).toBe(2);
    expect(transitionCost(e3, fs3, onlyResolution)).toBeCloseTo(0);
  });
});

describe('voicingCost', () => {
  it('is only the register anchor', () => {
    // |5-5| × 0.3 = 0. The self-transition of this grip is -6, which includes held notes.
    expect(voicingCost(cMajorBar)).toBeCloseTo(0);
    expect(transitionCost(cMajorBar, cMajorBar)).toBeCloseTo(-6);
    // Smooth Cmaj7 minFret 1: |1-5| × 0.3 = 1.2
    expect(voicingCost(cmaj7Guide)).toBeCloseTo(1.2);
    expect(voicingCost(cmaj7Guide, { ...DEFAULT_WEIGHTS, registerAnchor: 0 })).toBeCloseTo(0);
    expect(voicingCost(cmaj7Guide, { ...DEFAULT_WEIGHTS, anchorFret: 1 })).toBeCloseTo(0);
  });
});
