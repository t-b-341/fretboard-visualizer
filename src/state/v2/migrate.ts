// Turn a v1 app blob (and its progression snapshot) into v2, and accept a
// hand-edited v2 document without throwing. Unknown fields fall back one
// at a time. The v1 key itself is never written; storage.ts only reads it.

import {
  CHORD_QUALITIES,
  buildChord,
  getDiatonicTriad,
  roleForDegree,
} from '../../music/chords';
import type { Chord, ChordQuality } from '../../music/chords';
import { controllerWindow, cMidi } from '../../music/keys';
import { mod } from '../../music/notes';
import { getFamily, parentScale } from '../../music/scales';
import type { FamilyKey } from '../../music/scales';
import { defaultPresetForStrings } from '../../music/tunings';
import type { GuitarString } from '../../music/tunings';
import { DEFAULT_WEIGHTS } from '../../music/voiceLeading';
import type { Weights } from '../../music/voiceLeading';
import { mergeApp, mergeProgression } from '../appState';
import type { AppState } from '../appState';
import { FRET_COUNT, createDefaultV2 } from './defaults';
import type {
  AppStateV2,
  KeySelection,
  LabelStyle,
  MaterialType,
  MyDefault,
  NameStyle,
  NumStrings,
  QuestionTypes,
  ScalePositions,
  StaffPitch,
  StartIn,
  Step,
  StepSource,
  VoicingShape,
} from './types';

