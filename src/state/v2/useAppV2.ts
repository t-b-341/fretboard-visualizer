// Live v2 document. The address bar wins when it carries a setup; otherwise
// the last session (or the defaults) does. Edits are written back after a
// short pause so a reload opens where you left off.

import { useCallback, useEffect, useReducer } from 'react';
import type { Chord } from '../../music/chords';
import { rerollChord } from '../../music/explain';
import { mod } from '../../music/notes';
import { mulberry32 } from '../../music/progression';
import type { NoteQuizSettings } from '../../music/quiz';
import { captureMyDefault } from './myDefault';
import { resetState, saveLast, startState } from './storage';
import { mergeSuggestion, modeIntervals, suggestChords, type SuggestStyle } from './suggest';
import { readUrl } from './url';
import type { AppStateV2, KeySelection, MaterialType, StartIn, Step } from './types';

export type AppAction =
  | { type: 'setMaterialType'; material: MaterialType }
  | { type: 'setKey'; key: KeySelection }
  | { type: 'setView'; view: Partial<AppStateV2['view']> }
  | { type: 'setVoicing'; voicing: Partial<AppStateV2['voicing']> }
  | { type: 'setStepVoicing'; step: number; voicingIndex: number }
  | { type: 'setCurrentStep'; index: number }
  | { type: 'prevStep' }
  | { type: 'nextStep' }
  | { type: 'addChord'; chord: Chord; bassPc?: number; id: string }
  | { type: 'removeStep'; index: number }
  | { type: 'toggleLock'; index: number }
  | { type: 'rerollStep'; index: number; seed: number }
  | { type: 'suggest'; style: SuggestStyle; borrowed: boolean; seed: number; ids: string[] }
  | { type: 'setNoteQuiz'; settings: NoteQuizSettings }
  | { type: 'setStartIn'; startIn: StartIn }
  | { type: 'setMyDefault' }
  | { type: 'setTransport'; transport: Partial<AppStateV2['transport']> }
  | { type: 'reset' };

const VIEW_KEYS = [
  'staff',
  'neck',
  'keyboard',
  'labels',
  'names',
  'showKey',
  'voiceMotion',
  'staffPitch',
] as const satisfies readonly (keyof AppStateV2['view'])[];

function analysisKey(state: AppStateV2) {
  return {
    rootPc: state.material.key.rootPc,
    intervals: modeIntervals(state.material.key.familyKey, state.material.key.modeKey),
  };
}

function addChord(state: AppStateV2, chord: Chord, id: string, bassPc?: number): AppStateV2 {
  const step: Step = { id, chord, locked: false, voicingIndex: 0, source: 'manual' };
  if (bassPc !== undefined && mod(bassPc, 12) !== mod(chord.rootPc, 12)) step.bassPc = mod(bassPc, 12);
  const steps = [...state.material.steps, step];
  const type = steps.length >= 2 ? 'progression' : state.material.type === 'scale' ? 'chord' : state.material.type;
  return {
    ...state,
    material: { ...state.material, type, steps, currentStep: steps.length - 1 },
  };
}

function removeStep(state: AppStateV2, index: number): AppStateV2 {
  if (!state.material.steps[index]) return state;
  const steps = state.material.steps.filter((_, item) => item !== index);
  let current = state.material.currentStep;
  if (index < current) current -= 1;
  if (steps.length === 0) current = 0;
  else if (current >= steps.length) current = steps.length - 1;
  return { ...state, material: { ...state.material, steps, currentStep: current } };
}

function moveStep(state: AppStateV2, index: number): AppStateV2 {
  const count = state.material.steps.length;
  if (count === 0) return state;
  const currentStep = Math.max(0, Math.min(count - 1, index));
  if (currentStep === state.material.currentStep) return state;
  return { ...state, material: { ...state.material, currentStep } };
}

function applyNoteQuiz(state: AppStateV2, settings: NoteQuizSettings): AppStateV2 {
  const types = settings.types;
  const practice = state.practice;
  const spelling: AppStateV2['practice']['spelling'] = settings.keyContext === 'key' ? 'key' : 'either';
  const next = {
    ...practice,
    strings: [...settings.strings],
    fretMin: settings.fretMin,
    fretMax: settings.fretMax,
    spelling,
    questionTypes: {
      ...practice.questionTypes,
      nameNote: types.nameNote,
      findNote: types.findNote,
      intervalFromRoot: types.intervalFromRoot,
      earInterval: types.earInterval,
    },
  };
  if (
    next.spelling === practice.spelling &&
    next.fretMin === practice.fretMin &&
    next.fretMax === practice.fretMax &&
    next.strings.length === practice.strings.length &&
    next.strings.every((value, index) => value === practice.strings[index]) &&
    next.questionTypes.nameNote === practice.questionTypes.nameNote &&
    next.questionTypes.findNote === practice.questionTypes.findNote &&
    next.questionTypes.intervalFromRoot === practice.questionTypes.intervalFromRoot &&
    next.questionTypes.earInterval === practice.questionTypes.earInterval
  ) {
    return state;
  }
  return { ...state, practice: { ...practice, ...next, questionTypes: { ...next.questionTypes } } };
}

