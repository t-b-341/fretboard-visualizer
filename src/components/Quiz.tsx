import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { player } from '../audio/player';
import type { Cell } from '../music/fretboard';
import { mulberry32 } from '../music/progression';
import {
  INTERVAL_NAMES,
  accuracyTable,
  appendQuizLog,
  cellKey,
  cellsDuringAsk,
  cellsInPlay,
  gradeAnswer,
  gradePlayedNote,
  loadQuizLog,
  median,
  padNames,
  saveQuizLog,
  scheduleNoteQuestion,
  spelledName,
  type AnswerLogEntry,
  type GradeResult,
  type NoteQuizKind,
  type NoteQuizQuestion,
  type NoteQuizSettings,
  type QuizKey,
} from '../music/quiz';
import type { PracticeMark, PracticeOverlay } from './Fretboard';

const ASK = '#4c8dff';
const ROOT_FILL = '#e6b422';
const RIGHT = '#2ec27e';
const WRONG = '#e5484d';
const PICK = '#8b5cf6';

const KIND_LABEL: Record<NoteQuizKind | 'intervalReverse', string> = {
  nameNote: 'Name',
  findNote: 'Find',
  intervalFromRoot: 'Interval',
  intervalReverse: 'Find interval',
  earInterval: 'Ear',
};

interface Draft {
  letter: string;
  acc: number;
}

export interface NoteQuizApi {
  practice: PracticeOverlay | null;
  question: NoteQuizQuestion | null;
  phase: 'ask' | 'feedback';
  feedback: string;
  session: { count: number; correct: number; medianMs: number | null };
  saved: number;
  heatmap: boolean;
  setHeatmap: (on: boolean) => void;
  pickedCount: number;
  weakest: { label: string; accuracy: number }[];
  /** Why no question is on screen. Null while one is showing, or before the first draw. */
  empty: 'types' | 'range' | 'interval' | null;
  submitName: (name: string) => void;
  submitInterval: (name: string) => void;
  submitCells: () => void;
  /** Played MIDI note. Answers name-the-note and reverse-interval by pitch class. */
  answerPlayed: (midi: number) => void;
  next: () => void;
  play: () => void;
  playTogether: () => void;
}

function heatFill(accuracy: number | null): string {
  if (accuracy == null) return '#3d4756';
  const mix = (from: number[], to: number[], amount: number) =>
    `rgb(${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount)).join(',')})`;
  const t = Math.max(0, Math.min(1, accuracy));
  if (t < 0.5) return mix([229, 72, 77], [230, 180, 34], t / 0.5);
  return mix([230, 180, 34], [46, 194, 126], (t - 0.5) / 0.5);
}

function formatDraft(draft: Draft): string {
  if (draft.acc > 0) return `${draft.letter}${'#'.repeat(draft.acc)}`;
  if (draft.acc < 0) return `${draft.letter}${'b'.repeat(-draft.acc)}`;
  return draft.letter;
}