const QUALITY_KEYS = new Set<string>(CHORD_QUALITIES.map((q) => q.key));
const STEP_LIMIT = 32;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function clampFloat(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function readFinite(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function familyOf(v: unknown, fallback: FamilyKey): FamilyKey {
  return typeof v === 'string' && getFamily(v as FamilyKey).key === v ? (v as FamilyKey) : fallback;
}

function modeOf(family: FamilyKey, v: unknown, fallback: string): string {
  const modes = getFamily(family).modes;
  if (typeof v === 'string' && modes.some((mode) => mode.key === v)) return v;
  if (modes.some((mode) => mode.key === fallback)) return fallback;
  return modes[0].key;
}

function stringsOf(v: unknown, fallback: NumStrings): NumStrings {
  return v === 6 || v === 7 || v === 8 ? v : fallback;
}

function readName(v: unknown, fallback = ''): string {
  if (typeof v !== 'string') return fallback;
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 128);
}

function readTuning(v: unknown, count: number, fallback: readonly GuitarString[]): GuitarString[] {
  const fresh = fallback.map((note) => ({ pc: note.pc, octave: note.octave }));
  if (!Array.isArray(v) || v.length !== count) return fresh;
  const notes: GuitarString[] = [];
  for (const item of v) {
    if (!isRecord(item) || typeof item.pc !== 'number' || typeof item.octave !== 'number') return fresh;
    if (!Number.isFinite(item.pc) || !Number.isFinite(item.octave)) return fresh;
    notes.push({ pc: mod(Math.round(item.pc), 12), octave: clampNum(item.octave, 0, 8, 2) });
  }
  return notes;
}

function readChord(v: unknown): Chord | null {
  if (!isRecord(v) || typeof v.rootPc !== 'number' || !Number.isFinite(v.rootPc)) return null;
  const rootPc = mod(Math.round(v.rootPc), 12);
  if (typeof v.quality === 'string' && QUALITY_KEYS.has(v.quality)) {
    return buildChord(rootPc, v.quality as ChordQuality);
  }
  if (!Array.isArray(v.tones) || v.tones.length === 0) return null;
  const tones = [];
  for (const tone of v.tones) {
    if (!isRecord(tone) || typeof tone.interval !== 'number' || !Number.isFinite(tone.interval) || typeof tone.degree !== 'string') {
      return null;
    }
    tones.push({ interval: tone.interval, degree: tone.degree, role: roleForDegree(tone.degree) });
  }
  return {
    rootPc,
    symbol: typeof v.symbol === 'string' ? v.symbol : '',
    name: typeof v.name === 'string' ? v.name : '',
    tones,
    pcs: [...new Set(tones.map((tone) => mod(rootPc + tone.interval, 12)))],
  };
}

function readWeights(v: unknown, fallback: Weights): Weights {
  const base = fallback;
  if (!isRecord(v)) {
    return {
      roleMotion: { ...base.roleMotion },
      handShift: base.handShift,
      commonToneBonus: base.commonToneBonus,
      resolutionBonus: base.resolutionBonus,
      omissionPenalty: base.omissionPenalty,
      registerAnchor: base.registerAnchor,
      anchorFret: base.anchorFret,
    };
  }
  const role = isRecord(v.roleMotion) ? v.roleMotion : {};
  return {
    roleMotion: {
      root: readFinite(role.root, base.roleMotion.root),
      third: readFinite(role.third, base.roleMotion.third),
      fifth: readFinite(role.fifth, base.roleMotion.fifth),
      seventh: readFinite(role.seventh, base.roleMotion.seventh),
      ext: readFinite(role.ext, base.roleMotion.ext),
    },
    handShift: readFinite(v.handShift, base.handShift),
    commonToneBonus: readFinite(v.commonToneBonus, base.commonToneBonus),
    resolutionBonus: readFinite(v.resolutionBonus, base.resolutionBonus),
    omissionPenalty: readFinite(v.omissionPenalty, base.omissionPenalty),
    registerAnchor: readFinite(v.registerAnchor, base.registerAnchor),
    anchorFret: readFinite(v.anchorFret, base.anchorFret),
  };
}

function readSteps(v: unknown): Step[] {
  if (!Array.isArray(v)) return [];
  const steps: Step[] = [];
  const seen = new Set<string>();
  for (const item of v) {
    if (steps.length >= STEP_LIMIT) break;
    if (!isRecord(item)) continue;
    const chord = readChord(item.chord);
    if (!chord) continue;
    let id = typeof item.id === 'string' ? item.id.trim().slice(0, 80) : '';
    if (!id) id = `step-${steps.length + 1}`;
    if (seen.has(id)) id = `${id}-${steps.length + 1}`;
    seen.add(id);
    const source: StepSource =
      item.source === 'suggested' || item.source === 'identified' ? item.source : 'manual';
    let bassPc: number | undefined;
    if (typeof item.bassPc === 'number' && Number.isInteger(item.bassPc)) {
      const bass = mod(item.bassPc, 12);
      if (bass !== chord.rootPc) bassPc = bass;
    }
    steps.push({
      id,
      chord,
      ...(bassPc !== undefined ? { bassPc } : {}),
      locked: item.locked === true,
      voicingIndex: clampNum(item.voicingIndex, 0, 10000, 0),
      ...(item.voicingManual === true ? { voicingManual: true } : {}),
      source,
    });
  }
  return steps;
}

function readHidden(v: unknown, numStrings: number, fallback: readonly number[]): number[] {
  const source = Array.isArray(v) ? v : fallback;
  const hidden = [
    ...new Set(
      source.filter((n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < numStrings),
    ),
  ];
  return hidden.length >= numStrings ? [] : hidden;
}

function readQuestionTypes(v: unknown, fallback: QuestionTypes): QuestionTypes {
  const source = isRecord(v) ? v : {};
  const flag = (key: keyof QuestionTypes) => (typeof source[key] === 'boolean' ? (source[key] as boolean) : fallback[key]);
  return {
    nameNote: flag('nameNote'),
    findNote: flag('findNote'),
    intervalFromRoot: flag('intervalFromRoot'),
    earInterval: flag('earInterval'),
    chordTones: flag('chordTones'),
    readStaff: flag('readStaff'),
  };
}

function readMyDefault(v: unknown): MyDefault | null {
  if (!isRecord(v)) return null;
  const numStrings = stringsOf(v.numStrings, 7);
  const familyKey = familyOf(v.familyKey, 'major');
  const presetId = typeof v.tuningPresetId === 'string' ? v.tuningPresetId.trim().slice(0, 80) : '';
  return {
    rootPc: clampNum(v.rootPc, 0, 11, 10),
    familyKey,
    modeKey: modeOf(familyKey, v.modeKey, 'Ionian'),
    names: v.names === 'standard' ? 'standard' : 'concert',
    numStrings,
    tuningPresetId: presetId || defaultPresetForStrings(numStrings).id,
  };
}

function beatsOf(v: unknown, fallback: 1 | 2 | 4): 1 | 2 | 4 {
  return v === 1 || v === 2 || v === 4 ? v : fallback;
}

function octavesOf(v: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  return v === 1 || v === 2 || v === 3 ? v : fallback;
}

function lowestMidiOf(v: unknown, fallback: number): number {
  const midi = clampNum(v, 0, 127, fallback);
  return Math.max(0, Math.min(120, Math.round(midi / 12) * 12));
}

/** A full v2 document with every invalid field replaced. Never throws. */
export function normalizeV2(raw: unknown): AppStateV2 {
  try {
    return normalizeInner(raw);
  } catch {
    return createDefaultV2();
  }
}

function normalizeInner(raw: unknown): AppStateV2 {
  const base = createDefaultV2();
  if (!isRecord(raw)) return base;

  const material = isRecord(raw.material) ? raw.material : {};
  const voicing = isRecord(raw.voicing) ? raw.voicing : {};
  const view = isRecord(raw.view) ? raw.view : {};
  const transport = isRecord(raw.transport) ? raw.transport : {};
  const settings = isRecord(raw.settings) ? raw.settings : {};
  const practice = isRecord(raw.practice) ? raw.practice : {};
  const instrument = isRecord(settings.instrument) ? settings.instrument : {};
  const neck = isRecord(settings.neck) ? settings.neck : {};
  const keyboard = isRecord(settings.keyboard) ? settings.keyboard : {};
  const sound = isRecord(settings.sound) ? settings.sound : {};
  const midi = isRecord(settings.midi) ? settings.midi : {};
  const keyIn = isRecord(material.key) ? material.key : {};
  const compareIn = isRecord(material.compare) ? material.compare : {};
  const scaleIn = isRecord(material.scale) ? material.scale : {};
  const rangeIn = isRecord(scaleIn.fretRange) ? scaleIn.fretRange : {};

  const numStrings = stringsOf(instrument.numStrings, base.settings.instrument.numStrings);
  const tuning = readTuning(
    instrument.tuning,
    numStrings,
    defaultPresetForStrings(numStrings).notes,
  );

  const familyKey = familyOf(keyIn.familyKey, base.material.key.familyKey);
  const compareFamily = familyOf(compareIn.familyKey, base.material.compare.familyKey);
  const steps = readSteps(material.steps);
  const rangeMin = clampNum(rangeIn.min, 0, FRET_COUNT, base.material.scale.fretRange.min);
  const fretFrom = clampNum(neck.fretFrom, 0, FRET_COUNT, base.settings.neck.fretFrom);
  const positions: ScalePositions =
    scaleIn.positions === 'nps' || scaleIn.positions === 'caged' || scaleIn.positions === 'all'
      ? scaleIn.positions
      : base.material.scale.positions;
  const shape: VoicingShape =
    voicing.shape === 'close' || voicing.shape === 'drop2' || voicing.shape === 'all'
      ? voicing.shape
      : base.voicing.shape;
  const labels: LabelStyle = view.labels === 'degrees' || view.labels === 'notes' ? view.labels : base.view.labels;
  const names: NameStyle = view.names === 'standard' || view.names === 'concert' ? view.names : base.view.names;
  const staffPitch: StaffPitch =
    view.staffPitch === 'guitar' || view.staffPitch === 'concert' ? view.staffPitch : base.view.staffPitch;
  const type: MaterialType =
    material.type === 'chord' || material.type === 'progression' ? material.type : base.material.type;
  const startIn: StartIn = settings.startIn === 'default' || settings.startIn === 'last' ? settings.startIn : base.settings.startIn;
  const fretMin = clampNum(practice.fretMin, 0, FRET_COUNT, base.practice.fretMin);

  return {
    version: 2,
    material: {
      type,
      key: {
        rootPc: clampNum(keyIn.rootPc, 0, 11, base.material.key.rootPc),
        familyKey,
        modeKey: modeOf(familyKey, keyIn.modeKey, base.material.key.modeKey),
      },
      steps,
      currentStep: steps.length === 0 ? 0 : clampNum(material.currentStep, 0, steps.length - 1, 0),
      compare: {
        enabled: typeof compareIn.enabled === 'boolean' ? compareIn.enabled : base.material.compare.enabled,
        rootPc: clampNum(compareIn.rootPc, 0, 11, base.material.compare.rootPc),
        familyKey: compareFamily,
        modeKey: modeOf(compareFamily, compareIn.modeKey, base.material.compare.modeKey),
      },
      scale: {
        positions,
        positionIndex: clampNum(scaleIn.positionIndex, 0, 24, base.material.scale.positionIndex),
        fretRange: {
          enabled: typeof rangeIn.enabled === 'boolean' ? rangeIn.enabled : base.material.scale.fretRange.enabled,
          min: rangeMin,
          max: clampNum(rangeIn.max, rangeMin, FRET_COUNT, Math.max(rangeMin, base.material.scale.fretRange.max)),
        },
      },
    },
    voicing: {
      shape,
      stringSet: clampNum(voicing.stringSet, 0, Math.max(0, numStrings - 1), base.voicing.stringSet),
      smooth: typeof voicing.smooth === 'boolean' ? voicing.smooth : base.voicing.smooth,
    },
    view: {
      staff: typeof view.staff === 'boolean' ? view.staff : base.view.staff,
      neck: typeof view.neck === 'boolean' ? view.neck : base.view.neck,
      keyboard: typeof view.keyboard === 'boolean' ? view.keyboard : base.view.keyboard,
      labels,
      names,
      showKey: typeof view.showKey === 'boolean' ? view.showKey : base.view.showKey,
      voiceMotion: typeof view.voiceMotion === 'boolean' ? view.voiceMotion : base.view.voiceMotion,
      staffPitch,
    },
    transport: {
      tempo: clampNum(transport.tempo, 40, 240, base.transport.tempo),
      loop: typeof transport.loop === 'boolean' ? transport.loop : base.transport.loop,
    },
    settings: {
      startIn,
      myDefault: readMyDefault(settings.myDefault),
      instrument: {
        numStrings,
        tuning,
        leftHanded: typeof instrument.leftHanded === 'boolean' ? instrument.leftHanded : base.settings.instrument.leftHanded,
      },
      neck: {
        fretFrom,
        fretTo: clampNum(neck.fretTo, fretFrom, FRET_COUNT, Math.max(fretFrom, base.settings.neck.fretTo)),
        hiddenStrings: readHidden(neck.hiddenStrings, numStrings, base.settings.neck.hiddenStrings),
      },
      keyboard: {
        octaves: octavesOf(keyboard.octaves, base.settings.keyboard.octaves),
        lowestMidi: lowestMidiOf(keyboard.lowestMidi, base.settings.keyboard.lowestMidi),
      },
      sound: {
        volume: clampFloat(sound.volume, 0, 1, base.settings.sound.volume),
        muted: typeof sound.muted === 'boolean' ? sound.muted : base.settings.sound.muted,
        drone: typeof sound.drone === 'boolean' ? sound.drone : base.settings.sound.drone,
        clickToHear: typeof sound.clickToHear === 'boolean' ? sound.clickToHear : base.settings.sound.clickToHear,
        octave: clampNum(sound.octave, 2, 6, base.settings.sound.octave),
        beatsPerStep: beatsOf(sound.beatsPerStep, base.settings.sound.beatsPerStep),
      },
      midi: {
        outputName: readName(midi.outputName, base.settings.midi.outputName),
        channel: clampNum(midi.channel, 1, 16, base.settings.midi.channel),
        inputName: readName(midi.inputName, base.settings.midi.inputName),
        showPlayed: typeof midi.showPlayed === 'boolean' ? midi.showPlayed : base.settings.midi.showPlayed,
        soundPlayed: typeof midi.soundPlayed === 'boolean' ? midi.soundPlayed : base.settings.midi.soundPlayed,
      },
      voiceLeadingWeights: readWeights(settings.voiceLeadingWeights, base.settings.voiceLeadingWeights),
    },
    practice: {
      questionTypes: readQuestionTypes(practice.questionTypes, base.practice.questionTypes),
      strings: Array.isArray(practice.strings)
        ? [
            ...new Set(
              practice.strings.filter(
                (n): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < numStrings,
              ),
            ),
          ].sort((a, b) => a - b)
        : base.practice.strings.filter((n) => n < numStrings),
      fretMin,
      fretMax: clampNum(practice.fretMax, fretMin, FRET_COUNT, Math.max(fretMin, base.practice.fretMax)),
      spelling: practice.spelling === 'key' || practice.spelling === 'either' ? practice.spelling : base.practice.spelling,
    },
  };
}

interface SplitV1 {
  app: unknown;
  progression: unknown;
  extra: Record<string, unknown>;
}

/** `{ app, progression }` is how v1 storage nests a setup. A flat app blob may carry `progression` too. */
function splitV1(raw: unknown): SplitV1 {
  if (!isRecord(raw)) return { app: raw, progression: undefined, extra: {} };
  if (
    isRecord(raw.app) &&
    'progression' in raw &&
    !('viewMode' in raw) &&
    !('rootPc' in raw) &&
    !('numStrings' in raw)
  ) {
    return { app: raw.app, progression: raw.progression, extra: raw.app };
  }
  return { app: raw, progression: raw.progression, extra: raw };
}

function triadChord(key: KeySelection, degree: number): Chord {
  const mode = getFamily(key.familyKey).modes.find((item) => item.key === key.modeKey) ?? getFamily(key.familyKey).modes[0];
  const triad = getDiatonicTriad(key.rootPc, parentScale(mode.intervals).intervals, degree);
  return buildChord(triad.rootPc, triad.quality);
}

function makeStep(chord: Chord, index: number, voicingIndex: number): Step {
  return {
    id: `step-${index + 1}`,
    chord,
    locked: false,
    voicingIndex,
    source: 'manual',
  };
}

function sameChord(a: Chord, b: Chord): boolean {
  if (a.rootPc !== b.rootPc) return false;
  if (a.quality && b.quality) return a.quality === b.quality;
  return (
    a.symbol === b.symbol &&
    a.tones.length === b.tones.length &&
    a.tones.every((tone, index) => tone.interval === b.tones[index].interval)
  );
}

function stepList(chords: Chord[], current: number, voicingIndex: number): Step[] {
  return chords.map((chord, index) => makeStep(chord, index, index === current ? voicingIndex : 0));
}

function currentOf(chords: Chord[], active: Chord | null): number {
  if (!active) return 0;
  const index = chords.findIndex((chord) => sameChord(chord, active));
  return index >= 0 ? index : 0;
}

/**
 * Material follows the view that was open.
 * A saved progression is still kept as steps when the open view was Scale,
 * Identify, or Quiz, so changing view in v1 does not delete those chords.
 * Triad view is the one exception: it becomes exactly one step, the triad.
 */
function materialFrom(app: AppState, chords: Chord[]): {
  type: MaterialType;
  steps: Step[];
  currentStep: number;
} {
  const grip = app.voicingIndex;
  if (app.viewMode === 'triad') {
    return { type: 'chord', steps: [makeStep(triadChord(app, app.triadDegree), 0, grip)], currentStep: 0 };
  }
  if (app.viewMode === 'chord' && chords.length > 0) {
    const current = currentOf(chords, app.activeChord);
    return { type: 'progression', steps: stepList(chords, current, grip), currentStep: current };
  }
  if (app.viewMode === 'chord' && app.activeChord) {
    return { type: 'chord', steps: [makeStep(app.activeChord, 0, grip)], currentStep: 0 };
  }
  if (app.viewMode === 'chord') {
    return { type: 'progression', steps: [], currentStep: 0 };
  }
  if (chords.length > 0) {
    const current = currentOf(chords, app.activeChord);
    return { type: 'scale', steps: stepList(chords, current, grip), currentStep: current };
  }
  return { type: 'scale', steps: [], currentStep: 0 };
}

function shapeFrom(app: AppState): VoicingShape {
  if (app.chordDisplay !== 'voicing') return 'all';
  return app.voicingStyle === 'close' || app.voicingStyle === 'drop2' ? app.voicingStyle : 'all';
}

function lowestFrom(app: AppState): number {
  if (app.keyboardOctaves === 3) return controllerWindow(app.controllerBaseOctave, app.controllerOctaveShift).lowest;
  return cMidi(app.soundOctave);
}

function rawWeights(extra: Record<string, unknown>, progression: unknown): unknown {
  if (extra.voiceLeadingWeights != null) return extra.voiceLeadingWeights;
  if (extra.weights != null) return extra.weights;
  if (!isRecord(progression)) return undefined;
  return progression.voiceLeadingWeights ?? progression.weights;
}

/** Map one v1 setup. A non-object (or array) is the v2 default; an empty object is an empty v1 setup. */
export function migrateV1(raw: unknown): AppStateV2 {
  try {
    if (!isRecord(raw)) return createDefaultV2();
    const split = splitV1(raw);
    const app = mergeApp(split.app);
    const progressionRaw = split.progression;
    const prog = mergeProgression(isRecord(progressionRaw) ? progressionRaw : undefined);
    const { type, steps, currentStep } = materialFrom(app, prog.chords);
    const playbackOctave =
      isRecord(progressionRaw) && typeof progressionRaw.octave === 'number' && Number.isFinite(progressionRaw.octave)
        ? prog.octave
        : app.soundOctave;
    const smooth = typeof split.extra.voiceLeading === 'boolean' ? split.extra.voiceLeading : true;
    const outputName = readName(split.extra.midiOutputName ?? split.extra.outputName);
    const channel = split.extra.midiChannel ?? split.extra.channel;

    return normalizeV2({
      version: 2,
      material: {
        type,
        key: { rootPc: app.rootPc, familyKey: app.familyKey, modeKey: app.modeKey },
        steps,
        currentStep,
        compare: {
          enabled: app.compareEnabled,
          rootPc: app.compareRootPc,
          familyKey: app.compareFamilyKey,
          modeKey: app.compareModeKey,
        },
        scale: {
          positions: app.shapeMode,
          positionIndex: app.shapeIndex,
          fretRange: { ...app.positionWindow },
        },
      },
      voicing: {
        shape: shapeFrom(app),
        stringSet: app.voicingSetStart,
        smooth,
      },
      view: {
        staff: app.showStaff,
        neck: app.instrumentView !== 'keyboard',
        keyboard: app.instrumentView !== 'fretboard',
        labels: app.displayMode === 'degree' ? 'degrees' : 'notes',
        names: app.labelMode,
        showKey: app.ghostScale,
        voiceMotion: app.guideTones,
        staffPitch: app.staffPitch,
      },
      transport: {
        tempo: prog.tempo,
        loop: prog.loop,
      },
      settings: {
        startIn: 'last',
        myDefault: null,
        instrument: {
          numStrings: app.numStrings,
          tuning: app.tuning.map((note) => ({ pc: note.pc, octave: note.octave })),
          leftHanded: app.leftHanded,
        },
        neck: {
          fretFrom: app.fretFrom,
          fretTo: app.fretTo,
          hiddenStrings: [...app.hiddenStrings],
        },
        keyboard: {
          octaves: app.keyboardOctaves,
          lowestMidi: lowestFrom(app),
        },
        sound: {
          volume: typeof split.extra.volume === 'number' ? split.extra.volume : 0.5,
          muted: split.extra.muted === true,
          drone: app.drone,
          clickToHear: app.clickToHear,
          octave: playbackOctave,
          beatsPerStep: prog.beatsPerChord === 1 || prog.beatsPerChord === 4 ? prog.beatsPerChord : 2,
        },
        midi: {
          outputName,
          channel: typeof channel === 'number' ? channel : 1,
          inputName: app.midiInputName,
          showPlayed: app.showPlayedNotes,
          soundPlayed: app.soundPlayedNotes,
        },
        voiceLeadingWeights: rawWeights(split.extra, progressionRaw) ?? DEFAULT_WEIGHTS,
      },
      practice: {
        questionTypes: {
          nameNote: app.noteQuiz.types.nameNote,
          findNote: app.noteQuiz.types.findNote,
          intervalFromRoot: app.noteQuiz.types.intervalFromRoot,
          earInterval: app.noteQuiz.types.earInterval,
          chordTones: app.viewMode === 'quiz',
          readStaff: false,
        },
        strings: [...app.noteQuiz.strings],
        fretMin: app.noteQuiz.fretMin,
        fretMax: app.noteQuiz.fretMax,
        spelling: app.noteQuiz.keyContext === 'key' ? 'key' : 'either',
      },
    });
  } catch {
    return createDefaultV2();
  }
}
