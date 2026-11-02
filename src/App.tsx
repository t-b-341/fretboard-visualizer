import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Controls } from './components/Controls';
import { Fretboard } from './components/Fretboard';
import { Keyboard } from './components/Keyboard';
import { Legend } from './components/Legend';
import { MidiControls } from './components/MidiControls';
import { ProgressionControls } from './components/ProgressionControls';
import type { ProgressionSnapshot } from './components/ProgressionControls';
import { SCALE_FAMILIES, getFamily, getScaleNotes, parentScale, scaleFormulaLabels } from './music/scales';
import type { FamilyKey } from './music/scales';
import {
  CHORD_QUALITIES,
  buildChord,
  chordInKey,
  getDiatonicTriad,
  qualityName,
  roleForDegree,
  romanForChord,
} from './music/chords';
import type { Chord, ChordQuality, Triad } from './music/chords';
import { defaultPresetForStrings, getPreset } from './music/tunings';
import type { GuitarString } from './music/tunings';
import { buildGrid } from './music/fretboard';
import { chromaticDegreeLabel, labelShift, mod, noteName } from './music/notes';
import { buildCagedShapes, buildNotePerStringShapes, notesPerString } from './music/shapes';
import type { ShapeMode } from './music/shapes';
import { findVoicings, selectVoicingTones, voicingBassRole } from './music/voicings';
import { pitchSpelling, spellChordTone, spellScale } from './music/spelling';
import { chordReading, nextInProgression, scaleOrigin, scalePulls, shiftChord } from './music/reading';
import type { ChoiceNote } from './music/reading';
import type { VoicingStyle } from './music/voicings';
import { guideTonePcs } from './music/guide';
import { CONTROLLER_BASE_OCTAVES, clampControllerShift, controllerWindow, cMidi } from './music/keys';
import type { ControllerBaseOctave } from './music/keys';
import { PROGRESSION_TEMPLATES } from './music/progression';
import { player } from './audio/player';
import { deleteNamed, loadStore, saveLast, saveNamed } from './state/setups';
import type { NamedSetup } from './state/setups';

export type ViewMode = 'scale' | 'triad' | 'chord';
export type LabelMode = 'concert' | 'standard';
export type DisplayMode = 'note' | 'degree';
export type InstrumentView = 'fretboard' | 'keyboard' | 'both';
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
}

function createInitialState(): AppState {
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
  };
}

function defaultProgression(): ProgressionSnapshot {
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

function mergeApp(raw: unknown): AppState {
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
    viewMode: raw.viewMode === 'triad' || raw.viewMode === 'chord' ? raw.viewMode : 'scale',
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
  };
}

