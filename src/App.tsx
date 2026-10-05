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
  numStrings: 6 | 7 | 8;
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
    labelMode: 'concert',
    displayMode: 'note',
    ghostScale: true,
    compareEnabled: false,
    compareRootPc: 10,
    compareFamilyKey: 'major',
    compareModeKey: 'Aeolian', // parallel natural minor by default
    sharedOnly: false,
  };
}

export default function App() {
  const [state, setState] = useState<AppState>(createInitialState);
  const update = (patch: Partial<AppState>) => setState((s) => ({ ...s, ...patch }));

  const handleNumStrings = (n: 6 | 7 | 8) => {
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
      numStrings: preset.strings as 6 | 7 | 8,
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
          ? getDiatonicTriad(s.rootPc, m.intervals, s.triadDegree).rootPc
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
        const t = getDiatonicTriad(s.rootPc, m.intervals, s.triadDegree);
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

  const triad: Triad = useMemo(
    () => getDiatonicTriad(state.rootPc, intervals, state.triadDegree),
    [state.rootPc, intervals, state.triadDegree],
  );

  const grid = useMemo(
    () => buildGrid(state.tuning, state.fretCount),
    [state.tuning, state.fretCount],
  );

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

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fretboard Visualizer</h1>
        <p className="subtitle">
          6-string bass &amp; 7/8-string guitar &middot; scales, modes &amp; diatonic triads
        </p>
      </header>

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
        compareEnabled={state.compareEnabled}
        comparePcSet={comparePcSet}
        compareRootPc={state.compareRootPc}
        sharedOnly={state.sharedOnly}
      />

      <Legend
        viewMode={state.viewMode}
        triad={triad}
        rootName={noteName(mod(state.rootPc + shift, 12))}
        modeName={mode.name}
        familyName={family.name}
        chordRootName={noteName(mod(triad.rootPc + shift, 12))}
        chordQualityName={qualityName(triad.quality)}
        compareEnabled={state.compareEnabled}
        compareRootName={noteName(mod(state.compareRootPc + shift, 12))}
        compareModeName={compareMode.name}
        sharedCount={sharedCount}
      />
    </div>
  );
}
