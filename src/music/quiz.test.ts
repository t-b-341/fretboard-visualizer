import { describe, expect, it } from 'vitest';
import { chordSymbol } from './chords';
import { buildGrid } from './fretboard';
import type { Cell } from './fretboard';
import { mulberry32 } from './progression';
import {
  QUIZ_LOG_LIMIT,
  appendQuizLog,
  defaultNoteQuizSettings,
  gradeAnswer,
  gradePlayedNote,
  loadQuizLog,
  makeQuestion,
  median,
  saveQuizLog,
  scheduleNoteQuestion,
  spelledName,
  type AnswerLogEntry,
  type NoteQuizQuestion,
  type NoteQuizSettings,
} from './quiz';
import { getPreset } from './tunings';

const major = [0, 2, 4, 5, 7, 9, 11];
const pentatonic = [0, 2, 4, 7, 9];
const wholeTone = [0, 2, 4, 6, 8, 10];
const diminished = [0, 1, 3, 4, 6, 7, 9, 10];
const scales = [major, pentatonic, wholeTone, diminished];

describe('makeQuestion', () => {
  it('returns the same question for the same seed', () => {
    const a = makeQuestion(mulberry32(1), 7, major, 0);
    const b = makeQuestion(mulberry32(1), 7, major, 0);
    expect(a).toEqual(b);
    expect(a.prompt).toBe(`Find the ${a.targetDegree} of ${chordSymbol(a.chord, 0)}`);
  });

  it('keeps every target inside the chord across 500 questions', () => {
    const rnd = mulberry32(1);
    let borrowed = 0;
    let diatonic = 0;
    let diatonicSevenths = 0;

    for (let i = 0; i < 500; i++) {
      const keyRootPc = i % 12;
      const shift = i % 2;
      const intervals = scales[i % scales.length];
      const question = makeQuestion(rnd, keyRootPc, intervals, shift);
      const tone = question.chord.tones.find((item) => item.degree === question.targetDegree);

      expect(question.chord.pcs).toContain(question.targetPc);
      expect(tone).toBeDefined();
      expect(question.prompt).toBe(
        `Find the ${question.targetDegree} of ${chordSymbol(question.chord, shift)}`,
      );

      if (question.chord.quality) {
        borrowed += 1;
        expect(['7', 'm7', 'maj7', 'm7b5']).toContain(question.chord.quality);
      } else {
        diatonic += 1;
        if (question.chord.tones.length === 4) diatonicSevenths += 1;
      }
    }

    expect(borrowed).toBeGreaterThan(60);
    expect(borrowed).toBeLessThan(140);
    expect(diatonicSevenths / diatonic).toBeGreaterThan(0.35);
    expect(diatonicSevenths / diatonic).toBeLessThan(0.65);
  });
});

const aeolian = [0, 2, 3, 5, 7, 8, 10];

function cell(stringIndex: number, fret: number, pc: number, midi: number): Cell {
  return { stringIndex, fret, pc, midi };
}

function nameQuestion(target: Cell, answerText: string): NoteQuizQuestion {
  return {
    id: 'name',
    type: 'nameNote',
    reverse: false,
    prompt: 'Name this note.',
    target,
    answerCells: [target],
    answerText,
  };
}

function logEntry(partial: Partial<AnswerLogEntry> & Pick<AnswerLogEntry, 'stringIndex' | 'fret' | 'correct'>): AnswerLogEntry {
  return {
    type: 'nameNote',
    pc: 0,
    ms: 1000,
    at: 0,
    ...partial,
  };
}

