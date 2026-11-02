// Saved UI state: the JSON shape in localStorage and the address bar.
// Merging a stored blob always returns a full AppState so older setups still load.

import type { ProgressionSnapshot } from '../components/ProgressionControls';
import {
  CHORD_QUALITIES,
  buildChord,
  roleForDegree,
} from '../music/chords';
import type { Chord, ChordQuality } from '../music/chords';
import { CONTROLLER_BASE_OCTAVES, clampControllerShift } from '../music/keys';
import type { ControllerBaseOctave } from '../music/keys';
import { mod } from '../music/notes';
import { PROGRESSION_TEMPLATES } from '../music/progression';
import type { Question } from '../music/quiz';
import { SCALE_FAMILIES, getFamily } from '../music/scales';
import type { FamilyKey } from '../music/scales';
import type { ShapeMode } from '../music/shapes';
import { defaultPresetForStrings } from '../music/tunings';
import type { GuitarString } from '../music/tunings';
import type { VoicingStyle } from '../music/voicings';
import type { DisplayMode, InstrumentView, LabelMode, ViewMode } from '../music/types';

export type ColorMode = 'role' | 'degree';

export interface AppState {
  numStrings: 6 | 7 | 8;
  tuningId: string;
  tuning: GuitarString[];
  fretCount: number;
  rootPc: number;
  familyKey: FamilyKey;
  modeKey: string;
  viewMode: ViewMode;
  /** Chord view: every chord tone, or one generated grip. */
  chordDisplay: 'all' | 'voicing';
  /** Index into the generated voicing list. Clamped when that list is shorter. */
  voicingIndex: number;
  triadDegree: number;
  activeChord: Chord | null;
  labelMode: LabelMode;
  displayMode: DisplayMode;
  instrumentView: InstrumentView;
  keyboardOctaves: 1 | 2 | 3;
  /** True once the span buttons have been used. Older sessions open on 37 keys. */
  keyboardSpanChosen: boolean;
  /** Lowest C at the MPK Mini Plus center octave (both octave buttons). 3 → C3. */
  controllerBaseOctave: ControllerBaseOctave;
  /** Controller octave-button offset, in octaves. */
  controllerOctaveShift: number;
  ghostScale: boolean;
  fretFrom: number;
  fretTo: number;
  leftHanded: boolean;
  hiddenStrings: number[];
  shapeMode: ShapeMode;
  shapeIndex: number;
  colorMode: ColorMode;
  voicingStyle: VoicingStyle;
  voicingInversion: number;
  voicingWidth: 3 | 4;
  voicingSetStart: number;
  guideTones: boolean;
  clickToHear: boolean;
  soundOctave: number;
  drone: boolean;
  compareEnabled: boolean;
  compareRootPc: number;
  compareFamilyKey: FamilyKey;
  compareModeKey: string;
  sharedOnly: boolean;
  /** Inclusive fret range for grips. Open strings are allowed only when min is 0. */
  positionWindow: { enabled: boolean; min: number; max: number };
  /** Identify view: one fret per string. Missing keys are unpicked strings. */
  picked: Record<number, number>;
  /** Quiz view. Mark keys are "stringIndex:fret". */
  quiz: {
    question: Question | null;
    marks: Record<string, 'right' | 'wrong'>;
    score: number;
    total: number;
  };
}

export function createInitialState(): AppState {
  const preset = defaultPresetForStrings(7);
  return {
    numStrings: 7,
    tuningId: preset.id,
    tuning: preset.notes.map((n) => ({ ...n })),
    fretCount: 24,
    rootPc: 10, // Bb (concert) = open low string on the 7-string half-step-down preset
    familyKey: 'major',
    modeKey: 'Ionian',
    viewMode: 'scale',
    chordDisplay: 'all',
    voicingIndex: 0,
    triadDegree: 0,
    activeChord: null,
    labelMode: 'concert',
    displayMode: 'note',
    instrumentView: 'both',
    keyboardOctaves: 3,
    keyboardSpanChosen: true,
    controllerBaseOctave: 3,
    controllerOctaveShift: 0,
    ghostScale: true,
    fretFrom: 0,
    fretTo: 24,
    leftHanded: false,
    hiddenStrings: [],
    shapeMode: 'all',
    shapeIndex: 0,
    colorMode: 'role',
    voicingStyle: 'all',
    voicingInversion: 0,
    voicingWidth: 3,
    voicingSetStart: 4,
    guideTones: false,
    clickToHear: true,
    soundOctave: 4,
    drone: false,
    compareEnabled: false,
    compareRootPc: 10,
    compareFamilyKey: 'major',
    compareModeKey: 'Aeolian', // parallel natural minor by default
    sharedOnly: false,
    positionWindow: { enabled: false, min: 5, max: 8 },
    picked: {},
    quiz: { question: null, marks: {}, score: 0, total: 0 },
  };
}

