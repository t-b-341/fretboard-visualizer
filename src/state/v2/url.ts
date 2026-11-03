// Today's query string, read and written as v2 so an old shared link still
// opens. A blank query is the v2 default. Any other query is read the way v1
// read it (missing params keep the v1 meaning) and then migrated.
//
// Staff is written even when it is off. v1 treated "off" as the default and
// omitted it; v2's default is on, so a missing flag would mean two things.

import { buildChord, getDiatonicTriad } from '../../music/chords';
import { getFamily, parentScale } from '../../music/scales';
import { TUNING_PRESETS } from '../../music/tunings';
import type { GuitarString } from '../../music/tunings';
import { createInitialState } from '../appState';
import type { AppState } from '../appState';
import { decodeState, encodeState } from '../../urlState';
import { FRET_COUNT, createDefaultV2 } from './defaults';
import { migrateV1, normalizeV2 } from './migrate';
import type { AppStateV2 } from './types';

function sameNotes(a: readonly GuitarString[], b: readonly GuitarString[]): boolean {
  return a.length === b.length && a.every((note, index) => note.pc === b[index].pc && note.octave === b[index].octave);
}

function fretCountFor(state: AppStateV2): number {
  const { fretFrom, fretTo } = state.settings.neck;
  const range = state.material.scale.fretRange;
  let count = FRET_COUNT;
  if (fretFrom === 0 && fretTo >= 12 && fretTo <= FRET_COUNT) count = fretTo;
  if (range.enabled && range.max > count && range.max <= FRET_COUNT) count = range.max;
  return count;
}

/** Degree of the single step when it is the diatonic triad of the current key. Otherwise 0. */
function triadDegreeFor(state: AppStateV2): number {
  if (state.material.type !== 'chord' || state.material.steps.length !== 1) return 0;
  const chord = state.material.steps[0].chord;
  const family = getFamily(state.material.key.familyKey);
  const mode = family.modes.find((item) => item.key === state.material.key.modeKey) ?? family.modes[0];
  const intervals = parentScale(mode.intervals).intervals;
  for (let degree = 0; degree < 7; degree++) {
    const triad = getDiatonicTriad(state.material.key.rootPc, intervals, degree);
    const built = buildChord(triad.rootPc, triad.quality);
    if (chord.rootPc === built.rootPc && (chord.quality ? chord.quality === built.quality : chord.symbol === built.symbol)) {
      return degree;
    }
  }
  return 0;
}

function toUrlApp(state: AppStateV2): AppState {
  const base = createInitialState();
  const numStrings = state.settings.instrument.numStrings;
  const tuning = state.settings.instrument.tuning.map((note) => ({ pc: note.pc, octave: note.octave }));
  const matched = TUNING_PRESETS.find((preset) => preset.strings === numStrings && sameNotes(preset.notes, tuning));
  const view = state.view;
  const instrumentView = view.neck && view.keyboard ? 'both' : view.keyboard && !view.neck ? 'keyboard' : 'fretboard';
  const viewMode = state.material.type === 'chord' ? 'triad' : state.material.type === 'progression' ? 'chord' : 'scale';

  return {
    ...base,
    numStrings,
    tuningId: matched?.id ?? 'custom',
    tuning,
    fretCount: fretCountFor(state),
    rootPc: state.material.key.rootPc,
    familyKey: state.material.key.familyKey,
    modeKey: state.material.key.modeKey,
    viewMode,
    triadDegree: triadDegreeFor(state),
    labelMode: view.names,
    displayMode: view.labels === 'degrees' ? 'degree' : 'note',
    instrumentView,
    showStaff: view.staff,
    staffPitch: view.staffPitch,
    ghostScale: view.showKey,
    compareEnabled: state.material.compare.enabled,
    compareRootPc: state.material.compare.rootPc,
    compareFamilyKey: state.material.compare.familyKey,
    compareModeKey: state.material.compare.modeKey,
    positionWindow: { ...state.material.scale.fretRange },
  };
}

/** Query string without a leading `?`. Only today's params are used. */
export function writeUrl(state: AppStateV2): string {
  try {
    const clean = normalizeV2(state);
    const params = new URLSearchParams(encodeState(toUrlApp(clean), createInitialState()));
    params.set('sf', clean.view.staff ? '1' : '0');
    params.set('vm', clean.view.voiceMotion ? '1' : '0');
    return params.toString();
  } catch {
    return '';
  }
}

/** Full v2 state for a share link. Invalid params are skipped one field at a time. */
export function readUrl(search: string): AppStateV2 {
  try {
    const raw = (search.startsWith('?') ? search.slice(1) : search).split('#')[0] ?? '';
    if (raw.trim() === '') return createDefaultV2();
    const state = migrateV1(decodeState(raw, createInitialState()));
    const voiceMotion = new URLSearchParams(raw).get('vm');
    if (voiceMotion === '1' || voiceMotion === '0') {
      return { ...state, view: { ...state.view, voiceMotion: voiceMotion === '1' } };
    }
    return state;
  } catch {
    return createDefaultV2();
  }
}
