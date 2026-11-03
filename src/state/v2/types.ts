// v2 saved setup. One document replaces the v1 app blob plus progression snapshot.
// Music values stay in the types the theory code already uses.

import type { Chord } from '../../music/chords';
import type { FamilyKey } from '../../music/scales';
import type { GuitarString } from '../../music/tunings';
import type { Weights } from '../../music/voiceLeading';

export type MaterialType = 'scale' | 'chord' | 'progression';
export type StepSource = 'manual' | 'suggested' | 'identified';
export type NameStyle = 'concert' | 'standard';
export type LabelStyle = 'notes' | 'degrees';
export type VoicingShape = 'all' | 'close' | 'drop2';
export type ScalePositions = 'all' | 'nps' | 'caged';
export type NumStrings = 6 | 7 | 8;
export type StaffPitch = 'concert' | 'guitar';
export type StartIn = 'last' | 'default';

export interface Step {
  id: string;
  chord: Chord;
  /** Slash bass, when the lowest note is not the chord root. */
  bassPc?: number;
  locked: boolean;
  voicingIndex: number;
  /** The player picked this step's voicing. Smooth voice leading leaves it alone. */
  voicingManual?: boolean;
  source: StepSource;
}

export interface KeySelection {
  rootPc: number;
  familyKey: FamilyKey;
  modeKey: string;
}

/** What "My default" restores. Handedness and the live string pitches are not part of it. */
export interface MyDefault {
  rootPc: number;
  familyKey: FamilyKey;
  modeKey: string;
  names: NameStyle;
  numStrings: NumStrings;
  tuningPresetId: string;
}

export interface QuestionTypes {
  nameNote: boolean;
  findNote: boolean;
  /** Both directions of "intervals from a root". */
  intervalFromRoot: boolean;
  earInterval: boolean;
  /** The old chord-tone quiz. */
  chordTones: boolean;
  readStaff: boolean;
}

export interface AppStateV2 {
  version: 2;
  material: {
    type: MaterialType;
    key: KeySelection;
    steps: Step[];
    currentStep: number;
    compare: {
      enabled: boolean;
      rootPc: number;
      familyKey: FamilyKey;
      modeKey: string;
    };
    scale: {
      positions: ScalePositions;
      positionIndex: number;
      fretRange: { enabled: boolean; min: number; max: number };
    };
  };
  voicing: {
    shape: VoicingShape;
    stringSet: number;
    smooth: boolean;
  };
  view: {
    staff: boolean;
    neck: boolean;
    keyboard: boolean;
    labels: LabelStyle;
    names: NameStyle;
    showKey: boolean;
    voiceMotion: boolean;
    staffPitch: StaffPitch;
  };
  transport: {
    tempo: number;
    loop: boolean;
  };
  settings: {
    startIn: StartIn;
    myDefault: MyDefault | null;
    instrument: {
      numStrings: NumStrings;
      tuning: GuitarString[];
      leftHanded: boolean;
    };
    neck: {
      fretFrom: number;
      fretTo: number;
      hiddenStrings: number[];
    };
    keyboard: {
      octaves: 1 | 2 | 3;
      lowestMidi: number;
    };
    sound: {
      /** 0–1, matching the built-in synth. */
      volume: number;
      muted: boolean;
      drone: boolean;
      clickToHear: boolean;
      octave: number;
      beatsPerStep: 1 | 2 | 4;
    };
    midi: {
      outputName: string;
      /** 1–16, as the MIDI panel labels it. */
      channel: number;
      inputName: string;
      showPlayed: boolean;
      soundPlayed: boolean;
    };
    voiceLeadingWeights: Weights;
  };
  practice: {
    questionTypes: QuestionTypes;
    strings: number[];
    fretMin: number;
    fretMax: number;
    spelling: 'either' | 'key';
  };
}
