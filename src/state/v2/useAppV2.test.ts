import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WEIGHTS } from '../../music/voiceLeading';
import { defaultNoteQuizSettings } from '../../music/quiz';
import { createDefaultV2 } from './defaults';
import { V2_STORAGE_KEY, loadLast } from './storage';
import { writeUrl } from './url';
import type { AppStateV2, Step } from './types';
import { buildChord } from '../../music/chords';
import { initialAppV2, reduceApp, scheduleLastSave } from './useAppV2';

function installMemory() {
  const memory = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => {
      memory.clear();
    },
  });
  return memory;
}

function withSteps(count: number): AppStateV2 {
  const state = createDefaultV2();
  const steps: Step[] = Array.from({ length: count }, (_, index) => ({
    id: `step-${index + 1}`,
    chord: buildChord(index, 'maj'),
    locked: false,
    voicingIndex: 0,
    source: 'manual',
  }));
  state.material.steps = steps;
  state.material.currentStep = 0;
  return state;
}

describe('initialAppV2', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the last session when the query is empty and the url when it is not', () => {
    const memory = installMemory();
    const saved = createDefaultV2();
    saved.material.key.rootPc = 3;
    memory.set(V2_STORAGE_KEY, JSON.stringify({ version: 2, last: saved, named: [] }));
    expect(initialAppV2('').material.key.rootPc).toBe(3);
    expect(initialAppV2('?').material.key.rootPc).toBe(3);

    const linked = createDefaultV2();
    linked.material.key.rootPc = 7;
    expect(initialAppV2(writeUrl(linked)).material.key.rootPc).toBe(7);
    expect(initialAppV2(`?${writeUrl(linked)}#practice`).material.key.rootPc).toBe(7);
  });
});

