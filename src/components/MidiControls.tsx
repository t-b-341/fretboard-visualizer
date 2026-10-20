import { useEffect, useState } from 'react';
import './MidiControls.css';
import type { Triad } from '../music/chords';
import { midiEngine, scaleToMidi, triadToMidi } from '../audio/midi';

interface Props {
  rootPc: number;
  intervals: number[];
  triad: Triad;
}

type Status = 'idle' | 'enabling' | 'ready' | 'unsupported' | 'denied';

export function MidiControls({ rootPc, intervals, triad }: Props) {
  const [, setTick] = useState(0);
  const [status, setStatus] = useState<Status>(midiEngine.enabled ? 'ready' : 'idle');
  const [channel, setChannel] = useState(1);
  const [octave, setOctave] = useState(4);
  const [bpm, setBpm] = useState(120);

  // Re-render when the engine's device list / selection changes.
  useEffect(() => midiEngine.subscribe(() => setTick((t) => t + 1)), []);
  // Silence anything playing if this panel unmounts.
  useEffect(() => () => midiEngine.stop(), []);

  const enable = async () => {
    if (!midiEngine.supported) {
      setStatus('unsupported');
      return;
    }
    setStatus('enabling');
    const ok = await midiEngine.enable();
    setStatus(ok ? 'ready' : 'denied');
  };

  const outputs = midiEngine.outputs();
  const ready = status === 'ready';
  const hasOutput = ready && !!midiEngine.outputId && outputs.length > 0;

  const playScale = () => midiEngine.playSequence(scaleToMidi(rootPc, intervals, octave), { bpm });
  const playChord = () => midiEngine.playChord(triadToMidi(triad.pitches, octave));

  return (
    <div className="midi-bar">
      <span className="midi-bar-label">Sound (MIDI out)</span>

      {!ready && (
        <button className="btn-mini" onClick={enable} disabled={status === 'enabling'}>
          {status === 'enabling' ? 'Enabling\u2026' : 'Enable MIDI'}
        </button>
      )}
      {status === 'unsupported' && (
        <span className="midi-note muted">
          Web MIDI isn&rsquo;t available in this browser &mdash; try Chrome or Edge.
        </span>
      )}
      {status === 'denied' && <span className="midi-note muted">MIDI access was blocked.</span>}

      {ready && (
        <>
          <label className="midi-field">
            Device
            <select
              value={midiEngine.outputId ?? ''}
              onChange={(e) => midiEngine.setOutput(e.target.value)}
            >
              {outputs.length === 0 && <option value="">No MIDI outputs found</option>}
              {outputs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="midi-field">
            Ch
            <select
              value={channel}
              onChange={(e) => {
                const c = Number(e.target.value);
                setChannel(c);
                midiEngine.setChannel(c);
              }}
            >
              {Array.from({ length: 16 }, (_, i) => i + 1).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className="midi-field">
            Octave
            <select value={octave} onChange={(e) => setOctave(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>

          <label className="midi-field">
            Tempo
            <input
              type="number"
              min={40}
              max={240}
              value={bpm}
              onChange={(e) => setBpm(Math.max(40, Math.min(240, Number(e.target.value) || 120)))}
            />
          </label>

          <span className="midi-sep" />

          <button className="btn-mini" onClick={playScale} disabled={!hasOutput}>
            &#9654; Play scale
          </button>
          <button className="btn-mini" onClick={playChord} disabled={!hasOutput}>
            &#9654; Play chord
          </button>
          <button className="btn-mini" onClick={() => midiEngine.stop()} disabled={!hasOutput}>
            &#9632; Stop
          </button>

          {outputs.length === 0 && (
            <span className="midi-note muted">
              No MIDI outputs found &mdash; connect a device or enable a virtual/OS synth.
            </span>
          )}
        </>
      )}
    </div>
  );
}
