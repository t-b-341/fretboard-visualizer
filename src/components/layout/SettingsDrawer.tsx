import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { midiEngine } from '../../audio/midi';
import { midiInput } from '../../audio/midiIn';
import { synth } from '../../audio/synth';
import type { ChordToneRole } from '../../music/chords';
import { labelShift, mod, noteName, pitchName } from '../../music/notes';
import { TUNING_PRESETS } from '../../music/tunings';
import type { GuitarString } from '../../music/tunings';
import type { Weights } from '../../music/voiceLeading';
import { formatMyDefault } from '../../state/v2/myDefault';
import { keyboardStarts } from '../../state/v2/keyboardSpan';
import { FRET_COUNT } from '../../state/v2/defaults';
import type { AppStateV2, MyDefault, NumStrings, StartIn } from '../../state/v2/types';

function noteChoices(shift: number) {
  return Array.from({ length: 12 }, (_, displayed) => ({
    concertPc: mod(displayed - shift, 12),
    label: noteName(displayed),
  }));
}

function presetId(numStrings: number, tuning: readonly GuitarString[]): string {
  const matched = TUNING_PRESETS.find(
    (preset) =>
      preset.strings === numStrings &&
      preset.notes.length === tuning.length &&
      preset.notes.every((note, index) => note.pc === tuning[index].pc && note.octave === tuning[index].octave),
  );
  return matched?.id ?? 'custom';
}

function snapToStep(value: number, step: number): number {
  const places = step < 1 ? 1 : 0;
  return Number((Math.round(value / step) * step).toFixed(places));
}

function formatWeight(value: number, step: number): string {
  return step < 1 ? value.toFixed(1) : String(Math.round(value));
}

const ROLE_MOTION_FIELDS: { key: ChordToneRole; label: string }[] = [
  { key: 'root', label: 'Root motion' },
  { key: 'third', label: 'Third motion' },
  { key: 'fifth', label: 'Fifth motion' },
  { key: 'seventh', label: 'Seventh motion' },
  { key: 'ext', label: 'Extension motion' },
];

const SCALAR_WEIGHT_FIELDS: {
  key: Exclude<keyof Weights, 'roleMotion'>;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: 'handShift', label: 'Hand shift', min: 0, max: 5, step: 0.1 },
  { key: 'commonToneBonus', label: 'Common-tone bonus', min: 0, max: 5, step: 0.1 },
  { key: 'resolutionBonus', label: 'Resolution bonus', min: 0, max: 5, step: 0.1 },
  { key: 'registerAnchor', label: 'Register anchor', min: 0, max: 5, step: 0.1 },
  { key: 'omissionPenalty', label: 'Omission penalty', min: 0, max: 20, step: 0.5 },
  { key: 'anchorFret', label: 'Anchor fret', min: 0, max: 15, step: 1 },
];

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

type Status = 'idle' | 'enabling' | 'ready' | 'unsupported' | 'denied';