describe('reduceApp', () => {
  it('changes material type without dropping steps', () => {
    const state = withSteps(2);
    const next = reduceApp(state, { type: 'setMaterialType', material: 'progression' });
    expect(next.material.type).toBe('progression');
    expect(next.material.steps).toBe(state.material.steps);
    expect(state.material.type).toBe('scale');
    expect(reduceApp(next, { type: 'setMaterialType', material: 'progression' })).toBe(next);
  });

  it('patches view flags and leaves the rest', () => {
    const state = createDefaultV2();
    const next = reduceApp(state, { type: 'setView', view: { staff: false, labels: 'degrees', names: 'standard' } });
    expect(next.view.staff).toBe(false);
    expect(next.view.labels).toBe('degrees');
    expect(next.view.names).toBe('standard');
    expect(next.view.neck).toBe(true);
    expect(next.view.keyboard).toBe(true);
    expect(reduceApp(next, { type: 'setView', view: { staff: false } })).toBe(next);
  });

  it('steps between chords and stops at the ends', () => {
    const state = withSteps(3);
    const middle = reduceApp(state, { type: 'nextStep' });
    expect(middle.material.currentStep).toBe(1);
    expect(reduceApp(state, { type: 'prevStep' })).toBe(state);
    const end = reduceApp(middle, { type: 'setCurrentStep', index: 9 });
    expect(end.material.currentStep).toBe(2);
    expect(reduceApp(end, { type: 'nextStep' })).toBe(end);
    expect(reduceApp(createDefaultV2(), { type: 'nextStep' }).material.currentStep).toBe(0);
  });

  it('saves every practice question type', () => {
    const state = createDefaultV2();
    const settings = defaultNoteQuizSettings(7, 24);
    settings.types.nameNote = false;
    settings.types.chordTone = true;
    settings.types.readStaff = true;
    settings.keyContext = 'key';
    const next = reduceApp(state, { type: 'setNoteQuiz', settings });
    expect(next.practice.questionTypes.chordTones).toBe(true);
    expect(next.practice.questionTypes.readStaff).toBe(true);
    expect(next.practice.questionTypes.nameNote).toBe(false);
    expect(next.practice.spelling).toBe('key');
  });

  it('sets the key, the start-in choice, and my default from the current setup', () => {
    const state = createDefaultV2();
    const keyed = reduceApp(state, { type: 'setKey', key: { rootPc: 4, familyKey: 'major', modeKey: 'Aeolian' } });
    expect(keyed.material.key).toEqual({ rootPc: 4, familyKey: 'major', modeKey: 'Aeolian' });
    expect(keyed.material.steps).toBe(state.material.steps);
    expect(reduceApp(keyed, { type: 'setKey', key: keyed.material.key })).toBe(keyed);

    const named = reduceApp(keyed, { type: 'setView', view: { names: 'standard' } });
    const saved = reduceApp(named, { type: 'setMyDefault' });
    expect(saved.settings.myDefault).toEqual({
      rootPc: 4,
      familyKey: 'major',
      modeKey: 'Aeolian',
      names: 'standard',
      numStrings: 7,
      tuningPresetId: '7-half-down',
    });
    expect(named.settings.myDefault).toBeNull();
    expect(reduceApp(saved, { type: 'setMyDefault' })).toBe(saved);

    const chosen = reduceApp(saved, { type: 'setStartIn', startIn: 'default' });
    expect(chosen.settings.startIn).toBe('default');
    const changed = reduceApp(chosen, { type: 'setKey', key: { rootPc: 0, familyKey: 'major', modeKey: 'Ionian' } });
    const reset = reduceApp(changed, { type: 'reset' });
    expect(reset.material.key).toEqual({ rootPc: 4, familyKey: 'major', modeKey: 'Aeolian' });
    expect(reset.view.names).toBe('standard');
    expect(reset.settings.startIn).toBe('default');
  });

  it('adds steps, switches to a progression, and keeps a locked step when suggesting', () => {
    const state = createDefaultV2();
    const first = reduceApp(state, { type: 'addChord', chord: buildChord(0, 'm7'), id: 'a' });
    expect(first.material.type).toBe('chord');
    expect(first.material.steps).toHaveLength(1);
    expect(first.material.steps[0].source).toBe('manual');
    const second = reduceApp(first, { type: 'addChord', chord: buildChord(5, '7'), id: 'b' });
    expect(second.material.type).toBe('progression');
    const locked = reduceApp(second, { type: 'toggleLock', index: 1 });
    expect(locked.material.steps[1].locked).toBe(true);
    const suggested = reduceApp(locked, {
      type: 'suggest',
      style: 'jazz',
      borrowed: false,
      seed: 1,
      ids: ['n1', 'n2', 'n3'],
    });
    expect(suggested.material.steps[1].chord).toEqual(buildChord(5, '7'));
    expect(suggested.material.steps[1].locked).toBe(true);
    expect(suggested.material.steps[0].source).toBe('suggested');
    expect(suggested.material.steps.length).toBeGreaterThanOrEqual(2);
    const rerolled = reduceApp(suggested, { type: 'rerollStep', index: 0, seed: 3 });
    expect(rerolled.material.steps[1]).toBe(suggested.material.steps[1]);
    expect(rerolled.material.steps[0].chord).not.toEqual(suggested.material.steps[0].chord);
  });

  it('adds an identified chord as the step it names, and can replace the current one', () => {
    const state = createDefaultV2();
    const added = reduceApp(state, { type: 'addIdentified', chord: buildChord(2, 'maj'), bassPc: 2, id: 'd' });
    expect(added.material.type).toBe('chord');
    expect(added.material.currentStep).toBe(0);
    expect(added.material.steps).toHaveLength(1);
    expect(added.material.steps[0].source).toBe('identified');
    expect(added.material.steps[0].bassPc).toBeUndefined();
    expect(added.material.steps[0].chord.rootPc).toBe(2);
    expect(state.material.type).toBe('scale');
    expect(state.material.steps).toHaveLength(0);

    const slash = reduceApp(added, { type: 'addIdentified', chord: buildChord(9, 'm7'), bassPc: 0, id: 'am' });
    expect(slash.material.type).toBe('progression');
    expect(slash.material.currentStep).toBe(1);
    expect(slash.material.steps[1].source).toBe('identified');
    expect(slash.material.steps[1].bassPc).toBe(0);
    expect(slash.material.steps[0]).toBe(added.material.steps[0]);

    const replaced = reduceApp(slash, { type: 'replaceIdentified', chord: buildChord(0, 'maj'), bassPc: 4 });
    expect(replaced.material.type).toBe('progression');
    expect(replaced.material.steps).toHaveLength(2);
    expect(replaced.material.currentStep).toBe(1);
    expect(replaced.material.steps[1].chord.rootPc).toBe(0);
    expect(replaced.material.steps[1].bassPc).toBe(4);
    expect(replaced.material.steps[1].source).toBe('identified');
    expect(replaced.material.steps[1].id).toBe('am');
    expect(replaced.material.steps[0]).toBe(slash.material.steps[0]);
    expect(reduceApp(createDefaultV2(), { type: 'replaceIdentified', chord: buildChord(0, 'maj'), bassPc: 0 })).toEqual(
      createDefaultV2(),
    );
  });
});

