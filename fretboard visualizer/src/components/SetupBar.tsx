import type { NamedSetup } from '../state/setups';

interface Props {
  setupName: string;
  setupId: string;
  named: NamedSetup[];
  onSetupName: (name: string) => void;
  onSetupId: (id: string) => void;
  onSave: () => void;
  onLoad: () => void;
  onRemove: () => void;
  onReset: () => void;
}

export function SetupBar({
  setupName,
  setupId,
  named,
  onSetupName,
  onSetupId,
  onSave,
  onLoad,
  onRemove,
  onReset,
}: Props) {
  return (
    <div className="setup-bar">
      <span className="group-label">Setups</span>
      <input
        className="setup-name"
        type="text"
        placeholder="Name this setup"
        maxLength={40}
        value={setupName}
        onChange={(e) => onSetupName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave();
        }}
      />
      <button type="button" className="btn-mini" onClick={onSave} disabled={!setupName.trim()}>
        Save
      </button>
      <select value={setupId} onChange={(e) => onSetupId(e.target.value)} aria-label="Saved setups">
        <option value="">{named.length ? 'Saved setups' : 'No saved setups'}</option>
        {named.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn-mini" onClick={onLoad} disabled={!setupId}>
        Load
      </button>
      <button type="button" className="btn-mini" onClick={onRemove} disabled={!setupId}>
        Delete
      </button>
      <button type="button" className="btn-mini" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}
