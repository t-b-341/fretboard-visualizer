import { useEffect, useState } from 'react';
import './MidiControls.css';
import type { Triad } from '../music/chords';
import { midiEngine, scaleToMidi, triadToMidi } from '../audio/midi';
import { player } from '../audio/player';
import { synth } from '../audio/synth';

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

  // Re-render when the MIDI device list / selection or synth settings change.
  useEffect(() => midiEngine.subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => synth.subscribe(() => setTick((t) => t + 1)), []);
  // Silence anything playing if this panel unmounts.
  useEffect(() => () => player.stop(), []);

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
  // Playback works through the built-in synth even with no MIDI device.
  const soundReady = synth.supported || hasOutput;

  const playScale = () => player.playSequence(scaleToMidi(rootPc, intervals, octave), { bpm });
  const playChord = () => player.playChord(triadToMidi(triad.pitches, octave));

  return (
    <div className="midi-bar">
      <span className="midi-bar-label">Sound</span>

      {/* Built-in synth: makes sound with no setup */}
      <button
        className={`btn-mini${synth.muted ? ' active' : ''}`}
        onClick={() => synth.setMuted(!synth.muted)}
        disabled={!synth.supported}
        title={synth.muted ? 'Unmute the built-in synth' : 'Mute the built-in synth'}
      >
        {synth.muted ? 'Muted' : 'Mute'}
      </button>
      <label className="midi-field">
        Volume
        <input
          className="midi-range"
          type="range"
          min={0}
          max={100}
          value={Math.round(synth.volume * 100)}
          disabled={!synth.supported || synth.muted}
          onChange={(e) => synth.setVolume(Number(e.target.value) / 100)}
        />
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

      <button className="btn-mini" onClick={playScale} disabled={!soundReady}>
        &#9654; Play scale
      </button>
      <button className="btn-mini" onClick={playChord} disabled={!soundReady}>
        &#9654; Play chord
      </button>
      <button className="btn-mini" onClick={() => player.stop()}>
        &#9632; Stop
      </button>

      <span className="midi-sep" />

      {/* Optional: also send notes to an external MIDI device */}
      {!ready && (
        <button className="btn-mini" onClick={enable} disabled={status === 'enabling'}>
          {status === 'enabling' ? 'Enabling\u2026' : 'Send to MIDI\u2026'}
        </button>
      )}
      {status === 'unsupported' && (
        <span className="midi-note muted">External MIDI needs Chrome or Edge.</span>
      )}
      {status === 'denied' && <span className="midi-note muted">MIDI access was blocked.</span>}

      {ready && (
        <>
          <span className="midi-note muted">MIDI&nbsp;out</span>
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

          {outputs.length === 0 && (
            <span className="midi-note muted">
              No MIDI devices found &mdash; the built-in synth is still playing.
            </span>
          )}
        </>
      )}
    </div>
  );
}
