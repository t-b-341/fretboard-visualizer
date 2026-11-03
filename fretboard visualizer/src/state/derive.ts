// Turns saved UI state into the scale, chord, spelling, highlight, and voicings the views draw.

import type { ProgressionSnapshot } from '../components/ProgressionControls';
import {
  buildChord,
  chordInKey,
  getDiatonicTriad,
  qualityName,
  romanForChord,
} from '../music/chords';
import type { Chord, ChordToneRole, Triad } from '../music/chords';
import { buildGrid } from '../music/fretboard';
import type { Cell } from '../music/fretboard';
import { guideTonePcs } from '../music/guide';
import { createEvaluator } from '../music/highlight';
import type { HighlightContext, NoteHighlight } from '../music/highlight';
import { identifyChord } from '../music/identify';
import { controllerWindow, cMidi } from '../music/keys';
import { chromaticDegreeLabel, labelShift, mod, noteName } from '../music/notes';
import { chordReading, nextInProgression, scaleOrigin, scalePulls, shiftChord } from '../music/reading';
import type { ChordReading, ScaleOrigin, ScalePull } from '../music/reading';
import { getFamily, getScaleNotes, parentScale, scaleFormulaLabels } from '../music/scales';
import type { FamilyDef, FamilyKey, ModeDef } from '../music/scales';
import { buildCagedShapes, buildNotePerStringShapes, notesPerString } from '../music/shapes';
import type { NeckShape, ShapeMode } from '../music/shapes';
import { pitchSpelling, spellChordTone, spellScale } from '../music/spelling';
import type { SpelledTone } from '../music/spelling';
import { findVoicings, generateVoicings, selectVoicingTones, voicingBassRole } from '../music/voicings';
import type { Voicing, VoicingStyle } from '../music/voicings';
import type { AppState } from './appState';

const INVERSIONS = ['Root position', '1st inversion', '2nd inversion', '3rd inversion'];

export function selectScale(familyKey: FamilyKey, modeKey: string): {
  family: FamilyDef;
  mode: ModeDef;
  intervals: number[];
} {
  const family = getFamily(familyKey);
  const mode = family.modes.find((m) => m.key === modeKey) ?? family.modes[0];
  return { family, mode, intervals: mode.intervals };
}

export function pcToIndex(scalePcs: number[]): Map<number, number> {
  const m = new Map<number, number>();
  scalePcs.forEach((pc, i) => m.set(pc, i));
  return m;
}

/** Chord drawn on the instruments: the built chord, the diatonic triad, or nothing. */
export function voicedChordOf(viewMode: AppState['viewMode'], activeChord: Chord | null, triad: Triad): Chord | null {
  if (viewMode === 'chord') return activeChord;
  if (viewMode === 'triad') return buildChord(triad.rootPc, triad.quality);
  return null;
}

export function spellingMap(
  displayedRoot: number,
  intervals: number[],
  voicedChord: Chord | null,
  shift: number,
): { scaleSpelling: SpelledTone[] | null; spelling: Map<number, string> } {
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
  return { scaleSpelling, spelling };
}

/** The pitch-class evaluator the instrument views draw from. */
export function highlightEvaluator(ctx: HighlightContext) {
  return createEvaluator(ctx);
}

export type HighlightEvaluator = ReturnType<typeof highlightEvaluator>;

/** Keyboard evaluator. A voicing lights only its own pitch classes as chord tones. */
export function keyboardHighlight(
  ctx: HighlightContext,
  voicingPcs: Set<number> | null,
): (pc: number) => NoteHighlight | null {
  const evaluateChord = highlightEvaluator(ctx);
  return (pc: number) =>
    voicingPcs ? evaluateChord(pc, { placed: voicingPcs.has(pc) }) : evaluateChord(pc);
}

export function deriveShapes(grid: Cell[][], scalePcs: number[], intervals: number[], rootPc: number) {
  const scalePcSet = new Set(scalePcs);
  const npsShapes = buildNotePerStringShapes(grid, scalePcSet, notesPerString(intervals.length));
  const cagedShapes = buildCagedShapes(grid, scalePcSet, rootPc);
  return { npsShapes, cagedShapes };
}

export interface VoicingInputs {
  viewMode: AppState['viewMode'];
  activeChord: Chord | null;
  triad: Triad;
  chordDisplay: AppState['chordDisplay'];
  voicingIndex: number;
  voicingStyle: VoicingStyle;
  voicingInversion: number;
  voicingWidth: 3 | 4;
  voicingSetStart: number;
  tuning: AppState['tuning'];
  fretCount: number;
  fretFrom: number;
  fretTo: number;
  positionWindow: AppState['positionWindow'];
  playbackVoicing: Voicing | null;
  picked: Record<number, number>;
  grid: Cell[][];
  guideTones: boolean;
  shapeMode: ShapeMode;
  activeShape: NeckShape | null;
}

