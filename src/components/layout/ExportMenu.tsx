import { useEffect, useId, useRef, useState } from 'react';

function downloadBlob(bytes: BlobPart | Uint8Array, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function ExportMenu({
  disabled,
  tabText,
  tabFileName,
  onMidi,
}: {
  disabled: boolean;
  tabText: string;
  tabFileName: string;
  onMidi: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
  }, [open]);

  useEffect(() => {
    setCopied(false);
    setFallback(false);
  }, [tabText]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (!fallback) return;
    areaRef.current?.focus();
    areaRef.current?.select();
  }, [fallback, tabText]);

  const close = () => setOpen(false);

  const copy = () => {
    close();
    const write = navigator.clipboard?.writeText;
    if (!write) {
      setCopied(false);
      setFallback(true);
      return;
    }
    void write.call(navigator.clipboard, tabText).then(
      () => {
        setCopied(true);
        setFallback(false);
      },
      () => {
        setCopied(false);
        setFallback(true);
      },
    );
  };

  return (
    <div className="export-menu" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        Export
      </button>
      {open && (
        <div className="export-menu-list" id={menuId} role="menu">
          <button type="button" role="menuitem" onClick={() => { close(); onMidi(); }}>
            MIDI file (.mid)
          </button>
          <button type="button" role="menuitem" onClick={copy}>
            Copy tab
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              close();
              downloadBlob(tabText, 'text/plain;charset=utf-8', tabFileName);
            }}
          >
            Download tab (.txt)
          </button>
        </div>
      )}
      {copied && (
        <span className="muted" aria-live="polite">
          Copied
        </span>
      )}
      {fallback && (
        <>
          <span className="muted" aria-live="polite">
            Clipboard blocked. The tab below is selected — press Ctrl+C.
          </span>
          <textarea
            ref={areaRef}
            className="tab-fallback"
            readOnly
            value={tabText}
            aria-label="Tab text"
            spellCheck={false}
          />
        </>
      )}
    </div>
  );
}

export function downloadBytes(bytes: Uint8Array, type: string, fileName: string) {
  downloadBlob(bytes, type, fileName);
}
