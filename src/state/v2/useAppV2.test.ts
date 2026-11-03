import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('keeps practice question types the quiz does not edit', () => {
    const state = createDefaultV2();
    state.practice.questionTypes.chordTones = true;
    const settings = defaultNoteQuizSettings(7, 24);
    settings.types.nameNote = false;
    settings.keyContext = 'key';
    const next = reduceApp(state, { type: 'setNoteQuiz', settings });
    expect(next.practice.questionTypes.chordTones).toBe(true);
    expect(next.practice.questionTypes.nameNote).toBe(false);
    expect(next.practice.spelling).toBe('key');
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
