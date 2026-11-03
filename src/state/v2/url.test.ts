import { describe, expect, it } from 'vitest';
import { buildChord, getDiatonicTriad } from '../../music/chords';
import { getFamily, parentScale } from '../../music/scales';
import { getPreset } from '../../music/tunings';
import { createInitialState } from '../appState';
import type { AppState } from '../appState';
import { encodeState } from '../../urlState';
import { createDefaultV2 } from './defaults';
import type { AppStateV2 } from './types';
import { readUrl, writeUrl } from './url';

function ionian(): number[] {
  const mode = getFamily('major').modes.find((item) => item.key === 'Ionian') ?? getFamily('major').modes[0];
  return parentScale(mode.intervals).intervals;
}

function shared(state: AppStateV2) {
  return {
    type: state.material.type,
    key: state.material.key,
    compare: state.material.compare,
    fretRange: state.material.scale.fretRange,
    staff: state.view.staff,
    neck: state.view.neck,
    keyboard: state.view.keyboard,
    labels: state.view.labels,
    names: state.view.names,
    showKey: state.view.showKey,
    staffPitch: state.view.staffPitch,
    numStrings: state.settings.instrument.numStrings,
    tuning: state.settings.instrument.tuning,
    fretFrom: state.settings.neck.fretFrom,
    fretTo: state.settings.neck.fretTo,
  };
}

describe('v2 url', () => {
  it('round-trips the default setup and an explicit staff-off setup', () => {
    expect(readUrl('')).toEqual(createDefaultV2());
    expect(readUrl('?')).toEqual(createDefaultV2());
    expect(readUrl(writeUrl(createDefaultV2()))).toEqual(createDefaultV2());

    const staffOff = createDefaultV2();
    staffOff.view.staff = false;
    expect(writeUrl(staffOff)).toContain('sf=0');
    expect(readUrl(writeUrl(staffOff))).toEqual(staffOff);
  });

  it('round-trips the fields today’s query string can carry', () => {
    const preset = getPreset('6-bass-standard')!;
    const state = createDefaultV2();
    state.settings.instrument.numStrings = 6;
    state.settings.instrument.tuning = preset.notes.map((note) => ({ ...note }));
    state.settings.neck.fretTo = 18;
    state.material.key = { rootPc: 5, familyKey: 'harmonicMinor', modeKey: 'PhrygianDominant' };
    state.material.type = 'progression';
    state.material.steps = [
      {
        id: 'step-1',
        chord: buildChord(5, 'min'),
        locked: true,
        voicingIndex: 2,
        source: 'manual',
      },
    ];
    state.material.scale.positions = 'caged';
    state.material.scale.fretRange = { enabled: true, min: 2, max: 14 };
    state.material.compare = { enabled: true, rootPc: 2, familyKey: 'melodicMinor', modeKey: 'Altered' };
    state.view.labels = 'degrees';
    state.view.names = 'standard';
    state.view.keyboard = false;
    state.view.staffPitch = 'guitar';
    state.view.showKey = false;
    state.settings.sound.drone = true;

    const back = readUrl(writeUrl(state));
    const expected = shared(state);
    expected.fretFrom = 0;
    expect(shared(back)).toEqual(expected);
    expect(back.material.steps).toEqual([]);
    expect(back.material.scale.positions).toBe('all');
    expect(back.settings.sound.drone).toBe(false);
  });

  it('round-trips a custom tuning and a diatonic triad step', () => {
    const custom = createDefaultV2();
    custom.settings.instrument.tuning = custom.settings.instrument.tuning.map((note, index) =>
      index === 0 ? { pc: (note.pc + 1) % 12, octave: note.octave } : { ...note },
    );
    expect(readUrl(writeUrl(custom)).settings.instrument.tuning).toEqual(custom.settings.instrument.tuning);

    const triad = getDiatonicTriad(0, ionian(), 4);
    const chord = createDefaultV2();
    chord.material.key = { rootPc: 0, familyKey: 'major', modeKey: 'Ionian' };
    chord.material.type = 'chord';
    chord.material.steps = [
      { id: 'step-1', chord: buildChord(triad.rootPc, triad.quality), locked: false, voicingIndex: 0, source: 'manual' },
    ];
    const back = readUrl(writeUrl(chord));
    expect(back.material.type).toBe('chord');
    expect(back.material.steps).toHaveLength(1);
    expect(back.material.steps[0].chord).toEqual(chord.material.steps[0].chord);
  });

  it('opens an old share link on the same setup', () => {
    const defaults = createInitialState();
    const preset = getPreset('6-bass-standard')!;
    const state: AppState = {
      ...defaults,
      numStrings: 6,
      tuningId: preset.id,
      tuning: preset.notes.map((note) => ({ ...note })),
      fretCount: 18,
      rootPc: 5,
      familyKey: 'harmonicMinor',
      modeKey: 'PhrygianDominant',
      viewMode: 'identify',
      triadDegree: 4,
      labelMode: 'standard',
      displayMode: 'degree',
      instrumentView: 'fretboard',
      showStaff: true,
      staffPitch: 'guitar',
      ghostScale: false,
      compareEnabled: true,
      compareRootPc: 2,
      compareFamilyKey: 'melodicMinor',
      compareModeKey: 'Altered',
      sharedOnly: true,
      positionWindow: { enabled: true, min: 2, max: 14 },
    };

    const back = readUrl(encodeState(state, defaults));
    expect(back.material.type).toBe('scale');
    expect(back.material.steps).toEqual([]);
    expect(back.material.key).toEqual({ rootPc: 5, familyKey: 'harmonicMinor', modeKey: 'PhrygianDominant' });
    expect(back.material.compare).toEqual({ enabled: true, rootPc: 2, familyKey: 'melodicMinor', modeKey: 'Altered' });
    expect(back.material.scale.fretRange).toEqual({ enabled: true, min: 2, max: 14 });
    expect(back.view).toMatchObject({
      staff: true,
      neck: true,
      keyboard: false,
      labels: 'degrees',
      names: 'standard',
      showKey: false,
      staffPitch: 'guitar',
    });
    expect(back.settings.instrument.numStrings).toBe(6);
    expect(back.settings.instrument.tuning).toEqual(preset.notes);
    expect(back.settings.neck.fretTo).toBe(18);
    expect(back.practice.questionTypes.chordTones).toBe(false);
  });

  it('opens a triad link as one chord step', () => {
    const back = readUrl('v=triad&td=4&k=0');
    const triad = getDiatonicTriad(0, ionian(), 4);
    expect(back.material.type).toBe('chord');
    expect(back.material.key.rootPc).toBe(0);
    expect(back.material.steps).toHaveLength(1);
    expect(back.material.steps[0].chord).toEqual(buildChord(triad.rootPc, triad.quality));
    expect(back.view.staff).toBe(false);
    expect(readUrl('v=quiz').material.type).toBe('scale');
    expect(readUrl('v=quiz').practice.questionTypes.chordTones).toBe(true);
    expect(readUrl('v=chord').material.type).toBe('progression');
  });

  it('ignores garbage params', () => {
    const back = readUrl('k=99&fam=nope&v=zzz&w=9-2');
    expect(back.material.key.rootPc).toBe(createDefaultV2().material.key.rootPc);
    expect(back.material.key.familyKey).toBe('major');
    expect(back.material.type).toBe('scale');
    expect(back.material.scale.fretRange.enabled).toBe(false);
    expect(back.view.staff).toBe(false);
  });
});
