// Owns the saved UI state, the setters that change it, and save/restore.
// The stored JSON shape is AppState plus a progression snapshot.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ProgressionSnapshot } from '../components/ProgressionControls';
import { getDiatonicTriad } from '../music/chords';
import type { Chord } from '../music/chords';
import { labelShift, mod } from '../music/notes';
import { mulberry32 } from '../music/progression';
import { makeQuestion } from '../music/quiz';
import { getFamily, parentScale } from '../music/scales';
import type { FamilyKey } from '../music/scales';
import type { NeckShape, ShapeMode } from '../music/shapes';
import { defaultPresetForStrings, getPreset } from '../music/tunings';
import type { Voicing } from '../music/voicings';
import { decodeState, encodeState } from '../urlState';
import {
  createInitialState,
  defaultProgression,
  fitNoteQuiz,
  mergeApp,
  mergeProgression,
} from './appState';
import type { AppState } from './appState';
import { selectScale } from './derive';
import { deleteNamed, loadStore, saveLast, saveNamed } from './setups';
import type { NamedSetup } from './setups';

function readBoot(): { app: AppState; progression: ProgressionSnapshot; named: NamedSetup[] } {
  const store = loadStore();
  return {
    app: mergeApp(store.last?.app),
    progression: mergeProgression(store.last?.progression),
    named: store.named.filter((s) => !!s && typeof s.id === 'string' && typeof s.name === 'string'),
  };
}

export function useAppState() {
  const [boot] = useState(readBoot);
  const [state, setState] = useState<AppState>(() => decodeState(window.location.search, createInitialState()));
  const [playbackVoicing, setPlaybackVoicing] = useState<Voicing | null>(null);
  const [named, setNamed] = useState<NamedSetup[]>(boot.named);
  const [session, setSession] = useState<ProgressionSnapshot>(boot.progression);
  const [loadId, setLoadId] = useState(0);
  const [setupName, setSetupName] = useState('');
  const [setupId, setSetupId] = useState('');
  const progRef = useRef(boot.progression);
  const stateRef = useRef(state);
  stateRef.current = state;
  const quizRnd = useRef<(() => number) | null>(null);
  if (quizRnd.current == null) quizRnd.current = mulberry32((Math.random() * 2 ** 32) >>> 0);
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  const { intervals } = selectScale(state.familyKey, state.modeKey);
  const shift = labelShift(state.labelMode);

  useEffect(() => {
    const t = window.setTimeout(() => saveLast(stateRef.current, progRef.current), 250);
    return () => window.clearTimeout(t);
  }, [state]);

  useEffect(() => {
    const query = encodeState(state, createInitialState());
    const next = new URL(window.location.href);
    next.search = query;
    if (next.search === window.location.search) return;
    window.history.replaceState(window.history.state, '', next.href);
  }, [state]);

  useLayoutEffect(() => {
    if (state.viewMode !== 'quiz' || state.quiz.question) return;
    const rnd = quizRnd.current;
    if (!rnd) return;
    const question = makeQuestion(rnd, state.rootPc, intervals, shift);
    setState((s) => {
      if (s.viewMode !== 'quiz' || s.quiz.question) return s;
      return { ...s, quiz: { ...s.quiz, question } };
    });
  }, [state.viewMode, state.quiz.question, state.rootPc, intervals, shift]);

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
      voicingIndex: 0,
      picked: {},
      noteQuiz: fitNoteQuiz(s.noteQuiz, n, s.fretCount),
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
      voicingIndex: 0,
      picked: {},
      noteQuiz: fitNoteQuiz(s.noteQuiz, preset.strings, s.fretCount),
    }));
  };

  const handleStringEdit = (stringIndex: number, pc: number) => {
    setState((s) => ({
      ...s,
      tuningId: 'custom',
      tuning: s.tuning.map((t, i) => (i === stringIndex ? { ...t, pc } : t)),
      voicingIndex: 0,
      picked: {},
    }));
  };

  const togglePicked = (stringIndex: number, fret: number) => {
    setState((s) => {
      const picked = { ...s.picked };
      if (picked[stringIndex] === fret) delete picked[stringIndex];
      else picked[stringIndex] = fret;
      return { ...s, picked };
    });
  };

  const answerQuiz = (stringIndex: number, fret: number, pc: number) => {
    setState((s) => {
      const question = s.quiz.question;
      if (s.viewMode !== 'quiz' || !question) return s;
      const window = s.positionWindow;
      if (window.enabled && (fret < window.min || fret > window.max)) return s;
      const key = `${stringIndex}:${fret}`;
      if (s.quiz.marks[key]) return s;
      const mark = pc === question.targetPc ? 'right' : 'wrong';
      const first = Object.keys(s.quiz.marks).length === 0;
      return {
        ...s,
        quiz: {
          ...s.quiz,
          marks: { ...s.quiz.marks, [key]: mark },
          score: first && mark === 'right' ? s.quiz.score + 1 : s.quiz.score,
          total: first ? s.quiz.total + 1 : s.quiz.total,
        },
      };
    });
  };

  const handleFamily = (familyKey: FamilyKey) => {
    const fam = getFamily(familyKey);
    setState((s) => ({ ...s, familyKey, modeKey: fam.modes[0].key, triadDegree: 0 }));
  };

  // Show a chord on the instruments (from the builder or a progression step),
  // switching into chord view so it is visible.
  const handleShowChord = (chord: Chord | null) => {
    setState((s) => ({ ...s, activeChord: chord, viewMode: 'chord', voicingIndex: 0 }));
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

  const handleShape = (mode: ShapeMode, index: number, npsShapes: NeckShape[], cagedShapes: NeckShape[]) => {
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

  const nextQuiz = () => {
    const rnd = quizRnd.current;
    if (!rnd) return;
    const question = makeQuestion(rnd, state.rootPc, intervals, shift);
    setState((s) => ({
      ...s,
      quiz: { ...s.quiz, question, marks: {} },
    }));
  };

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

  return {
    state,
    update,
    session,
    loadId,
    named,
    setupName,
    setSetupName,
    setupId,
    setSetupId,
    playbackVoicing,
    setPlaybackVoicing,
    saveSetup,
    loadSetup,
    removeSetup,
    resetSession,
    onSessionChange,
    handleNumStrings,
    handlePreset,
    handleStringEdit,
    togglePicked,
    answerQuiz,
    handleFamily,
    handleShowChord,
    handleToggleCompare,
    handleCompareFamily,
    handleComparePreset,
    handleShape,
    nextQuiz,
  };
}