function MidiSection({
  midi,
  onMidi,
}: {
  midi: AppStateV2['settings']['midi'];
  onMidi: (midi: Partial<AppStateV2['settings']['midi']>) => void;
}) {
  const [, setTick] = useState(0);
  const [status, setStatus] = useState<Status>(midiEngine.enabled ? 'ready' : 'idle');

  useEffect(() => midiEngine.subscribe(() => setTick((tick) => tick + 1)), []);
  useEffect(() => midiInput.subscribe(() => setTick((tick) => tick + 1)), []);

  const enable = async () => {
    if (!midiEngine.supported) {
      setStatus('unsupported');
      return;
    }
    setStatus('enabling');
    const ok = await midiEngine.enable();
    if (ok) await midiInput.enable();
    setStatus(ok ? 'ready' : 'denied');
  };

  const outputs = midiEngine.outputs();
  const inputs = midiInput.inputs();
  const ready = status === 'ready' || midiEngine.enabled;
  const selectedOutput = outputs.find((port) => port.name === midi.outputName) ?? outputs.find((port) => port.id === midiEngine.outputId);
  const selectedInput = inputs.find((port) => port.name === midi.inputName);

  return (
    <section>
      <h3>MIDI</h3>
      {!midiEngine.supported && <p className="midi-note">This browser has no Web MIDI.</p>}
      {midiEngine.supported && !ready && (
        <button type="button" onClick={() => void enable()} disabled={status === 'enabling'}>
          {status === 'enabling' ? 'Enabling…' : 'Enable MIDI'}
        </button>
      )}
      {status === 'denied' && <p className="midi-note">MIDI access was blocked.</p>}
      {ready && (
        <>
          <div className="field">
            <label htmlFor="midi-output">Output</label>
            <select
              id="midi-output"
              value={selectedOutput?.id ?? ''}
              onChange={(event) => {
                const port = outputs.find((item) => item.id === event.target.value);
                midiEngine.setOutput(event.target.value);
                onMidi({ outputName: port?.name ?? '' });
              }}
            >
              {outputs.length === 0 && <option value="">No MIDI outputs found</option>}
              {outputs.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="midi-channel">Channel</label>
            <select
              id="midi-channel"
              value={midi.channel}
              onChange={(event) => {
                const channel = Number(event.target.value);
                midiEngine.setChannel(channel);
                onMidi({ channel });
              }}
            >
              {Array.from({ length: 16 }, (_, index) => index + 1).map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
          </div>
          {outputs.length === 0 && <p className="midi-note">No MIDI outputs found — the built-in synth is still playing.</p>}
          <div className="field">
            <label htmlFor="midi-input">Input</label>
            <select
              id="midi-input"
              value={selectedInput?.id ?? ''}
              onChange={(event) => {
                const port = inputs.find((item) => item.id === event.target.value);
                onMidi({ inputName: port?.name ?? '' });
              }}
            >
              <option value="">None</option>
              {inputs.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.name}
                </option>
              ))}
            </select>
          </div>
          {inputs.length === 0 && <p className="midi-note">No MIDI inputs found.</p>}
          <label className="check-line">
            <input
              type="checkbox"
              checked={midi.showPlayed}
              onChange={(event) => onMidi({ showPlayed: event.target.checked })}
            />
            Show played notes
          </label>
          <label className="check-line" title="Plays incoming notes on the built-in synth. Leave off to avoid doubling a hardware synth.">
            <input
              type="checkbox"
              checked={midi.soundPlayed}
              onChange={(event) => {
                if (event.target.checked) synth.resume();
                onMidi({ soundPlayed: event.target.checked });
              }}
            />
            Sound played notes
          </label>
        </>
      )}
    </section>
  );
}

function VoiceLeadingSection({
  weights,
  onWeights,
  onReset,
}: {
  weights: Weights;
  onWeights: (weights: Weights) => void;
  onReset: () => void;
}) {
  return (
    <details className="vl-weights">
      <summary>
        <h3>Voice leading (advanced)</h3>
      </summary>
      <div className="vl-weights-body">
        {ROLE_MOTION_FIELDS.map((field) => (
          <label key={field.key} className="vl-weight">
            <span>{field.label}</span>
            <span className="vl-weight-value">{formatWeight(weights.roleMotion[field.key], 0.1)}</span>
            <input
              type="range"
              min={0}
              max={5}
              step={0.1}
              aria-label={field.label}
              value={weights.roleMotion[field.key]}
              onChange={(event) => {
                const value = snapToStep(Number(event.target.value), 0.1);
                onWeights({ ...weights, roleMotion: { ...weights.roleMotion, [field.key]: value } });
              }}
            />
          </label>
        ))}
        {SCALAR_WEIGHT_FIELDS.map((field) => (
          <label key={field.key} className="vl-weight">
            <span>{field.label}</span>
            <span className="vl-weight-value">{formatWeight(weights[field.key], field.step)}</span>
            <input
              type="range"
              min={field.min}
              max={field.max}
              step={field.step}
              aria-label={field.label}
              value={weights[field.key]}
              onChange={(event) => {
                const value = snapToStep(Number(event.target.value), field.step);
                onWeights({ ...weights, [field.key]: value });
              }}
            />
          </label>
        ))}
        <button type="button" className="btn-mini vl-weights-reset" onClick={onReset}>
          Reset
        </button>
      </div>
    </details>
  );
}