describe('note quiz grading', () => {
  const eb = cell(1, 2, 3, 51);

  it('grades nameNote, and accepts either enharmonic when there is no key', () => {
    const question = nameQuestion(eb, 'Eb');
    expect(gradeAnswer(question, { name: 'Eb' }, [eb], 0, null).correct).toBe(true);
    expect(gradeAnswer(question, { name: 'D#' }, [eb], 0, null).correct).toBe(true);
    expect(gradeAnswer(question, { name: 'E' }, [eb], 0, null).correct).toBe(false);
    expect(gradeAnswer(question, { name: 'H' }, [eb], 0, null).correct).toBe(false);
  });

  it('requires the scale spelling when a key is set', () => {
    const key = { rootPc: 0, intervals: aeolian };
    const question = nameQuestion(eb, spelledName(eb.midi, 0, key));
    expect(question.answerText).toBe('Eb');
    expect(gradeAnswer(question, { name: 'Eb' }, [eb], 0, key).correct).toBe(true);
    expect(gradeAnswer(question, { name: 'D#' }, [eb], 0, key).correct).toBe(false);

    const fSharp = cell(0, 0, 6, 66);
    const sharpKey = { rootPc: 6, intervals: major };
    const sharp = nameQuestion(fSharp, spelledName(fSharp.midi, 0, sharpKey));
    expect(sharp.answerText).toBe('F#');
    expect(gradeAnswer(sharp, { name: 'F#' }, [fSharp], 0, sharpKey).correct).toBe(true);
    expect(gradeAnswer(sharp, { name: 'Gb' }, [fSharp], 0, sharpKey).correct).toBe(false);
    expect(gradeAnswer(sharp, { name: 'Gb' }, [fSharp], 0, null).correct).toBe(true);
  });

  it('shifts the expected name by one semitone in Standard mode', () => {
    const question = nameQuestion(eb, 'E');
    const concert = gradeAnswer(question, { name: 'Eb' }, [eb], 0, null);
    const standard = gradeAnswer(question, { name: 'E' }, [eb], 1, null);
    expect(concert.correct).toBe(true);
    expect(standard.correct).toBe(true);
    expect(gradeAnswer(question, { name: 'Eb' }, [eb], 1, null).correct).toBe(false);
    expect(gradeAnswer(question, { name: 'Fb' }, [eb], 1, null).correct).toBe(true);
    expect(standard.labels['1:2']).toBe('E');

    const key = { rootPc: 0, intervals: aeolian };
    expect(spelledName(eb.midi, 0, key)).toBe('Eb');
    expect(spelledName(eb.midi, 1, key)).toBe('Fb');
    const spelled = nameQuestion(eb, 'Fb');
    expect(gradeAnswer(spelled, { name: 'Fb' }, [eb], 1, key).correct).toBe(true);
    expect(gradeAnswer(spelled, { name: 'E' }, [eb], 1, key).correct).toBe(false);
  });

  it('scores findNote precision and recall', () => {
    const pool = [cell(0, 0, 3, 51), cell(1, 4, 3, 63), cell(2, 1, 3, 56), cell(2, 2, 4, 57)];
    const question: NoteQuizQuestion = {
      id: 'find',
      type: 'findNote',
      reverse: false,
      prompt: 'Find every Eb',
      answerCells: pool.slice(0, 3),
      answerText: 'Eb',
    };
    const exact = gradeAnswer(question, { cells: pool.slice(0, 3) }, pool, 0, null);
    expect(exact.correct).toBe(true);
    expect(exact.precision).toBe(1);
    expect(exact.recall).toBe(1);

    const partial = gradeAnswer(question, { cells: [pool[0], pool[1], pool[3]] }, pool, 0, null);
    expect(partial.correct).toBe(false);
    expect(partial.precision).toBeCloseTo(2 / 3);
    expect(partial.recall).toBeCloseTo(2 / 3);
    expect(partial.wrong.map((item) => item.fret)).toEqual([2]);
    expect(partial.entries.filter((entry) => !entry.correct)).toHaveLength(2);
  });

  it('grades interval names and the reverse click', () => {
    const root = cell(0, 0, 0, 40);
    const target = cell(1, 3, 3, 43);
    const named: NoteQuizQuestion = {
      id: 'interval',
      type: 'intervalFromRoot',
      reverse: false,
      prompt: 'Name the interval',
      root,
      target,
      answerCells: [target],
      answerText: 'm3',
      semitones: 3,
    };
    expect(gradeAnswer(named, { name: 'm3' }, [root, target], 0, null).correct).toBe(true);
    expect(gradeAnswer(named, { name: 'M3' }, [root, target], 0, null).correct).toBe(false);

    const ear: NoteQuizQuestion = { ...named, id: 'ear', type: 'earInterval', prompt: 'Name the interval you hear.' };
    expect(gradeAnswer(ear, { name: 'm3' }, [root, target], 0, null).correct).toBe(true);
    expect(gradeAnswer(ear, { name: 'P4' }, [root, target], 0, null).correct).toBe(false);

    const reverse: NoteQuizQuestion = {
      id: 'rev',
      type: 'intervalFromRoot',
      reverse: true,
      prompt: 'Click the b6 above this root',
      root,
      target: cell(2, 1, 8, 48),
      answerCells: [cell(2, 1, 8, 48)],
      answerText: 'b6',
      semitones: 8,
    };
    const pool = [root, reverse.target!];
    expect(gradeAnswer(reverse, { cells: [reverse.target!] }, pool, 0, null).correct).toBe(true);
    const missed = gradeAnswer(reverse, { cells: [root] }, pool, 0, null);
    expect(missed.correct).toBe(false);
    expect(missed.wrong).toEqual([root]);
    expect(missed.right).toEqual(reverse.answerCells);
  });

  it('answers nameNote and the reverse interval from a played pitch class', () => {
    const question = nameQuestion(eb, 'Eb');
    expect(gradePlayedNote(question, 51, [eb], 0, null)?.correct).toBe(true);
    expect(gradePlayedNote(question, 63, [eb], 0, null)?.correct).toBe(true);
    expect(gradePlayedNote(question, 64, [eb], 0, null)?.correct).toBe(false);

    const key = { rootPc: 10, intervals: aeolian };
    const spelled = nameQuestion(eb, spelledName(eb.midi, 0, key));
    expect(gradePlayedNote(spelled, 63, [eb], 0, key)?.correct).toBe(true);

    const root = cell(0, 0, 0, 60);
    const target = cell(2, 1, 8, 68);
    const reverse: NoteQuizQuestion = {
      id: 'rev-played',
      type: 'intervalFromRoot',
      reverse: true,
      prompt: 'Click the b6 above this root',
      root,
      target,
      answerCells: [target],
      answerText: 'b6',
      semitones: 8,
    };
    expect(gradePlayedNote(reverse, 68, [root, target], 0, null)?.correct).toBe(true);
    expect(gradePlayedNote(reverse, 56, [root, target], 0, null)?.correct).toBe(true);
    expect(gradePlayedNote(reverse, 60, [root, target], 0, null)?.correct).toBe(false);

    const find: NoteQuizQuestion = { ...question, type: 'findNote', prompt: 'Find every Eb' };
    expect(gradePlayedNote(find, 51, [eb], 0, null)).toBeNull();
    const namedInterval: NoteQuizQuestion = { ...reverse, reverse: false, type: 'intervalFromRoot' };
    expect(gradePlayedNote(namedInterval, 48, [root, target], 0, null)).toBeNull();
  });
});

