import { useState } from 'react';
import { detectKeys } from '../../music/detectKey';
import { keyLabel, scaleReadout } from '../../music/keyLabel';
import { labelShift, mod } from '../../music/notes';
import { SCALE_FAMILIES, getFamily, type FamilyKey } from '../../music/scales';
import { pitchSpelling } from '../../music/spelling';
import type { KeySelection, NameStyle, Step } from '../../state/v2/types';

function scaleOptionLabel(familyName: string, modeName: string): string {
  const cut = modeName.indexOf(' (');
  const mode = cut >= 0 ? modeName.slice(0, cut) : modeName;
  return `${familyName} \u00b7 ${mode}`;
}

function parseScale(value: string): { familyKey: FamilyKey; modeKey: string } | null {
  const split = value.indexOf(':');
  if (split < 0) return null;
  const family = SCALE_FAMILIES.find((item) => item.key === value.slice(0, split));
  const mode = family?.modes.find((item) => item.key === value.slice(split + 1));
  if (!family || !mode) return null;
  return { familyKey: family.key, modeKey: mode.key };
}

export function KeyPanel({
  selection,
  names,
  steps,
  heldMidis,
  onKey,
}: {
  selection: KeySelection;
  names: NameStyle;
  steps: Step[];
  heldMidis: ReadonlySet<number>;
  onKey: (key: KeySelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const shift = labelShift(names);
  const family = getFamily(selection.familyKey);
  const mode = family.modes.find((item) => item.key === selection.modeKey) ?? family.modes[0];
  const rootOptions = Array.from({ length: 12 }, (_, displayed) => ({
    value: mod(displayed - shift, 12),
    label: pitchSpelling(displayed),
  }));
  const chords = steps.map((step) => step.chord);
  const heldPcs = [...heldMidis].map((midi) => mod(midi, 12));
  const usingHeld = chords.length === 0 && heldPcs.length > 0;
  const results = open ? detectKeys(chords.length > 0 ? chords : null, heldPcs, 3, shift) : [];

  return (
    <section data-testid="key-panel">
      <h2>Key</h2>
      <div className="key-fields">
        <div className="field">
          <label htmlFor="key-root">Root</label>
          <select
            id="key-root"
            value={selection.rootPc}
            onChange={(event) => onKey({ ...selection, rootPc: Number(event.target.value) })}
          >
            {rootOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="key-scale">Scale</label>
          <select
            id="key-scale"
            value={`${family.key}:${mode.key}`}
            onChange={(event) => {
              const next = parseScale(event.target.value);
              if (next) onKey({ rootPc: selection.rootPc, ...next });
            }}
          >
            {SCALE_FAMILIES.map((item) => (
              <optgroup key={item.key} label={item.name}>
                {item.modes.map((entry) => (
                  <option key={`${item.key}:${entry.key}`} value={`${item.key}:${entry.key}`}>
                    {scaleOptionLabel(item.name, entry.name)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <p className="key-readout">{scaleReadout(selection.rootPc, mode.key, mode.intervals, shift)}</p>
      <div data-testid="detect-key">
        <button type="button" className="panel-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          Detect key from steps
        </button>
        {open && usingHeld && <p className="detect-note">Using the notes you are holding.</p>}
        {open && chords.length === 0 && !usingHeld && <p className="detect-note">Add some steps first.</p>}
        {results.length > 0 && (
          <ul className="detect-list" aria-label="Detected keys">
            {results.map((item) => (
              <li key={`${item.familyKey}:${item.modeKey}:${item.rootPc}`}>
                <span className="detect-name">{keyLabel(item.rootPc, item.modeKey, shift)}</span>
                <button
                  type="button"
                  className="panel-button"
                  onClick={() =>
                    onKey({ rootPc: item.rootPc, familyKey: item.familyKey, modeKey: item.modeKey })
                  }
                >
                  Use
                </button>
                <p className="detect-reason">{item.reason}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