export function SettingsDrawer({
  open,
  onClose,
  state,
  onStartIn,
  onSetFromCurrent,
  onNumStrings,
  onPreset,
  onStringPitch,
  onLeftHanded,
  onNeck,
  onKeyboard,
  onSound,
  onMidi,
  onWeights,
  onResetWeights,
}: {
  open: boolean;
  onClose: () => void;
  state: AppStateV2;
  onStartIn: (startIn: StartIn) => void;
  onSetFromCurrent: () => void;
  onNumStrings: (numStrings: NumStrings) => void;
  onPreset: (id: string) => void;
  onStringPitch: (index: number, pc: number) => void;
  onLeftHanded: (leftHanded: boolean) => void;
  onNeck: (neck: Partial<AppStateV2['settings']['neck']>) => void;
  onKeyboard: (keyboard: Partial<AppStateV2['settings']['keyboard']>) => void;
  onSound: (sound: Partial<AppStateV2['settings']['sound']>) => void;
  onMidi: (midi: Partial<AppStateV2['settings']['midi']>) => void;
  onWeights: (weights: Weights) => void;
  onResetWeights: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const { settings } = state;
  const instrument = settings.instrument;
  const neck = settings.neck;
  const shift = labelShift(state.view.names);
  const notes = noteChoices(shift);
  const tuningId = presetId(instrument.numStrings, instrument.tuning);
  const starts = keyboardStarts(settings.keyboard.octaves);

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

  const setHidden = (hidden: number[]) => {
    const unique = [...new Set(hidden.filter((index) => index >= 0 && index < instrument.numStrings))];
    if (unique.length >= instrument.numStrings) return;
    onNeck({ hiddenStrings: unique });
  };

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
              <input type="radio" name="start-in" checked={settings.startIn === 'last'} onChange={() => onStartIn('last')} />
              Last session
            </label>
            <label>
              <input
                type="radio"
                name="start-in"
                checked={settings.startIn === 'default'}
                onChange={() => onStartIn('default')}
              />
              My default
            </label>
          </div>
          {settings.startIn === 'default' && (
            <MyDefaultBlock mine={settings.myDefault} onSetFromCurrent={onSetFromCurrent} />
          )}
        </section>

        <section>
          <h3>Instrument</h3>
          <div className="segmented" role="group" aria-label="Number of strings">
            {([6, 7, 8] as const).map((count) => (
              <button
                key={count}
                type="button"
                className={instrument.numStrings === count ? 'active' : ''}
                onClick={() => onNumStrings(count)}
              >
                {count === 6 ? '6-string bass' : `${count}-string`}
              </button>
            ))}
          </div>
          <div className="field">
            <label htmlFor="tuning-preset">Tuning</label>
            <select id="tuning-preset" value={tuningId} onChange={(event) => onPreset(event.target.value)}>
              {TUNING_PRESETS.filter((preset) => preset.strings === instrument.numStrings).map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
              {tuningId === 'custom' && <option value="custom">Custom</option>}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Strings (low → high)</span>
            <div className="tuning-editor">
              {instrument.tuning.map((string, index) => (
                <div className="str" key={index}>
                  <small>{index + 1}</small>
                  <select
                    aria-label={`String ${index + 1}`}
                    value={string.pc}
                    onChange={(event) => onStringPitch(index, Number(event.target.value))}
                  >
                    {notes.map((option) => (
                      <option key={option.concertPc} value={option.concertPc}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">Hand</span>
            <div className="segmented" role="group" aria-label="Fretboard handedness">
              <button type="button" className={instrument.leftHanded ? '' : 'active'} onClick={() => onLeftHanded(false)}>
                Right
              </button>
              <button type="button" className={instrument.leftHanded ? 'active' : ''} onClick={() => onLeftHanded(true)}>
                Left
              </button>
            </div>
          </div>
        </section>

        <section>
          <h3>Neck</h3>
          <div className="field">
            <span className="field-label">Frets shown</span>
            <div className="row">
              <div className="field">
                <label htmlFor="fret-from">From</label>
                <input
                  id="fret-from"
                  type="number"
                  min={0}
                  max={neck.fretTo}
                  value={neck.fretFrom}
                  aria-label="Frets shown from"
                  onChange={(event) => {
                    const fretFrom = Math.max(0, Math.min(neck.fretTo, Number(event.target.value) || 0));
                    onNeck({ fretFrom });
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="fret-to">To</label>
                <input
                  id="fret-to"
                  type="number"
                  min={neck.fretFrom}
                  max={FRET_COUNT}
                  value={Math.min(neck.fretTo, FRET_COUNT)}
                  aria-label="Frets shown to"
                  onChange={(event) => {
                    const fretTo = Math.max(neck.fretFrom, Math.min(FRET_COUNT, Number(event.target.value) || FRET_COUNT));
                    onNeck({ fretTo });
                  }}
                />
              </div>
            </div>
          </div>
          <div className="field">
            <span className="field-label">Strings shown</span>
            <div className="btn-row">
              <button type="button" className="btn-mini" onClick={() => setHidden([])}>
                All
              </button>
              <button
                type="button"
                className="btn-mini"
                onClick={() => setHidden(instrument.tuning.map((_, index) => index).filter((index) => index >= 4))}
              >
                Low 4
              </button>
              <button
                type="button"
                className="btn-mini"
                onClick={() =>
                  setHidden(instrument.tuning.map((_, index) => index).filter((index) => index < instrument.numStrings - 4))
                }
              >
                High 4
              </button>
            </div>
            <div className="str-toggles">
              {instrument.tuning.map((string, index) => {
                const shown = !neck.hiddenStrings.includes(index);
                return (
                  <button
                    key={index}
                    type="button"
                    className={shown ? 'on' : ''}
                    aria-pressed={shown}
                    title={noteName(mod(string.pc + shift, 12))}
                    onClick={() => {
                      if (shown) setHidden([...neck.hiddenStrings, index]);
                      else setHidden(neck.hiddenStrings.filter((item) => item !== index));
                    }}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section>
          <h3>Keyboard</h3>
          <div className="field">
            <span className="field-label">Span</span>
            <div className="segmented" role="group" aria-label="Keyboard span">
              {(
                [
                  [1, '1 octave'],
                  [2, '2 octaves'],
                  [3, '37 keys'],
                ] as const
              ).map(([count, label]) => (
                <button
                  key={count}
                  type="button"
                  className={settings.keyboard.octaves === count ? 'active' : ''}
                  title={count === 3 ? 'MPK Mini Plus keybed, C to C.' : undefined}
                  onClick={() => onKeyboard({ octaves: count })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="keyboard-start">Start key</label>
            <select
              id="keyboard-start"
              value={starts.includes(settings.keyboard.lowestMidi) ? settings.keyboard.lowestMidi : starts[0]}
              onChange={(event) => onKeyboard({ lowestMidi: Number(event.target.value) })}
            >
              {starts.map((midi) => (
                <option key={midi} value={midi}>
                  {pitchName(midi)}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section>
          <h3>Sound</h3>
          <div className="sound-row">
            <button
              type="button"
              className={`btn-mini${settings.sound.muted ? ' active' : ''}`}
              aria-pressed={settings.sound.muted}
              onClick={() => onSound({ muted: !settings.sound.muted })}
              disabled={!synth.supported}
              title={settings.sound.muted ? 'Unmute the built-in synth' : 'Mute the built-in synth'}
            >
              {settings.sound.muted ? 'Muted' : 'Mute'}
            </button>
            <label className="midi-field">
              Volume
              <input
                className="midi-range"
                type="range"
                min={0}
                max={100}
                aria-label="Volume"
                value={Math.round(settings.sound.volume * 100)}
                disabled={!synth.supported || settings.sound.muted}
                onChange={(event) => onSound({ volume: Number(event.target.value) / 100 })}
              />
            </label>
          </div>
          <div className="sound-row">
            <button
              type="button"
              className={`btn-mini${settings.sound.drone ? ' active' : ''}`}
              aria-pressed={settings.sound.drone}
              onClick={() => onSound({ drone: !settings.sound.drone })}
              disabled={!synth.supported}
              title="Hold the root under the scale"
            >
              Drone
            </button>
            <label className="check-line">
              <input
                type="checkbox"
                checked={settings.sound.clickToHear}
                onChange={(event) => onSound({ clickToHear: event.target.checked })}
              />
              Click notes to hear
            </label>
          </div>
          <div className="field">
            <label htmlFor="playback-octave">Playback octave</label>
            <select
              id="playback-octave"
              value={settings.sound.octave}
              onChange={(event) => onSound({ octave: Number(event.target.value) })}
            >
              {[2, 3, 4, 5, 6].map((octave) => (
                <option key={octave} value={octave}>
                  {octave}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Beats per step</span>
            <div className="segmented" role="group" aria-label="Beats per step">
              {([1, 2, 4] as const).map((beats) => (
                <button
                  key={beats}
                  type="button"
                  className={settings.sound.beatsPerStep === beats ? 'active' : ''}
                  onClick={() => onSound({ beatsPerStep: beats })}
                >
                  {beats}
                </button>
              ))}
            </div>
          </div>
        </section>

        <MidiSection midi={settings.midi} onMidi={onMidi} />
        <VoiceLeadingSection weights={settings.voiceLeadingWeights} onWeights={onWeights} onReset={onResetWeights} />
      </aside>
    </div>
  );
}
