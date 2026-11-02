import type { AppState } from '../state/appState';
import type { FamilyDef, FamilyKey, ModeDef } from '../music/scales';
import { SCALE_FAMILIES, parentScale } from '../music/scales';
import { getAllDiatonicTriads, qualitySuffix } from '../music/chords';
import { TUNING_PRESETS } from '../music/tunings';
import { CONTROLLER_BASE_OCTAVES, clampControllerShift, controllerWindow, shiftLimits } from '../music/keys';
import type { ControllerBaseOctave } from '../music/keys';
import { mod, noteName, pitchName } from '../music/notes';
import type { NeckShape, ShapeMode } from '../music/shapes';
import { notesPerString } from '../music/shapes';
import { voicingStringSets } from '../music/voicings';

function copyPageLink() {
  const href = window.location.href;
  const write = navigator.clipboard?.writeText;
  if (write) {
    void write.call(navigator.clipboard, href).catch(() => writeTextFallback(href));
    return;
  }
  writeTextFallback(href);
}

function writeTextFallback(text: string) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand('copy');
  } catch {
    // Clipboard is unavailable; the address bar still holds the link.
  } finally {
    area.remove();
  }
}

interface Props {
  state: AppState;
  family: FamilyDef;
  mode: ModeDef;
  compareFamily: FamilyDef;
  compareMode: ModeDef;
  shift: number;
  onUpdate: (patch: Partial<AppState>) => void;
  onNumStrings: (n: 6 | 7 | 8) => void;
  onPreset: (id: string) => void;
  onStringEdit: (stringIndex: number, pc: number) => void;
  onFamily: (familyKey: FamilyKey) => void;
  onToggleCompare: (enabled: boolean) => void;
  onCompareFamily: (familyKey: FamilyKey) => void;
  onComparePreset: (kind: 'parallel' | 'relative') => void;
  npsShapes: NeckShape[];
  cagedShapes: NeckShape[];
  /** How many tones the current voicing can use (3 for a triad, 4 when a 7th is available). */
  voicingToneCount: number;
  onShape: (mode: ShapeMode, index: number) => void;
  /** Generated grips for the chord on screen. Used by the one-voicing stepper. */
  voicingCount: number;
  voicingIndex: number;
  onPlayVoicing: () => void;
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
    npsShapes,
    cagedShapes,
    voicingToneCount,
    onShape,
    voicingCount,
    voicingIndex,
    onPlayVoicing,
  } = props;

  const controllerRange = controllerWindow(state.controllerBaseOctave, state.controllerOctaveShift);
  const controllerLimits = shiftLimits(state.controllerBaseOctave);
  const controllerSpan = `${pitchName(controllerRange.lowest)}–${pitchName(controllerRange.lowest + controllerRange.keyCount - 1)}`;
  const shiftLabel =
    state.controllerOctaveShift > 0 ? `+${state.controllerOctaveShift}` : String(state.controllerOctaveShift);

  // Note options in the current displayed label space. `value` is the concert
  // pitch class, `label` is the displayed name (shifted in Standard mode).
  const noteOptions = Array.from({ length: 12 }, (_, d) => ({
    concertPc: mod(d - shift, 12),
    label: noteName(d),
  }));

  const diatonic = parentScale(mode.intervals);
  const parentName = diatonic.name;
  const triads = getAllDiatonicTriads(state.rootPc, diatonic.intervals);

  // Tonality of the thing the overlay presets anchor to: the selected chord in
  // Triad view, otherwise the primary scale. Drives the parallel/relative labels.
  const anchorIsMajor =
    state.viewMode === 'triad'
      ? ['maj', 'aug'].includes(triads[state.triadDegree]?.quality ?? 'maj')
      : mode.intervals[2] === 4;
  const parallelLabel = anchorIsMajor ? 'Parallel minor' : 'Parallel major';
  const relativeLabel = anchorIsMajor ? 'Relative minor' : 'Relative major';

  const perString = notesPerString(mode.intervals.length);
  const shapes = state.shapeMode === 'nps' ? npsShapes : state.shapeMode === 'caged' ? cagedShapes : [];
  const shapeIndex = shapes.length === 0 ? 0 : Math.min(state.shapeIndex, shapes.length - 1);
  const voicingWidth = state.voicingStyle === 'drop2' ? 4 : state.voicingWidth;
  const stringSets = voicingStringSets(state.numStrings, voicingWidth);
  const inversionCount = Math.min(4, Math.max(1, voicingToneCount));
  const showVoicing = state.viewMode === 'triad' || state.viewMode === 'chord';

  const setHidden = (hidden: number[]) => {
    const unique = [...new Set(hidden.filter((i) => i >= 0 && i < state.numStrings))];
    if (unique.length >= state.numStrings) return;
    onUpdate({ hiddenStrings: unique });
  };

  return (
    <div className="controls">
      {/* Instrument */}
      <div className="control-group">
        <span className="group-label">Instrument</span>
        <div className="segmented" role="group" aria-label="Number of strings">
          {[6, 7, 8].map((n) => (
            <button
              key={n}
              className={state.numStrings === n ? 'active' : ''}
              onClick={() => onNumStrings(n as 6 | 7 | 8)}
            >
              {n === 6 ? '6-string bass' : `${n}-string`}
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
              const min = Math.max(0, Math.min(state.positionWindow.min, v));
              const max = Math.max(min, Math.min(state.positionWindow.max, v));
              onUpdate({
                fretCount: v,
                fretTo: Math.min(state.fretTo, v),
                fretFrom: Math.min(state.fretFrom, v),
                positionWindow: { ...state.positionWindow, min, max },
              });
            }}
          />
        </div>
        <div className="segmented">
          <button type="button" onClick={copyPageLink}>
            Copy link
          </button>
        </div>
      </div>

      {/* Neck window, strings, and position boxes */}
      <div className="control-group">
        <span className="group-label">Neck</span>
        <div className="field">
          <label>Hand</label>
          <div className="segmented" role="group" aria-label="Fretboard handedness">
            <button
              className={state.leftHanded ? '' : 'active'}
              onClick={() => onUpdate({ leftHanded: false })}
            >
              Right
            </button>
            <button
              className={state.leftHanded ? 'active' : ''}
              onClick={() => onUpdate({ leftHanded: true })}
            >
              Left
            </button>
          </div>
        </div>
        <div className="row">
          <div className="field">
            <label>From fret</label>
            <input
              type="number"
              min={0}
              max={state.fretTo}
              value={state.fretFrom}
              onChange={(e) => {
                const v = Math.max(0, Math.min(state.fretTo, Number(e.target.value) || 0));
                onUpdate({ fretFrom: v });
              }}
            />
          </div>
          <div className="field">
            <label>To fret</label>
            <input
              type="number"
              min={state.fretFrom}
              max={state.fretCount}
              value={state.fretTo}
              onChange={(e) => {
                const v = Math.max(state.fretFrom, Math.min(state.fretCount, Number(e.target.value) || state.fretCount));
                onUpdate({ fretTo: v });
              }}
            />
          </div>
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={state.positionWindow.enabled}
            onChange={(e) =>
              onUpdate({ positionWindow: { ...state.positionWindow, enabled: e.target.checked } })
            }
          />
          Position window
        </label>
        <div className="row">
          <div className="field">
            <label>From</label>
            <input
              type="number"
              min={0}
              max={state.positionWindow.max}
              value={state.positionWindow.min}
              aria-label="Position window from"
              onChange={(e) => {
                const v = Math.max(
                  0,
                  Math.min(state.positionWindow.max, Math.round(Number(e.target.value)) || 0),
                );
                onUpdate({ positionWindow: { ...state.positionWindow, min: v } });
              }}
            />
          </div>
          <div className="field">
            <label>To</label>
            <input
              type="number"
              min={state.positionWindow.min}
              max={state.fretCount}
              value={state.positionWindow.max}
              aria-label="Position window to"
              onChange={(e) => {
                const raw = Math.round(Number(e.target.value));
                const v = Math.max(
                  state.positionWindow.min,
                  Math.min(state.fretCount, Number.isFinite(raw) ? raw : state.positionWindow.max),
                );
                onUpdate({ positionWindow: { ...state.positionWindow, max: v } });
              }}
            />
          </div>
        </div>
        <div className="field">
          <label>Strings shown</label>
          <div className="btn-row">
            <button type="button" className="btn-mini" onClick={() => setHidden([])}>
              All
            </button>
            <button
              type="button"
              className="btn-mini"
              onClick={() => setHidden(state.tuning.map((_, i) => i).filter((i) => i >= 4))}
            >
              Low 4
            </button>
            <button
              type="button"
              className="btn-mini"
              onClick={() =>
                setHidden(state.tuning.map((_, i) => i).filter((i) => i < state.numStrings - 4))
              }
            >
              High 4
            </button>
          </div>
          <div className="str-toggles">
            {state.tuning.map((str, i) => {
              const on = !state.hiddenStrings.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  className={on ? 'on' : ''}
                  title={noteName(mod(str.pc + shift, 12))}
                  onClick={() => {
                    if (on) setHidden([...state.hiddenStrings, i]);
                    else setHidden(state.hiddenStrings.filter((n) => n !== i));
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label>Position</label>
          <div className="segmented" role="group" aria-label="Position box">
            <button
              className={state.shapeMode === 'all' ? 'active' : ''}
              onClick={() => onShape('all', 0)}
            >
              All
            </button>
            <button
              className={state.shapeMode === 'nps' ? 'active' : ''}
              onClick={() => onShape('nps', shapeIndex)}
            >
              {perString}/string
            </button>
            <button
              className={state.shapeMode === 'caged' ? 'active' : ''}
              onClick={() => onShape('caged', shapeIndex)}
            >
              CAGED
            </button>
          </div>
        </div>
        {state.shapeMode !== 'all' && (
          <div className="field">
            <label>{state.shapeMode === 'caged' ? 'Shape' : 'Box'}</label>
            <select
              value={shapes.length ? shapeIndex : ''}
              onChange={(e) => onShape(state.shapeMode, Number(e.target.value))}
            >
              {shapes.length === 0 && <option value="">No box in this tuning</option>}
              {shapes.map((shape, i) => (
                <option key={shape.id} value={i}>
                  {shape.name}
                </option>
              ))}
            </select>
          </div>
        )}
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
          <label>Show on</label>
          <div className="segmented" role="group" aria-label="Instrument view">
            {(['fretboard', 'keyboard', 'both'] as const).map((v) => (
              <button
                key={v}
                className={state.instrumentView === v ? 'active' : ''}
                onClick={() => onUpdate({ instrumentView: v })}
              >
                {v === 'fretboard' ? 'Fretboard' : v === 'keyboard' ? 'Keyboard' : 'Both'}
              </button>
            ))}
          </div>
        </div>
        {state.instrumentView !== 'fretboard' && (
          <div className="field">
            <label>Keyboard</label>
            <div className="segmented" role="group" aria-label="Keyboard span">
              {(
                [
                  [1, '1 oct'],
                  [2, '2 oct'],
                  [3, '37 keys'],
                ] as const
              ).map(([n, label]) => (
                <button
                  key={n}
                  className={state.keyboardOctaves === n ? 'active' : ''}
                  title={n === 3 ? 'MPK Mini Plus keybed, C to C. Center octave is C3–C6.' : undefined}
                  onClick={() => onUpdate({ keyboardOctaves: n, keyboardSpanChosen: true })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {state.instrumentView !== 'fretboard' && state.keyboardOctaves === 3 && (
          <>
            <div className="field">
              <label
                title="Lowest key when both MPK Mini Plus octave buttons are pressed (center). Same numbering as the sound octave: 4 is middle C."
              >
                Start key
              </label>
              <select
                value={state.controllerBaseOctave}
                title="Lowest key when both MPK Mini Plus octave buttons are pressed (center). Same numbering as the sound octave: 4 is middle C."
                onChange={(e) => {
                  const controllerBaseOctave = Number(e.target.value) as ControllerBaseOctave;
                  onUpdate({
                    controllerBaseOctave,
                    controllerOctaveShift: clampControllerShift(
                      controllerBaseOctave,
                      state.controllerOctaveShift,
                    ),
                  });
                }}
              >
                {CONTROLLER_BASE_OCTAVES.map((octave) => (
                  <option key={octave} value={octave}>
                    C{octave}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label title="Matches the octave buttons on the controller">Octave</label>
              <div className="segmented" role="group" aria-label="Controller octave">
                <button
                  aria-label="Octave down"
                  disabled={state.controllerOctaveShift <= controllerLimits.min}
                  onClick={() => onUpdate({ controllerOctaveShift: state.controllerOctaveShift - 1 })}
                >
                  −
                </button>
                <span className="segment-value">{shiftLabel}</span>
                <button
                  aria-label="Octave up"
                  disabled={state.controllerOctaveShift >= controllerLimits.max}
                  onClick={() => onUpdate({ controllerOctaveShift: state.controllerOctaveShift + 1 })}
                >
                  +
                </button>
              </div>
              <span className="muted keyboard-range-note">{controllerSpan}</span>
            </div>
          </>
        )}
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
            <button
              className={state.viewMode === 'chord' ? 'active' : ''}
              onClick={() => onUpdate({ viewMode: 'chord' })}
            >
              Chords
            </button>
            <button
              className={state.viewMode === 'identify' ? 'active' : ''}
              onClick={() => onUpdate({ viewMode: 'identify' })}
            >
              Identify
            </button>
            <button
              className={state.viewMode === 'quiz' ? 'active' : ''}
              onClick={() => onUpdate({ viewMode: 'quiz' })}
            >
              Quiz
            </button>
          </div>
        </div>
        {state.viewMode === 'chord' && (
          <div className="field">
            <label>On the neck</label>
            <div className="segmented" role="group" aria-label="Chord display">
              <button
                className={state.chordDisplay === 'all' ? 'active' : ''}
                onClick={() => onUpdate({ chordDisplay: 'all' })}
              >
                All tones
              </button>
              <button
                className={state.chordDisplay === 'voicing' ? 'active' : ''}
                onClick={() => onUpdate({ chordDisplay: 'voicing' })}
              >
                One voicing
              </button>
            </div>
            {state.chordDisplay === 'voicing' && (
              <div className="voicing-picker">
                {voicingCount === 0 ? (
                  <span className="muted">No playable voicing</span>
                ) : (
                  <div className="segmented" role="group" aria-label="Which voicing">
                    <button
                      disabled={voicingIndex <= 0}
                      onClick={() => onUpdate({ voicingIndex: voicingIndex - 1 })}
                    >
                      Prev
                    </button>
                    <span className="segment-value">
                      {voicingIndex + 1} of {voicingCount}
                    </span>
                    <button
                      disabled={voicingIndex >= voicingCount - 1}
                      onClick={() => onUpdate({ voicingIndex: voicingIndex + 1 })}
                    >
                      Next
                    </button>
                  </div>
                )}
                <button className="btn-mini" disabled={voicingCount === 0} onClick={onPlayVoicing}>
                  Play voicing
                </button>
              </div>
            )}
          </div>
        )}
        {state.viewMode === 'triad' && (
          <>
            <div className="field">
              <label>Diatonic triad{parentName ? ` · ${parentName}` : ''}</label>
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
        <div className="field">
          <label>Color</label>
          <div className="segmented" role="group" aria-label="Note color">
            <button
              className={state.colorMode === 'role' ? 'active' : ''}
              onClick={() => onUpdate({ colorMode: 'role' })}
            >
              Role
            </button>
            <button
              className={state.colorMode === 'degree' ? 'active' : ''}
              onClick={() => onUpdate({ colorMode: 'degree' })}
            >
              Degree
            </button>
          </div>
        </div>
      </div>

      {showVoicing && (
        <div className="control-group">
          <span className="group-label">Voicing</span>
          <div className="field">
            <label>Grip</label>
            <div className="segmented" role="group" aria-label="Voicing">
              {(['all', 'close', 'drop2'] as const).map((style) => (
                <button
                  key={style}
                  className={state.voicingStyle === style ? 'active' : ''}
                  disabled={style === 'drop2' && voicingToneCount < 4}
                  onClick={() => {
                    const width = style === 'drop2' ? 4 : state.voicingWidth;
                    const start = Math.max(0, Math.min(state.voicingSetStart, state.numStrings - width));
                    onUpdate({ voicingStyle: style, voicingWidth: width as 3 | 4, voicingSetStart: start });
                  }}
                >
                  {style === 'all' ? 'All tones' : style === 'close' ? 'Close' : 'Drop-2'}
                </button>
              ))}
            </div>
          </div>
          {state.voicingStyle !== 'all' && (
            <>
              <div className="field">
                <label>Inversion</label>
                <select
                  value={Math.min(state.voicingInversion, inversionCount - 1)}
                  onChange={(e) => onUpdate({ voicingInversion: Number(e.target.value) })}
                >
                  {['Root position', '1st inversion', '2nd inversion', '3rd inversion']
                    .slice(0, inversionCount)
                    .map((label, i) => (
                      <option key={label} value={i}>
                        {label}
                      </option>
                    ))}
                </select>
              </div>
              {state.voicingStyle === 'close' && (
                <div className="field">
                  <label>Strings in the grip</label>
                  <div className="segmented" role="group" aria-label="Voicing width">
                    {[3, 4].map((w) => (
                      <button
                        key={w}
                        className={voicingWidth === w ? 'active' : ''}
                        disabled={w === 4 && voicingToneCount < 4}
                        onClick={() => {
                          const start = Math.max(0, Math.min(state.voicingSetStart, state.numStrings - w));
                          onUpdate({ voicingWidth: w as 3 | 4, voicingSetStart: start });
                        }}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="field">
                <label>String set</label>
                <select
                  value={Math.min(state.voicingSetStart, Math.max(0, stringSets.length - 1))}
                  onChange={(e) => onUpdate({ voicingSetStart: Number(e.target.value) })}
                >
                  {stringSets.map((set) => (
                    <option key={set.start} value={set.start}>
                      {set.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
