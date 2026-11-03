// Last session and up to 24 named setups. The v2 key is
// fretboard-visualizer:setups:v2. When that key is missing, a v1 store is
// copied across once. The v1 key is never written.

import { defaultPresetForStrings, getPreset } from '../../music/tunings';
import { createDefaultV2 } from './defaults';
import { migrateV1, normalizeV2 } from './migrate';
import type { AppStateV2, MyDefault, NumStrings } from './types';

export const V2_STORAGE_KEY = 'fretboard-visualizer:setups:v2';
export const V1_STORAGE_KEY = 'fretboard-visualizer:setups:v1';

const NAMED_LIMIT = 24;
const NAME_LIMIT = 40;

export interface NamedSetupMeta {
  id: string;
  name: string;
  savedAt: number;
}

interface StoredNamed {
  id: string;
  name: string;
  savedAt: number;
  state: unknown;
}

interface StoreV2 {
  version: 2;
  last: unknown;
  named: StoredNamed[];
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined' || !localStorage) return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readKey(key: string): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    getStorage()?.setItem(key, value);
  } catch {
    /* private mode, or the disk is full — the session simply isn't remembered */
  }
}

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function emptyStore(): StoreV2 {
  return { version: 2, last: null, named: [] };
}

function readNamedEntry(v: unknown): StoredNamed | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !v.id) return null;
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name.trim().slice(0, NAME_LIMIT) : '',
    savedAt: typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) ? v.savedAt : 0,
    state: v.state,
  };
}

function parseV2(raw: string): StoreV2 | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 2) return null;
    const named = Array.isArray(parsed.named)
      ? parsed.named.map(readNamedEntry).filter((item): item is StoredNamed => !!item).slice(0, NAMED_LIMIT)
      : [];
    return { version: 2, last: parsed.last ?? null, named };
  } catch {
    return null;
  }
}

function migrateNamed(v: unknown): StoredNamed | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !v.id) return null;
  return {
    id: v.id,
    name: typeof v.name === 'string' ? v.name.trim().slice(0, NAME_LIMIT) : '',
    savedAt: typeof v.savedAt === 'number' && Number.isFinite(v.savedAt) ? v.savedAt : Date.now(),
    state: migrateV1({ app: v.app, progression: v.progression }),
  };
}

/** Read v1 and produce a v2 store. Returns null when v1 has nothing to keep. Does not write v1. */
function migrateV1Store(raw: string): StoreV2 | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1) return null;
    const named = Array.isArray(parsed.named)
      ? parsed.named.map(migrateNamed).filter((item): item is StoredNamed => !!item).slice(0, NAMED_LIMIT)
      : [];
    const last = isRecord(parsed.last)
      ? migrateV1({ app: parsed.last.app, progression: parsed.last.progression })
      : null;
    if (!last && named.length === 0) return null;
    return { version: 2, last, named };
  } catch {
    return null;
  }
}

function readStore(): StoreV2 {
  const existing = readKey(V2_STORAGE_KEY);
  if (existing != null) {
    const parsed = parseV2(existing);
    if (parsed) return parsed;
  }
  const legacy = readKey(V1_STORAGE_KEY);
  if (legacy != null) {
    const migrated = migrateV1Store(legacy);
    if (migrated) {
      writeKey(V2_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }
  return emptyStore();
}

function writeStore(store: StoreV2) {
  writeKey(V2_STORAGE_KEY, JSON.stringify(store));
}

function metas(store: StoreV2): NamedSetupMeta[] {
  return store.named.map((item) => ({ id: item.id, name: item.name, savedAt: item.savedAt }));
}

export function loadLast(): AppStateV2 | null {
  try {
    const last = readStore().last;
    if (last == null) return null;
    return normalizeV2(last);
  } catch {
    return null;
  }
}

export function saveLast(state: AppStateV2) {
  try {
    const store = readStore();
    store.last = normalizeV2(state);
    writeStore(store);
  } catch {
    /* blocked */
  }
}

export function listNamed(): NamedSetupMeta[] {
  try {
    return metas(readStore());
  } catch {
    return [];
  }
}

export function saveNamed(name: string, state: AppStateV2): NamedSetupMeta[] {
  try {
    const store = readStore();
    const setup: StoredNamed = {
      id: newId(),
      name: (typeof name === 'string' ? name : '').trim().slice(0, NAME_LIMIT),
      savedAt: Date.now(),
      state: normalizeV2(state),
    };
    store.named = [setup, ...store.named].slice(0, NAMED_LIMIT);
    writeStore(store);
    return metas(store);
  } catch {
    return [];
  }
}

export function loadNamed(id: string): AppStateV2 | null {
  try {
    const found = readStore().named.find((item) => item.id === id);
    if (!found) return null;
    return normalizeV2(found.state);
  } catch {
    return null;
  }
}

export function removeNamed(id: string): NamedSetupMeta[] {
  try {
    const store = readStore();
    store.named = store.named.filter((item) => item.id !== id);
    writeStore(store);
    return metas(store);
  } catch {
    return [];
  }
}

function presetStringCount(id: string): NumStrings | null {
  const preset = getPreset(id);
  if (!preset) return null;
  return preset.strings === 6 || preset.strings === 7 || preset.strings === 8 ? preset.strings : null;
}

/** Defaults, with the saved "My default" key, names, and tuning laid on top. */
function applyMyDefault(mine: MyDefault): AppStateV2 {
  const presetCount = presetStringCount(mine.tuningPresetId);
  const numStrings = presetCount ?? mine.numStrings;
  const preset = getPreset(mine.tuningPresetId);
  const notes = preset && preset.strings === numStrings ? preset.notes : defaultPresetForStrings(numStrings).notes;
  const base = createDefaultV2();
  return normalizeV2({
    ...base,
    material: {
      ...base.material,
      key: { rootPc: mine.rootPc, familyKey: mine.familyKey, modeKey: mine.modeKey },
    },
    view: { ...base.view, names: mine.names },
    settings: {
      ...base.settings,
      startIn: 'default',
      myDefault: { ...mine, numStrings },
      instrument: {
        numStrings,
        tuning: notes.map((note) => ({ pc: note.pc, octave: note.octave })),
        leftHanded: false,
      },
    },
  });
}

/**
 * Where Reset and New land. My default, when one is saved; otherwise the
 * factory setup. The Start in choice itself is left as it was.
 */
export function resetState(current: AppStateV2): AppStateV2 {
  if (!current.settings.myDefault) {
    const fresh = createDefaultV2();
    if (fresh.settings.startIn === current.settings.startIn) return fresh;
    return { ...fresh, settings: { ...fresh.settings, startIn: current.settings.startIn } };
  }
  const next = applyMyDefault(current.settings.myDefault);
  if (next.settings.startIn === current.settings.startIn) return next;
  return { ...next, settings: { ...next.settings, startIn: current.settings.startIn } };
}

/**
 * Boot state. My default wins only when the saved session asked for it and
 * one is set. Otherwise the last session, and if there is none, the defaults.
 */
export function startState(): AppStateV2 {
  try {
    const last = loadLast();
    if (last && last.settings.startIn === 'default' && last.settings.myDefault) {
      return applyMyDefault(last.settings.myDefault);
    }
    if (last) return last;
    return createDefaultV2();
  } catch {
    return createDefaultV2();
  }
}
