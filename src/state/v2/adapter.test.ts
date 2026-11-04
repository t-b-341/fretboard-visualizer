import { describe, expect, it } from 'vitest';
import { buildChord } from '../../music/chords';
import { defaultProgression } from '../appState';
import type { ProgressionSnapshot } from '../appState';
import { deriveView } from '../derive';
import { createDefaultV2 } from './defaults';
import type { AppStateV2, Step } from './types';
import { toLegacy } from './adapter';

function step(chord: ReturnType<typeof buildChord>, index: number, voicingIndex = 0): Step {
  return { id: `step-${index + 1}`, chord, locked: false, voicingIndex, source: 'manual' };
}

function sessionFor(state: AppStateV2): ProgressionSnapshot {
  return {
    ...defaultProgression(),
    chords: state.material.steps.map((item) => item.chord),
    tempo: state.transport.tempo,
    loop: state.transport.loop,
  };
}

describe('toLegacy', () => {
  it('maps a scale, including one with saved steps, onto the scale view', () => {
    const state = createDefaultV2();
    state.material.type = 'scale';
    state.material.key = { rootPc: 5, familyKey: 'harmonicMinor', modeKey: 'PhrygianDominant' };
    state.material.steps = [step(buildChord(0, 'maj'), 0)];
    state.material.currentStep = 0;
    state.view.labels = 'degrees';
    state.view.names = 'standard';
    state.view.staff = true;
    state.view.neck = false;
    state.view.keyboard = true;
    state.view.showKey = false;

    const legacy = toLegacy(state);
    expect(legacy.viewMode).toBe('scale');
    expect(legacy.activeChord).toBeNull();
    expect(legacy.rootPc).toBe(5);
    expect(legacy.familyKey).toBe('harmonicMinor');
    expect(legacy.modeKey).toBe('PhrygianDominant');
    expect(legacy.displayMode).toBe('degree');
    expect(legacy.labelMode).toBe('standard');
    expect(legacy.showStaff).toBe(true);
    expect(legacy.instrumentView).toBe('keyboard');
    expect(legacy.ghostScale).toBe(false);
    expect(deriveView(legacy, sessionFor(state), null).shift).toBe(1);
  });

  it('maps a chord onto the current step and its voicing', () => {
    const chord = buildChord(7, 'm7');
    const state = createDefaultV2();
    state.material.type = 'chord';
    state.material.steps = [step(chord, 0, 4)];
    state.voicing = { shape: 'drop2', stringSet: 1, smooth: true };

    const legacy = toLegacy(state);
    expect(legacy.viewMode).toBe('chord');
    expect(legacy.activeChord).toEqual(chord);
    expect(legacy.chordDisplay).toBe('voicing');
    expect(legacy.voicingStyle).toBe('drop2');
    expect(legacy.voicingWidth).toBe(4);
    expect(legacy.voicingIndex).toBe(4);
    expect(legacy.voicingSetStart).toBe(1);
    expect(deriveView(legacy, sessionFor(state), null).activeChordSymbol).toBe('Gm7');
  });

  it('maps a progression onto the current step', () => {
    const chords = [buildChord(2, 'maj'), buildChord(7, 'maj'), buildChord(9, 'maj')];
    const state = createDefaultV2();
    state.material.type = 'progression';
    state.material.key = { rootPc: 2, familyKey: 'major', modeKey: 'Ionian' };
    state.material.steps = chords.map((chord, index) => step(chord, index, index === 2 ? 3 : 0));
    state.material.currentStep = 2;
    state.voicing.shape = 'close';

    const legacy = toLegacy(state);
    expect(legacy.viewMode).toBe('chord');
    expect(legacy.activeChord).toEqual(chords[2]);
    expect(legacy.voicingIndex).toBe(3);
    expect(legacy.chordDisplay).toBe('voicing');
    expect(legacy.voicingStyle).toBe('close');
    const derived = deriveView(legacy, sessionFor(state), null);
    expect(derived.activeChordSymbol).toBe('A');
    expect(derived.activeChordRoman).toBe('V');
  });
});
