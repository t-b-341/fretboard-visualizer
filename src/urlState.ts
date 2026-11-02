import type { AppState } from './state/appState';
import type { FamilyKey } from './music/scales';
import { SCALE_FAMILIES, getFamily } from './music/scales';
import type { GuitarString } from './music/tunings';
import { defaultPresetForStrings, getPreset } from './music/tunings';
import type { DisplayMode, InstrumentView, LabelMode, ViewMode } from './music/types';

const VIEW_MODES = ['scale', 'triad', 'chord', 'identify', 'quiz'] as const satisfies readonly ViewMode[];
const LABEL_MODES = ['concert', 'standard'] as const satisfies readonly LabelMode[];
const DISPLAY_MODES = ['note', 'degree'] as const satisfies readonly DisplayMode[];
const INSTRUMENT_VIEWS = ['fretboard', 'keyboard', 'both'] as const satisfies readonly InstrumentView[];

function fromDefaults(defaults: AppState): AppState {
  return {
    ...defaults,
    tuning: defaults.tuning.map((note) => ({ ...note })),
    hiddenStrings: [...defaults.hiddenStrings],
    positionWindow: { ...defaults.positionWindow },
    picked: { ...defaults.picked },
    quiz: { ...defaults.quiz, marks: { ...defaults.quiz.marks } },
  };
}

function sameNotes(a: readonly GuitarString[], b: readonly GuitarString[]): boolean {
  return a.length === b.length && a.every((note, i) => note.pc === b[i].pc && note.octave === b[i].octave);
}

function readInt(raw: string | null, min: number, max: number): number | undefined {
  if (raw == null || !/^\d+$/.test(raw)) return undefined;
  const n = Number(raw);
  if (n < min || n > max) return undefined;
  return n;
}

function readBit(raw: string | null): boolean | undefined {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return undefined;
}

