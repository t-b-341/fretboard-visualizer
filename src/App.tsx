import { useMemo, useState } from 'react';
import './App.css';
import { Controls } from './components/Controls';
import { Fretboard } from './components/Fretboard';
import { Legend } from './components/Legend';
import { getFamily, getScaleNotes } from './music/scales';
import type { FamilyKey } from './music/scales';
import { getDiatonicTriad, qualityName } from './music/chords';
import type { Triad } from './music/chords';
import { defaultPresetForStrings, getPreset } from './music/tunings';
import type { GuitarString } from './music/tunings';
import { buildGrid } from './music/fretboard';
import { labelShift, mod, noteName } from './music/notes';

export type ViewMode = 'scale' | 'triad';
export type LabelMode = 'concert' | 'standard';
export type DisplayMode = 'note' | 'degree';

export interface AppState {
  numStrings: 7 | 8;
  tuningId: string;
  tuning: GuitarString[];
  fretCount: number;
  rootPc: number;
  familyKey: FamilyKey;
  modeKey: string;
  viewMode: ViewMode;
  triadDegree: number;
  labelMode: LabelMode;
  displayMode: DisplayMode;
  ghostScale: boolean;
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
    labelMode: 'concert',
    displayMode: 'note',
    ghostScale: true,
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  const handleNumStrings = (n: 7 | 8) => {
    const preset = defaultPresetForStrings(n);
    setState((s) => ({
      ...s,
      numStrings: n,
      tuningId: preset.id,
      tuning: preset.notes.map((x) => ({ ...x })),
    }));
  };

  const handlePreset = (id: string) => {
    const preset = getPreset(id);
    if (!preset) return;
    setState((s) => ({
      ...s,
      tuningId: preset.id,
      numStrings: preset.strings as 7 | 8,
      tuning: preset.notes.map((x) => ({ ...x })),
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

  const triad: Triad = useMemo(
    () => getDiatonicTriad(state.rootPc, intervals, state.triadDegree),
    [state.rootPc, intervals, state.triadDegree],
  );

  const grid = useMemo(
    () => buildGrid(state.tuning, state.fretCount),
    [state.tuning, state.fretCount],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fretboard Visualizer</h1>
        <p className="subtitle">7 &amp; 8 string &middot; scales, modes &amp; diatonic triads</p>
      </header>

      <Controls
        state={state}
        family={family}
        mode={mode}
        shift={shift}
        onUpdate={update}
        onNumStrings={handleNumStrings}
        onPreset={handlePreset}
        onStringEdit={handleStringEdit}
        onFamily={handleFamily}
      />

      <Fretboard
        grid={grid}
        tuning={state.tuning}
        fretCount={state.fretCount}
        rootPc={state.rootPc}
        intervals={intervals}
        pcToIndex={pcToIndex}
        viewMode={state.viewMode}
        triad={triad}
        displayMode={state.displayMode}
        shift={shift}
        ghostScale={state.ghostScale}
      />

      <Legend
        viewMode={state.viewMode}
        triad={triad}
        rootName={noteName(mod(state.rootPc + shift, 12))}
        modeName={mode.name}
        familyName={family.name}
        chordRootName={noteName(mod(triad.rootPc + shift, 12))}
        chordQualityName={qualityName(triad.quality)}
      />
    </div>
  );
}
