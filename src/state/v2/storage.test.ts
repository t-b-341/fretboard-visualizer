import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildChord } from '../../music/chords';
import { getPreset } from '../../music/tunings';
import { createDefaultV2 } from './defaults';
import {
  V1_STORAGE_KEY,
  V2_STORAGE_KEY,
  listNamed,
  loadLast,
  loadNamed,
  removeNamed,
  resetState,
  saveLast,
  saveNamed,
  startState,
} from './storage';
import { formatMyDefault } from './myDefault';

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

describe('v2 storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('saves and loads the last session without keeping the caller’s object', () => {
    installMemory();
    const state = createDefaultV2();
    state.material.key.rootPc = 4;
    saveLast(state);
    state.material.key.rootPc = 9;
    expect(loadLast()?.material.key.rootPc).toBe(4);
  });

  it('migrates v1 once and leaves the v1 value untouched', () => {
    const chords = [buildChord(0, 'maj'), buildChord(5, 'min'), buildChord(7, '7'), buildChord(2, 'm7')];
    const document = {
      version: 1,
      last: {
        app: { rootPc: 3, viewMode: 'chord' },
        progression: { tempo: 80, chords },
      },
      named: [
        {
          id: 'keep-me',
          name: '  four chords  ',
          savedAt: 1735689600000,
          app: { rootPc: 3, viewMode: 'chord' },
          progression: { tempo: 80, chords },
        },
      ],
    };
    const original = JSON.stringify(document);
    const memory = installMemory();
    memory.set(V1_STORAGE_KEY, original);

    const last = loadLast();
    expect(memory.get(V1_STORAGE_KEY)).toBe(original);
    expect(last?.material.type).toBe('progression');
    expect(last?.material.key.rootPc).toBe(3);
    expect(last?.material.steps.map((step) => step.chord)).toEqual(chords);
    expect(memory.get(V2_STORAGE_KEY)).toBeTruthy();

    expect(loadLast()?.material.key.rootPc).toBe(3);
    expect(memory.get(V1_STORAGE_KEY)).toBe(original);
    expect(listNamed()).toEqual([{ id: 'keep-me', name: 'four chords', savedAt: 1735689600000 }]);
    expect(loadNamed('keep-me')?.material.steps.map((step) => step.chord)).toEqual(chords);
  });

  it('does not re-read v1 when v2 is already there', () => {
    const memory = installMemory();
    const saved = createDefaultV2();
    saved.material.key.rootPc = 4;
    memory.set(V2_STORAGE_KEY, JSON.stringify({ version: 2, last: saved, named: [] }));
    const v1 = JSON.stringify({
      version: 1,
      last: { app: { rootPc: 1, viewMode: 'scale' }, progression: { chords: [] } },
      named: [],
    });
    memory.set(V1_STORAGE_KEY, v1);
    expect(loadLast()?.material.key.rootPc).toBe(4);
    expect(memory.get(V1_STORAGE_KEY)).toBe(v1);
  });

  it('caps named setups at 24 and trims the name', () => {
    installMemory();
    for (let i = 0; i < 30; i++) saveNamed(`setup ${i}`, createDefaultV2());
    const named = listNamed();
    expect(named).toHaveLength(24);
    expect(named[0].name).toBe('setup 29');
    expect(named[23].name).toBe('setup 6');

    saveNamed(`  ${'n'.repeat(50)}  `, createDefaultV2());
    expect(listNamed()[0].name).toHaveLength(40);

    const id = named[0].id;
    removeNamed(id);
    expect(listNamed().some((item) => item.id === id)).toBe(false);
    expect(loadNamed(id)).toBeNull();
  });

  it('still works when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
    });
    expect(loadLast()).toBeNull();
    expect(listNamed()).toEqual([]);
    expect(loadNamed('x')).toBeNull();
    expect(() => saveLast(createDefaultV2())).not.toThrow();
    expect(() => saveNamed('A', createDefaultV2())).not.toThrow();
    expect(() => removeNamed('x')).not.toThrow();
    expect(startState()).toEqual(createDefaultV2());
  });
});

