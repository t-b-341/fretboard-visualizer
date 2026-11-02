import { buildChord, buildDiatonicChord, chordSymbol, type Chord, type ChordQuality } from './chords';
import type { Cell } from './fretboard';
import { mod, noteName } from './notes';
import { NATURAL } from './spelling';
import { enharmonicEqual, parseNoteName, spellMidiInScale } from './written';

export interface Question {
  chord: Chord;
  targetDegree: string;
  targetPc: number;
  prompt: string;
}

const BORROWED: readonly ChordQuality[] = ['7', 'm7', 'maj7', 'm7b5'];

/**
 * One quiz item for the current key. About 80% of chords are diatonic
 * (degree 0-6, a seventh half the time). The rest are a borrowed seventh
 * on a random root. The asked tone is one of that chord's own degrees.
 */
export function makeQuestion(
  rnd: () => number,
  keyRootPc: number,
  intervals: number[],
  shift: number,
): Question {
  const chord =
    rnd() < 0.8
      ? buildDiatonicChord(keyRootPc, intervals, Math.floor(rnd() * 7), rnd() < 0.5)
      : buildChord(Math.floor(rnd() * 12), BORROWED[Math.floor(rnd() * BORROWED.length)]);
  const tone = chord.tones[Math.floor(rnd() * chord.tones.length)];
  const targetDegree = tone.degree;
  const targetPc = mod(chord.rootPc + tone.interval, 12);
  return {
    chord,
    targetDegree,
    targetPc,
    prompt: `Find the ${targetDegree} of ${chordSymbol(chord, shift)}`,
  };
}

// --- Note quiz ----------------------------------------------------------------
//
// A second drill, separate from the chord-degree quiz above. Questions, grading,
// the answer log, and the scheduler are pure. React and localStorage stay outside
// except for the two storage helpers, which swallow failures.

export type NoteQuizKind = 'nameNote' | 'findNote' | 'intervalFromRoot' | 'earInterval';

/** Log rows distinguish the click-the-interval variant from naming one. */
export type QuizLogType = NoteQuizKind | 'intervalReverse';

export interface NoteQuizSettings {
  enabled: boolean;
  /** String indexes that may be asked. 0 is the lowest string. */
  strings: number[];
  fretMin: number;
  fretMax: number;
  naturalsOnly: boolean;
  /** 'none' accepts either enharmonic. 'key' requires spellMidiInScale. */
  keyContext: 'none' | 'key';
  types: Record<NoteQuizKind, boolean>;
  /** Ear questions also sound the two notes together. */
  harmonic: boolean;
}

export interface QuizKey {
  rootPc: number;
  intervals: number[];
}

export interface AnswerLogEntry {
  type: QuizLogType;
  stringIndex: number;
  fret: number;
  /** Concert pitch class. */
  pc: number;
  correct: boolean;
  ms: number;
  at: number;
}

export interface NoteQuizQuestion {
  id: string;
  type: NoteQuizKind;
  /** Click the named degree above the root, instead of naming the interval. */
  reverse: boolean;
  prompt: string;
  root?: Cell;
  target?: Cell;
  /** Cells that satisfy a find or reverse question, and the logged cell otherwise. */
  answerCells: Cell[];
  /** Text shown as the right answer. */
  answerText: string;
  /** Semitones from the root up to the target. */
  semitones?: number;
}

export interface CellRef {
  stringIndex: number;
  fret: number;
}

export interface GradeResult {
  correct: boolean;
  precision: number;
  recall: number;
  /** Right answers, including ones the player missed and we reveal. */
  right: CellRef[];
  /** Cells the player chose that are not part of the answer. */
  wrong: CellRef[];
  /** Note name or interval label keyed by "stringIndex:fret". */
  labels: Record<string, string>;
  entries: Omit<AnswerLogEntry, 'ms' | 'at'>[];
}

export const QUIZ_LOG_KEY = 'fretboard-visualizer:quiz:v1';
export const QUIZ_LOG_LIMIT = 2000;