export function reduceApp(state: AppStateV2, action: AppAction): AppStateV2 {
  switch (action.type) {
    case 'setMaterialType':
      if (state.material.type === action.material) return state;
      return { ...state, material: { ...state.material, type: action.material } };
    case 'setKey': {
      const key = {
        rootPc: mod(action.key.rootPc, 12),
        familyKey: action.key.familyKey,
        modeKey: action.key.modeKey,
      };
      const current = state.material.key;
      if (current.rootPc === key.rootPc && current.familyKey === key.familyKey && current.modeKey === key.modeKey) {
        return state;
      }
      return { ...state, material: { ...state.material, key } };
    }
    case 'setView': {
      const view = { ...state.view, ...action.view };
      if (VIEW_KEYS.every((key) => view[key] === state.view[key])) return state;
      return { ...state, view };
    }
    case 'setVoicing': {
      const voicing = { ...state.voicing, ...action.voicing };
      if (voicing.shape !== 'all' && voicing.shape !== 'close' && voicing.shape !== 'drop2') return state;
      if (!Number.isInteger(voicing.stringSet) || voicing.stringSet < 0) voicing.stringSet = state.voicing.stringSet;
      if (
        voicing.shape === state.voicing.shape &&
        voicing.stringSet === state.voicing.stringSet &&
        voicing.smooth === state.voicing.smooth
      ) {
        return state;
      }
      return { ...state, voicing };
    }
    case 'setStepVoicing': {
      const current = state.material.steps[action.step];
      if (!current) return state;
      const voicingIndex = Math.max(0, Math.floor(action.voicingIndex));
      if (current.voicingIndex === voicingIndex && current.voicingManual === true) return state;
      const steps = state.material.steps.map((step, index) =>
        index === action.step ? { ...step, voicingIndex, voicingManual: true } : step,
      );
      return { ...state, material: { ...state.material, steps } };
    }
    case 'setCurrentStep':
      return moveStep(state, action.index);
    case 'prevStep':
      return moveStep(state, state.material.currentStep - 1);
    case 'nextStep':
      return moveStep(state, state.material.currentStep + 1);
    case 'addChord':
      return addChord(state, action.chord, action.id, action.bassPc);
    case 'removeStep':
      return removeStep(state, action.index);
    case 'toggleLock': {
      const index = action.index;
      if (!state.material.steps[index]) return state;
      const steps = state.material.steps.map((step, item) =>
        item === index ? { ...step, locked: !step.locked } : step,
      );
      return { ...state, material: { ...state.material, steps } };
    }
    case 'rerollStep': {
      const index = action.index;
      const step = state.material.steps[index];
      if (!step) return state;
      const key = analysisKey(state);
      const chord = rerollChord(step.chord, state.material.steps, index, key, mulberry32(action.seed >>> 0));
      if (chord.rootPc === step.chord.rootPc && chord.symbol === step.chord.symbol) return state;
      const steps = state.material.steps.map((item, itemIndex) =>
        itemIndex === index
          ? { id: item.id, chord, locked: item.locked, voicingIndex: 0, source: 'suggested' as const }
          : item,
      );
      return { ...state, material: { ...state.material, steps } };
    }
    case 'suggest': {
      const key = analysisKey(state);
      const count = state.material.steps.length;
      const generated = suggestChords(
        key,
        action.style,
        action.borrowed,
        count === 0 ? null : count,
        action.seed >>> 0,
      );
      const steps = mergeSuggestion(state.material.steps, generated, (index) => action.ids[index] ?? `step-${index + 1}`);
      const type = steps.length >= 2 ? 'progression' : steps.length === 1 ? 'chord' : state.material.type;
      const currentStep = steps.length === 0 ? 0 : Math.min(state.material.currentStep, steps.length - 1);
      return { ...state, material: { ...state.material, type, steps, currentStep } };
    }
    case 'setNoteQuiz':
      return applyNoteQuiz(state, action.settings);
    case 'setStartIn':
      if (state.settings.startIn === action.startIn) return state;
      return { ...state, settings: { ...state.settings, startIn: action.startIn } };
    case 'setTransport': {
      const tempo = Number.isFinite(action.transport.tempo)
        ? Math.max(40, Math.min(240, Math.round(action.transport.tempo as number)))
        : state.transport.tempo;
      const loop = typeof action.transport.loop === 'boolean' ? action.transport.loop : state.transport.loop;
      if (tempo === state.transport.tempo && loop === state.transport.loop) return state;
      return { ...state, transport: { tempo, loop } };
    }
    case 'setMyDefault': {
      const myDefault = captureMyDefault(state);
      const prev = state.settings.myDefault;
      if (
        prev &&
        prev.rootPc === myDefault.rootPc &&
        prev.familyKey === myDefault.familyKey &&
        prev.modeKey === myDefault.modeKey &&
        prev.names === myDefault.names &&
        prev.numStrings === myDefault.numStrings &&
        prev.tuningPresetId === myDefault.tuningPresetId
      ) {
        return state;
      }
      return { ...state, settings: { ...state.settings, myDefault } };
    }
    case 'reset':
      return resetState(state);
    default:
      return state;
  }
}