function oneOf<T extends string>(raw: string | null, allowed: readonly T[]): T | undefined {
  if (raw == null) return undefined;
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

function readFamily(raw: string | null): FamilyKey | undefined {
  if (raw == null) return undefined;
  return SCALE_FAMILIES.some((family) => family.key === raw) ? (raw as FamilyKey) : undefined;
}

function readMode(family: FamilyKey, raw: string | null): string | undefined {
  if (raw == null) return undefined;
  return getFamily(family).modes.some((mode) => mode.key === raw) ? raw : undefined;
}

function readStringCount(raw: string | null): 6 | 7 | 8 | undefined {
  const n = readInt(raw, 6, 8);
  return n === 6 || n === 7 || n === 8 ? n : undefined;
}

function readTuning(raw: string | null, count: number): GuitarString[] | undefined {
  if (raw == null || raw === '') return undefined;
  const parts = raw.split(',');
  if (parts.length !== count) return undefined;
  const notes: GuitarString[] = [];
  for (const part of parts) {
    const pieces = part.split('.');
    if (pieces.length !== 2) return undefined;
    const pc = readInt(pieces[0], 0, 11);
    const octave = readInt(pieces[1], 0, 8);
    if (pc === undefined || octave === undefined) return undefined;
    notes.push({ pc, octave });
  }
  return notes;
}

function readWindow(raw: string | null, fretCount: number): AppState['positionWindow'] | undefined {
  if (raw == null) return undefined;
  const match = /^(\d+)-(\d+)$/.exec(raw);
  if (!match) return undefined;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (min > max || max > fretCount) return undefined;
  return { enabled: true, min, max };
}

function apply<K extends keyof AppState>(state: AppState, key: K, value: AppState[K] | undefined) {
  if (value !== undefined) state[key] = value;
}

function windowToken(window: AppState['positionWindow']): string | null {
  return window.enabled ? `${window.min}-${window.max}` : null;
}

/** Query string without a leading `?`. Only fields that differ from `defaults` are included. */
export function encodeState(s: AppState, defaults: AppState): string {
  const params = new URLSearchParams();
  const put = (key: string, value: string | number) => params.set(key, String(value));

  if (s.numStrings !== defaults.numStrings) put('n', s.numStrings);
  if (s.tuningId !== defaults.tuningId && getPreset(s.tuningId)) put('t', s.tuningId);

  const preset = getPreset(s.tuningId) ?? defaultPresetForStrings(s.numStrings);
  if (!sameNotes(s.tuning, preset.notes)) {
    put('tu', s.tuning.map((note) => `${note.pc}.${note.octave}`).join(','));
  }

  if (s.fretCount !== defaults.fretCount) put('f', s.fretCount);
  if (s.rootPc !== defaults.rootPc) put('k', s.rootPc);
  if (s.familyKey !== defaults.familyKey) put('fam', s.familyKey);
  if (s.modeKey !== defaults.modeKey) put('m', s.modeKey);
  if (s.viewMode !== defaults.viewMode) put('v', s.viewMode);
  if (s.triadDegree !== defaults.triadDegree) put('td', s.triadDegree);
  if (s.labelMode !== defaults.labelMode) put('l', s.labelMode);
  if (s.displayMode !== defaults.displayMode) put('d', s.displayMode);
  if (s.instrumentView !== defaults.instrumentView) put('i', s.instrumentView);
  if (s.ghostScale !== defaults.ghostScale) put('g', s.ghostScale ? 1 : 0);
  if (s.compareEnabled !== defaults.compareEnabled) put('c', s.compareEnabled ? 1 : 0);
  if (s.compareRootPc !== defaults.compareRootPc) put('ck', s.compareRootPc);
  if (s.compareFamilyKey !== defaults.compareFamilyKey) put('cf', s.compareFamilyKey);
  if (s.compareModeKey !== defaults.compareModeKey) put('cm', s.compareModeKey);
  if (s.sharedOnly !== defaults.sharedOnly) put('so', s.sharedOnly ? 1 : 0);

  const w = windowToken(s.positionWindow);
  if (w !== null && w !== windowToken(defaults.positionWindow)) put('w', w);

  return params.toString();
}

/** Read a query string. Invalid values fall back one field at a time and never throw. */
export function decodeState(search: string, defaults: AppState): AppState {
  try {
    const next = fromDefaults(defaults);
    const raw = search.startsWith('?') ? search.slice(1) : search;
    const params = new URLSearchParams(raw);

    apply(next, 'fretCount', readInt(params.get('f'), 12, 24));
    apply(next, 'rootPc', readInt(params.get('k'), 0, 11));

    apply(next, 'familyKey', readFamily(params.get('fam')));
    apply(next, 'modeKey', readMode(next.familyKey, params.get('m')));
    apply(next, 'viewMode', oneOf(params.get('v'), VIEW_MODES));
    apply(next, 'triadDegree', readInt(params.get('td'), 0, 6));
    apply(next, 'labelMode', oneOf(params.get('l'), LABEL_MODES));
    apply(next, 'displayMode', oneOf(params.get('d'), DISPLAY_MODES));
    apply(next, 'instrumentView', oneOf(params.get('i'), INSTRUMENT_VIEWS));

    apply(next, 'ghostScale', readBit(params.get('g')));
    apply(next, 'compareEnabled', readBit(params.get('c')));
    apply(next, 'compareRootPc', readInt(params.get('ck'), 0, 11));
    apply(next, 'compareFamilyKey', readFamily(params.get('cf')));
    apply(next, 'compareModeKey', readMode(next.compareFamilyKey, params.get('cm')));
    apply(next, 'sharedOnly', readBit(params.get('so')));

    // A named preset owns the string count. `n` applies only when `t` is absent or unknown.
    const tuningParam = params.get('t');
    const named = tuningParam ? getPreset(tuningParam) : undefined;
    const namedCount =
      named && (named.strings === 6 || named.strings === 7 || named.strings === 8) ? named.strings : undefined;
    if (named && namedCount) {
      next.tuningId = named.id;
      next.numStrings = namedCount;
      next.tuning = named.notes.map((note) => ({ ...note }));
    } else {
      const count = readStringCount(params.get('n'));
      if (count !== undefined && count !== next.numStrings) {
        const fallback = defaultPresetForStrings(count);
        next.numStrings = count;
        next.tuningId = fallback.id;
        next.tuning = fallback.notes.map((note) => ({ ...note }));
      }
    }

    const custom = readTuning(params.get('tu'), next.numStrings);
    if (custom) {
      next.tuning = custom;
      const base = getPreset(next.tuningId);
      if (!base || !sameNotes(custom, base.notes)) next.tuningId = 'custom';
    }

    const positionWindow = readWindow(params.get('w'), next.fretCount);
    if (positionWindow) next.positionWindow = positionWindow;

    return next;
  } catch {
    return fromDefaults(defaults);
  }
}
