import { useEffect, useState } from 'react';
import './MidiControls.css';
import type { Triad } from '../music/chords';
import { midiEngine, scaleToMidi, triadToMidi } from '../audio/midi';
import { midiInput } from '../audio/midiIn';
import { player } from '../audio/player';
import { synth } from '../audio/synth';

interface Props {
  rootPc: number;
  intervals: number[];
  triad: Triad;
  soundOctave: number;
  onSoundOctave: (octave: number) => void;
  drone: boolean;
  onDrone: (on: boolean) => void;
  clickToHear: boolean;
  onClickToHear: (on: boolean) => void;
  midiInputName: string;
  showPlayedNotes: boolean;
  soundPlayedNotes: boolean;
  onMidiInputName: (name: string) => void;
  onShowPlayedNotes: (on: boolean) => void;
  onSoundPlayedNotes: (on: boolean) => void;
}

type Status = 'idle' | 'enabling' | 'ready' | 'unsupported' | 'denied';

export function MidiControls({
  rootPc,
  intervals,
  triad,
  soundOctave,
  onSoundOctave,
  drone,
  onDrone,
  clickToHear,
  onClickToHear,
  midiInputName,
  showPlayedNotes,
  soundPlayedNotes,
  onMidiInputName,
  onShowPlayedNotes,
  onSoundPlayedNotes,
}: Props) {
  const [, setTick] = useState(0);
  const [status, setStatus] = useState<Status>(midiEngine.enabled ? 'ready' : 'idle');
  const [channel, setChannel] = useState(1);
  const [bpm, setBpm] = useState(120);
  const droneMidi = (soundOctave + 1) * 12 + rootPc;

  // Retune a sounding drone when the root or octave changes. The first start
  // also happens in the click handler so the audio context is allowed to run.
  useEffect(() => {
    if (drone) player.startDrone(droneMidi);
    else player.stopDrone();
  }, [drone, droneMidi]);
  useEffect(() => () => player.stopDrone(), []);

  // Re-render when the MIDI device list / selection or synth settings change.
  useEffect(() => midiEngine.subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => midiInput.subscribe(() => setTick((t) => t + 1)), []);
  useEffect(() => synth.subscribe(() => setTick((t) => t + 1)), []);
  // Silence anything playing if this panel unmounts.
  useEffect(() => () => player.stop(), []);
  useEffect(() => () => midiInput.setThru(false), []);

  useEffect(() => {
    midiInput.selectByName(midiInputName);
  }, [midiInputName]);

  useEffect(() => {
    midiInput.setThru(soundPlayedNotes);
  }, [soundPlayedNotes]);

  // A saved input should reconnect without another click once MIDI is allowed.
  useEffect(() => {
    if (!midiInputName || !midiEngine.supported || midiEngine.enabled) return;
    let cancel = false;
    void (async () => {
      setStatus('enabling');
      const ok = await midiEngine.enable();
      if (cancel) return;
      if (ok) await midiInput.enable();
      if (!cancel) setStatus(ok ? 'ready' : 'denied');
    })();
    return () => {
      cancel = true;
    };
  }, [midiInputName]);

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
  const selectedInput = inputs.find((port) => port.name === midiInputName);
  const hasOutput = ready && !!midiEngine.outputId && outputs.length > 0;
  // Playback works through the built-in synth even with no MIDI device.
  const soundReady = synth.supported || hasOutput;

  const playScale = () => player.playSequence(scaleToMidi(rootPc, intervals, soundOctave), { bpm });
  const playChord = () => player.playChord(triadToMidi(triad.pitches, soundOctave));

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

      <button
        className={`btn-mini${drone ? ' active' : ''}`}
        onClick={() => {
          const next = !drone;
          onDrone(next);
          if (next) player.startDrone(droneMidi);
          else player.stopDrone();
        }}
        disabled={!synth.supported}
        title="Hold the root under the scale"
      >
        Drone
      </button>
      <label className="checkbox-row">
        <input type="checkbox" checked={clickToHear} onChange={(e) => onClickToHear(e.target.checked)} />
        Click notes
      </label>

      <label className="midi-field">
        Octave
        <select value={soundOctave} onChange={(e) => onSoundOctave(Number(e.target.value))}>
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

      {/* Optional: send notes out, and listen for a keyboard. */}
      {!midiEngine.supported && (
        <span className="midi-note muted">MIDI needs Chrome or Edge.</span>
      )}
      {midiEngine.supported && !ready && (
        <button className="btn-mini" onClick={enable} disabled={status === 'enabling'}>
          {status === 'enabling' ? 'Enabling\u2026' : 'Enable MIDI\u2026'}
        </button>
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
              No MIDI outputs found &mdash; the built-in synth is still playing.
            </span>
          )}

          <span className="midi-sep" />
          <span className="midi-note muted">MIDI&nbsp;in</span>
          <label className="midi-field">
            Input
            <select
              value={selectedInput?.id ?? ''}
              onChange={(e) => {
                const port = inputs.find((item) => item.id === e.target.value);
                onMidiInputName(port?.name ?? '');
              }}
            >
              <option value="">None</option>
              {inputs.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.name}
                </option>
              ))}
            </select>
          </label>
          {inputs.length === 0 && <span className="midi-note muted">No MIDI inputs found.</span>}
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={showPlayedNotes}
              onChange={(e) => onShowPlayedNotes(e.target.checked)}
            />
            Show played notes
          </label>
          <label className="checkbox-row" title="Plays incoming notes on the built-in synth. Leave off to avoid doubling a hardware synth.">
            <input
              type="checkbox"
              checked={soundPlayedNotes}
              onChange={(e) => {
                if (e.target.checked) synth.resume();
                onSoundPlayedNotes(e.target.checked);
              }}
            />
            Sound played notes
          </label>
        </>
      )}
    </div>
  );
}