function formatMs(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function feedbackText(question: NoteQuizQuestion, result: GradeResult): string {
  if (question.type === 'findNote') {
    const pct = (value: number) => `${Math.round(value * 100)}%`;
    const head = result.correct ? 'Correct' : 'Not quite';
    return `${head}. Precision ${pct(result.precision)}, recall ${pct(result.recall)}. Answer: every ${question.answerText}.`;
  }
  return result.correct ? `Correct — ${question.answerText}` : `Answer: ${question.answerText}`;
}

function settingsSignature(settings: NoteQuizSettings, shift: number, key: QuizKey | null, grid: Cell[][]): string {
  return JSON.stringify({
    strings: [...settings.strings].sort((a, b) => a - b),
    fretMin: settings.fretMin,
    fretMax: settings.fretMax,
    naturalsOnly: settings.naturalsOnly,
    keyContext: settings.keyContext,
    types: settings.types,
    shift,
    root: settings.keyContext === 'key' ? (key?.rootPc ?? null) : null,
    intervals: settings.keyContext === 'key' ? (key?.intervals ?? null) : null,
    rows: grid.length,
    frets: grid[0]?.length ?? 0,
    open: grid.map((row) => row[0]?.midi ?? 0).join(','),
  });
}

function buildMarks(input: {
  heatmap: boolean;
  grid: Cell[][];
  log: readonly AnswerLogEntry[];
  question: NoteQuizQuestion | null;
  phase: 'ask' | 'feedback';
  grade: GradeResult | null;
  picked: readonly Cell[];
}): Record<string, PracticeMark> {
  const marks: Record<string, PracticeMark> = {};
  if (input.heatmap) {
    const table = new Map(accuracyTable(input.log).map((row) => [`${row.stringIndex}:${row.fret}`, row]));
    for (const row of input.grid) {
      for (const cell of row) {
        const stat = table.get(cellKey(cell));
        marks[cellKey(cell)] = {
          fill: heatFill(stat ? stat.accuracy : null),
          label: stat ? String(Math.round(stat.accuracy * 100)) : '',
        };
      }
    }
    return marks;
  }
  const question = input.question;
  if (!question) return marks;
  if (input.phase === 'ask') {
    for (const item of cellsDuringAsk(question)) {
      marks[cellKey(item.cell)] =
        item.role === 'root' ? { fill: ROOT_FILL, label: 'R', ring: true } : { fill: ASK, label: '?' };
    }
    if (question.type === 'findNote') {
      for (const item of input.picked) marks[cellKey(item)] = { fill: PICK, label: '•' };
    }
    return marks;
  }
  const grade = input.grade;
  if (!grade) return marks;
  const paint = (refs: { stringIndex: number; fret: number }[], fill: string) => {
    for (const ref of refs) {
      const id = cellKey(ref);
      marks[id] = { fill, label: grade.labels[id] ?? '' };
    }
  };
  paint(grade.right, RIGHT);
  paint(grade.wrong, WRONG);
  if (question.root) {
    const id = cellKey(question.root);
    if (!marks[id]) marks[id] = { fill: ROOT_FILL, label: 'R', ring: true };
  }
  return marks;
}

function hear(question: NoteQuizQuestion, harmonic: boolean): number | null {
  if (!question.root || !question.target) return null;
  const rootMidi = question.root.midi;
  const targetMidi = question.target.midi;
  player.playSequence([rootMidi, targetMidi], { bpm: 70, gate: 0.85 });
  if (!harmonic) return null;
  return window.setTimeout(() => {
    player.playChord([rootMidi, targetMidi], { durationMs: 1000, strumMs: 0 });
  }, 1900);
}

export function useNoteQuiz(args: {
  enabled: boolean;
  settings: NoteQuizSettings;
  grid: Cell[][];
  shift: number;
  musicalKey: QuizKey | null;
}): NoteQuizApi {
  const { enabled, settings, grid, shift, musicalKey } = args;
  const key = settings.keyContext === 'key' ? musicalKey : null;
  const sig = settingsSignature(settings, shift, musicalKey, grid);
  const [log, setLog] = useState<AnswerLogEntry[]>(() => loadQuizLog());
  const [question, setQuestion] = useState<NoteQuizQuestion | null>(null);
  const [phase, setPhase] = useState<'ask' | 'feedback'>('ask');
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [picked, setPicked] = useState<Cell[]>([]);
  const [heatmap, setHeatmap] = useState(false);
  const [booted, setBooted] = useState(false);
  const [session, setSession] = useState({ count: 0, correct: 0, times: [] as number[] });
  const logRef = useRef(log);
  logRef.current = log;
  const started = useRef(Date.now());
  const hearTimer = useRef<number | null>(null);
  const rnd = useRef<(() => number) | null>(null);
  if (rnd.current == null) rnd.current = mulberry32((Math.random() * 2 ** 32) >>> 0);
  const argsRef = useRef(args);
  argsRef.current = args;
  const busy = useRef(false);
  const finishRef = useRef<(result: GradeResult) => void>(() => {});
  const questionRef = useRef(question);
  const phaseRef = useRef(phase);
  const heatmapRef = useRef(heatmap);
  const poolRef = useRef<Cell[]>([]);
  questionRef.current = question;
  phaseRef.current = phase;
  heatmapRef.current = heatmap;

  const make = () => {
    const current = argsRef.current;
    return scheduleNoteQuestion({
      log: logRef.current,
      cells: current.grid.flat(),
      settings: current.settings,
      shift: current.shift,
      key: current.settings.keyContext === 'key' ? current.musicalKey : null,
      rnd: rnd.current ?? Math.random,
    });
  };

  const stopHear = () => {
    if (hearTimer.current != null) {
      window.clearTimeout(hearTimer.current);
      hearTimer.current = null;
    }
  };

  const arm = (nextQuestion: NoteQuizQuestion | null) => {
    busy.current = false;
    stopHear();
    setQuestion(nextQuestion);
    setPhase('ask');
    setGrade(null);
    setPicked([]);
    started.current = Date.now();
  };

  useEffect(() => {
    if (!enabled) return;
    setSession({ count: 0, correct: 0, times: [] });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setBooted(false);
      return;
    }
    arm(make());
    setBooted(true);
    // The question follows the setting signature. The log is read from a ref so an answer does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sig]);

  useEffect(() => {
    if (!enabled || phase !== 'ask' || question?.type !== 'earInterval') return;
    hearTimer.current = hear(question, settings.harmonic);
    return stopHear;
    // stopHear only clears the ref timer, which this effect owns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, phase, question, settings.harmonic]);

  const pool = useMemo(() => cellsInPlay(grid.flat(), settings, shift), [grid, settings, shift]);
  poolRef.current = pool;

  const finish = (result: GradeResult) => {
    const at = Date.now();
    const ms = Math.max(0, at - started.current);
    const entries = result.entries.map((entry) => ({ ...entry, ms, at }));
    const nextLog = appendQuizLog(logRef.current, entries);
    logRef.current = nextLog;
    saveQuizLog(nextLog);
    setLog(nextLog);
    setGrade(result);
    setPhase('feedback');
    setSession((current) => ({
      count: current.count + 1,
      correct: current.correct + (result.correct ? 1 : 0),
      times: [...current.times, ms].slice(-500),
    }));
  };
  finishRef.current = finish;

  const answerPlayed = useCallback((midi: number) => {
    if (busy.current) return;
    const now = argsRef.current;
    const questionNow = questionRef.current;
    const phaseNow = phaseRef.current;
    if (!now.enabled || !questionNow || phaseNow !== 'ask' || heatmapRef.current) return;
    const result = gradePlayedNote(questionNow, midi, poolRef.current, now.shift, now.settings.keyContext === 'key' ? now.musicalKey : null);
    if (!result) return;
    busy.current = true;
    finishRef.current(result);
  }, []);

  const submitName = (name: string) => {
    if (!question || phase !== 'ask' || question.type !== 'nameNote') return;
    finish(gradeAnswer(question, { name }, pool, shift, key));
  };

  const submitInterval = (name: string) => {
    if (!question || phase !== 'ask') return;
    if (question.type !== 'earInterval' && !(question.type === 'intervalFromRoot' && !question.reverse)) return;
    finish(gradeAnswer(question, { name }, pool, shift, key));
  };

  const onCell = (stringIndex: number, fret: number) => {
    if (!question || phase !== 'ask' || heatmap) return;
    const found = pool.find((item) => item.stringIndex === stringIndex && item.fret === fret);
    if (!found) return;
    if (question.type === 'findNote') {
      setPicked((current) => {
        const exists = current.some((item) => item.stringIndex === stringIndex && item.fret === fret);
        if (exists) return current.filter((item) => !(item.stringIndex === stringIndex && item.fret === fret));
        return [...current, found];
      });
      return;
    }
    if (question.type === 'intervalFromRoot' && question.reverse) {
      finish(gradeAnswer(question, { cells: [found] }, pool, shift, key));
    }
  };

  const submitCells = () => {
    if (!question || phase !== 'ask' || question.type !== 'findNote') return;
    finish(gradeAnswer(question, { cells: picked }, pool, shift, key));
  };

  const next = () => {
    if (phase !== 'feedback') return;
    arm(make());
  };

  const play = () => {
    if (!question) return;
    stopHear();
    hearTimer.current = hear(question, settings.harmonic);
  };

  const playTogether = () => {
    if (!question?.root || !question.target) return;
    player.playChord([question.root.midi, question.target.midi], { durationMs: 1100, strumMs: 0 });
  };

  const marks = useMemo(
    () => buildMarks({ heatmap, grid, log, question, phase, grade, picked }),
    [heatmap, grid, log, question, phase, grade, picked],
  );

  const typesOn =
    settings.types.nameNote || settings.types.findNote || settings.types.intervalFromRoot || settings.types.earInterval;
  const empty = !enabled || !booted ? null : !typesOn ? 'types' : pool.length === 0 ? 'range' : question == null ? 'interval' : null;

  const weakest = useMemo(
    () =>
      accuracyTable(log)
        .filter((row) => row.seen > 0)
        .slice(0, 3)
        .map((row) => {
          const match = grid.flat().find((item) => item.stringIndex === row.stringIndex && item.fret === row.fret);
          const name = match ? spelledName(match.midi, shift, key) : String(row.pc);
          return {
            label: `${name} · string ${row.stringIndex + 1}, fret ${row.fret}`,
            accuracy: row.accuracy,
          };
        }),
    [log, grid, shift, key],
  );

  const listening =
    !heatmap && phase === 'ask' && !!question && (question.type === 'findNote' || (question.type === 'intervalFromRoot' && question.reverse));

  return {
    practice: enabled ? { marks, heatmap, listen: listening, onCell } : null,
    question: enabled ? question : null,
    phase,
    feedback: grade && question ? feedbackText(question, grade) : '',
    session: { count: session.count, correct: session.correct, medianMs: median(session.times) },
    saved: log.length,
    heatmap,
    setHeatmap,
    pickedCount: picked.length,
    weakest,
    empty,
    submitName,
    submitInterval,
    submitCells,
    answerPlayed,
    next,
    play,
    playTogether,
  };
}

interface Props {
  api: NoteQuizApi;
  settings: NoteQuizSettings;
  numStrings: number;
  fretCount: number;
  neckFrom: number;
  neckTo: number;
  shift: number;
  musicalKey: QuizKey | null;
  stringLabels: string[];
  keyLabel: string;
  onSettings: (settings: NoteQuizSettings) => void;
}

export function Quiz({
  api,
  settings,
  numStrings,
  fretCount,
  neckFrom,
  neckTo,
  shift,
  musicalKey,
  stringLabels,
  keyLabel,
  onSettings,
}: Props) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const pad = padNames(shift, settings.keyContext === 'key' ? musicalKey : null);

  useEffect(() => {
    setDraft(null);
  }, [api.question?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (event.key === 'Enter') {
        if (api.phase === 'feedback') {
          event.preventDefault();
          api.next();
          return;
        }
        if (api.question?.type === 'findNote') {
          event.preventDefault();
          api.submitCells();
          return;
        }
        if (api.question?.type === 'nameNote' && draft) {
          event.preventDefault();
          api.submitName(formatDraft(draft));
        }
        return;
      }
      if (api.phase !== 'ask' || api.question?.type !== 'nameNote' || api.heatmap) return;
      if (event.key === 'Backspace') {
        event.preventDefault();
        setDraft(null);
        return;
      }
      if (event.key === '#' || event.key === '♯') {
        event.preventDefault();
        setDraft((current) => (current ? { ...current, acc: 1 } : current));
        return;
      }
      if ((event.key === 'b' || event.key === 'B' || event.key === '♭') && draft) {
        event.preventDefault();
        setDraft({ ...draft, acc: -1 });
        return;
      }
      if (/^[a-g]$/i.test(event.key)) {
        event.preventDefault();
        setDraft({ letter: event.key.toUpperCase(), acc: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api, draft]);

  const question = api.question;
  const showNamePad = question && question.type === 'nameNote' && api.phase === 'ask' && !api.heatmap;
  const showIntervalPad =
    question &&
    api.phase === 'ask' &&
    !api.heatmap &&
    (question.type === 'earInterval' || (question.type === 'intervalFromRoot' && !question.reverse));
  const kind = question ? (question.reverse ? 'intervalReverse' : question.type) : null;
  const accuracy = api.session.count === 0 ? '—' : `${Math.round((100 * api.session.correct) / api.session.count)}%`;
  const neckClipped = settings.fretMin < neckFrom || settings.fretMax > neckTo;

  const toggleString = (index: number) => {
    const has = settings.strings.includes(index);
    const strings = has
      ? settings.strings.filter((item) => item !== index)
      : [...settings.strings, index].sort((a, b) => a - b);
    onSettings({ ...settings, strings });
  };

  const toggleType = (type: NoteQuizKind) => {
    onSettings({ ...settings, types: { ...settings.types, [type]: !settings.types[type] } });
  };

  return (
    <section className="note-quiz" aria-label="Note quiz">
      <div className="quiz-session" aria-label="Session">
        <span>
          <strong data-quiz-count={api.session.count}>{api.session.count}</strong> answered
        </span>
        <span>
          Accuracy <strong>{accuracy}</strong>
        </span>
        <span>
          Median <strong>{formatMs(api.session.medianMs)}</strong>
        </span>
        <span className="muted">{api.saved} saved</span>
        <button
          type="button"
          className={api.heatmap ? 'btn-mini active' : 'btn-mini'}
          aria-pressed={api.heatmap}
          onClick={() => api.setHeatmap(!api.heatmap)}
        >
          Heatmap
        </button>
      </div>

      {api.heatmap && (
        <div className="heat-banner">
          <div>
            <strong>Accuracy on this neck</strong>
            <p>
              Gray has not been asked. Red was missed. Green was answered correctly. Darker reds and greens are the
              ones to trust. Saved on this device, so it is still here after a reload.
            </p>
          </div>
          <div className="heat-scale" aria-hidden="true">
            <span>Missed</span>
            <i />
            <span>Accurate</span>
          </div>
          {api.weakest.length > 0 && (
            <ul className="heat-weak">
              {api.weakest.map((item) => (
                <li key={item.label}>
                  {item.label} · {Math.round(item.accuracy * 100)}%
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!api.heatmap && (
        <div className="note-quiz-ask">
          <p className="quiz-kicker">{kind ? KIND_LABEL[kind] : 'Note quiz'}</p>
          <p className="quiz-prompt" data-quiz-prompt data-question-type={kind ?? ''} aria-live="polite">
            {api.feedback || question?.prompt || emptyMessage(api.empty)}
          </p>
          {draft && api.phase === 'ask' && question?.type === 'nameNote' && (
            <p className="quiz-draft">
              Typing <strong>{formatDraft(draft)}</strong> · Enter answers
            </p>
          )}
          {question?.type === 'findNote' && api.phase === 'ask' && (
            <p className="quiz-draft">{api.pickedCount} selected · Enter submits</p>
          )}

          {showNamePad && (
            <div className="quiz-pad" role="group" aria-label="Note names">
              {pad.map((item) => (
                <button key={item.pc} type="button" className="btn-mini" data-note={item.name} onClick={() => api.submitName(item.name)}>
                  {item.name}
                </button>
              ))}
            </div>
          )}
          {showIntervalPad && (
            <div className="quiz-pad" role="group" aria-label="Intervals">
              {INTERVAL_NAMES.slice(1).map((name) => (
                <button key={name} type="button" className="btn-mini" data-interval={name} onClick={() => api.submitInterval(name)}>
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="quiz-actions">
            {question?.type === 'earInterval' && api.phase === 'ask' && (
              <>
                <button type="button" className="btn-mini" onClick={api.play}>
                  Play
                </button>
                <button type="button" className="btn-mini" onClick={api.playTogether}>
                  Together
                </button>
              </>
            )}
            {question?.type === 'findNote' && api.phase === 'ask' && (
              <button type="button" className="btn-mini" onClick={api.submitCells}>
                Done
              </button>
            )}
            {api.phase === 'feedback' && (
              <button type="button" className="btn-mini active" onClick={api.next}>
                Next
              </button>
            )}
            <span className="muted quiz-keys">Letters, then b or #. Enter continues.</span>
          </div>
        </div>
      )}

      <div className="note-quiz-settings">
        <div className="field">
          <label>Strings</label>
          <div className="str-toggles" role="group" aria-label="Quiz strings">
            {Array.from({ length: numStrings }, (_, index) => (
              <button
                key={index}
                type="button"
                className={settings.strings.includes(index) ? 'on' : ''}
                aria-pressed={settings.strings.includes(index)}
                onClick={() => toggleString(index)}
              >
                {index + 1}
                {stringLabels[index] ? ` ${stringLabels[index]}` : ''}
              </button>
            ))}
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="quiz-fret-min">Quiz from</label>
            <input
              id="quiz-fret-min"
              type="number"
              min={0}
              max={settings.fretMax}
              value={settings.fretMin}
              onChange={(event) => {
                const fretMin = clamp(Number(event.target.value), 0, settings.fretMax);
                onSettings({ ...settings, fretMin });
              }}
            />
          </div>
          <div className="field">
            <label htmlFor="quiz-fret-max">Quiz to</label>
            <input
              id="quiz-fret-max"
              type="number"
              min={settings.fretMin}
              max={fretCount}
              value={settings.fretMax}
              onChange={(event) => {
                const fretMax = clamp(Number(event.target.value), settings.fretMin, fretCount);
                onSettings({ ...settings, fretMax });
              }}
            />
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={settings.naturalsOnly}
            onChange={(event) => onSettings({ ...settings, naturalsOnly: event.target.checked })}
          />
          Naturals only
        </label>
        <div className="field">
          <label>Key spelling</label>
          <div className="segmented" role="group" aria-label="Key context">
            <button
              type="button"
              className={settings.keyContext === 'none' ? 'active' : ''}
              onClick={() => onSettings({ ...settings, keyContext: 'none' })}
            >
              Either spelling
            </button>
            <button
              type="button"
              className={settings.keyContext === 'key' ? 'active' : ''}
              onClick={() => onSettings({ ...settings, keyContext: 'key' })}
            >
              {keyLabel}
            </button>
          </div>
        </div>
        <div className="field">
          <label>Questions</label>
          <div className="quiz-types">
            {(
              [
                ['nameNote', 'Name the note'],
                ['findNote', 'Find every note'],
                ['intervalFromRoot', 'Intervals'],
                ['earInterval', 'Ear intervals'],
              ] as const
            ).map(([type, label]) => (
              <label key={type} className="checkbox-row">
                <input type="checkbox" checked={settings.types[type]} onChange={() => toggleType(type)} />
                {label}
              </label>
            ))}
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settings.harmonic}
                onChange={(event) => onSettings({ ...settings, harmonic: event.target.checked })}
              />
              Play ear intervals together too
            </label>
          </div>
        </div>
        {neckClipped && (
          <p className="quiz-draft">
            The neck is showing frets {neckFrom}–{neckTo}. Quiz frets outside that window are hidden.
          </p>
        )}
      </div>
    </section>
  );
}

function emptyMessage(empty: NoteQuizApi['empty']): string {
  if (empty === 'types') return 'Turn on at least one question type.';
  if (empty === 'range') return 'No notes in this range. Open more strings or frets, or turn off naturals only.';
  if (empty === 'interval') return 'No interval fits in this range. Widen the frets or turn on name questions.';
  return 'Getting the next question…';
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}
