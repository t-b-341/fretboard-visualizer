import type { LabelStyle, NameStyle } from '../../state/v2/types';

export function ViewBar({
  staff,
  neck,
  keyboard,
  labels,
  names,
  showKey,
  voiceMotion,
  onStaff,
  onNeck,
  onKeyboard,
  onLabels,
  onNames,
  onShowKey,
  onVoiceMotion,
  referenceOn,
  referenceName,
  onToggleReference,
  onClearReference,
}: {
  staff: boolean;
  neck: boolean;
  keyboard: boolean;
  labels: LabelStyle;
  names: NameStyle;
  showKey: boolean;
  voiceMotion: boolean;
  onStaff: (on: boolean) => void;
  onNeck: (on: boolean) => void;
  onKeyboard: (on: boolean) => void;
  onLabels: (labels: LabelStyle) => void;
  onNames: (names: NameStyle) => void;
  onShowKey: (on: boolean) => void;
  onVoiceMotion: (on: boolean) => void;
  referenceOn: boolean;
  referenceName: string | null;
  onToggleReference: (on: boolean) => void;
  onClearReference: () => void;
}) {
  return (
    <div className="view-bar" data-testid="view-bar">
      <div className="view-toggles" role="group" aria-label="Views">
        <label>
          <input type="checkbox" checked={staff} onChange={(event) => onStaff(event.target.checked)} />
          Staff
        </label>
        <label>
          <input type="checkbox" checked={neck} onChange={(event) => onNeck(event.target.checked)} />
          Neck
        </label>
        <label>
          <input type="checkbox" checked={keyboard} onChange={(event) => onKeyboard(event.target.checked)} />
          Keyboard
        </label>
      </div>
      <div className="segmented" role="radiogroup" aria-label="Labels">
        <Choice current={labels} value="notes" label="Notes" onPick={onLabels} />
        <Choice current={labels} value="degrees" label="Degrees" onPick={onLabels} />
      </div>
      <div className="segmented" role="radiogroup" aria-label="Names">
        <Choice current={names} value="concert" label="Concert" onPick={onNames} />
        <Choice current={names} value="standard" label="Standard" onPick={onNames} />
      </div>
      <button
        type="button"
        className={referenceOn ? 'intervals-toggle active' : 'intervals-toggle'}
        aria-pressed={referenceOn}
        onClick={() => onToggleReference(!referenceOn)}
      >
        Intervals from…
      </button>
      {referenceName && (
        <span className="reference-chip">
          Intervals from {referenceName}
          <button type="button" className="reference-chip-x" aria-label="Clear reference" onClick={onClearReference}>
            ×
          </button>
        </span>
      )}
      <label>
        <input type="checkbox" checked={showKey} onChange={(event) => onShowKey(event.target.checked)} />
        Show key
      </label>
      <label>
        <input type="checkbox" checked={voiceMotion} onChange={(event) => onVoiceMotion(event.target.checked)} />
        Voice motion
      </label>
    </div>
  );
}

function Choice<T extends string>({
  current,
  value,
  label,
  onPick,
}: {
  current: T;
  value: T;
  label: string;
  onPick: (value: T) => void;
}) {
  const on = current === value;
  return (
    <button type="button" role="radio" aria-checked={on} className={on ? 'active' : undefined} onClick={() => onPick(value)}>
      {label}
    </button>
  );
}
