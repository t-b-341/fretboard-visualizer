import { describe, expect, it } from 'vitest';
import { createInitialState } from './state/appState';
import type { AppState } from './state/appState';
import { buildChord } from './music/chords';
import { getPreset } from './music/tunings';
import { decodeState, encodeState } from './urlState';

const ENCODED_FIELDS = [
  'numStrings',
  'tuningId',
  'tuning',
  'fretCount',
  'rootPc',
  'familyKey',
  'modeKey',
  'viewMode',
  'triadDegree',
  'labelMode',
  'displayMode',
  'instrumentView',
  'showStaff',
  'staffPitch',
  'ghostScale',
  'compareEnabled',
  'compareRootPc',
  'compareFamilyKey',
  'compareModeKey',
  'sharedOnly',
  'positionWindow',
] as const satisfies readonly (keyof AppState)[];

function encoded(s: AppState): Record<string, unknown> {
  return Object.fromEntries(ENCODED_FIELDS.map((key) => [key, s[key]]));
}

describe('urlState', () => {
  it('encodes defaults to an empty string', () => {
    const defaults = createInitialState();
    expect(encodeState(defaults, defaults)).toBe('');
  });

  it('round-trips a non-default state on every encoded field', () => {
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
      activeChord: buildChord(0, 'maj'),
      picked: { 0: 3, 2: 5 },
      drone: true,
      voicingIndex: 4,
    };

    const query = encodeState(state, defaults);
    const back = decodeState(query, defaults);

    expect(encoded(back)).toEqual(encoded(state));
    expect(back.activeChord).toEqual(defaults.activeChord);
    expect(back.picked).toEqual(defaults.picked);
    expect(back.drone).toBe(defaults.drone);
    expect(back.voicingIndex).toBe(defaults.voicingIndex);
  });

  it('returns defaults for garbage values', () => {
    const defaults = createInitialState();
    const back = decodeState('k=99&fam=nope&v=zzz&w=9-2', defaults);
    expect(back.rootPc).toBe(defaults.rootPc);
    expect(back.familyKey).toBe(defaults.familyKey);
    expect(back.viewMode).toBe(defaults.viewMode);
    expect(back.positionWindow).toEqual(defaults.positionWindow);
  });

  it('round-trips a custom tuning', () => {
    const defaults = createInitialState();
    const tuning = defaults.tuning.map((note, index) =>
      index === 0 ? { pc: (note.pc + 1) % 12, octave: note.octave } : { ...note },
    );
    const state: AppState = { ...defaults, tuningId: 'custom', tuning };
    const back = decodeState(encodeState(state, defaults), defaults);
    expect(back.tuning).toEqual(state.tuning);
    expect(back.tuningId).toBe('custom');
    expect(back.numStrings).toBe(state.numStrings);
  });

  it('t=8-half-down sets numStrings to 8', () => {
    const defaults = createInitialState();
    const preset = getPreset('8-half-down')!;
    const back = decodeState('t=8-half-down', defaults);
    expect(back.numStrings).toBe(8);
    expect(back.tuningId).toBe(preset.id);
    expect(back.tuning).toEqual(preset.notes);
    expect(decodeState('?t=8-half-down', defaults).numStrings).toBe(8);
  });
});
