import type { NeckShape } from '../../music/shapes';
import type { ScalePositions as ScalePositionMode } from '../../state/v2/types';
import { FRET_COUNT } from '../../state/v2/defaults';

export function ScalePositions({
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
  positions: ScalePositionMode;
  positionIndex: number;
  fretRange: { enabled: boolean; min: number; max: number };
  perString: number;
  npsShapes: NeckShape[];
  cagedShapes: NeckShape[];
  onPositions: (positions: ScalePositionMode) => void;
  onPositionIndex: (index: number) => void;
  onFretRange: (range: { enabled: boolean; min: number; max: number }) => void;
}) {
  const shapes = positions === 'nps' ? npsShapes : positions === 'caged' ? cagedShapes : [];
  const index = shapes.length === 0 ? 0 : Math.min(positionIndex, shapes.length - 1);

  return (
    <section data-testid="scale-positions">
      <h2>Positions</h2>
      <div className="segmented" role="group" aria-label="Position box">
        <button type="button" className={positions === 'all' ? 'active' : ''} onClick={() => onPositions('all')}>
          All
        </button>
        <button type="button" className={positions === 'nps' ? 'active' : ''} onClick={() => onPositions('nps')}>
          {perString} per string
        </button>
        <button type="button" className={positions === 'caged' ? 'active' : ''} onClick={() => onPositions('caged')}>
          CAGED
        </button>
      </div>
      {positions !== 'all' && (
        <div className="field">
          <label htmlFor="scale-position-list">{positions === 'caged' ? 'Shape' : 'Box'}</label>
          <select
            id="scale-position-list"
            aria-label={positions === 'caged' ? 'CAGED position' : 'Position'}
            value={shapes.length ? index : ''}
            onChange={(event) => onPositionIndex(Number(event.target.value))}
          >
            {shapes.length === 0 && <option value="">No box in this tuning</option>}
            {shapes.map((shape, shapeIndex) => (
              <option key={shape.id} value={shapeIndex}>
                {shape.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <label className="check-line">
        <input
          type="checkbox"
          checked={fretRange.enabled}
          onChange={(event) => onFretRange({ ...fretRange, enabled: event.target.checked })}
        />
        Fret range
      </label>
      <div className="row">
        <div className="field">
          <label htmlFor="fret-range-from">From</label>
          <input
            id="fret-range-from"
            type="number"
            min={0}
            max={fretRange.max}
            value={fretRange.min}
            aria-label="Fret range from"
            onChange={(event) => {
              const min = Math.max(0, Math.min(fretRange.max, Math.round(Number(event.target.value)) || 0));
              onFretRange({ ...fretRange, min });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="fret-range-to">To</label>
          <input
            id="fret-range-to"
            type="number"
            min={fretRange.min}
            max={FRET_COUNT}
            value={fretRange.max}
            aria-label="Fret range to"
            onChange={(event) => {
              const raw = Math.round(Number(event.target.value));
              const max = Math.max(fretRange.min, Math.min(FRET_COUNT, Number.isFinite(raw) ? raw : fretRange.max));
              onFretRange({ ...fretRange, max });
            }}
          />
        </div>
      </div>
    </section>
  );
}