/** Quality names for 0..12 semitones. 0 is unused by the quiz. */
export const INTERVAL_NAMES = ['P1', 'm2', 'M2', 'm3', 'M3', 'P4', 'A4', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'] as const;

/** Degree names for a click-the-note prompt. Index 12 is the octave. */
export const INTERVAL_DEGREES = ['1', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7', '8'] as const;

const INTERVAL_ALIAS: Record<string, string> = {
  tt: 'A4',
  tritone: 'A4',
  d5: 'A4',
  aug4: 'A4',
  dim5: 'A4',
};

const NATURAL_PCS = new Set(NATURAL);
const LOG_TYPES = new Set<QuizLogType>(['nameNote', 'findNote', 'intervalFromRoot', 'intervalReverse', 'earInterval']);
const BOX_WEIGHT = [12, 8, 5, 3, 2, 1];
const RECENT = 5;

export function defaultNoteQuizSettings(numStrings: number, fretCount: number): NoteQuizSettings {
  const frets = Math.max(0, fretCount);
  return {
    enabled: false,
    strings: Array.from({ length: Math.max(0, numStrings) }, (_, i) => i),
    fretMin: 0,
    fretMax: Math.min(12, frets),
    naturalsOnly: false,
    keyContext: 'none',
    types: { nameNote: true, findNote: true, intervalFromRoot: true, earInterval: true },
    harmonic: false,
  };
}

export function cellKey(cell: CellRef): string {
  return `${cell.stringIndex}:${cell.fret}`;
}

export function isNaturalPc(pc: number): boolean {
  return NATURAL_PCS.has(mod(pc, 12));
}

/** Name the player should see for this sounding MIDI note. */
export function spelledName(midi: number, shift: number, key: QuizKey | null): string {
  const shownMidi = midi + shift;
  const shownPc = mod(shownMidi, 12);
  if (!key) return noteName(shownPc, true);
  try {
    const note = spellMidiInScale(shownMidi, mod(key.rootPc + shift, 12), key.intervals);
    return note.name.replace(/-?\d+$/, '');
  } catch {
    return noteName(shownPc, true);
  }
}

/** Twelve displayed pitch classes, spelled the way the pad should label them. */
export function padNames(shift: number, key: QuizKey | null): { pc: number; name: string }[] {
  return Array.from({ length: 12 }, (_, pc) => ({
    pc,
    name: spelledName(60 + pc - shift, shift, key),
  }));
}

export function cellsInPlay(cells: readonly Cell[], settings: NoteQuizSettings, shift: number): Cell[] {
  const allow = new Set(settings.strings);
  return cells.filter((cell) => {
    if (!allow.has(cell.stringIndex)) return false;
    if (cell.fret < settings.fretMin || cell.fret > settings.fretMax) return false;
    if (settings.naturalsOnly && !isNaturalPc(cell.pc + shift)) return false;
    return true;
  });
}

function sameSpelling(answer: string, expected: string): boolean {
  try {
    const given = parseNoteName(answer.trim());
    const want = parseNoteName(expected);
    return given.letter === want.letter && given.accidental === want.accidental;
  } catch {
    return false;
  }
}

/** No key: either enharmonic of the displayed pitch class. A key: that spelling only. */
export function nameAccepted(answer: string, shownPc: number, spelled: string | null): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  try {
    parseNoteName(trimmed);
  } catch {
    return false;
  }
  if (spelled) return sameSpelling(trimmed, spelled);
  const pc = mod(shownPc, 12);
  return enharmonicEqual(trimmed, noteName(pc, true)) || enharmonicEqual(trimmed, noteName(pc, false));
}

export function intervalAccepted(answer: string, semitones: number): boolean {
  const want = INTERVAL_NAMES[semitones];
  if (!want) return false;
  const given = answer.trim();
  if (given === want) return true;
  return INTERVAL_ALIAS[given.toLowerCase()] === want;
}

function rootsBelow(target: Cell, pool: readonly Cell[]): Cell[] {
  return pool.filter((cell) => {
    const distance = target.midi - cell.midi;
    return distance >= 1 && distance <= 12;
  });
}

function logTypeOf(question: NoteQuizQuestion): QuizLogType {
  if (question.type === 'intervalFromRoot' && question.reverse) return 'intervalReverse';
  return question.type;
}

function entryFor(type: QuizLogType, cell: Cell, correct: boolean): GradeResult['entries'][number] {
  return { type, stringIndex: cell.stringIndex, fret: cell.fret, pc: cell.pc, correct };
}

export function gradeAnswer(
  question: NoteQuizQuestion,
  answer: { name?: string; cells?: CellRef[] },
  pool: readonly Cell[],
  shift: number,
  key: QuizKey | null,
): GradeResult {
  const labels: Record<string, string> = {};
  const type = logTypeOf(question);

  if (question.type === 'nameNote' && question.target) {
    const cell = question.target;
    const shownPc = mod(cell.pc + shift, 12);
    const spelled = spelledName(cell.midi, shift, key);
    const correct = nameAccepted(answer.name ?? '', shownPc, key ? spelled : null);
    labels[cellKey(cell)] = spelled;
    return {
      correct,
      precision: correct ? 1 : 0,
      recall: correct ? 1 : 0,
      right: correct ? [cell] : [],
      wrong: correct ? [] : [cell],
      labels,
      entries: [entryFor(type, cell, correct)],
    };
  }

  if (question.type === 'findNote') {
    const expected = question.answerCells;
    const expectedIds = new Set(expected.map(cellKey));
    const picked = uniqueCells(answer.cells ?? [], pool);
    const pickedIds = new Set(picked.map(cellKey));
    const hits = expected.filter((cell) => pickedIds.has(cellKey(cell)));
    const extras = picked.filter((cell) => !expectedIds.has(cellKey(cell)));
    const precision = picked.length === 0 ? 0 : hits.length / picked.length;
    const recall = expected.length === 0 ? 0 : hits.length / expected.length;
    const correct = expected.length > 0 && precision === 1 && recall === 1;
    const name = question.answerText;
    for (const cell of expected) labels[cellKey(cell)] = name;
    for (const cell of extras) labels[cellKey(cell)] = nameOfCell(cell, shift, key);
    const entries = [
      ...expected.map((cell) => entryFor(type, cell, pickedIds.has(cellKey(cell)))),
      ...extras.map((cell) => entryFor(type, cell, false)),
    ];
    return {
      correct,
      precision,
      recall,
      right: expected,
      wrong: extras,
      labels,
      entries,
    };
  }

  if (question.type === 'intervalFromRoot' && question.reverse && question.root) {
    const expected = question.answerCells;
    const expectedIds = new Set(expected.map(cellKey));
    const picked = uniqueCells(answer.cells ?? [], pool).slice(0, 1);
    const hit = picked.filter((cell) => expectedIds.has(cellKey(cell)));
    const extras = picked.filter((cell) => !expectedIds.has(cellKey(cell)));
    const correct = hit.length === 1;
    const degree = question.answerText;
    for (const cell of expected) labels[cellKey(cell)] = degree;
    for (const cell of extras) labels[cellKey(cell)] = nameOfCell(cell, shift, key);
    const entries = [
      ...expected.map((cell) => entryFor(type, cell, hit.some((item) => cellKey(item) === cellKey(cell)))),
      ...extras.map((cell) => entryFor(type, cell, false)),
    ];
    return {
      correct,
      precision: correct ? 1 : 0,
      recall: correct ? 1 : 0,
      right: expected,
      wrong: extras,
      labels,
      entries,
    };
  }

  if ((question.type === 'intervalFromRoot' || question.type === 'earInterval') && question.target && question.semitones) {
    const cell = question.target;
    const correct = intervalAccepted(answer.name ?? '', question.semitones);
    labels[cellKey(cell)] = question.answerText;
    if (question.root) labels[cellKey(question.root)] = 'R';
    return {
      correct,
      precision: correct ? 1 : 0,
      recall: correct ? 1 : 0,
      right: correct ? [cell] : [],
      wrong: correct ? [] : [cell],
      labels,
      entries: [entryFor(type, cell, correct)],
    };
  }

  return { correct: false, precision: 0, recall: 0, right: [], wrong: [], labels, entries: [] };
}

function nameOfCell(cell: Cell, shift: number, key: QuizKey | null): string {
  return spelledName(cell.midi, shift, key);
}

function uniqueCells(refs: readonly CellRef[], pool: readonly Cell[]): Cell[] {
  const byId = new Map(pool.map((cell) => [cellKey(cell), cell]));
  const out: Cell[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const id = cellKey(ref);
    const cell = byId.get(id);
    if (!cell || seen.has(id)) continue;
    seen.add(id);
    out.push(cell);
  }
  return out;
}

interface CellStat {
  box: number;
  recent: { correct: boolean; ms: number }[];
}

function statsFromLog(log: readonly AnswerLogEntry[]): Map<string, CellStat> {
  const stats = new Map<string, CellStat>();
  for (const entry of log) {
    const id = `${entry.type}:${entry.stringIndex}:${entry.fret}`;
    const stat = stats.get(id) ?? { box: 0, recent: [] };
    stat.box = entry.correct ? Math.min(5, stat.box + 1) : 0;
    stat.recent.push({ correct: entry.correct, ms: entry.ms });
    if (stat.recent.length > RECENT) stat.recent.shift();
    stats.set(id, stat);
  }
  return stats;
}

/** Higher when the cell was missed or answered slowly. Unseen cells sit in the middle. */
export function cellWeight(stat: CellStat | undefined): number {
  if (!stat || stat.recent.length === 0) return 1.5;
  const boxW = BOX_WEIGHT[Math.max(0, Math.min(5, stat.box))];
  const accuracy = stat.recent.filter((item) => item.correct).length / stat.recent.length;
  const meanMs = stat.recent.reduce((sum, item) => sum + item.ms, 0) / stat.recent.length;
  const accW = 1.15 - accuracy;
  const msW = 0.75 + Math.min(meanMs, 12000) / 4000;
  return boxW * accW * msW;
}

function weightedPick<T>(entries: { item: T; weight: number }[], rnd: () => number): T {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = rnd() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.item;
  }
  return entries[entries.length - 1].item;
}

