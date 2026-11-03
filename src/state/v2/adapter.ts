// Old view model for deriveView. Chord and progression both use the chord
// view so the current step is what the staff, neck, and keyboard draw.

import type { NoteQuizSettings } from '../../music/quiz';
import { TUNING_PRESETS } from '../../music/tunings';
import type { GuitarString } from '../../music/tunings';
import type { InstrumentView, ViewMode } from '../../music/types';
import { createInitialState } from '../appState';
import type { AppState } from '../appState';
import { FRET_COUNT } from './defaults';
import type { AppStateV2, Step } from './types';

function sameNotes(a: readonly GuitarString[], b: readonly GuitarString[]): boolean {
  return a.length === b.length && a.every((note, index) => note.pc === b[index].pc && note.octave === b[index].octave);
}

function tuningIdFor(numStrings: number, tuning: readonly GuitarString[]): string {
  const matched = TUNING_PRESETS.find((preset) => preset.strings === numStrings && sameNotes(preset.notes, tuning));
  return matched?.id ?? 'custom';
}

function viewModeOf(state: AppStateV2): ViewMode {
  return state.material.type === 'scale' ? 'scale' : 'chord';
}

function instrumentViewOf(state: AppStateV2): InstrumentView {
  const { neck, keyboard } = state.view;
  if (neck && keyboard) return 'both';
  if (keyboard) return 'keyboard';
  return 'fretboard';
}

/** The step the instruments show. A scale stays a scale even when steps are saved. */
function shownStep(state: AppStateV2): Step | null {
  if (state.material.type === 'scale') return null;
  const steps = state.material.steps;
  if (steps.length === 0) return null;
  const index = Math.min(Math.max(state.material.currentStep, 0), steps.length - 1);
  return steps[index] ?? null;
}

function noteQuizOf(state: AppStateV2): NoteQuizSettings {
  const practice = state.practice;
  return {
    enabled: false,
    strings: [...practice.strings],
    fretMin: practice.fretMin,
    fretMax: practice.fretMax,
    naturalsOnly: false,
    keyContext: practice.spelling === 'key' ? 'key' : 'none',
    types: {
      nameNote: practice.questionTypes.nameNote,
      findNote: practice.questionTypes.findNote,
      intervalFromRoot: practice.questionTypes.intervalFromRoot,
      earInterval: practice.questionTypes.earInterval,
    },
    harmonic: false,
  };
}

/** The v1 AppState deriveView already understands. */
export function toLegacy(state: AppStateV2): AppState {
  const base = createInitialState();
  const step = shownStep(state);
  const tuning = state.settings.instrument.tuning.map((note) => ({ pc: note.pc, octave: note.octave }));
  const numStrings = state.settings.instrument.numStrings;
  const shape = state.voicing.shape;
  const view = state.view;
  return {
    ...base,
    numStrings,
    tuningId: tuningIdFor(numStrings, tuning),
    tuning,
    fretCount: FRET_COUNT,
    rootPc: state.material.key.rootPc,
    familyKey: state.material.key.familyKey,
    modeKey: state.material.key.modeKey,
    viewMode: viewModeOf(state),
    chordDisplay: shape === 'all' ? 'all' : 'voicing',
    voicingIndex: step?.voicingIndex ?? 0,
    triadDegree: 0,
    activeChord: step ? step.chord : null,
    labelMode: view.names,
    displayMode: view.labels === 'degrees' ? 'degree' : 'note',
    instrumentView: instrumentViewOf(state),
    showStaff: view.staff,
    staffPitch: view.staffPitch,
    keyboardOctaves: state.settings.keyboard.octaves,
    keyboardSpanChosen: true,
    ghostScale: view.showKey,
    fretFrom: state.settings.neck.fretFrom,
    fretTo: state.settings.neck.fretTo,
    leftHanded: state.settings.instrument.leftHanded,
    hiddenStrings: [...state.settings.neck.hiddenStrings],
    shapeMode: state.material.scale.positions,
    shapeIndex: state.material.scale.positionIndex,
    colorMode: 'role',
    colorChordsByRoot: true,
    voicingStyle: shape === 'close' || shape === 'drop2' ? shape : 'all',
    voicingInversion: 0,
    voicingWidth: shape === 'drop2' ? 4 : 3,
    voicingSetStart: state.voicing.stringSet,
    guideTones: view.voiceMotion,
    clickToHear: state.settings.sound.clickToHear,
    soundOctave: state.settings.sound.octave,
    drone: state.settings.sound.drone,
    midiInputName: state.settings.midi.inputName,
    showPlayedNotes: state.settings.midi.showPlayed,
    soundPlayedNotes: state.settings.midi.soundPlayed,
    compareEnabled: state.material.compare.enabled,
    compareRootPc: state.material.compare.rootPc,
    compareFamilyKey: state.material.compare.familyKey,
    compareModeKey: state.material.compare.modeKey,
    sharedOnly: false,
    positionWindow: { ...state.material.scale.fretRange },
    picked: {},
    quiz: { question: null, marks: {}, score: 0, total: 0 },
    noteQuiz: noteQuizOf(state),
  };
}