function mergeProgression(raw: unknown): ProgressionSnapshot {
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

function readBoot(): { app: AppState; progression: ProgressionSnapshot; named: NamedSetup[] } {
  const store = loadStore();
  return {
    app: mergeApp(store.last?.app),
    progression: mergeProgression(store.last?.progression),
    named: store.named.filter((s) => !!s && typeof s.id === 'string' && typeof s.name === 'string'),
  };
}

const INVERSIONS = ['Root position', '1st inversion', '2nd inversion', '3rd inversion'];

export default function App() {
  const [boot] = useState(readBoot);
  const [state, setState] = useState<AppState>(boot.app);
  const [named, setNamed] = useState<NamedSetup[]>(boot.named);
  const [session, setSession] = useState<ProgressionSnapshot>(boot.progression);
  const [loadId, setLoadId] = useState(0);
  const [setupName, setSetupName] = useState('');
  const [setupId, setSetupId] = useState('');
  const progRef = useRef(boot.progression);
  const stateRef = useRef(state);
  stateRef.current = state;
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  useEffect(() => {
    const t = window.setTimeout(() => saveLast(stateRef.current, progRef.current), 250);
    return () => window.clearTimeout(t);
  }, [state]);

  const onSessionChange = (snap: ProgressionSnapshot) => {
    progRef.current = snap;
    saveLast(stateRef.current, snap);
    setSession(snap);
  };

  const handleNumStrings = (n: 6 | 7 | 8) => {
    const preset = defaultPresetForStrings(n);
    setState((s) => ({
      ...s,
      numStrings: n,
      tuningId: preset.id,
      tuning: preset.notes.map((x) => ({ ...x })),
      hiddenStrings: [],
      voicingSetStart: Math.max(0, n - (s.voicingStyle === 'drop2' ? 4 : s.voicingWidth)),
    }));
  };

  const handlePreset = (id: string) => {
    const preset = getPreset(id);
    if (!preset) return;
    setState((s) => ({
      ...s,
      tuningId: preset.id,
      numStrings: preset.strings as 6 | 7 | 8,
      tuning: preset.notes.map((x) => ({ ...x })),
      hiddenStrings: s.hiddenStrings.filter((i) => i < preset.strings),
      voicingSetStart: Math.max(0, Math.min(s.voicingSetStart, preset.strings - (s.voicingStyle === 'drop2' ? 4 : s.voicingWidth))),
    }));
  };

  const handleStringEdit = (stringIndex: number, pc: number) => {
    setState((s) => ({
      ...s,
      tuningId: 'custom',
      tuning: s.tuning.map((t, i) => (i === stringIndex ? { ...t, pc } : t)),
    }));
  };

  const handleFamily = (familyKey: FamilyKey) => {
    const fam = getFamily(familyKey);
    setState((s) => ({ ...s, familyKey, modeKey: fam.modes[0].key, triadDegree: 0 }));
  };

  // Show a chord on the instruments (from the builder or a progression step),
  // switching into chord view so it is visible.
  const handleShowChord = (chord: Chord | null) => {
    setState((s) => ({ ...s, activeChord: chord, viewMode: 'chord' }));
  };

  const handleToggleCompare = (enabled: boolean) => {
    setState((s) => {
      if (!enabled) return { ...s, compareEnabled: false };
      // Anchor the overlay to whatever is in focus: the chord root in Triad view
      // (for a chord-vs-scale read), otherwise the primary scale root. This makes
      // the default a parallel comparison (e.g. Bb major vs Bb minor).
      const fam = getFamily(s.familyKey);
      const m = fam.modes.find((x) => x.key === s.modeKey) ?? fam.modes[0];
      const baseRoot =
        s.viewMode === 'triad'
          ? getDiatonicTriad(s.rootPc, parentScale(m.intervals).intervals, s.triadDegree).rootPc
          : s.rootPc;
      return { ...s, compareEnabled: true, compareRootPc: baseRoot };
    });
  };

  const handleCompareFamily = (familyKey: FamilyKey) => {
    const fam = getFamily(familyKey);
    setState((s) => ({ ...s, compareFamilyKey: familyKey, compareModeKey: fam.modes[0].key }));
  };

  // Quick overlay presets: set the overlay to the parallel or relative
  // major/minor of whatever is in focus (the chord in Triad view, else the
  // primary scale). Natural minor and major both live in the "major" family.
  const handleComparePreset = (kind: 'parallel' | 'relative') => {
    setState((s) => {
      const fam = getFamily(s.familyKey);
      const m = fam.modes.find((x) => x.key === s.modeKey) ?? fam.modes[0];
      let anchorRoot: number;
      let anchorIsMajor: boolean;
      if (s.viewMode === 'triad') {
        const t = getDiatonicTriad(s.rootPc, parentScale(m.intervals).intervals, s.triadDegree);
        anchorRoot = t.rootPc;
        anchorIsMajor = t.quality === 'maj' || t.quality === 'aug';
      } else {
        anchorRoot = s.rootPc;
        anchorIsMajor = m.intervals[2] === 4;
      }
      const targetModeKey = anchorIsMajor ? 'Aeolian' : 'Ionian';
      const relShift = anchorIsMajor ? 9 : 3; // major -> relative minor (+9); minor -> relative major (+3)
      const targetRoot = kind === 'parallel' ? anchorRoot : mod(anchorRoot + relShift, 12);
      return {
        ...s,
        compareEnabled: true,
        compareFamilyKey: 'major',
        compareModeKey: targetModeKey,
        compareRootPc: targetRoot,
      };
    });
  };

  const family = getFamily(state.familyKey);
  const mode = family.modes.find((m) => m.key === state.modeKey) ?? family.modes[0];
  const intervals = mode.intervals;
  const shift = labelShift(state.labelMode);

  const scalePcs = useMemo(() => getScaleNotes(state.rootPc, intervals), [state.rootPc, intervals]);

  const pcToIndex = useMemo(() => {
    const m = new Map<number, number>();
    scalePcs.forEach((pc, i) => m.set(pc, i));
    return m;
  }, [scalePcs]);

  const diatonic = useMemo(() => parentScale(intervals), [intervals]);
  const triad: Triad = useMemo(
    () => getDiatonicTriad(state.rootPc, diatonic.intervals, state.triadDegree),
    [state.rootPc, diatonic.intervals, state.triadDegree],
  );

  const grid = useMemo(
    () => buildGrid(state.tuning, state.fretCount),
    [state.tuning, state.fretCount],
  );

  const scalePcSet = useMemo(() => new Set(scalePcs), [scalePcs]);
  const npsShapes = useMemo(
    () => buildNotePerStringShapes(grid, scalePcSet, notesPerString(intervals.length)),
    [grid, scalePcSet, intervals.length],
  );
  const cagedShapes = useMemo(
    () => buildCagedShapes(grid, scalePcSet, state.rootPc),
    [grid, scalePcSet, state.rootPc],
  );

  const handleShape = (mode: ShapeMode, index: number) => {
    const list = mode === 'nps' ? npsShapes : mode === 'caged' ? cagedShapes : [];
    const picked = list[index];
    setState((s) => {
      if (mode === 'all') {
        return {
          ...s,
          shapeMode: 'all',
          shapeIndex: 0,
          // A position box zooms the neck. Leaving it restores the full fret range.
          ...(s.shapeMode !== 'all' ? { fretFrom: 0, fretTo: s.fretCount } : {}),
        };
      }
      if (!picked) return { ...s, shapeMode: mode, shapeIndex: 0 };
      return {
        ...s,
        shapeMode: mode,
        shapeIndex: index,
        fretFrom: picked.fretFrom,
        fretTo: Math.min(s.fretCount, Math.max(picked.fretFrom, picked.fretTo)),
      };
    });
  };

  const shapeList = state.shapeMode === 'nps' ? npsShapes : state.shapeMode === 'caged' ? cagedShapes : [];
  const activeShape = shapeList.length ? shapeList[Math.min(state.shapeIndex, shapeList.length - 1)] ?? null : null;

  const voicedChord = useMemo(() => {
    if (state.viewMode === 'chord') return state.activeChord;
    if (state.viewMode === 'triad') return buildChord(triad.rootPc, triad.quality);
    return null;
  }, [state.viewMode, state.activeChord, triad]);

  const voicingWidth: 3 | 4 = state.voicingStyle === 'drop2' ? 4 : state.voicingWidth;
  const voicingStart = Math.max(0, Math.min(state.voicingSetStart, state.tuning.length - voicingWidth));
  const voicingShapes = useMemo(() => {
    if (!voicedChord || state.voicingStyle === 'all') return [];
    if (state.viewMode !== 'triad' && state.viewMode !== 'chord') return [];
    return findVoicings(
      state.tuning,
      state.fretCount,
      voicedChord,
      state.voicingStyle,
      state.voicingInversion,
      voicingStart,
      voicingWidth,
    ).filter((grip) => grip.every((n) => n.fret >= state.fretFrom && n.fret <= state.fretTo));
  }, [
    voicedChord,
    state.voicingStyle,
    state.voicingInversion,
    state.tuning,
    state.fretCount,
    state.fretFrom,
    state.fretTo,
    state.viewMode,
    voicingStart,
    voicingWidth,
  ]);

  const guideActive = state.guideTones && state.viewMode === 'chord' && !!state.activeChord;
  const voicingActive =
    !guideActive &&
    state.voicingStyle !== 'all' &&
    (state.viewMode === 'triad' || state.viewMode === 'chord') &&
    !!voicedChord;

  let onlyCells: { stringIndex: number; fret: number }[] | null = null;
  let caption: string | null = null;
  if (guideActive) {
    caption = 'Guide tones are the 3rd and 7th of this chord, or the 5th when there is no 7th. The line is their shortest step from the previous chord.';
  } else if (voicingActive) {
    const setLabel = `${voicingStart + 1}–${voicingStart + voicingWidth}`;
    const kind = state.voicingStyle === 'drop2' ? 'Drop-2' : 'Close';
    const inversion = INVERSIONS[Math.min(state.voicingInversion, voicingWidth - 1)] ?? 'Root position';
    if (voicingShapes.length > 0) {
      onlyCells = voicingShapes.flat();
      caption = `${kind} · ${inversion} · strings ${setLabel} · ${voicingShapes.length} ${voicingShapes.length === 1 ? 'grip' : 'grips'}`;
    } else {
      caption = `No ${kind.toLowerCase()} voicing on strings ${setLabel} in this fret range`;
    }
  } else if (activeShape && state.shapeMode !== 'all') {
    onlyCells = activeShape.cells;
    caption = activeShape.name;
  }

  const guidePcs = useMemo(() => {
    if (!guideActive || !state.activeChord) return null;
    return new Set(guideTonePcs(state.activeChord));
  }, [guideActive, state.activeChord]);

  const restrictPcs = useMemo(() => {
    if (voicingActive && voicedChord && voicingShapes.length > 0) {
      return new Set(selectVoicingTones(voicedChord, voicingWidth).map((t) => t.pc));
    }
    return null;
  }, [voicingActive, voicedChord, voicingShapes.length, voicingWidth]);

  const displayedRoot = mod(state.rootPc + shift, 12);
  const modeIndex = family.modes.findIndex((item) => item.key === mode.key);
  const origin = scaleOrigin(family.key, modeIndex, displayedRoot, family.modes[0].intervals, intervals);
  const pulls = state.viewMode === 'scale' ? scalePulls(displayedRoot, intervals) : [];
  const pullIndexes = new Set(pulls.map((pull) => pull.index));
  const scaleSpelling = spellScale(displayedRoot, intervals);
  const spelling = new Map<number, string>();
  if (scaleSpelling) {
    for (const tone of scaleSpelling) spelling.set(tone.pc, tone.name);
  }
  if (voicedChord) {
    const chordRoot = mod(voicedChord.rootPc + shift, 12);
    for (const tone of voicedChord.tones) {
      const pc = mod(chordRoot + tone.interval, 12);
      if (!spelling.has(pc)) spelling.set(pc, spellChordTone(chordRoot, tone.interval, tone.degree));
    }
  }
  const bassRole =
    voicingActive && voicedChord && (state.voicingStyle === 'close' || state.voicingStyle === 'drop2')
      ? voicingBassRole(
          voicedChord,
          state.voicingStyle,
          Math.min(state.voicingInversion, voicingWidth - 1),
          voicingWidth,
        )
      : null;
  const upcoming =
    state.viewMode === 'chord' ? nextInProgression(session.chords, state.activeChord, session.loop) : null;
  const reading =
    voicedChord && (state.viewMode === 'chord' || state.viewMode === 'triad')
      ? chordReading(
          displayedRoot,
          diatonic.intervals,
          shiftChord(voicedChord, shift),
          upcoming ? shiftChord(upcoming, shift) : null,
          bassRole,
        )
      : null;

  const formula = scaleFormulaLabels(intervals);
  const spellFormula =
    state.viewMode === 'chord' && state.activeChord
      ? state.activeChord.tones.map((t) => t.degree).join('  ')
      : state.viewMode === 'triad'
        ? triad.pitches.map((pc) => chromaticDegreeLabel(mod(pc - triad.rootPc, 12))).join('  ')
        : null;

  const saveSetup = () => {
    const name = setupName.trim();
    if (!name) return;
    setNamed(saveNamed(name, stateRef.current, progRef.current));
    setSetupName('');
  };
  const loadSetup = () => {
    const picked = named.find((s) => s.id === setupId);
    if (!picked) return;
    const app = mergeApp(picked.app);
    const progression = mergeProgression(picked.progression);
    progRef.current = progression;
    setSession(progression);
    setLoadId((n) => n + 1);
    setState(app);
  };
  const removeSetup = () => {
    if (!setupId) return;
    setNamed(deleteNamed(setupId));
    setSetupId('');
  };
  const resetSession = () => {
    const app = createInitialState();
    const progression = defaultProgression();
    progRef.current = progression;
    setSession(progression);
    setLoadId((n) => n + 1);
    setState(app);
    saveLast(app, progression);
  };

  const compareFamily = getFamily(state.compareFamilyKey);
  const compareMode =
    compareFamily.modes.find((m) => m.key === state.compareModeKey) ?? compareFamily.modes[0];
  const compareIntervals = compareMode.intervals;

  const comparePcs = useMemo(
    () => getScaleNotes(state.compareRootPc, compareIntervals),
    [state.compareRootPc, compareIntervals],
  );
  const comparePcSet = useMemo(() => new Set(comparePcs), [comparePcs]);
  const sharedCount = useMemo(
    () => (state.compareEnabled ? scalePcs.filter((pc) => comparePcSet.has(pc)).length : 0),
    [scalePcs, comparePcSet, state.compareEnabled],
  );

  const shownChordRoot = state.activeChord ? mod(state.activeChord.rootPc + shift, 12) : 0;
  const activeChordSymbol = state.activeChord
    ? `${spelling.get(shownChordRoot) ?? pitchSpelling(shownChordRoot)}${state.activeChord.symbol}`
    : undefined;
  const activeChordRoman = state.activeChord ? romanForChord(state.rootPc, state.activeChord) : undefined;
  const activeChordInKey = state.activeChord ? chordInKey(scalePcs, state.activeChord) : undefined;

  const degreeLabels = formula;
  const colorByDegree = state.colorMode === 'degree';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fretboard Visualizer</h1>
        <p className="subtitle">
          6-string bass, 7/8-string guitar &amp; keyboard &middot; scales, modes &amp; diatonic triads
        </p>
      </header>

      <div className="setup-bar">
        <span className="group-label">Setups</span>
        <input
          className="setup-name"
          type="text"
          placeholder="Name this setup"
          maxLength={40}
          value={setupName}
          onChange={(e) => setSetupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveSetup();
          }}
        />
        <button type="button" className="btn-mini" onClick={saveSetup} disabled={!setupName.trim()}>
          Save
        </button>
        <select value={setupId} onChange={(e) => setSetupId(e.target.value)} aria-label="Saved setups">
          <option value="">{named.length ? 'Saved setups' : 'No saved setups'}</option>
          {named.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button type="button" className="btn-mini" onClick={loadSetup} disabled={!setupId}>
          Load
        </button>
        <button type="button" className="btn-mini" onClick={removeSetup} disabled={!setupId}>
          Delete
        </button>
        <button type="button" className="btn-mini" onClick={resetSession}>
          Reset
        </button>
      </div>

      <Controls
        state={state}
        family={family}
        mode={mode}
        compareFamily={compareFamily}
        compareMode={compareMode}
        shift={shift}
        onUpdate={update}
        onNumStrings={handleNumStrings}
        onPreset={handlePreset}
        onStringEdit={handleStringEdit}
        onFamily={handleFamily}
        onToggleCompare={handleToggleCompare}
        onCompareFamily={handleCompareFamily}
        onComparePreset={handleComparePreset}
        npsShapes={npsShapes}
        cagedShapes={cagedShapes}
        voicingToneCount={voicedChord ? selectVoicingTones(voicedChord, 4).length : 3}
        onShape={handleShape}
      />

      <MidiControls
        rootPc={state.rootPc}
        intervals={intervals}
        triad={triad}
        soundOctave={state.soundOctave}
        onSoundOctave={(soundOctave) => update({ soundOctave })}
        drone={state.drone}
        onDrone={(drone) => update({ drone })}
        clickToHear={state.clickToHear}
        onClickToHear={(clickToHear) => update({ clickToHear })}
      />

      <ProgressionControls
        rootPc={state.rootPc}
        intervals={intervals}
        scalePcs={scalePcs}
        shift={shift}
        active={state.viewMode === 'chord'}
        activeChord={state.activeChord}
        ghostScale={state.ghostScale}
        onShowChord={handleShowChord}
        onGhostScale={(v) => update({ ghostScale: v })}
        diatonicIntervals={diatonic.intervals}
        parentName={diatonic.name}
        guideTones={state.guideTones}
        onGuideTones={(guideTones) => update({ guideTones })}
        session={session}
        loadId={loadId}
        onSessionChange={onSessionChange}
      />

      <div className="formula-bar" aria-label="Scale and harmony reading">
        <div className="formula-line">
          <span className="formula-k">Scale</span>
          {formula.map((label, i) => {
            const moved = origin?.movedIndex === i;
            const className = [
              colorByDegree ? `formula-deg formula-deg-${i}` : 'formula-token',
              pullIndexes.has(i) ? 'formula-pull' : '',
            ]
              .filter(Boolean)
              .join(' ');
            const title = [
              moved ? 'This degree was moved to build the scale' : '',
              pulls.find((pull) => pull.index === i)?.text ?? '',
            ]
              .filter(Boolean)
              .join('. ');
            return (
              <span key={`${label}-${i}`} className={className} title={title || undefined}>
                {label}
                {moved ? '\u2191' : ''}
              </span>
            );
          })}
        </div>
        {scaleSpelling && (
          <div className="formula-line">
            <span className="formula-k">Notes</span>
            {scaleSpelling.map((tone, i) => (
              <span key={`${tone.name}-${i}`} className="formula-token">
                {tone.name}
              </span>
            ))}
          </div>
        )}
        {origin && <p className="formula-caption">{origin.text}</p>}
        {pulls.length > 0 && <p className="formula-caption">{pulls.map((pull) => pull.text).join(' ')}</p>}
        {spellFormula && (
          <div className="formula-line">
            <span className="formula-k">{state.viewMode === 'chord' ? 'Chord' : 'Triad'}</span>
            <span className="formula-token">{spellFormula}</span>
          </div>
        )}
        {reading && (
          <>
            <p className="formula-caption">{reading.summary}</p>
            <ChoiceLine label="Sit" notes={reading.sit} />
            <ChoiceLine label="Color" notes={reading.color} />
            <ChoiceLine label="Lean" notes={reading.lean} />
            {reading.inversion && <p className="formula-caption">{reading.inversion}</p>}
          </>
        )}
        {diatonic.name && state.viewMode !== 'scale' && (
          <p className="formula-caption">Triads follow {diatonic.name}</p>
        )}
        {caption && <p className="formula-caption">{caption}</p>}
      </div>

      <div className="instrument-views">
        {(state.instrumentView === 'fretboard' || state.instrumentView === 'both') && (
          <Fretboard
            grid={grid}
            tuning={state.tuning}
            fretCount={state.fretCount}
            fretFrom={state.fretFrom}
            fretTo={Math.min(state.fretTo, state.fretCount)}
            hiddenStrings={state.hiddenStrings}
            leftHanded={state.leftHanded}
            onlyCells={onlyCells}
            guideTones={state.guideTones}
            rootPc={state.rootPc}
            intervals={intervals}
            pcToIndex={pcToIndex}
            viewMode={state.viewMode}
            triad={triad}
            activeChord={state.activeChord}
            displayMode={state.displayMode}
            shift={shift}
            ghostScale={state.ghostScale && !guideActive}
            compareEnabled={state.compareEnabled}
            comparePcSet={comparePcSet}
            compareRootPc={state.compareRootPc}
            sharedOnly={state.sharedOnly}
            colorByDegree={colorByDegree}
            clickToHear={state.clickToHear}
            spelling={spelling}
            guidePcs={guidePcs}
            onPlay={(midi) => player.playNote(midi, 420)}
            caption={null}
          />
        )}
        {(state.instrumentView === 'keyboard' || state.instrumentView === 'both') && (
          <Keyboard
            octaves={state.keyboardOctaves}
            lowestMidi={
              state.keyboardOctaves === 3
                ? controllerWindow(state.controllerBaseOctave, state.controllerOctaveShift).lowest
                : cMidi(state.soundOctave)
            }
            rootPc={state.rootPc}
            intervals={intervals}
            pcToIndex={pcToIndex}
            viewMode={state.viewMode}
            triad={triad}
            activeChord={state.activeChord}
            displayMode={state.displayMode}
            shift={shift}
            ghostScale={state.ghostScale && !guideActive}
            compareEnabled={state.compareEnabled}
            comparePcSet={comparePcSet}
            compareRootPc={state.compareRootPc}
            sharedOnly={state.sharedOnly}
            restrictPcs={restrictPcs}
            colorByDegree={colorByDegree}
            clickToHear={state.clickToHear}
            spelling={spelling}
            guidePcs={guidePcs}
            onPlay={(midi) => player.playNote(midi, 420)}
          />
        )}
      </div>

      <Legend
        viewMode={state.viewMode}
        triad={triad}
        rootName={scaleSpelling?.[0]?.name ?? noteName(displayedRoot)}
        modeName={mode.name}
        familyName={family.name}
        chordRootName={
          scaleSpelling?.find((tone) => tone.pc === mod(triad.rootPc + shift, 12))?.name ??
          pitchSpelling(mod(triad.rootPc + shift, 12))
        }
        chordQualityName={qualityName(triad.quality)}
        compareEnabled={state.compareEnabled}
        compareRootName={
          spellScale(mod(state.compareRootPc + shift, 12), compareIntervals)?.[0]?.name ??
          noteName(mod(state.compareRootPc + shift, 12))
        }
        compareModeName={compareMode.name}
        sharedCount={sharedCount}
        activeChordSymbol={activeChordSymbol}
        activeChordRoman={activeChordRoman}
        activeChordInKey={activeChordInKey}
        colorByDegree={colorByDegree}
        degreeLabels={degreeLabels}
        guideTones={guideActive}
      />
    </div>
  );
}

function ChoiceLine({ label, notes }: { label: string; notes: ChoiceNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="formula-line">
      <span className="formula-k">{label}</span>
      {notes.map((note) => (
        <span key={`${note.degree}-${note.name}`} className="formula-token">
          {note.name}
          <span className="formula-degree"> {note.degree}</span>
          {note.detail && <span className="formula-detail"> · {note.detail}</span>}
        </span>
      ))}
    </div>
  );
}
