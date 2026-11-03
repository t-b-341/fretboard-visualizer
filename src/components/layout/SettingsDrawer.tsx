import { useEffect, useLayoutEffect, useRef } from 'react';

const SECTIONS = ['Start in', 'Instrument', 'Neck', 'Keyboard', 'Sound', 'MIDI', 'Voice leading (advanced)'] as const;

export function SettingsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
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
        {SECTIONS.map((name) => (
          <section key={name}>
            <h3>{name}</h3>
          </section>
        ))}
      </aside>
    </div>
  );
}
