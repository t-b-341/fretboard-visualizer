import { useState } from 'react';
import type { SuggestStyle } from '../../state/v2/suggest';

const STYLES: readonly { id: SuggestStyle; label: string }[] = [
  { id: 'jazz', label: 'Jazz ii\u2013V\u2013I' },
  { id: 'pop', label: 'Pop I\u2013V\u2013vi\u2013IV' },
  { id: 'free', label: 'Free functional' },
];

export function SuggestPanel({ onSuggest }: { onSuggest: (style: SuggestStyle, borrowed: boolean) => void }) {
  const [style, setStyle] = useState<SuggestStyle>('jazz');
  const [borrowed, setBorrowed] = useState(false);
  return (
    <details className="suggest-panel" data-testid="suggest-panel">
      <summary>
        <h2>Suggest</h2>
      </summary>
      <label className="field">
        Style
        <select value={style} onChange={(event) => setStyle(event.target.value as SuggestStyle)}>
          {STYLES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="check-line">
        <input type="checkbox" checked={borrowed} onChange={(event) => setBorrowed(event.target.checked)} />
        Borrowed and secondary chords
      </label>
      <button type="button" className="panel-button suggest-go" onClick={() => onSuggest(style, borrowed)}>
        Suggest
      </button>
    </details>
  );
}
