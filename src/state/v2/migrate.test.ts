import { describe, expect, it } from 'vitest';
import { buildChord, getDiatonicTriad } from '../../music/chords';
import { controllerWindow, cMidi } from '../../music/keys';
import { defaultNoteQuizSettings } from '../../music/quiz';
import { getFamily, parentScale } from '../../music/scales';
import { getPreset } from '../../music/tunings';
import { createInitialState } from '../appState';
import { createDefaultV2 } from './defaults';
import { migrateV1, normalizeV2 } from './migrate';

function ionianIntervals(): number[] {
  const mode = getFamily('major').modes.find((item) => item.key === 'Ionian') ?? getFamily('major').modes[0];
  return parentScale(mode.intervals).intervals;
}

describe('createDefaultV2', () => {
  it('starts on a 7-string half step down, Bb major, with every view on', () => {
    const state = createDefaultV2();
    const preset = getPreset('7-half-down')!;
    expect(state.version).toBe(2);
    expect(state.material.type).toBe('scale');
    expect(state.material.key).toEqual({ rootPc: 10, familyKey: 'major', modeKey: 'Ionian' });
    expect(state.view.staff).toBe(true);
    expect(state.view.neck).toBe(true);
    expect(state.view.keyboard).toBe(true);
    expect(state.view.names).toBe('concert');
    expect(state.view.labels).toBe('notes');
    expect(state.settings.startIn).toBe('last');
    expect(state.settings.myDefault).toBeNull();
    expect(state.settings.instrument.numStrings).toBe(7);
    expect(state.settings.instrument.tuning).toEqual(preset.notes);
  });

  it('gives each caller its own objects', () => {
    const first = createDefaultV2();
    const second = createDefaultV2();
    first.material.key.rootPc = 0;
    first.settings.voiceLeadingWeights.roleMotion.root = 9;
    expect(second.material.key.rootPc).toBe(10);
    expect(second.settings.voiceLeadingWeights.roleMotion.root).toBe(createDefaultV2().settings.voiceLeadingWeights.roleMotion.root);
  });
});

