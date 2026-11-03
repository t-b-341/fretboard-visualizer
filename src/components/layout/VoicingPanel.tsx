import type { Chord } from '../../music/chords';
import { voicingStringSets } from '../../music/voicings';
import { voicingPlacement, type VoicingShape } from '../../music/voicingSet';

const SHAPES: readonly { id: VoicingShape; label: string }[] = [
  { id: 'all', label: 'All tones' },
  { id: 'close', label: 'Close' },
  { id: 'drop2', label: 'Drop-2' },
];

export function VoicingPanel({
  shape,
  stringSet,
  smooth,
  stringCount,
  chord,
  count,
  index,
  fellBack,
  onShape,
  onStringSet,
  onSmooth,
  onIndex,
}: {
  shape: VoicingShape;
  stringSet: number;
  smooth: boolean;
  stringCount: number;
  chord: Chord | null;
  count: number;
  index: number;
  fellBack: boolean;
  onShape: (shape: VoicingShape) => void;
  onStringSet: (stringSet: number) => void;
  onSmooth: (smooth: boolean) => void;
  onIndex: (index: number) => void;
}) {
  const width = chord ? voicingPlacement(chord, shape).width : 4;
  const sets = voicingStringSets(stringCount, Math.max(1, Math.min(width, stringCount)));
  const selected = sets.length === 0 ? 0 : Math.max(0, Math.min(stringSet, sets.length - 1));
  const shown = count === 0 ? 0 : index + 1;

  return (
    <section className="voicing-panel" data-testid="voicing-panel">
      <h2>Voicing</h2>
      <div className="segmented" role="radiogroup" aria-label="Voicing">
        {SHAPES.map((item) => {
          const on = shape === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={on}
              className={on ? 'active' : undefined}
              onClick={() => onShape(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <label className="voicing-field" htmlFor="voicing-string-set">
        String set
      </label>
      <select
        id="voicing-string-set"
        aria-label="String set"
        value={selected}
        onChange={(event) => onStringSet(Number(event.target.value))}
      >
        {sets.map((set) => (
          <option key={set.start} value={set.start}>
            {set.label}
          </option>
        ))}
      </select>
      {count > 0 && (
      <div className="voicing-stepper" role="group" aria-label="Which voicing">
        <button
          type="button"
          aria-label="Previous voicing"
          disabled={count === 0 || index <= 0}
          onClick={() => onIndex(index - 1)}
        >
          ‹
        </button>
        <span className="voicing-count">
          voicing {shown} of {count}
        </span>
        <button
          type="button"
          aria-label="Next voicing"
          disabled={count === 0 || index >= count - 1}
          onClick={() => onIndex(index + 1)}
        >
          ›
        </button>
      </div>
      )}
      {fellBack && (
        <p className="voicing-note">Drop-2 needs four notes, so this chord uses a close voicing.</p>
      )}
      <label className="check-line">
        <input type="checkbox" checked={smooth} onChange={(event) => onSmooth(event.target.checked)} />
        Smooth voice leading (suggests voicings)
      </label>
    </section>
  );
}