describe('note quiz scheduler', () => {
  const bad = cell(0, 0, 0, 40);
  const good = cell(0, 3, 5, 45);

  function history(): AnswerLogEntry[] {
    const rows: AnswerLogEntry[] = [];
    for (let i = 0; i < 8; i++) {
      rows.push(logEntry({ stringIndex: 0, fret: 0, pc: 0, correct: false, ms: 8000, at: i }));
      rows.push(logEntry({ stringIndex: 0, fret: 3, pc: 5, correct: true, ms: 400, at: 100 + i }));
    }
    return rows;
  }

  function nameOnly(): NoteQuizSettings {
    return {
      ...defaultNoteQuizSettings(7, 12),
      types: { nameNote: true, findNote: false, intervalFromRoot: false, earInterval: false },
    };
  }

  it('returns the same question for the same seed', () => {
    const input = {
      log: history(),
      cells: [bad, good],
      settings: nameOnly(),
      shift: 0,
      key: null,
    };
    expect(scheduleNoteQuestion({ ...input, rnd: mulberry32(4) })).toEqual(
      scheduleNoteQuestion({ ...input, rnd: mulberry32(4) }),
    );
  });

  it('favors a cell with a bad history over many seeds', () => {
    let misses = 0;
    const trials = 80;
    for (let seed = 0; seed < trials; seed++) {
      const question = scheduleNoteQuestion({
        log: history(),
        cells: [bad, good],
        settings: nameOnly(),
        shift: 0,
        key: null,
        rnd: mulberry32(seed),
      });
      expect(question?.type).toBe('nameNote');
      if (question?.target?.fret === 0) misses += 1;
    }
    expect(misses).toBeGreaterThan(70);
  });

  it('can ask every question type on a 7-string from frets 0 to 5', () => {
    const tuning = getPreset('7-half-down');
    expect(tuning?.strings).toBe(7);
    const cells = buildGrid(tuning!.notes, 5).flat();
    const settings = { ...defaultNoteQuizSettings(7, 5), fretMin: 0, fretMax: 5 };
    const seen = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const question = scheduleNoteQuestion({
        log: [],
        cells,
        settings,
        shift: 0,
        key: null,
        rnd: mulberry32(seed),
      });
      expect(question).not.toBeNull();
      if (!question) continue;
      seen.add(question.reverse ? 'intervalReverse' : question.type);
      for (const cell of question.answerCells) {
        expect(cell.fret).toBeGreaterThanOrEqual(0);
        expect(cell.fret).toBeLessThanOrEqual(5);
      }
      if (question.semitones !== undefined) {
        expect(question.semitones).toBeGreaterThanOrEqual(1);
        expect(question.semitones).toBeLessThanOrEqual(12);
      }
    }
    expect([...seen].sort()).toEqual(['earInterval', 'findNote', 'intervalFromRoot', 'intervalReverse', 'nameNote']);
  });
});