interface ScheduleInput {
  log: readonly AnswerLogEntry[];
  cells: readonly Cell[];
  settings: NoteQuizSettings;
  shift: number;
  key: QuizKey | null;
  rnd: () => number;
}

/**
 * Next question from the log. Missed and slow cells outweigh ones that were
 * answered quickly and correctly. `rnd` is the only source of randomness.
 */
export function scheduleNoteQuestion(input: ScheduleInput): NoteQuizQuestion | null {
  const { log, settings, shift, rnd } = input;
  const key = settings.keyContext === 'key' ? input.key : null;
  const pool = cellsInPlay(input.cells, settings, shift);
  if (pool.length === 0) return null;

  const types: QuizLogType[] = [];
  if (settings.types.nameNote) types.push('nameNote');
  if (settings.types.findNote) types.push('findNote');
  if (settings.types.intervalFromRoot) types.push('intervalFromRoot', 'intervalReverse');
  if (settings.types.earInterval) types.push('earInterval');
  if (types.length === 0) return null;

  const stats = statsFromLog(log);
  const candidates: { item: { type: QuizLogType; cell: Cell }; weight: number }[] = [];
  for (const type of types) {
    const share = type === 'intervalFromRoot' || type === 'intervalReverse' ? 0.5 : 1;
    for (const cell of pool) {
      if ((type === 'intervalFromRoot' || type === 'intervalReverse' || type === 'earInterval') && rootsBelow(cell, pool).length === 0) {
        continue;
      }
      const stat = stats.get(`${type}:${cell.stringIndex}:${cell.fret}`);
      candidates.push({ item: { type, cell }, weight: cellWeight(stat) * share });
    }
  }
  if (candidates.length === 0) return null;

  const picked = weightedPick(candidates, rnd);
  return buildQuestion(picked.type, picked.cell, pool, shift, key, rnd);
}

