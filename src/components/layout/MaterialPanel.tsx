import type { MaterialType, NameStyle, KeySelection, Step } from '../../state/v2/types';
import { KeyPanel } from './KeyPanel';

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
}: {
  type: MaterialType;
  onType: (type: MaterialType) => void;
  selection: KeySelection;
  names: NameStyle;
  steps: Step[];
  heldMidis: ReadonlySet<number>;
  onKey: (key: KeySelection) => void;
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

      <section data-testid="add-chord">
        <h2>Add chord</h2>
        <div data-testid="chord-palette" className="panel-slot" />
      </section>

      <section data-testid="suggest-panel">
        <h2>Suggest</h2>
      </section>

      <section data-testid="voicing-panel">
        <h2>Voicing</h2>
      </section>

      <details className="compare-panel" data-testid="compare-panel">
        <summary>
          <h2>Compare with another scale</h2>
        </summary>
      </details>

      {type === 'scale' && (
        <section data-testid="scale-positions">
          <h2>Positions</h2>
        </section>
      )}
    </aside>
  );
}