describe('migrateV1', () => {
  it('maps each view mode', () => {
    expect(migrateV1({ viewMode: 'scale' }).material.type).toBe('scale');
    expect(migrateV1({ viewMode: 'identify' }).material.type).toBe('scale');
    expect(migrateV1({ viewMode: 'quiz' }).material.type).toBe('scale');
    expect(migrateV1({ viewMode: 'quiz' }).practice.questionTypes.chordTones).toBe(true);
    expect(migrateV1({ viewMode: 'identify' }).practice.questionTypes.chordTones).toBe(false);

    const triad = migrateV1({ viewMode: 'triad', triadDegree: 4, rootPc: 0, familyKey: 'major', modeKey: 'Ionian' });
    const built = getDiatonicTriad(0, ionianIntervals(), 4);
    expect(triad.material.type).toBe('chord');
    expect(triad.material.steps).toHaveLength(1);
    expect(triad.material.steps[0].chord).toEqual(buildChord(built.rootPc, built.quality));
    expect(triad.material.steps[0].source).toBe('manual');
    expect(triad.material.steps[0].locked).toBe(false);

    const only = buildChord(10, '7');
    const single = migrateV1({
      viewMode: 'chord',
      activeChord: only,
      chordDisplay: 'voicing',
      voicingStyle: 'drop2',
      voicingSetStart: 1,
      voicingIndex: 3,
    });
    expect(single.material.type).toBe('chord');
    expect(single.material.steps.map((step) => step.chord)).toEqual([only]);
    expect(single.material.steps[0].voicingIndex).toBe(3);
    expect(single.voicing).toMatchObject({ shape: 'drop2', stringSet: 1 });

    expect(migrateV1({ viewMode: 'chord' }).material.type).toBe('progression');
    expect(migrateV1({ viewMode: 'chord' }).material.steps).toEqual([]);
  });

  it('turns a v1 progression of four chords into four steps', () => {
    const chords = [buildChord(0, 'maj'), buildChord(5, 'min'), buildChord(7, '7'), buildChord(10, 'maj7')];
    const state = migrateV1({
      viewMode: 'chord',
      activeChord: chords[2],
      voicingIndex: 4,
      soundOctave: 5,
      progression: { chords, tempo: 90, beatsPerChord: 4, loop: false, octave: 3 },
    });
    expect(state.material.type).toBe('progression');
    expect(state.material.steps.map((step) => step.chord)).toEqual(chords);
    expect(state.material.currentStep).toBe(2);
    expect(state.material.steps[2].voicingIndex).toBe(4);
    expect(state.material.steps[0].voicingIndex).toBe(0);
    expect(state.transport).toEqual({ tempo: 90, loop: false });
    expect(state.settings.sound.beatsPerStep).toBe(4);
    expect(state.settings.sound.octave).toBe(3);
  });

  it('keeps a progression that was saved while a scale was on screen', () => {
    const chords = [buildChord(0, 'maj'), buildChord(5, 'min')];
    const state = migrateV1({ viewMode: 'scale', progression: { chords, tempo: 120, loop: false } });
    expect(state.material.type).toBe('scale');
    expect(state.material.steps.map((step) => step.chord)).toEqual(chords);
    expect(state.transport).toEqual({ tempo: 120, loop: false });
  });

  it('lets the triad replace a saved progression', () => {
    const state = migrateV1({
      viewMode: 'triad',
      triadDegree: 0,
      rootPc: 10,
      progression: { chords: [buildChord(0, 'maj'), buildChord(5, 'min')] },
    });
    expect(state.material.type).toBe('chord');
    expect(state.material.steps).toHaveLength(1);
  });

  it('maps the controls the spec still has', () => {
    const viewed = migrateV1({
      instrumentView: 'keyboard',
      showStaff: true,
      displayMode: 'degree',
      labelMode: 'standard',
      ghostScale: false,
      guideTones: true,
      staffPitch: 'guitar',
    });
    expect(viewed.view).toMatchObject({
      staff: true,
      neck: false,
      keyboard: true,
      labels: 'degrees',
      names: 'standard',
      showKey: false,
      voiceMotion: true,
      staffPitch: 'guitar',
    });
    expect(migrateV1({ instrumentView: 'fretboard', showStaff: false }).view).toMatchObject({
      staff: false,
      neck: true,
      keyboard: false,
    });

    expect(
      migrateV1({ shapeMode: 'caged', shapeIndex: 3, positionWindow: { enabled: true, min: 3, max: 7 } }).material.scale,
    ).toEqual({ positions: 'caged', positionIndex: 3, fretRange: { enabled: true, min: 3, max: 7 } });

    expect(
      migrateV1({
        compareEnabled: true,
        compareRootPc: 2,
        compareFamilyKey: 'melodicMinor',
        compareModeKey: 'Altered',
      }).material.compare,
    ).toEqual({ enabled: true, rootPc: 2, familyKey: 'melodicMinor', modeKey: 'Altered' });

    expect(migrateV1({ chordDisplay: 'all', voicingStyle: 'drop2' }).voicing.shape).toBe('all');

    const preset = getPreset('6-bass-standard')!;
    const instrument = migrateV1({
      numStrings: 6,
      tuningId: preset.id,
      tuning: preset.notes,
      leftHanded: true,
      fretFrom: 2,
      fretTo: 14,
      hiddenStrings: [1, 1, 4],
      midiInputName: 'Keystation 61',
      showPlayedNotes: false,
      soundPlayedNotes: true,
    });
    expect(instrument.settings.instrument).toEqual({ numStrings: 6, tuning: preset.notes, leftHanded: true });
    expect(instrument.settings.neck).toEqual({ fretFrom: 2, fretTo: 14, hiddenStrings: [1, 4] });
    expect(instrument.settings.midi).toMatchObject({
      inputName: 'Keystation 61',
      showPlayed: false,
      soundPlayed: true,
      outputName: '',
      channel: 1,
    });

    const quiz = defaultNoteQuizSettings(7, 24);
    const practice = migrateV1({
      noteQuiz: {
        ...quiz,
        strings: [0, 2],
        fretMin: 1,
        fretMax: 4,
        keyContext: 'key',
        types: { nameNote: true, findNote: false, intervalFromRoot: true, earInterval: false },
      },
    });
    expect(practice.practice.spelling).toBe('key');
    expect(practice.practice.strings).toEqual([0, 2]);
    expect(practice.practice.fretMin).toBe(1);
    expect(practice.practice.fretMax).toBe(4);
    expect(practice.practice.questionTypes.findNote).toBe(false);
    expect(practice.practice.questionTypes.earInterval).toBe(false);
    expect(practice.practice.questionTypes.readStaff).toBe(false);

    expect(
      migrateV1({ keyboardOctaves: 2, keyboardSpanChosen: true, soundOctave: 3 }).settings.keyboard,
    ).toEqual({ octaves: 2, lowestMidi: cMidi(3) });
    expect(
      migrateV1({
        keyboardOctaves: 3,
        keyboardSpanChosen: true,
        controllerBaseOctave: 2,
        controllerOctaveShift: 1,
      }).settings.keyboard.lowestMidi,
    ).toBe(controllerWindow(2, 1).lowest);
    expect(migrateV1({ keyboardOctaves: 1 }).settings.keyboard.octaves).toBe(3);
  });

  it('returns v2 defaults for garbage and v1 defaults for an empty setup', () => {
    expect(migrateV1(null)).toEqual(createDefaultV2());
    expect(migrateV1(undefined)).toEqual(createDefaultV2());
    expect(migrateV1('garbage')).toEqual(createDefaultV2());
    expect(migrateV1(1)).toEqual(createDefaultV2());
    expect(migrateV1([])).toEqual(createDefaultV2());

    const fromEmpty = migrateV1({});
    const fromToday = migrateV1(createInitialState());
    const v1AsV2 = createDefaultV2();
    v1AsV2.view.staff = false;
    v1AsV2.view.voiceMotion = false;
    expect(fromEmpty).toEqual(v1AsV2);
    expect(fromToday).toEqual(v1AsV2);
  });

  it('accepts the storage wrapper as well as a flat app blob', () => {
    const chords = [buildChord(2, 'm7'), buildChord(7, '7')];
    const wrapped = migrateV1({
      app: { viewMode: 'chord', rootPc: 2 },
      progression: { chords },
    });
    expect(wrapped.material.type).toBe('progression');
    expect(wrapped.material.key.rootPc).toBe(2);
    expect(wrapped.material.steps.map((step) => step.chord)).toEqual(chords);
  });
});

