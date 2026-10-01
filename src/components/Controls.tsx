import type { AppState } from '../App';
import type { FamilyDef, FamilyKey, ModeDef } from '../music/scales';
import { SCALE_FAMILIES } from '../music/scales';
import { getAllDiatonicTriads, qualitySuffix } from '../music/chords';
import { TUNING_PRESETS } from '../music/tunings';
import { mod, noteName } from '../music/notes';

interface Props {
  state: AppState;
  family: FamilyDef;
  mode: ModeDef;
  compareFamily: FamilyDef;
  compareMode: ModeDef;
  shift: number;
  onUpdate: (patch: Partial<AppState>) => void;
  onNumStrings: (n: 7 | 8) => void;
  onPreset: (id: string) => void;
  onStringEdit: (stringIndex: number, pc: number) => void;
  onFamily: (familyKey: FamilyKey) => void;
  onToggleCompare: (enabled: boolean) => void;
  onCompareFamily: (familyKey: FamilyKey) => void;
  onComparePreset: (kind: 'parallel' | 'relative') => void;
}

export function Controls(props: Props) {
  const {
    state,
    family,
    mode,
    compareFamily,
    compareMode,
    shift,
    onUpdate,
    onNumStrings,
    onPreset,
    onStringEdit,
    onFamily,
    onToggleCompare,
    onCompareFamily,
    onComparePreset,
  } = props;

  // Note options in the current displayed label space. `value` is the concert
  // pitch class, `label` is the displayed name (shifted in Standard mode).
  const noteOptions = Array.from({ length: 12 }, (_, d) => ({
    concertPc: mod(d - shift, 12),
    label: noteName(d),
  }));

  const triads = getAllDiatonicTriads(state.rootPc, mode.intervals);

  // Tonality of the thing the overlay presets anchor to: the selected chord in
  // Triad view, otherwise the primary scale. Drives the parallel/relative labels.
  const anchorIsMajor =
    state.viewMode === 'triad'
      ? ['maj', 'aug'].includes(triads[state.triadDegree]?.quality ?? 'maj')
      : mode.intervals[2] === 4;
  const parallelLabel = anchorIsMajor ? 'Parallel minor' : 'Parallel major';
  const relativeLabel = anchorIsMajor ? 'Relative minor' : 'Relative major';

  return (
    <div className="controls">
      {/* Instrument */}
      <div className="control-group">
        <span className="group-label">Instrument</span>
        <div className="segmented" role="group" aria-label="Number of strings">
          {[7, 8].map((n) => (
            <button
              key={n}
              className={state.numStrings === n ? 'active' : ''}
              onClick={() => onNumStrings(n as 7 | 8)}
            >
              {n}-string
            </button>
          ))}
        </div>
        <div className="field">
          <label>Tuning</label>
          <select value={state.tuningId} onChange={(e) => onPreset(e.target.value)}>
            {TUNING_PRESETS.filter((p) => p.strings === state.numStrings).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {state.tuningId === 'custom' && <option value="custom">Custom</option>}
          </select>
        </div>
        <div className="field">
          <label>Strings (low &rarr; high)</label>
          <div className="tuning-editor">
            {state.tuning.map((str, i) => (
              <div className="str" key={i}>
                <small>{i + 1}</small>
                <select value={str.pc} onChange={(e) => onStringEdit(i, Number(e.target.value))}>
                  {noteOptions.map((o) => (
                    <option key={o.concertPc} value={o.concertPc}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Frets</label>
          <input
            type="number"
            min={12}
            max={24}
            value={state.fretCount}
            onChange={(e) => {
              const v = Math.max(12, Math.min(24, Number(e.target.value) || 24));
              onUpdate({ fretCount: v });
            }}
          />
        </div>
      </div>

      {/* Key & scale */}
      <div className="control-group">
        <span className="group-label">Key &amp; Scale</span>
        <div className="field">
          <label>Root</label>
          <select
            value={state.rootPc}
            onChange={(e) => onUpdate({ rootPc: Number(e.target.value) })}
          >
            {noteOptions.map((o) => (
              <option key={o.concertPc} value={o.concertPc}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Scale family</label>
          <select value={family.key} onChange={(e) => onFamily(e.target.value as FamilyKey)}>
            {SCALE_FAMILIES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Mode</label>
          <select value={mode.key} onChange={(e) => onUpdate({ modeKey: e.target.value })}>
            {family.modes.map((m) => (
              <option key={m.key} value={m.key}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Compare / overlay */}
      <div className="control-group">
        <span className="group-label">Compare</span>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={state.compareEnabled}
            onChange={(e) => onToggleCompare(e.target.checked)}
          />
          {state.viewMode === 'triad' ? 'Overlay a scale on the chord' : 'Overlay a second scale'}
        </label>
        {state.compareEnabled && (
          <>
            <div className="field">
              <label>Quick set</label>
              <div className="btn-row">
                <button type="button" className="btn-mini" onClick={() => onComparePreset('parallel')}>
                  {parallelLabel}
                </button>
                <button type="button" className="btn-mini" onClick={() => onComparePreset('relative')}>
                  {relativeLabel}
                </button>
              </div>
            </div>
            <div className="field">
              <label>Overlay root</label>
              <select
                value={state.compareRootPc}
                onChange={(e) => onUpdate({ compareRootPc: Number(e.target.value) })}
              >
                {noteOptions.map((o) => (
                  <option key={o.concertPc} value={o.concertPc}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Overlay family</label>
              <select
                value={compareFamily.key}
                onChange={(e) => onCompareFamily(e.target.value as FamilyKey)}
              >
                {SCALE_FAMILIES.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Overlay mode</label>
              <select
                value={compareMode.key}
                onChange={(e) => onUpdate({ compareModeKey: e.target.value })}
              >
                {compareFamily.modes.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={state.sharedOnly}
                onChange={(e) => onUpdate({ sharedOnly: e.target.checked })}
              />
              {state.viewMode === 'triad' ? 'Chord tones in scale only' : 'Shared notes only'}
            </label>
          </>
        )}
      </div>

      {/* Display / chords */}
      <div className="control-group">
        <span className="group-label">Display</span>
        <div className="field">
          <label>View</label>
          <div className="segmented" role="group" aria-label="View mode">
            <button
              className={state.viewMode === 'scale' ? 'active' : ''}
              onClick={() => onUpdate({ viewMode: 'scale' })}
            >
              Full scale
            </button>
            <button
              className={state.viewMode === 'triad' ? 'active' : ''}
              onClick={() => onUpdate({ viewMode: 'triad' })}
            >
              Triad
            </button>
          </div>
        </div>
        {state.viewMode === 'triad' && (
          <>
            <div className="field">
              <label>Diatonic triad</label>
              <select
                value={state.triadDegree}
                onChange={(e) => onUpdate({ triadDegree: Number(e.target.value) })}
              >
                {triads.map((t) => (
                  <option key={t.degree} value={t.degree}>
                    {t.roman} &mdash; {noteName(mod(t.rootPc + shift, 12))}
                    {qualitySuffix(t.quality)}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={state.ghostScale}
                onChange={(e) => onUpdate({ ghostScale: e.target.checked })}
              />
              Ghost scale notes
            </label>
          </>
        )}
      </div>

      {/* Labels */}
      <div className="control-group">
        <span className="group-label">Labels</span>
        <div className="field">
          <label>Show</label>
          <div className="segmented" role="group" aria-label="Label content">
            <button
              className={state.displayMode === 'note' ? 'active' : ''}
              onClick={() => onUpdate({ displayMode: 'note' })}
            >
              Notes
            </button>
            <button
              className={state.displayMode === 'degree' ? 'active' : ''}
              onClick={() => onUpdate({ displayMode: 'degree' })}
            >
              Degrees
            </button>
          </div>
        </div>
        <div className="field">
          <label>Tuning reference</label>
          <div className="segmented" role="group" aria-label="Label pitch reference">
            <button
              className={state.labelMode === 'concert' ? 'active' : ''}
              onClick={() => onUpdate({ labelMode: 'concert' })}
            >
              Concert
            </button>
            <button
              className={state.labelMode === 'standard' ? 'active' : ''}
              onClick={() => onUpdate({ labelMode: 'standard' })}
            >
              Standard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
