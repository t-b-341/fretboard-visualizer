import { mod, noteName } from '../../music/notes';
import { SCALE_FAMILIES, getFamily } from '../../music/scales';
import type { FamilyKey } from '../../music/scales';
import type { AppStateV2 } from '../../state/v2/types';

function noteChoices(shift: number) {
  return Array.from({ length: 12 }, (_, displayed) => ({
    concertPc: mod(displayed - shift, 12),
    label: noteName(displayed),
  }));
}

export function ComparePanel({
  compare,
  intervals,
  rootPc,
  shift,
  onCompare,
}: {
  compare: AppStateV2['material']['compare'];
  /** Current scale intervals, so the quick set knows major from minor. */
  intervals: number[];
  rootPc: number;
  shift: number;
  onCompare: (compare: Partial<AppStateV2['material']['compare']>) => void;
}) {
  const notes = noteChoices(shift);
  const anchorIsMajor = intervals[2] === 4;
  const parallelLabel = anchorIsMajor ? 'Parallel minor' : 'Parallel major';
  const relativeLabel = anchorIsMajor ? 'Relative minor' : 'Relative major';
  const family = getFamily(compare.familyKey);
  const mode = family.modes.find((item) => item.key === compare.modeKey) ?? family.modes[0];

  const preset = (kind: 'parallel' | 'relative') => {
    const targetModeKey = anchorIsMajor ? 'Aeolian' : 'Ionian';
    const relShift = anchorIsMajor ? 9 : 3;
    const targetRoot = kind === 'parallel' ? rootPc : mod(rootPc + relShift, 12);
    onCompare({
      enabled: true,
      familyKey: 'major',
      modeKey: targetModeKey,
      rootPc: targetRoot,
    });
  };

  return (
    <details className="compare-panel" data-testid="compare-panel">
      <summary>
        <h2>Compare with another scale</h2>
      </summary>
      <label className="check-line">
        <input
          type="checkbox"
          checked={compare.enabled}
          onChange={(event) => onCompare({ enabled: event.target.checked })}
        />
        Overlay a second scale
      </label>
      {compare.enabled && (
        <>
          <div className="field">
            <span className="field-label">Quick set</span>
            <div className="btn-row">
              <button type="button" className="btn-mini" onClick={() => preset('parallel')}>
                {parallelLabel}
              </button>
              <button type="button" className="btn-mini" onClick={() => preset('relative')}>
                {relativeLabel}
              </button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="compare-root">Overlay root</label>
            <select
              id="compare-root"
              value={compare.rootPc}
              onChange={(event) => onCompare({ rootPc: Number(event.target.value) })}
            >
              {notes.map((option) => (
                <option key={option.concertPc} value={option.concertPc}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="compare-family">Overlay family</label>
            <select
              id="compare-family"
              value={family.key}
              onChange={(event) => onCompare({ familyKey: event.target.value as FamilyKey })}
            >
              {SCALE_FAMILIES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="compare-mode">Overlay mode</label>
            <select id="compare-mode" value={mode.key} onChange={(event) => onCompare({ modeKey: event.target.value })}>
              {family.modes.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={compare.sharedOnly}
              onChange={(event) => onCompare({ sharedOnly: event.target.checked })}
            />
            Shared notes only
          </label>
        </>
      )}
    </details>
  );
}