export function deriveVoicings(args: VoicingInputs) {
  const voicedChord = voicedChordOf(args.viewMode, args.activeChord, args.triad);
  const voicingToneCount = voicedChord ? selectVoicingTones(voicedChord, 4).length : 3;
  const voicingWidth: 3 | 4 = args.voicingStyle === 'drop2' ? 4 : args.voicingWidth;
  const voicingStart = Math.max(0, Math.min(args.voicingSetStart, args.tuning.length - voicingWidth));
  const voicingShapes =
    !voicedChord || args.voicingStyle === 'all' || (args.viewMode !== 'triad' && args.viewMode !== 'chord')
      ? []
      : findVoicings(
          args.tuning,
          args.fretCount,
          voicedChord,
          args.voicingStyle,
          args.voicingInversion,
          voicingStart,
          voicingWidth,
        ).filter((grip) => grip.every((n) => n.fret >= args.fretFrom && n.fret <= args.fretTo));

  const oneVoicing = args.viewMode === 'chord' && args.chordDisplay === 'voicing' && args.activeChord !== null;
  const positionWindow = args.positionWindow;
  const generatedVoicings =
    oneVoicing && args.activeChord
      ? generateVoicings(
          args.activeChord,
          args.tuning,
          positionWindow.enabled
            ? {
                fretRange: [positionWindow.min, positionWindow.max],
                allowOpen: positionWindow.min === 0,
              }
            : undefined,
        )
      : [];
  const voicingCount = generatedVoicings.length;
  const voicingIndex = voicingCount === 0 ? 0 : Math.min(args.voicingIndex, voicingCount - 1);
  const selectedVoicing = voicingCount > 0 ? generatedVoicings[voicingIndex] : null;
  const shownVoicing = args.playbackVoicing ?? (oneVoicing ? selectedVoicing : null);
  const pickedNotes = [];
  for (const [key, fret] of Object.entries(args.picked)) {
    const cell = args.grid[Number(key)]?.[fret];
    if (cell) pickedNotes.push(cell);
  }
  pickedNotes.sort((a, b) => a.midi - b.midi);
  const identifyMatches =
    args.viewMode === 'identify'
      ? identifyChord(pickedNotes.map((note) => ({ pc: note.pc, midi: note.midi })))
      : [];
  const activeCells =
    args.viewMode === 'identify'
      ? new Set(Object.entries(args.picked).map(([stringIndex, fret]) => `${stringIndex}:${fret}`))
      : !shownVoicing
        ? undefined
        : new Set(shownVoicing.notes.map((note) => `${note.stringIndex}:${note.fret}`));
  const voicingPcs = !shownVoicing ? null : new Set(shownVoicing.notes.map((note) => note.pc));

  const guideActive = args.guideTones && args.viewMode === 'chord' && !!args.activeChord;
  const voicingActive =
    !guideActive &&
    args.voicingStyle !== 'all' &&
    (args.viewMode === 'triad' || args.viewMode === 'chord') &&
    !!voicedChord;

  let onlyCells: { stringIndex: number; fret: number }[] | null = null;
  let caption: string | null = null;
  if (guideActive) {
    caption = 'Guide tones are the 3rd and 7th of this chord, or the 5th when there is no 7th. The line is their shortest step from the previous chord.';
  } else if (voicingActive) {
    const setLabel = `${voicingStart + 1}–${voicingStart + voicingWidth}`;
    const kind = args.voicingStyle === 'drop2' ? 'Drop-2' : 'Close';
    const inversion = INVERSIONS[Math.min(args.voicingInversion, voicingWidth - 1)] ?? 'Root position';
    if (voicingShapes.length > 0) {
      onlyCells = voicingShapes.flat();
      caption = `${kind} · ${inversion} · strings ${setLabel} · ${voicingShapes.length} ${voicingShapes.length === 1 ? 'grip' : 'grips'}`;
    } else {
      caption = `No ${kind.toLowerCase()} voicing on strings ${setLabel} in this fret range`;
    }
  } else if (args.activeShape && args.shapeMode !== 'all') {
    onlyCells = args.activeShape.cells;
    caption = args.activeShape.name;
  }
  if (args.playbackVoicing || oneVoicing || args.viewMode === 'identify' || args.viewMode === 'quiz') {
    onlyCells = null;
    if (args.viewMode === 'identify' || args.viewMode === 'quiz') caption = null;
  }

  const guidePcs = !guideActive || !args.activeChord ? null : new Set(guideTonePcs(args.activeChord));
  const restrictPcs =
    args.playbackVoicing || oneVoicing
      ? null
      : voicingActive && voicedChord && voicingShapes.length > 0
        ? new Set(selectVoicingTones(voicedChord, voicingWidth).map((t) => t.pc))
        : null;
  const bassRole: ChordToneRole | null =
    voicingActive && voicedChord && (args.voicingStyle === 'close' || args.voicingStyle === 'drop2')
      ? voicingBassRole(
          voicedChord,
          args.voicingStyle,
          Math.min(args.voicingInversion, voicingWidth - 1),
          voicingWidth,
        )
      : null;

  return {
    voicedChord,
    voicingToneCount,
    voicingShapes,
    generatedVoicings,
    voicingCount,
    voicingIndex,
    selectedVoicing,
    shownVoicing,
    pickedNotes,
    identifyMatches,
    activeCells,
    voicingPcs,
    guideActive,
    onlyCells,
    caption,
    guidePcs,
    restrictPcs,
    bassRole,
  };
}