describe('note quiz log', () => {
  it('trims to the cap and keeps the newest rows', () => {
    const rows = Array.from({ length: QUIZ_LOG_LIMIT + 5 }, (_, at) => logEntry({ stringIndex: 0, fret: 0, at, correct: true }));
    const trimmed = appendQuizLog([], rows);
    expect(trimmed).toHaveLength(QUIZ_LOG_LIMIT);
    expect(trimmed[0].at).toBe(5);
    expect(trimmed[trimmed.length - 1].at).toBe(QUIZ_LOG_LIMIT + 4);
  });

  it('ignores corrupt JSON and a storage that throws', () => {
    const broken = {
      getItem: () => '{',
      setItem: () => {
        throw new Error('full');
      },
    };
    expect(loadQuizLog(broken)).toEqual([]);
    expect(() => saveQuizLog([logEntry({ stringIndex: 0, fret: 1, correct: true })], broken)).not.toThrow();

    let raw = '{"version":1,"entries":"nope"}';
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    expect(loadQuizLog(storage)).toEqual([]);
    const rows = Array.from({ length: QUIZ_LOG_LIMIT + 3 }, (_, at) =>
      logEntry({ stringIndex: 1, fret: 2, at, correct: at % 2 === 0 }),
    );
    saveQuizLog(rows, storage);
    const loaded = loadQuizLog(storage);
    expect(loaded).toHaveLength(QUIZ_LOG_LIMIT);
    expect(loaded[0].at).toBe(3);
    expect(median([10, 30, 20, 40])).toBe(25);
    expect(median([])).toBeNull();
  });
});
