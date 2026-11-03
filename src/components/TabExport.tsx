import { useEffect, useRef, useState } from 'react';
import './TabExport.css';

interface Props {
  text: string;
  fileName: string;
  disabled?: boolean;
}

export function TabExport({ text, fileName, disabled = false }: Props) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const blocked = disabled || text.length === 0;

  useEffect(() => {
    setCopied(false);
    setFallback(false);
  }, [text]);

  useEffect(() => {
    if (!copied) return;
    const id = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(id);
  }, [copied]);

  useEffect(() => {
    if (!fallback) return;
    const area = areaRef.current;
    if (!area) return;
    area.focus();
    area.select();
  }, [fallback, text]);

  const copy = () => {
    const write = navigator.clipboard?.writeText;
    if (!write) {
      setCopied(false);
      setFallback(true);
      return;
    }
    void write.call(navigator.clipboard, text).then(
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

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="tab-export">
      <pre className="tab-preview" aria-label="Tab preview">
        {text}
      </pre>
      <div className="tab-export-actions">
        <button type="button" className="btn-mini" onClick={copy} disabled={blocked}>
          Copy tab
        </button>
        <button type="button" className="btn-mini" onClick={download} disabled={blocked}>
          Download .txt
        </button>
        {copied && (
          <span className="muted" aria-live="polite">
            Copied
          </span>
        )}
        {fallback && (
          <span className="muted" aria-live="polite">
            Clipboard blocked. The tab below is selected — press Ctrl+C.
          </span>
        )}
      </div>
      {fallback && (
        <textarea
          ref={areaRef}
          className="tab-fallback"
          readOnly
          value={text}
          aria-label="Tab text"
          spellCheck={false}
        />
      )}
    </div>
  );
}
