// Live v2 document. The address bar wins when it carries a setup; otherwise
// the last session (or the defaults) does. Edits are written back after a
// short pause so a reload opens where you left off.

import { useCallback, useEffect, useReducer } from 'react';
import type { Chord } from '../../music/chords';
import { rerollChord } from '../../music/explain';
import { mod } from '../../music/notes';
import { mulberry32 } from '../../music/progression';
import type { NoteQuizSettings } from '../../music/quiz';
import { SCALE_FAMILIES, getFamily } from '../../music/scales';
import type { FamilyKey } from '../../music/scales';
import { defaultPresetForStrings, getPreset } from '../../music/tunings';
import type { GuitarString } from '../../music/tunings';
import { DEFAULT_WEIGHTS } from '../../music/voiceLeading';
import type { Weights } from '../../music/voiceLeading';
import { fitNoteQuiz } from '../appState';
import { FRET_COUNT } from './defaults';
import { clampKeyboardLowest } from './keyboardSpan';
import { captureMyDefault } from './myDefault';
import { resetState, saveLast, startState } from './storage';
import { mergeSuggestion, modeIntervals, suggestChords, type SuggestStyle } from './suggest';
import { readUrl } from './url';
import type { AppStateV2, KeySelection, MaterialType, NumStrings, ScalePositions, StartIn, Step } from './types';

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
  | { type: 'addIdentified'; chord: Chord; bassPc?: number; id: string }
  | { type: 'replaceIdentified'; chord: Chord; bassPc?: number }
  | { type: 'removeStep'; index: number }
  | { type: 'toggleLock'; index: number }
  | { type: 'rerollStep'; index: number; seed: number }
  | { type: 'suggest'; style: SuggestStyle; borrowed: boolean; seed: number; ids: string[] }
  | { type: 'setNoteQuiz'; settings: NoteQuizSettings }
  | { type: 'setStartIn'; startIn: StartIn }
  | { type: 'setMyDefault' }
  | { type: 'setTransport'; transport: Partial<AppStateV2['transport']> }
  | { type: 'setMidiInput'; name: string }
  | { type: 'setNumStrings'; numStrings: NumStrings }
  | { type: 'setTuningPreset'; id: string }
  | { type: 'setStringPitch'; index: number; pc: number }
  | { type: 'setLeftHanded'; leftHanded: boolean }
  | { type: 'setNeck'; neck: Partial<AppStateV2['settings']['neck']> }
  | { type: 'setKeyboard'; keyboard: Partial<AppStateV2['settings']['keyboard']> }
  | { type: 'setSound'; sound: Partial<AppStateV2['settings']['sound']> }
  | { type: 'setMidi'; midi: Partial<AppStateV2['settings']['midi']> }
  | { type: 'setWeights'; weights: Weights }
  | { type: 'resetWeights' }
  | { type: 'setCompare'; compare: Partial<AppStateV2['material']['compare']> }
  | { type: 'setScale'; scale: Partial<AppStateV2['material']['scale']> }
  | { type: 'replace'; state: AppStateV2 }
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

/** One chord is Chord; two or more are a Progression. */
function typeForCount(count: number): MaterialType {
  return count <= 1 ? 'chord' : 'progression';
}

function identifiedStep(id: string, chord: Chord, bassPc: number | undefined, locked: boolean): Step {
  const step: Step = { id, chord, locked, voicingIndex: 0, source: 'identified' };
  if (bassPc !== undefined && mod(bassPc, 12) !== mod(chord.rootPc, 12)) step.bassPc = mod(bassPc, 12);
  return step;
}

function addIdentified(state: AppStateV2, chord: Chord, id: string, bassPc?: number): AppStateV2 {
  const steps = [...state.material.steps, identifiedStep(id, chord, bassPc, false)];
  return {
    ...state,
    material: {
      ...state.material,
      type: typeForCount(steps.length),
      steps,
      currentStep: steps.length - 1,
    },
  };
}