describe('settings', () => {
  it('re-clamps practice strings and frets when the instrument changes and keeps the key', () => {
    const state = createDefaultV2();
    const quiz = defaultNoteQuizSettings(8, 24);
    quiz.strings = [0, 1, 2, 3, 4, 5, 6, 7];
    quiz.fretMax = 30;
    const quizzed = reduceApp(state, { type: 'setNoteQuiz', settings: quiz });
    const eight = reduceApp(quizzed, { type: 'setNumStrings', numStrings: 8 });
    expect(eight.settings.instrument.numStrings).toBe(8);
    expect(eight.settings.instrument.tuning).toHaveLength(8);
    expect(eight.material.key).toEqual(state.material.key);
    expect(eight.practice.fretMax).toBe(24);
    expect(eight.practice.strings).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const hidden = reduceApp(eight, { type: 'setNeck', neck: { hiddenStrings: [5, 6, 7] } });
    expect(hidden.settings.neck.hiddenStrings).toEqual([5, 6, 7]);

    const six = reduceApp(hidden, { type: 'setNumStrings', numStrings: 6 });
    expect(six.settings.instrument.numStrings).toBe(6);
    expect(six.settings.instrument.tuning).toHaveLength(6);
    expect(six.practice.strings).toEqual([0, 1, 2, 3, 4, 5]);
    expect(six.settings.neck.hiddenStrings).toEqual([5]);
    expect(six.material.key).toEqual(state.material.key);
    expect(reduceApp(six, { type: 'setNumStrings', numStrings: 6 })).toBe(six);
  });

  it('restores the voice-leading defaults', () => {
    const state = createDefaultV2();
    const changed = reduceApp(state, {
      type: 'setWeights',
      weights: { ...state.settings.voiceLeadingWeights, handShift: 3, roleMotion: { ...state.settings.voiceLeadingWeights.roleMotion } },
    });
    expect(changed.settings.voiceLeadingWeights.handShift).toBe(3);
    const reset = reduceApp(changed, { type: 'resetWeights' });
    expect(reset.settings.voiceLeadingWeights).toEqual(DEFAULT_WEIGHTS);
    expect(reduceApp(reset, { type: 'resetWeights' })).toBe(reset);
  });
});

describe('scheduleLastSave', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('writes the last session after 250ms and not before', () => {
    vi.useFakeTimers();
    installMemory();
    const state = createDefaultV2();
    state.material.type = 'chord';
    const cancel = scheduleLastSave(state);
    vi.advanceTimersByTime(249);
    expect(loadLast()).toBeNull();
    vi.advanceTimersByTime(1);
    expect(loadLast()?.material.type).toBe('chord');
    cancel();
  });

  it('does not write when cancelled', () => {
    vi.useFakeTimers();
    installMemory();
    const cancel = scheduleLastSave(createDefaultV2());
    cancel();
    vi.advanceTimersByTime(1000);
    expect(loadLast()).toBeNull();
  });
});