export function defaultProgression(): ProgressionSnapshot {
  return {
    chords: [],
    tempo: 100,
    beatsPerChord: 2,
    octave: 4,
    loop: true,
    useSevenths: false,
    spicy: false,
    templateId: PROGRESSION_TEMPLATES[0].id,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object';
}

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(lo, Math.min(hi, n));
}

function readPicked(v: unknown, numStrings: number, fretCount: number): Record<number, number> {
  if (!isRecord(v)) return {};
  const picked: Record<number, number> = {};
  for (const [key, fret] of Object.entries(v)) {
    const stringIndex = Number(key);
    if (!Number.isInteger(stringIndex) || stringIndex < 0 || stringIndex >= numStrings) continue;
    if (typeof fret !== 'number' || !Number.isInteger(fret) || fret < 0 || fret > fretCount) continue;
    picked[stringIndex] = fret;
  }
  return picked;
}

function readPositionWindow(v: unknown, fretCount: number): AppState['positionWindow'] {
  const base = { enabled: false, min: 5, max: 8 };
  if (!isRecord(v)) return base;
  const min = clampNum(v.min, 0, fretCount, base.min);
  const max = clampNum(v.max, min, fretCount, base.max);
  return { enabled: v.enabled === true, min, max };
}

function controllerBaseOf(v: unknown): ControllerBaseOctave {
  return CONTROLLER_BASE_OCTAVES.includes(v as ControllerBaseOctave) ? (v as ControllerBaseOctave) : 3;
}

function familyOf(v: unknown, fallback: FamilyKey): FamilyKey {
  return typeof v === 'string' && SCALE_FAMILIES.some((f) => f.key === v) ? (v as FamilyKey) : fallback;
}

function modeOf(family: FamilyKey, v: unknown, fallback: string): string {
  const modes = getFamily(family).modes;
  if (typeof v === 'string' && modes.some((m) => m.key === v)) return v;
  if (modes.some((m) => m.key === fallback)) return fallback;
  return modes[0].key;
}

function readTuning(v: unknown, count: number, fallback: GuitarString[]): GuitarString[] {
  if (!Array.isArray(v) || v.length !== count) return fallback;
  const notes: GuitarString[] = [];
  for (const item of v) {
    if (!isRecord(item) || typeof item.pc !== 'number' || typeof item.octave !== 'number') return fallback;
    notes.push({ pc: mod(Math.round(item.pc), 12), octave: clampNum(item.octave, 0, 8, 2) });
  }
  return notes;
}

const QUALITY_KEYS = new Set<string>(CHORD_QUALITIES.map((q) => q.key));

function readChord(v: unknown): Chord | null {
  if (!isRecord(v) || typeof v.rootPc !== 'number') return null;
  const rootPc = mod(Math.round(v.rootPc), 12);
  if (typeof v.quality === 'string' && QUALITY_KEYS.has(v.quality)) {
    return buildChord(rootPc, v.quality as ChordQuality);
  }
  if (!Array.isArray(v.tones) || v.tones.length === 0) return null;
  const tones = [];
  for (const tone of v.tones) {
    if (!isRecord(tone) || typeof tone.interval !== 'number' || typeof tone.degree !== 'string') return null;
    tones.push({ interval: tone.interval, degree: tone.degree, role: roleForDegree(tone.degree) });
  }
  return {
    rootPc,
    symbol: typeof v.symbol === 'string' ? v.symbol : '',
    name: typeof v.name === 'string' ? v.name : '',
    tones,
    pcs: [...new Set(tones.map((t) => mod(rootPc + t.interval, 12)))],
  };
}

