// Fresh v2 setup. Listed product defaults are fixed here; everything else
// is copied from today's initial state so the two stay aligned.

import { createInitialState, defaultProgression } from '../appState';
import { controllerWindow, cMidi } from '../../music/keys';
import { DEFAULT_WEIGHTS } from '../../music/voiceLeading';
import type { Weights } from '../../music/voiceLeading';
import type { AppStateV2 } from './types';

/** Frets the neck can address. Today's fret-count control tops out here. */
export const FRET_COUNT = 24;

function cloneWeights(weights: Weights): Weights {
  return {
    roleMotion: { ...weights.roleMotion },
    handShift: weights.handShift,
    commonToneBonus: weights.commonToneBonus,
    resolutionBonus: weights.resolutionBonus,
    omissionPenalty: weights.omissionPenalty,
    registerAnchor: weights.registerAnchor,
    anchorFret: weights.anchorFret,
  };
}

export function createDefaultV2(): AppStateV2 {
  const today = createInitialState();
  const progression = defaultProgression();
  const quiz = today.noteQuiz;
  const lowestMidi =
    today.keyboardOctaves === 3
      ? controllerWindow(today.controllerBaseOctave, today.controllerOctaveShift).lowest
      : cMidi(today.soundOctave);

  return {
    version: 2,
    material: {
      type: 'scale',
      key: { rootPc: today.rootPc, familyKey: today.familyKey, modeKey: today.modeKey },
      steps: [],
      currentStep: 0,
      compare: {
        enabled: today.compareEnabled,
        rootPc: today.compareRootPc,
        familyKey: today.compareFamilyKey,
        modeKey: today.compareModeKey,
      },
      scale: {
        positions: today.shapeMode,
        positionIndex: today.shapeIndex,
        fretRange: { ...today.positionWindow },
      },
    },
    voicing: {
      shape: 'all',
      stringSet: today.voicingSetStart,
      // The voice-leading checkbox lives in component state and starts on.
      smooth: true,
    },
    view: {
      staff: true,
      neck: true,
      keyboard: true,
      labels: 'notes',
      names: 'concert',
      showKey: today.ghostScale,
      voiceMotion: today.guideTones,
      staffPitch: today.staffPitch,
    },
    transport: {
      tempo: progression.tempo,
      loop: progression.loop,
    },
    settings: {
      startIn: 'last',
      myDefault: null,
      instrument: {
        numStrings: today.numStrings,
        tuning: today.tuning.map((note) => ({ pc: note.pc, octave: note.octave })),
        leftHanded: today.leftHanded,
      },
      neck: {
        fretFrom: today.fretFrom,
        fretTo: today.fretTo,
        hiddenStrings: [...today.hiddenStrings],
      },
      keyboard: {
        octaves: today.keyboardOctaves,
        lowestMidi,
      },
      sound: {
        volume: 0.5,
        muted: false,
        drone: today.drone,
        clickToHear: today.clickToHear,
        octave: today.soundOctave,
        beatsPerStep: progression.beatsPerChord === 1 || progression.beatsPerChord === 4 ? progression.beatsPerChord : 2,
      },
      midi: {
        outputName: '',
        channel: 1,
        inputName: today.midiInputName,
        showPlayed: today.showPlayedNotes,
        soundPlayed: today.soundPlayedNotes,
      },
      voiceLeadingWeights: cloneWeights(DEFAULT_WEIGHTS),
    },
    practice: {
      questionTypes: {
        nameNote: quiz.types.nameNote,
        findNote: quiz.types.findNote,
        intervalFromRoot: quiz.types.intervalFromRoot,
        earInterval: quiz.types.earInterval,
        chordTones: false,
        readStaff: false,
      },
      strings: [...quiz.strings],
      fretMin: quiz.fretMin,
      fretMax: quiz.fretMax,
      spelling: quiz.keyContext === 'key' ? 'key' : 'either',
    },
  };
}