function replaceIdentified(state: AppStateV2, chord: Chord, bassPc?: number): AppStateV2 {
  const steps = state.material.steps;
  if (steps.length === 0) return state;
  const index = Math.min(Math.max(state.material.currentStep, 0), steps.length - 1);
  const current = steps[index];
  const next = identifiedStep(current.id, chord, bassPc, current.locked);
  return {
    ...state,
    material: {
      ...state.material,
      type: typeForCount(steps.length),
      steps: steps.map((step, item) => (item === index ? next : step)),
      currentStep: index,
    },
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
      chordTones: types.chordTone,
      readStaff: types.readStaff,
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
    next.questionTypes.earInterval === practice.questionTypes.earInterval &&
    next.questionTypes.chordTones === practice.questionTypes.chordTones &&
    next.questionTypes.readStaff === practice.questionTypes.readStaff
  ) {
    return state;
  }
  return { ...state, practice: { ...practice, ...next, questionTypes: { ...next.questionTypes } } };
}

function sameTuning(a: readonly GuitarString[], b: readonly GuitarString[]): boolean {
  return a.length === b.length && a.every((note, index) => note.pc === b[index].pc && note.octave === b[index].octave);
}

function sameNumbers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function clampHidden(hidden: readonly number[], numStrings: number): number[] {
  const unique = [...new Set(hidden.filter((index) => Number.isInteger(index) && index >= 0 && index < numStrings))];
  if (unique.length >= numStrings) return [];
  return unique;
}

function clampPractice(practice: AppStateV2['practice'], numStrings: number): AppStateV2['practice'] {
  const fitted = fitNoteQuiz(
    {
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
        chordTone: practice.questionTypes.chordTones,
        readStaff: practice.questionTypes.readStaff,
      },
      harmonic: false,
    },
    numStrings,
    FRET_COUNT,
  );
  if (
    fitted.fretMin === practice.fretMin &&
    fitted.fretMax === practice.fretMax &&
    sameNumbers(fitted.strings, practice.strings)
  ) {
    return practice;
  }
  return { ...practice, strings: fitted.strings, fretMin: fitted.fretMin, fretMax: fitted.fretMax };
}

function clampFretRange(range: AppStateV2['material']['scale']['fretRange']): AppStateV2['material']['scale']['fretRange'] {
  const min = Math.max(0, Math.min(FRET_COUNT, Math.round(range.min)));
  const max = Math.max(min, Math.min(FRET_COUNT, Math.round(Number.isFinite(range.max) ? range.max : min)));
  if (min === range.min && max === range.max) return range;
  return { ...range, min, max };
}

/** New string count or tuning, with frets and string picks pulled back into range. */
function retune(state: AppStateV2, numStrings: NumStrings, tuning: readonly GuitarString[]): AppStateV2 {
  const notes = tuning.map((note) => ({ pc: mod(note.pc, 12), octave: note.octave }));
  const hidden = clampHidden(state.settings.neck.hiddenStrings, numStrings);
  const fretFrom = Math.max(0, Math.min(FRET_COUNT, Math.round(state.settings.neck.fretFrom)));
  const fretTo = Math.max(fretFrom, Math.min(FRET_COUNT, Math.round(state.settings.neck.fretTo)));
  const fretRange = clampFretRange(state.material.scale.fretRange);
  const practice = clampPractice(state.practice, numStrings);
  const stringSet = Math.max(0, Math.min(state.voicing.stringSet, Math.max(0, numStrings - 1)));
  if (
    numStrings === state.settings.instrument.numStrings &&
    sameTuning(notes, state.settings.instrument.tuning) &&
    sameNumbers(hidden, state.settings.neck.hiddenStrings) &&
    fretFrom === state.settings.neck.fretFrom &&
    fretTo === state.settings.neck.fretTo &&
    fretRange === state.material.scale.fretRange &&
    practice === state.practice &&
    stringSet === state.voicing.stringSet
  ) {
    return state;
  }
  return {
    ...state,
    material: { ...state.material, scale: { ...state.material.scale, fretRange } },
    voicing: stringSet === state.voicing.stringSet ? state.voicing : { ...state.voicing, stringSet },
    settings: {
      ...state.settings,
      instrument: { ...state.settings.instrument, numStrings, tuning: notes },
      neck: { fretFrom, fretTo, hiddenStrings: hidden },
    },
    practice,
  };
}

function familyKeyOf(value: string | undefined, fallback: FamilyKey): FamilyKey {
  if (value && SCALE_FAMILIES.some((family) => family.key === value)) return value as FamilyKey;
  return fallback;
}

