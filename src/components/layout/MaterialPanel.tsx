import type { Chord } from '../../music/chords';
import type { NeckShape } from '../../music/shapes';
import type { VoicingShape } from '../../music/voicingSet';
import type { SuggestStyle } from '../../state/v2/suggest';
import type { AppStateV2, MaterialType, NameStyle, KeySelection, ScalePositions, Step } from '../../state/v2/types';
import { AddChord } from './AddChord';
import { ComparePanel } from './ComparePanel';
import { KeyPanel } from './KeyPanel';
import { ScalePositions as ScalePositionSection } from './ScalePositions';
import { SuggestPanel } from './SuggestPanel';
import { VoicingPanel } from './VoicingPanel';

const NOTES: Record<MaterialType, string> = {
  scale: 'One scale, on the staff, the neck, and the keyboard.',
  chord: 'One chord, on every view at once.',
  progression: 'A sequence of chords, stepped through one at a time.',
};

const TYPES: readonly { id: MaterialType; label: string }[] = [
  { id: 'scale', label: 'Scale' },
  { id: 'chord', label: 'Chord' },
  { id: 'progression', label: 'Progression' },
];

export function MaterialPanel({
  type,
  onType,
  selection,
  names,
  steps,
  heldMidis,
  onKey,
  onAddChord,
  onSuggest,
  voicingShape,
  stringSet,
  smooth,
  stringCount,
  chord,
  voicingCount,
  voicingIndex,
  fellBack,
  onVoicingShape,
  onStringSet,
  onSmooth,
  onVoicingIndex,
  compare,
  intervals,
  shift,
  onCompare,
  positions,
  positionIndex,
  fretRange,
  perString,
  npsShapes,
  cagedShapes,
  onPositions,
  onPositionIndex,
  onFretRange,
}: {
  type: MaterialType;
  onType: (type: MaterialType) => void;
  selection: KeySelection;
  names: NameStyle;
  steps: Step[];
  heldMidis: ReadonlySet<number>;
  onKey: (key: KeySelection) => void;
  onAddChord: (chord: Chord, bassPc?: number) => void;
  onSuggest: (style: SuggestStyle, borrowed: boolean) => void;
  voicingShape: VoicingShape;
  stringSet: number;
  smooth: boolean;
  stringCount: number;
  chord: Chord | null;
  voicingCount: number;
  voicingIndex: number;
  fellBack: boolean;
  onVoicingShape: (shape: VoicingShape) => void;
  onStringSet: (stringSet: number) => void;
  onSmooth: (smooth: boolean) => void;
  onVoicingIndex: (index: number) => void;
  compare: AppStateV2['material']['compare'];
  intervals: number[];
  shift: number;
  onCompare: (compare: Partial<AppStateV2['material']['compare']>) => void;
  positions: ScalePositions;
  positionIndex: number;
  fretRange: AppStateV2['material']['scale']['fretRange'];
  perString: number;
  npsShapes: NeckShape[];
  cagedShapes: NeckShape[];
  onPositions: (positions: ScalePositions) => void;
  onPositionIndex: (index: number) => void;
  onFretRange: (range: AppStateV2['material']['scale']['fretRange']) => void;
}) {
  return (
    <aside className="material-panel" data-testid="material-panel">
      <section data-testid="material-type">
        <h2>Material type</h2>
        <div className="segmented" role="radiogroup" aria-label="Material type" aria-describedby="material-type-note">
          {TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={type === item.id}
              className={type === item.id ? 'active' : undefined}
              onClick={() => onType(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p id="material-type-note" className="material-note">
          {NOTES[type]}
        </p>
      </section>

      <KeyPanel selection={selection} names={names} steps={steps} heldMidis={heldMidis} onKey={onKey} />

      <AddChord selection={selection} onAdd={onAddChord} />
      <SuggestPanel onSuggest={onSuggest} />

      <VoicingPanel
        shape={voicingShape}
        stringSet={stringSet}
        smooth={smooth}
        stringCount={stringCount}
        chord={chord}
        count={voicingCount}
        index={voicingIndex}
        fellBack={fellBack}
        onShape={onVoicingShape}
        onStringSet={onStringSet}
        onSmooth={onSmooth}
        onIndex={onVoicingIndex}
      />

      <ComparePanel compare={compare} intervals={intervals} rootPc={selection.rootPc} shift={shift} onCompare={onCompare} />

      {type === 'scale' && (
        <ScalePositionSection
          positions={positions}
          positionIndex={positionIndex}
          fretRange={fretRange}
          perString={perString}
          npsShapes={npsShapes}
          cagedShapes={cagedShapes}
          onPositions={onPositions}
          onPositionIndex={onPositionIndex}
          onFretRange={onFretRange}
        />
      )}
    </aside>
  );
}