describe('normalizeV2', () => {
  it('returns defaults for garbage and clamps the current step', () => {
    expect(normalizeV2(undefined)).toEqual(createDefaultV2());
    expect(normalizeV2('nope')).toEqual(createDefaultV2());
    expect(normalizeV2([])).toEqual(createDefaultV2());

    const chord = buildChord(0, 'maj');
    const step = (id: string, voicingIndex: number) => ({
      id,
      chord,
      locked: false,
      voicingIndex,
      source: 'manual' as const,
    });
    const clamped = normalizeV2({
      version: 2,
      material: {
        steps: [step('a', 1), step('b', 2), { id: 'c', chord, locked: false, voicingIndex: -5, source: 'manual' }],
        currentStep: 40,
      },
    });
    expect(clamped.material.steps).toHaveLength(3);
    expect(clamped.material.currentStep).toBe(2);
    expect(clamped.material.steps[2].voicingIndex).toBe(0);

    const dropped = normalizeV2({
      version: 2,
      material: {
        currentStep: 5,
        steps: [step('ok', 0), { id: 'bad', chord: { nope: true } }],
      },
    });
    expect(dropped.material.steps).toHaveLength(1);
    expect(dropped.material.currentStep).toBe(0);
  });

  it('clamps frets and strings to the instrument', () => {
    const preset = getPreset('6-bass-bb-standard')!;
    const out = normalizeV2({
      version: 2,
      settings: {
        instrument: { numStrings: 6, tuning: preset.notes },
        neck: { fretFrom: -4, fretTo: 40, hiddenStrings: [0, 0, 3, 9] },
      },
      material: { scale: { fretRange: { enabled: true, min: 30, max: 10 } } },
      practice: { fretMin: 50, fretMax: -1, strings: [1, 8, 1] },
    });
    expect(out.settings.instrument.numStrings).toBe(6);
    expect(out.settings.instrument.tuning).toEqual(preset.notes);
    expect(out.settings.neck.fretFrom).toBe(0);
    expect(out.settings.neck.fretTo).toBe(24);
    expect(out.settings.neck.hiddenStrings).toEqual([0, 3]);
    expect(out.material.scale.fretRange).toEqual({ enabled: true, min: 24, max: 24 });
    expect(out.practice.fretMin).toBe(24);
    expect(out.practice.fretMax).toBe(24);
    expect(out.practice.strings).toEqual([1]);
    expect(out.voicing.stringSet).toBeLessThan(6);
  });

  it('repairs a bad key and stays idempotent', () => {
    expect(normalizeV2({ material: { key: { familyKey: 'nope', modeKey: 'nope', rootPc: 99 } } }).material.key).toEqual({
      rootPc: 11,
      familyKey: 'major',
      modeKey: 'Ionian',
    });
    const once = migrateV1({ viewMode: 'triad', triadDegree: 2, rootPc: 10 });
    expect(normalizeV2(once)).toEqual(once);
    expect(normalizeV2(createDefaultV2())).toEqual(createDefaultV2());
  });
});
