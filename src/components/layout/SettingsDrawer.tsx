import { useEffect, useLayoutEffect, useRef } from 'react';
import { formatMyDefault } from '../../state/v2/myDefault';
import type { MyDefault, StartIn } from '../../state/v2/types';

const SECTIONS = ['Instrument', 'Neck', 'Keyboard', 'Sound', 'MIDI', 'Voice leading (advanced)'] as const;

function MyDefaultBlock({ mine, onSetFromCurrent }: { mine: MyDefault | null; onSetFromCurrent: () => void }) {
  const saved = mine ? formatMyDefault(mine) : null;
  return (
    <div className="default-block">
      <p className="default-summary">{saved ? saved.summary : 'Not set yet.'}</p>
      {saved?.soundsAs && <p className="sounds-as">{saved.soundsAs}</p>}
      <button type="button" onClick={onSetFromCurrent}>
        Set from current
      </button>
    </div>
  );
}

export function SettingsDrawer({
  open,
  onClose,
  startIn,
  myDefault,
  onStartIn,
  onSetFromCurrent,
}: {
  open: boolean;
  onClose: () => void;
  startIn: StartIn;
  myDefault: MyDefault | null;
  onStartIn: (startIn: StartIn) => void;
  onSetFromCurrent: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="drawer-layer">
      <div className="drawer-backdrop" onClick={onClose} />
      <aside
        id="settings-drawer"
        className="settings-drawer"
        data-testid="settings-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <div className="drawer-title">
          <h2 id="settings-title">Settings</h2>
          <button ref={closeRef} type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <section>
          <h3>Start in</h3>
          <div className="start-options" role="radiogroup" aria-label="Start in">
            <label>
              <input
                type="radio"
                name="start-in"
                checked={startIn === 'last'}
                onChange={() => onStartIn('last')}
              />
              Last session
            </label>
            <label>
              <input
                type="radio"
                name="start-in"
                checked={startIn === 'default'}
                onChange={() => onStartIn('default')}
              />
              My default
            </label>
          </div>
          {startIn === 'default' && <MyDefaultBlock mine={myDefault} onSetFromCurrent={onSetFromCurrent} />}
        </section>
        {SECTIONS.map((name) => (
          <section key={name}>
            <h3>{name}</h3>
          </section>
        ))}
      </aside>
    </div>
  );
}
