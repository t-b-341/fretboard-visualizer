import { useState } from 'react';
import { buildChord, buildDiatonicChord, getDiatonicTriad } from '../../music/chords';
import type { Chord } from '../../music/chords';
import { parseChordSymbol } from '../../music/parseChord';
import { getFamily, parentIntervals } from '../../music/scales';
import type { KeySelection } from '../../state/v2/types';

const ERROR = "Can't read that chord. Try Gm7, Eb/G, or A7.";

export function AddChord({
  selection,
  onAdd,
}: {
  selection: KeySelection;
  onAdd: (chord: Chord, bassPc?: number) => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sevenths, setSevenths] = useState(false);
  const family = getFamily(selection.familyKey);
  const mode = family.modes.find((item) => item.key === selection.modeKey) ?? family.modes[0];
  const intervals = parentIntervals(mode.intervals);
  const degrees = [0, 1, 2, 3, 4, 5, 6];

  const submit = () => {
    const parsed = parseChordSymbol(text);
    if (!parsed) {
      setError(ERROR);
      return;
    }
    onAdd(buildChord(parsed.rootPc, parsed.quality), parsed.bassPc);
    setText('');
    setError('');
  };

  return (
    <section data-testid="add-chord">
      <h2>Add chord</h2>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="add-chord-row">
          <input
            id="add-chord-symbol"
            aria-label="Chord symbol"
            placeholder="Gm7, Eb/G, A7"
            autoComplete="off"
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              if (error) setError('');
            }}
          />
          <button type="submit">Add</button>
        </div>
      </form>
      {error && <p className="field-error">{error}</p>}
      <div data-testid="chord-palette">
        <div className="palette-row">
          {degrees.map((degree) => {
            const roman = getDiatonicTriad(selection.rootPc, intervals, degree).roman;
            return (
              <button
                key={degree}
                type="button"
                className={`palette-deg-${degree}`}
                onClick={() => onAdd(buildDiatonicChord(selection.rootPc, intervals, degree, sevenths))}
              >
                {roman}
              </button>
            );
          })}
        </div>
        <label className="check-line">
          <input type="checkbox" checked={sevenths} onChange={(event) => setSevenths(event.target.checked)} />
          7th chords
        </label>
      </div>
    </section>
  );
}