export function mergeApp(raw: unknown): AppState {
  const base = createInitialState();
  if (!isRecord(raw)) return base;
  const numStrings = raw.numStrings === 6 || raw.numStrings === 7 || raw.numStrings === 8 ? raw.numStrings : base.numStrings;
  const preset = defaultPresetForStrings(numStrings);
  const familyKey = familyOf(raw.familyKey, base.familyKey);
  const compareFamilyKey = familyOf(raw.compareFamilyKey, base.compareFamilyKey);
  const fretCount = clampNum(raw.fretCount, 12, 24, base.fretCount);
  let fretFrom = clampNum(raw.fretFrom, 0, fretCount, 0);
  const fretTo = clampNum(raw.fretTo, fretFrom, fretCount, fretCount);
  if (fretFrom > fretTo) fretFrom = 0;
  const voicingWidth: 3 | 4 = raw.voicingWidth === 4 ? 4 : 3;
  const hidden = Array.isArray(raw.hiddenStrings)
    ? [...new Set(raw.hiddenStrings.filter((n): n is number => typeof n === 'number' && n >= 0 && n < numStrings))]
    : [];
  return {
    ...base,
    numStrings,
    tuningId: typeof raw.tuningId === 'string' ? raw.tuningId : preset.id,
    tuning: readTuning(raw.tuning, numStrings, preset.notes.map((n) => ({ ...n }))),
    fretCount,
    fretFrom,
    fretTo,
    rootPc: clampNum(raw.rootPc, 0, 11, base.rootPc),
    familyKey,
    modeKey: modeOf(familyKey, raw.modeKey, base.modeKey),
    viewMode:
      raw.viewMode === 'triad' ||
      raw.viewMode === 'chord' ||
      raw.viewMode === 'identify' ||
      raw.viewMode === 'quiz'
        ? raw.viewMode
        : 'scale',
    chordDisplay: raw.chordDisplay === 'voicing' ? 'voicing' : 'all',
    voicingIndex: clampNum(raw.voicingIndex, 0, 10000, 0),
    triadDegree: clampNum(raw.triadDegree, 0, 6, 0),
    activeChord: readChord(raw.activeChord),
    labelMode: raw.labelMode === 'standard' ? 'standard' : 'concert',
    displayMode: raw.displayMode === 'degree' ? 'degree' : 'note',
    instrumentView: raw.instrumentView === 'fretboard' || raw.instrumentView === 'keyboard' ? raw.instrumentView : 'both',
    // Until the span buttons are used, show the 37-key controller. A saved
    // 2-octave view from before that option existed would otherwise stick.
    keyboardOctaves: raw.keyboardSpanChosen === true
      ? raw.keyboardOctaves === 1
        ? 1
        : raw.keyboardOctaves === 3
          ? 3
          : 2
      : 3,
    keyboardSpanChosen: raw.keyboardSpanChosen === true,
    controllerBaseOctave: controllerBaseOf(raw.controllerBaseOctave),
    controllerOctaveShift: clampControllerShift(
      controllerBaseOf(raw.controllerBaseOctave),
      clampNum(raw.controllerOctaveShift, -8, 8, 0),
    ),
    ghostScale: raw.ghostScale !== false,
    leftHanded: raw.leftHanded === true,
    hiddenStrings: hidden.length >= numStrings ? [] : hidden,
    shapeMode: raw.shapeMode === 'nps' || raw.shapeMode === 'caged' ? raw.shapeMode : 'all',
    shapeIndex: clampNum(raw.shapeIndex, 0, 24, 0),
    colorMode: raw.colorMode === 'degree' ? 'degree' : 'role',
    voicingStyle: raw.voicingStyle === 'close' || raw.voicingStyle === 'drop2' ? raw.voicingStyle : 'all',
    voicingInversion: clampNum(raw.voicingInversion, 0, 3, 0),
    voicingWidth,
    voicingSetStart: clampNum(raw.voicingSetStart, 0, Math.max(0, numStrings - 1), Math.max(0, numStrings - voicingWidth)),
    guideTones: raw.guideTones === true,
    clickToHear: raw.clickToHear !== false,
    soundOctave: clampNum(raw.soundOctave, 2, 6, 4),
    drone: raw.drone === true,
    compareEnabled: raw.compareEnabled === true,
    compareRootPc: clampNum(raw.compareRootPc, 0, 11, base.compareRootPc),
    compareFamilyKey,
    compareModeKey: modeOf(compareFamilyKey, raw.compareModeKey, base.compareModeKey),
    sharedOnly: raw.sharedOnly === true,
    positionWindow: readPositionWindow(raw.positionWindow, fretCount),
    picked: readPicked(raw.picked, numStrings, fretCount),
  };
}

export function mergeProgression(raw: unknown): ProgressionSnapshot {
  const base = defaultProgression();
  if (!isRecord(raw)) return base;
  const templateId =
    typeof raw.templateId === 'string' && PROGRESSION_TEMPLATES.some((t) => t.id === raw.templateId)
      ? raw.templateId
      : base.templateId;
  const chords = Array.isArray(raw.chords)
    ? raw.chords.map(readChord).filter((c): c is Chord => !!c).slice(0, 32)
    : [];
  return {
    chords,
    tempo: clampNum(raw.tempo, 40, 240, base.tempo),
    beatsPerChord: raw.beatsPerChord === 1 || raw.beatsPerChord === 4 ? raw.beatsPerChord : 2,
    octave: clampNum(raw.octave, 2, 6, base.octave),
    loop: raw.loop !== false,
    useSevenths: raw.useSevenths === true,
    spicy: raw.spicy === true,
    templateId,
  };
}