function deriveReading(args: {
  viewMode: AppState['viewMode'];
  family: FamilyDef;
  mode: ModeDef;
  intervals: number[];
  displayedRoot: number;
  shift: number;
  rootPc: number;
  triad: Triad;
  voicedChord: Chord | null;
  activeChord: Chord | null;
  spelling: Map<number, string>;
  scaleSpelling: SpelledTone[] | null;
  bassRole: ChordToneRole | null;
  chords: Chord[];
  loop: boolean;
  scalePcs: number[];
  diatonicIntervals: number[];
}): {
  origin: ScaleOrigin | null;
  pulls: ScalePull[];
  pullIndexes: Set<number>;
  reading: ChordReading | null;
  formula: string[];
  spellFormula: string | null;
  activeChordSymbol: string | undefined;
  activeChordRoman: string | undefined;
  activeChordInKey: boolean | undefined;
  rootName: string;
  chordRootName: string;
  degreeLabels: string[];
} {
  const modeIndex = args.family.modes.findIndex((item) => item.key === args.mode.key);
  const origin = scaleOrigin(
    args.family.key,
    modeIndex,
    args.displayedRoot,
    args.family.modes[0].intervals,
    args.intervals,
  );
  const pulls = args.viewMode === 'scale' ? scalePulls(args.displayedRoot, args.intervals) : [];
  const pullIndexes = new Set(pulls.map((pull) => pull.index));
  const upcoming =
    args.viewMode === 'chord' ? nextInProgression(args.chords, args.activeChord, args.loop) : null;
  const reading =
    args.voicedChord && (args.viewMode === 'chord' || args.viewMode === 'triad')
      ? chordReading(
          args.displayedRoot,
          args.diatonicIntervals,
          shiftChord(args.voicedChord, args.shift),
          upcoming ? shiftChord(upcoming, args.shift) : null,
          args.bassRole,
        )
      : null;
  const formula = scaleFormulaLabels(args.intervals);
  const spellFormula =
    args.viewMode === 'chord' && args.activeChord
      ? args.activeChord.tones.map((t) => t.degree).join('  ')
      : args.viewMode === 'triad'
        ? args.triad.pitches.map((pc) => chromaticDegreeLabel(mod(pc - args.triad.rootPc, 12))).join('  ')
        : null;
  const shownChordRoot = args.activeChord ? mod(args.activeChord.rootPc + args.shift, 12) : 0;
  const activeChordSymbol = args.activeChord
    ? `${args.spelling.get(shownChordRoot) ?? pitchSpelling(shownChordRoot)}${args.activeChord.symbol}`
    : undefined;
  const activeChordRoman = args.activeChord ? romanForChord(args.rootPc, args.activeChord) : undefined;
  const activeChordInKey = args.activeChord ? chordInKey(args.scalePcs, args.activeChord) : undefined;
  const rootName = args.scaleSpelling?.[0]?.name ?? noteName(args.displayedRoot);
  const chordRootName =
    args.scaleSpelling?.find((tone) => tone.pc === mod(args.triad.rootPc + args.shift, 12))?.name ??
    pitchSpelling(mod(args.triad.rootPc + args.shift, 12));
  return {
    origin,
    pulls,
    pullIndexes,
    reading,
    formula,
    spellFormula,
    activeChordSymbol,
    activeChordRoman,
    activeChordInKey,
    rootName,
    chordRootName,
    degreeLabels: formula,
  };
}