describe('startState', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses defaults when nothing is saved', () => {
    installMemory();
    expect(startState()).toEqual(createDefaultV2());
  });

  it('uses my default only when the session asked for it', () => {
    installMemory();
    const session = createDefaultV2();
    session.material.key.rootPc = 2;
    session.settings.sound.drone = true;
    session.transport.tempo = 140;
    session.settings.myDefault = {
      rootPc: 5,
      familyKey: 'major',
      modeKey: 'Dorian',
      names: 'standard',
      numStrings: 6,
      tuningPresetId: '6-bass-standard',
    };

    saveLast(session);
    const last = startState();
    expect(last.material.key.rootPc).toBe(2);
    expect(last.settings.sound.drone).toBe(true);
    expect(last.settings.instrument.numStrings).toBe(7);
    expect(last.transport.tempo).toBe(140);

    session.settings.startIn = 'default';
    saveLast(session);
    const booted = startState();
    const preset = getPreset('6-bass-standard')!;
    expect(booted.material.key).toEqual({ rootPc: 5, familyKey: 'major', modeKey: 'Dorian' });
    expect(booted.view.names).toBe('standard');
    expect(booted.settings.instrument.numStrings).toBe(6);
    expect(booted.settings.instrument.tuning).toEqual(preset.notes);
    expect(booted.settings.sound.drone).toBe(false);
    expect(booted.transport.tempo).toBe(createDefaultV2().transport.tempo);
    expect(booted.settings.startIn).toBe('default');
    expect(booted.settings.myDefault).toMatchObject({ rootPc: 5, modeKey: 'Dorian', numStrings: 6, names: 'standard' });
    expect(booted.view.staff).toBe(true);

    const preferenceOnly = createDefaultV2();
    preferenceOnly.settings.startIn = 'default';
    preferenceOnly.material.key.rootPc = 3;
    saveLast(preferenceOnly);
    expect(startState().material.key.rootPc).toBe(3);
  });

  it('resets to my default when one is set, and to the factory setup otherwise', () => {
    const session = createDefaultV2();
    session.material.key.rootPc = 2;
    session.transport.tempo = 180;
    session.settings.startIn = 'last';
    session.settings.myDefault = {
      rootPc: 3,
      familyKey: 'major',
      modeKey: 'Aeolian',
      names: 'standard',
      numStrings: 7,
      tuningPresetId: '7-half-down',
    };
    const reset = resetState(session);
    const preset = getPreset('7-half-down')!;
    expect(reset.material.key).toEqual({ rootPc: 3, familyKey: 'major', modeKey: 'Aeolian' });
    expect(reset.view.names).toBe('standard');
    expect(reset.settings.startIn).toBe('last');
    expect(reset.settings.myDefault?.rootPc).toBe(3);
    expect(reset.transport.tempo).toBe(createDefaultV2().transport.tempo);
    expect(reset.settings.instrument.tuning).toEqual(preset.notes);

    const plain = createDefaultV2();
    plain.material.key.rootPc = 2;
    plain.settings.startIn = 'last';
    const fresh = resetState(plain);
    expect(fresh.material.key.rootPc).toBe(createDefaultV2().material.key.rootPc);
    expect(fresh.settings.startIn).toBe('last');
    expect(fresh.settings.myDefault).toBeNull();
  });
});

describe('formatMyDefault', () => {
  it('names the saved key, and the sounding pitch when names are Standard', () => {
    expect(
      formatMyDefault({
        rootPc: 3,
        familyKey: 'major',
        modeKey: 'Aeolian',
        names: 'standard',
        numStrings: 7,
        tuningPresetId: '7-half-down',
      }),
    ).toEqual({
      summary: 'E minor (Aeolian), Standard names, 7-string half step down',
      soundsAs: 'Sounds as Eb minor',
    });
    expect(
      formatMyDefault({
        rootPc: 4,
        familyKey: 'major',
        modeKey: 'Aeolian',
        names: 'concert',
        numStrings: 7,
        tuningPresetId: '7-half-down',
      }).soundsAs,
    ).toBeNull();
  });
});
