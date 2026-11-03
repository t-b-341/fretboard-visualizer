import { useEffect, useId, useState } from 'react';
import type { AppStateV2 } from '../../state/v2/types';
import { listNamed, loadNamed, removeNamed, saveNamed } from '../../state/v2/storage';
import type { NamedSetupMeta } from '../../state/v2/storage';
import { writeUrl } from '../../state/v2/url';

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

function copyText(text: string) {
  const write = navigator.clipboard?.writeText;
  if (write) {
    void write.call(navigator.clipboard, text).catch(() => writeTextFallback(text));
    return;
  }
  writeTextFallback(text);
}

function shareHref(state: AppStateV2): string {
  const url = new URL(window.location.href);
  url.search = writeUrl(state);
  return url.toString();
}

export function SetupsMenu({
  state,
  onLoad,
  onReset,
}: {
  state: AppStateV2;
  onLoad: (state: AppStateV2) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [named, setNamed] = useState<NamedSetupMeta[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (open) setNamed(listNamed());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!document.getElementById(menuId)?.parentElement?.contains(target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, menuId]);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setNamed(saveNamed(trimmed, state));
  };

  const copyLink = () => {
    const href = shareHref(state);
    const next = new URL(href);
    if (next.href !== window.location.href) window.history.replaceState(window.history.state, '', next.href);
    copyText(next.href);
  };

  return (
    <div className="setups">
      <button
        type="button"
        className="header-button"
        data-testid="setups-menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        Setups
      </button>
      {open && (
        <div className="setups-popover" id={menuId} role="dialog" aria-label="Setups">
          <div className="setups-save">
            <input
              type="text"
              placeholder="Name this setup"
              aria-label="Setup name"
              maxLength={40}
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') save();
              }}
            />
            <button type="button" onClick={save} disabled={!name.trim()}>
              Save
            </button>
          </div>
          <ul className="setups-list">
            {named.length === 0 && <li className="muted">No saved setups</li>}
            {named.map((item) => (
              <li key={item.id}>
                <span>{item.name || 'Untitled'}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = loadNamed(item.id);
                    if (next) onLoad(next);
                    setOpen(false);
                  }}
                >
                  Load
                </button>
                <button type="button" onClick={() => setNamed(removeNamed(item.id))}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <div className="setups-actions">
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              New
            </button>
            <button
              type="button"
              onClick={() => {
                onReset();
                setOpen(false);
              }}
            >
              Reset
            </button>
            <button type="button" onClick={copyLink}>
              Copy link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