function finiteIn(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function cloneWeights(weights: Weights): Weights {
  return {
    roleMotion: {
      root: finiteIn(weights.roleMotion.root, 0, 5, DEFAULT_WEIGHTS.roleMotion.root),
      third: finiteIn(weights.roleMotion.third, 0, 5, DEFAULT_WEIGHTS.roleMotion.third),
      fifth: finiteIn(weights.roleMotion.fifth, 0, 5, DEFAULT_WEIGHTS.roleMotion.fifth),
      seventh: finiteIn(weights.roleMotion.seventh, 0, 5, DEFAULT_WEIGHTS.roleMotion.seventh),
      ext: finiteIn(weights.roleMotion.ext, 0, 5, DEFAULT_WEIGHTS.roleMotion.ext),
    },
    handShift: finiteIn(weights.handShift, 0, 5, DEFAULT_WEIGHTS.handShift),
    commonToneBonus: finiteIn(weights.commonToneBonus, 0, 5, DEFAULT_WEIGHTS.commonToneBonus),
    resolutionBonus: finiteIn(weights.resolutionBonus, 0, 5, DEFAULT_WEIGHTS.resolutionBonus),
    registerAnchor: finiteIn(weights.registerAnchor, 0, 5, DEFAULT_WEIGHTS.registerAnchor),
    omissionPenalty: finiteIn(weights.omissionPenalty, 0, 20, DEFAULT_WEIGHTS.omissionPenalty),
    anchorFret: finiteIn(weights.anchorFret, 0, 15, DEFAULT_WEIGHTS.anchorFret),
  };
}

function sameWeights(a: Weights, b: Weights): boolean {
  return (
    a.handShift === b.handShift &&
    a.commonToneBonus === b.commonToneBonus &&
    a.resolutionBonus === b.resolutionBonus &&
    a.registerAnchor === b.registerAnchor &&
    a.omissionPenalty === b.omissionPenalty &&
    a.anchorFret === b.anchorFret &&
    a.roleMotion.root === b.roleMotion.root &&
    a.roleMotion.third === b.roleMotion.third &&
    a.roleMotion.fifth === b.roleMotion.fifth &&
    a.roleMotion.seventh === b.roleMotion.seventh &&
    a.roleMotion.ext === b.roleMotion.ext
  );
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
    case 'addIdentified':
      return addIdentified(state, action.chord, action.id, action.bassPc);
    case 'replaceIdentified':
      return replaceIdentified(state, action.chord, action.bassPc);
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
    case 'setMidiInput': {
      const inputName = action.name.trim();
      if (inputName === state.settings.midi.inputName) return state;
      return { ...state, settings: { ...state.settings, midi: { ...state.settings.midi, inputName } } };
    }
    case 'setNumStrings': {
      if (state.settings.instrument.numStrings === action.numStrings) return state;
      return retune(state, action.numStrings, defaultPresetForStrings(action.numStrings).notes);
    }
    case 'setTuningPreset': {
      const preset = getPreset(action.id);
      if (!preset || (preset.strings !== 6 && preset.strings !== 7 && preset.strings !== 8)) return state;
      return retune(state, preset.strings, preset.notes);
    }
    case 'setStringPitch': {
      const tuning = state.settings.instrument.tuning;
      const current = tuning[action.index];
      if (!current) return state;
      const pc = mod(Math.round(action.pc), 12);
      if (current.pc === pc) return state;
      return retune(
        state,
        state.settings.instrument.numStrings,
        tuning.map((note, index) => (index === action.index ? { ...note, pc } : note)),
      );
    }
    case 'setLeftHanded':
      if (state.settings.instrument.leftHanded === action.leftHanded) return state;
      return {
        ...state,
        settings: {
          ...state.settings,
          instrument: { ...state.settings.instrument, leftHanded: action.leftHanded },
        },
      };
    case 'setNeck': {
      const neck = state.settings.neck;
      const count = state.settings.instrument.numStrings;
      let fretFrom = finiteIn(action.neck.fretFrom, 0, FRET_COUNT, neck.fretFrom);
      let fretTo = finiteIn(action.neck.fretTo, 0, FRET_COUNT, neck.fretTo);
      fretFrom = Math.round(fretFrom);
      fretTo = Math.round(fretTo);
      if (fretFrom > fretTo) {
        if (action.neck.fretTo === undefined) fretFrom = fretTo;
        else fretTo = fretFrom;
      }
      let hidden = neck.hiddenStrings;
      if (action.neck.hiddenStrings) {
        const next = clampHidden(action.neck.hiddenStrings, count);
        if (next.length >= count) return state;
        hidden = next;
      }
      if (fretFrom === neck.fretFrom && fretTo === neck.fretTo && sameNumbers(hidden, neck.hiddenStrings)) return state;
      return { ...state, settings: { ...state.settings, neck: { fretFrom, fretTo, hiddenStrings: hidden } } };
    }
    case 'setKeyboard': {
      const current = state.settings.keyboard;
      const octaves = action.keyboard.octaves === 1 || action.keyboard.octaves === 2 || action.keyboard.octaves === 3
        ? action.keyboard.octaves
        : current.octaves;
      const lowestMidi = clampKeyboardLowest(octaves, action.keyboard.lowestMidi ?? current.lowestMidi);
      if (octaves === current.octaves && lowestMidi === current.lowestMidi) return state;
      return { ...state, settings: { ...state.settings, keyboard: { octaves, lowestMidi } } };
    }
    case 'setSound': {
      const current = state.settings.sound;
      const beats = action.sound.beatsPerStep;
      const sound: AppStateV2['settings']['sound'] = {
        volume: finiteIn(action.sound.volume, 0, 1, current.volume),
        muted: typeof action.sound.muted === 'boolean' ? action.sound.muted : current.muted,
        drone: typeof action.sound.drone === 'boolean' ? action.sound.drone : current.drone,
        clickToHear: typeof action.sound.clickToHear === 'boolean' ? action.sound.clickToHear : current.clickToHear,
        octave: Math.round(finiteIn(action.sound.octave, 2, 6, current.octave)),
        beatsPerStep: beats === 1 || beats === 2 || beats === 4 ? beats : current.beatsPerStep,
      };
      if (
        sound.volume === current.volume &&
        sound.muted === current.muted &&
        sound.drone === current.drone &&
        sound.clickToHear === current.clickToHear &&
        sound.octave === current.octave &&
        sound.beatsPerStep === current.beatsPerStep
      ) {
        return state;
      }
      return { ...state, settings: { ...state.settings, sound } };
    }
    case 'setMidi': {
      const current = state.settings.midi;
      const channel = action.midi.channel === undefined ? current.channel : Math.round(finiteIn(action.midi.channel, 1, 16, current.channel));
      const outputName = action.midi.outputName === undefined ? current.outputName : action.midi.outputName.trim().slice(0, 128);
      const inputName = action.midi.inputName === undefined ? current.inputName : action.midi.inputName.trim();
      const showPlayed = typeof action.midi.showPlayed === 'boolean' ? action.midi.showPlayed : current.showPlayed;
      const soundPlayed = typeof action.midi.soundPlayed === 'boolean' ? action.midi.soundPlayed : current.soundPlayed;
      if (
        channel === current.channel &&
        outputName === current.outputName &&
        inputName === current.inputName &&
        showPlayed === current.showPlayed &&
        soundPlayed === current.soundPlayed
      ) {
        return state;
      }
      return { ...state, settings: { ...state.settings, midi: { outputName, channel, inputName, showPlayed, soundPlayed } } };
    }
    case 'setWeights': {
      const weights = cloneWeights(action.weights);
      if (sameWeights(weights, state.settings.voiceLeadingWeights)) return state;
      return { ...state, settings: { ...state.settings, voiceLeadingWeights: weights } };
    }
    case 'resetWeights': {
      const weights = cloneWeights(DEFAULT_WEIGHTS);
      if (sameWeights(weights, state.settings.voiceLeadingWeights)) return state;
      return { ...state, settings: { ...state.settings, voiceLeadingWeights: weights } };
    }
    case 'setCompare': {
      const current = state.material.compare;
      const familyKey = familyKeyOf(action.compare.familyKey, current.familyKey);
      const family = getFamily(familyKey);
      const requested = action.compare.modeKey ?? current.modeKey;
      const modeKey = family.modes.some((mode) => mode.key === requested) ? requested : family.modes[0].key;
      const compare: AppStateV2['material']['compare'] = {
        enabled: typeof action.compare.enabled === 'boolean' ? action.compare.enabled : current.enabled,
        rootPc: mod(action.compare.rootPc ?? current.rootPc, 12),
        familyKey,
        modeKey,
        sharedOnly: typeof action.compare.sharedOnly === 'boolean' ? action.compare.sharedOnly : current.sharedOnly,
      };
      if (
        compare.enabled === current.enabled &&
        compare.rootPc === current.rootPc &&
        compare.familyKey === current.familyKey &&
        compare.modeKey === current.modeKey &&
        compare.sharedOnly === current.sharedOnly
      ) {
        return state;
      }
      return { ...state, material: { ...state.material, compare } };
    }
    case 'setScale': {
      const current = state.material.scale;
      const positions: ScalePositions =
        action.scale.positions === 'all' || action.scale.positions === 'nps' || action.scale.positions === 'caged'
          ? action.scale.positions
          : current.positions;
      const rawIndex = action.scale.positionIndex ?? (positions === 'all' ? 0 : current.positionIndex);
      const positionIndex = Math.max(0, Math.min(24, Math.round(Number.isFinite(rawIndex) ? rawIndex : 0)));
      const incoming = action.scale.fretRange ?? current.fretRange;
      const min = Math.max(0, Math.min(FRET_COUNT, Math.round(finiteIn(incoming.min, 0, FRET_COUNT, current.fretRange.min))));
      let max = Math.round(finiteIn(incoming.max, 0, FRET_COUNT, current.fretRange.max));
      if (max < min) max = min;
      const fretRange = { enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : current.fretRange.enabled, min, max };
      if (
        positions === current.positions &&
        positionIndex === current.positionIndex &&
        fretRange.enabled === current.fretRange.enabled &&
        fretRange.min === current.fretRange.min &&
        fretRange.max === current.fretRange.max
      ) {
        return state;
      }
      return { ...state, material: { ...state.material, scale: { positions, positionIndex, fretRange } } };
    }
    case 'replace':
      return action.state;
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
  const addIdentifiedChord = useCallback((chord: Chord, bassPc?: number) => {
    dispatch({ type: 'addIdentified', chord, bassPc, id: `step-${Math.random().toString(36).slice(2, 10)}` });
  }, []);
  const replaceIdentifiedChord = useCallback((chord: Chord, bassPc?: number) => {
    dispatch({ type: 'replaceIdentified', chord, bassPc });
  }, []);
  const setMidiInput = useCallback((name: string) => {
    dispatch({ type: 'setMidiInput', name });
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
  const setNumStrings = useCallback((numStrings: NumStrings) => dispatch({ type: 'setNumStrings', numStrings }), []);
  const setTuningPreset = useCallback((id: string) => dispatch({ type: 'setTuningPreset', id }), []);
  const setStringPitch = useCallback((index: number, pc: number) => dispatch({ type: 'setStringPitch', index, pc }), []);
  const setLeftHanded = useCallback((leftHanded: boolean) => dispatch({ type: 'setLeftHanded', leftHanded }), []);
  const setNeck = useCallback((neck: Partial<AppStateV2['settings']['neck']>) => dispatch({ type: 'setNeck', neck }), []);
  const setKeyboard = useCallback(
    (keyboard: Partial<AppStateV2['settings']['keyboard']>) => dispatch({ type: 'setKeyboard', keyboard }),
    [],
  );
  const setSound = useCallback((sound: Partial<AppStateV2['settings']['sound']>) => dispatch({ type: 'setSound', sound }), []);
  const setMidi = useCallback((midi: Partial<AppStateV2['settings']['midi']>) => dispatch({ type: 'setMidi', midi }), []);
  const setWeights = useCallback((weights: Weights) => dispatch({ type: 'setWeights', weights }), []);
  const resetWeights = useCallback(() => dispatch({ type: 'resetWeights' }), []);
  const setCompare = useCallback(
    (compare: Partial<AppStateV2['material']['compare']>) => dispatch({ type: 'setCompare', compare }),
    [],
  );
  const setScale = useCallback(
    (scale: Partial<AppStateV2['material']['scale']>) => dispatch({ type: 'setScale', scale }),
    [],
  );
  const replaceState = useCallback((next: AppStateV2) => dispatch({ type: 'replace', state: next }), []);

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
    addIdentified: addIdentifiedChord,
    replaceIdentified: replaceIdentifiedChord,
    setMidiInput,
    removeStep: removeCurrent,
    toggleLock,
    rerollStep: rerollCurrent,
    suggest,
    setNoteQuiz,
    setStartIn,
    setMyDefault,
    setTransport,
    reset,
    setNumStrings,
    setTuningPreset,
    setStringPitch,
    setLeftHanded,
    setNeck,
    setKeyboard,
    setSound,
    setMidi,
    setWeights,
    resetWeights,
    setCompare,
    setScale,
    replaceState,
  };
}
