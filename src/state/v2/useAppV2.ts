// Live v2 document. The address bar wins when it carries a setup; otherwise
// the last session (or the defaults) does. Edits are written back after a
// short pause so a reload opens where you left off.

import { useCallback, useEffect, useReducer } from 'react';
import type { NoteQuizSettings } from '../../music/quiz';
import { saveLast, startState } from './storage';
import { readUrl } from './url';
import type { AppStateV2, MaterialType } from './types';

export type AppAction =
  | { type: 'setMaterialType'; material: MaterialType }
  | { type: 'setView'; view: Partial<AppStateV2['view']> }
  | { type: 'setCurrentStep'; index: number }
  | { type: 'prevStep' }
  | { type: 'nextStep' }
  | { type: 'setNoteQuiz'; settings: NoteQuizSettings };

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
    case 'setView': {
      const view = { ...state.view, ...action.view };
      if (VIEW_KEYS.every((key) => view[key] === state.view[key])) return state;
      return { ...state, view };
    }
    case 'setCurrentStep':
      return moveStep(state, action.index);
    case 'prevStep':
      return moveStep(state, state.material.currentStep - 1);
    case 'nextStep':
      return moveStep(state, state.material.currentStep + 1);
    case 'setNoteQuiz':
      return applyNoteQuiz(state, action.settings);
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
  const setView = useCallback((view: Partial<AppStateV2['view']>) => {
    dispatch({ type: 'setView', view });
  }, []);
  const setCurrentStep = useCallback((index: number) => {
    dispatch({ type: 'setCurrentStep', index });
  }, []);
  const prevStep = useCallback(() => dispatch({ type: 'prevStep' }), []);
  const nextStep = useCallback(() => dispatch({ type: 'nextStep' }), []);
  const setNoteQuiz = useCallback((settings: NoteQuizSettings) => {
    dispatch({ type: 'setNoteQuiz', settings });
  }, []);

  return {
    state,
    dispatch,
    setMaterialType,
    setView,
    setCurrentStep,
    prevStep,
    nextStep,
    setNoteQuiz,
  };
}