function buildQuestion(
  type: QuizLogType,
  cell: Cell,
  pool: readonly Cell[],
  shift: number,
  key: QuizKey | null,
  rnd: () => number,
): NoteQuizQuestion | null {
  const nonce = Math.floor(rnd() * 1e9);
  if (type === 'nameNote') {
    const name = spelledName(cell.midi, shift, key);
    return {
      id: `nameNote:${cell.stringIndex}:${cell.fret}:${nonce}`,
      type: 'nameNote',
      reverse: false,
      prompt: 'Name this note.',
      target: cell,
      answerCells: [cell],
      answerText: name,
    };
  }

  if (type === 'findNote') {
    const name = spelledName(cell.midi, shift, key);
    const answerCells = pool.filter((item) => spelledName(item.midi, shift, key) === name);
    return {
      id: `findNote:${name}:${nonce}`,
      type: 'findNote',
      reverse: false,
      prompt: `Find every ${name}`,
      answerCells,
      answerText: name,
    };
  }

  const roots = rootsBelow(cell, pool);
  if (roots.length === 0) return null;
  const root = roots[Math.floor(rnd() * roots.length)];
  const semitones = cell.midi - root.midi;
  if (type === 'intervalReverse') {
    const degree = INTERVAL_DEGREES[semitones] ?? String(semitones);
    const answerCells = pool.filter((item) => item.midi === root.midi + semitones);
    return {
      id: `intervalReverse:${cell.stringIndex}:${cell.fret}:${nonce}`,
      type: 'intervalFromRoot',
      reverse: true,
      prompt: `Click the ${degree} above this root`,
      root,
      target: cell,
      answerCells,
      answerText: degree,
      semitones,
    };
  }

  const interval = INTERVAL_NAMES[semitones] ?? '';
  const kind: NoteQuizKind = type === 'earInterval' ? 'earInterval' : 'intervalFromRoot';
  return {
    id: `${kind}:${cell.stringIndex}:${cell.fret}:${nonce}`,
    type: kind,
    reverse: false,
    prompt: kind === 'earInterval' ? 'Name the interval you hear.' : 'Name the interval from the root up to the highlighted note.',
    root,
    target: cell,
    answerCells: [cell],
    answerText: interval,
    semitones,
  };
}