/** Last session, unless the query string is a shared setup. */
export function initialAppV2(search: string): AppStateV2 {
  const raw = (search.startsWith('?') ? search.slice(1) : search).split('#')[0] ?? '';
  if (raw.trim() === '') return startState();
  return readUrl(raw);
}

/** Write the last session after `delay` ms. Call the return value to cancel. */
export function scheduleLastSave(state: AppStateV2, delay = 250): () => void {
  const id = setTimeout(() => saveLast(state), delay);
  return () => clearTimeout(id);
}

function readLocationSearch(): string {
  if (typeof window === 'undefined') return '';
  return window.location.search;
}

export function useAppV2() {
  const [state, dispatch] = useReducer(reduceApp, undefined, () => initialAppV2(readLocationSearch()));

  useEffect(() => scheduleLastSave(state), [state]);

  const setMaterialType = useCallback((material: MaterialType) => {
    dispatch({ type: 'setMaterialType', material });
  }, []);
  const setKey = useCallback((key: KeySelection) => {
    dispatch({ type: 'setKey', key });
  }, []);
  const setView = useCallback((view: Partial<AppStateV2['view']>) => {
    dispatch({ type: 'setView', view });
  }, []);
  const setVoicing = useCallback((voicing: Partial<AppStateV2['voicing']>) => {
    dispatch({ type: 'setVoicing', voicing });
  }, []);
  const setStepVoicing = useCallback((step: number, voicingIndex: number) => {
    dispatch({ type: 'setStepVoicing', step, voicingIndex });
  }, []);
  const setCurrentStep = useCallback((index: number) => {
    dispatch({ type: 'setCurrentStep', index });
  }, []);
  const prevStep = useCallback(() => dispatch({ type: 'prevStep' }), []);
  const nextStep = useCallback(() => dispatch({ type: 'nextStep' }), []);
  const addChordToSteps = useCallback((chord: Chord, bassPc?: number) => {
    dispatch({ type: 'addChord', chord, bassPc, id: `step-${Math.random().toString(36).slice(2, 10)}` });
  }, []);
  const removeCurrent = useCallback((index: number) => dispatch({ type: 'removeStep', index }), []);
  const toggleLock = useCallback((index: number) => dispatch({ type: 'toggleLock', index }), []);
  const rerollCurrent = useCallback((index: number) => {
    dispatch({ type: 'rerollStep', index, seed: Math.floor(Math.random() * 0x100000000) });
  }, []);
  const suggest = useCallback((style: SuggestStyle, borrowed: boolean) => {
    dispatch({
      type: 'suggest',
      style,
      borrowed,
      seed: Math.floor(Math.random() * 0x100000000),
      ids: Array.from({ length: 16 }, () => `step-${Math.random().toString(36).slice(2, 10)}`),
    });
  }, []);
  const setNoteQuiz = useCallback((settings: NoteQuizSettings) => {
    dispatch({ type: 'setNoteQuiz', settings });
  }, []);
  const setStartIn = useCallback((startIn: StartIn) => {
    dispatch({ type: 'setStartIn', startIn });
  }, []);
  const setMyDefault = useCallback(() => dispatch({ type: 'setMyDefault' }), []);
  const setTransport = useCallback((transport: Partial<AppStateV2['transport']>) => {
    dispatch({ type: 'setTransport', transport });
  }, []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);

  return {
    state,
    dispatch,
    setMaterialType,
    setKey,
    setView,
    setVoicing,
    setStepVoicing,
    setCurrentStep,
    prevStep,
    nextStep,
    addChord: addChordToSteps,
    removeStep: removeCurrent,
    toggleLock,
    rerollStep: rerollCurrent,
    suggest,
    setNoteQuiz,
    setStartIn,
    setMyDefault,
    setTransport,
    reset,
  };
}