export function deriveView(
  state: AppState,
  session: ProgressionSnapshot,
  playbackVoicing: Voicing | null,
  referencePc: number | null = null,
) {
  const { family, mode, intervals } = selectScale(state.familyKey, state.modeKey);
  const { family: compareFamily, mode: compareMode, intervals: compareIntervals } = selectScale(
    state.compareFamilyKey,
    state.compareModeKey,
  );
  const shift = labelShift(state.labelMode);
  const scalePcs = getScaleNotes(state.rootPc, intervals);
  const pitchIndex = pcToIndex(scalePcs);
  const diatonic = parentScale(intervals);
  const triad = getDiatonicTriad(state.rootPc, diatonic.intervals, state.triadDegree);
  const grid = buildGrid(state.tuning, state.fretCount);
  const { npsShapes, cagedShapes } = deriveShapes(grid, scalePcs, intervals, state.rootPc);
  const shapeList = state.shapeMode === 'nps' ? npsShapes : state.shapeMode === 'caged' ? cagedShapes : [];
  const activeShape = shapeList.length ? shapeList[Math.min(state.shapeIndex, shapeList.length - 1)] ?? null : null;
  const voicings = deriveVoicings({
    viewMode: state.viewMode,
    activeChord: state.activeChord,
    triad,
    chordDisplay: state.chordDisplay,
    voicingIndex: state.voicingIndex,
    voicingStyle: state.voicingStyle,
    voicingInversion: state.voicingInversion,
    voicingWidth: state.voicingWidth,
    voicingSetStart: state.voicingSetStart,
    tuning: state.tuning,
    fretCount: state.fretCount,
    fretFrom: state.fretFrom,
    fretTo: state.fretTo,
    positionWindow: state.positionWindow,
    playbackVoicing,
    picked: state.picked,
    grid,
    guideTones: state.guideTones,
    shapeMode: state.shapeMode,
    activeShape,
  });
  const displayedRoot = mod(state.rootPc + shift, 12);
  const { scaleSpelling, spelling } = spellingMap(displayedRoot, intervals, voicings.voicedChord, shift);
  const reading = deriveReading({
    viewMode: state.viewMode,
    family,
    mode,
    intervals,
    displayedRoot,
    shift,
    rootPc: state.rootPc,
    triad,
    voicedChord: voicings.voicedChord,
    activeChord: state.activeChord,
    spelling,
    scaleSpelling,
    bassRole: voicings.bassRole,
    chords: session.chords,
    loop: session.loop,
    scalePcs,
    diatonicIntervals: diatonic.intervals,
  });
  const comparePcs = getScaleNotes(state.compareRootPc, compareIntervals);
  const comparePcSet = new Set(comparePcs);
  const sharedCount = state.compareEnabled ? scalePcs.filter((pc) => comparePcSet.has(pc)).length : 0;
  const compareRootName =
    spellScale(mod(state.compareRootPc + shift, 12), compareIntervals)?.[0]?.name ??
    noteName(mod(state.compareRootPc + shift, 12));
  const colorByDegree = state.colorMode === 'degree';
  const keyboardLowestMidi =
    state.keyboardOctaves === 3
      ? controllerWindow(state.controllerBaseOctave, state.controllerOctaveShift).lowest
      : cMidi(state.soundOctave);
  const highlightBase: HighlightContext = {
    rootPc: state.rootPc,
    intervals,
    pcToIndex: pitchIndex,
    viewMode: state.viewMode,
    triad,
    activeChord: state.activeChord,
    displayMode: state.displayMode,
    shift,
    ghostScale: state.ghostScale && !voicings.guideActive,
    compareEnabled: state.compareEnabled,
    comparePcSet,
    compareRootPc: state.compareRootPc,
    sharedOnly: state.sharedOnly,
    spelling,
    referencePc,
  };
  const referenceName =
    referencePc == null
      ? null
      : (spelling.get(mod(referencePc + shift, 12)) ?? noteName(mod(referencePc + shift, 12)));
  const evaluateFretboard = highlightEvaluator({
    ...highlightBase,
    identifyBassMidi: state.viewMode === 'identify' ? voicings.pickedNotes[0]?.midi : undefined,
    quizMarks: state.quiz.marks,
  });
  const evaluateKeyboard = keyboardHighlight(
    { ...highlightBase, restrictPcs: voicings.restrictPcs },
    voicings.voicingPcs,
  );

  return {
    family,
    mode,
    intervals,
    shift,
    scalePcs,
    pcToIndex: pitchIndex,
    diatonic,
    triad,
    grid,
    npsShapes,
    cagedShapes,
    displayedRoot,
    scaleSpelling,
    spelling,
    compareFamily,
    compareMode,
    compareIntervals,
    comparePcSet,
    sharedCount,
    compareRootName,
    colorByDegree,
    chordQualityName: qualityName(triad.quality),
    keyboardLowestMidi,
    evaluateFretboard,
    evaluateKeyboard,
    referenceName,
    ...voicings,
    ...reading,
  };
}