/** Cells drawn before the player answers. */
export function cellsDuringAsk(question: NoteQuizQuestion): { cell: Cell; role: 'root' | 'target' }[] {
  if (question.type === 'nameNote' && question.target) return [{ cell: question.target, role: 'target' }];
  if (question.type === 'intervalFromRoot' && !question.reverse && question.root && question.target) {
    return [
      { cell: question.root, role: 'root' },
      { cell: question.target, role: 'target' },
    ];
  }
  if (question.type === 'intervalFromRoot' && question.reverse && question.root) {
    return [{ cell: question.root, role: 'root' }];
  }
  return [];
}

export function appendQuizLog(log: readonly AnswerLogEntry[], next: readonly AnswerLogEntry[]): AnswerLogEntry[] {
  return [...log, ...next].slice(-QUIZ_LOG_LIMIT);
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

export interface CellAccuracy {
  stringIndex: number;
  fret: number;
  pc: number;
  accuracy: number;
  seen: number;
}

/** Accuracy of each fret, across every question type, oldest answers included. */
export function accuracyTable(log: readonly AnswerLogEntry[]): CellAccuracy[] {
  const rows = new Map<string, CellAccuracy>();
  for (const entry of log) {
    const id = `${entry.stringIndex}:${entry.fret}`;
    const row = rows.get(id) ?? {
      stringIndex: entry.stringIndex,
      fret: entry.fret,
      pc: entry.pc,
      accuracy: 0,
      seen: 0,
    };
    row.seen += 1;
    row.accuracy += entry.correct ? 1 : 0;
    row.pc = entry.pc;
    rows.set(id, row);
  }
  return [...rows.values()]
    .map((row) => ({ ...row, accuracy: row.seen === 0 ? 0 : row.accuracy / row.seen }))
    .sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen);
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function sanitizeLog(parsed: unknown): AnswerLogEntry[] {
  const entries = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { entries?: unknown }).entries)
      ? (parsed as { entries: unknown[] }).entries
      : null;
  if (!entries) return [];
  const clean: AnswerLogEntry[] = [];
  for (const item of entries) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Partial<AnswerLogEntry>;
    const { type, stringIndex, fret, pc, correct, ms, at } = entry;
    if (typeof type !== 'string' || !LOG_TYPES.has(type as QuizLogType)) continue;
    if (typeof stringIndex !== 'number' || !Number.isInteger(stringIndex)) continue;
    if (typeof fret !== 'number' || !Number.isInteger(fret)) continue;
    if (typeof pc !== 'number' || !Number.isInteger(pc)) continue;
    if (typeof correct !== 'boolean') continue;
    if (typeof ms !== 'number' || !Number.isFinite(ms)) continue;
    if (typeof at !== 'number' || !Number.isFinite(at)) continue;
    clean.push({ type: type as QuizLogType, stringIndex, fret, pc, correct, ms, at });
  }
  return clean.slice(-QUIZ_LOG_LIMIT);
}

/** Empty when storage is missing, throws, or holds JSON that is not a log. */
export function loadQuizLog(storage?: StorageLike | null): AnswerLogEntry[] {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return [];
  try {
    const raw = store.getItem(QUIZ_LOG_KEY);
    if (!raw) return [];
    return sanitizeLog(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function saveQuizLog(entries: readonly AnswerLogEntry[], storage?: StorageLike | null): void {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return;
  try {
    const body = { version: 1 as const, entries: entries.slice(-QUIZ_LOG_LIMIT) };
    store.setItem(QUIZ_LOG_KEY, JSON.stringify(body));
  } catch {
    /* private mode or a full disk — the drill still runs */
  }
}
