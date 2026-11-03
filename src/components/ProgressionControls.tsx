import { useEffect, useMemo, useRef, useState } from 'react';
import './ProgressionControls.css';
import type { Chord, ChordToneRole } from '../music/chords';
import { chordSymbol } from '../music/chords';
import { chordToMidi, midiEngine, progressionToSmf } from '../audio/midi';
import { player } from '../audio/player';
import { synth } from '../audio/synth';
import { mod, noteName } from '../music/notes';
import { formatTab } from '../music/tab';
import type { GuitarString } from '../music/tunings';
import { DEFAULT_WEIGHTS, leadProgression } from '../music/voiceLeading';
import type { Weights } from '../music/voiceLeading';
import { findVoicings } from '../music/voicings';
import type { VoicedNote, Voicing, VoicingStyle } from '../music/voicings';
import { TabExport } from './TabExport';

interface Props {
  /** Key centre (concert pitch class). */
  rootPc: number;
  /** Label shift (concert vs standard). */
  shift: number;
  /** Current guitar tuning. Voice leading places grips on these strings. */
  tuning: GuitarString[];
  /** Neck length and the frets currently in view. Tab grips stay inside that window. */
  fretCount: number;
  fretFrom: number;
  fretTo: number;
  /** String set and grip style used when a chord has no grip on the neck. */
  voicingStyle: VoicingStyle;
  voicingInversion: number;
  voicingWidth: 3 | 4;
  voicingSetStart: number;
  /** The single grip on the neck for activeChord, when one is shown. */
  activeGrip: VoicedNote[] | null;
  /** Whether the chord view is currently active (viewMode === 'chord'). */
  active: boolean;
  /** The chord currently shown on the instruments. */
  activeChord: Chord | null;
  ghostScale: boolean;
  /** Show a chord on the instruments (also switches into chord view). */
  onShowChord: (chord: Chord | null) => void;
  onShowVoicing: (v: Voicing | null) => void;
  onGhostScale: (v: boolean) => void;
  guideTones: boolean;
  onGuideTones: (v: boolean) => void;
  /** When enabled, grips stay inside this inclusive fret range. */
  positionWindow: { enabled: boolean; min: number; max: number };
  /** Restored session. Applied on mount, and again whenever loadId changes. */
  session: ProgressionSnapshot;
  loadId: number;
  onSessionChange: (snap: ProgressionSnapshot) => void;
  identifyOn: boolean;
  onToggleIdentify: () => void;
}

export interface ProgressionSnapshot {
  chords: Chord[];
  tempo: number;
  beatsPerChord: number;
  octave: number;
  loop: boolean;
  useSevenths: boolean;
  spicy: boolean;
  templateId: string;
}

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

/** First playable grip from findVoicings for the neck's string set and style. */
function firstStringSetGrip(
  tuning: GuitarString[],
  chord: Chord,
  opts: {
    fretCount: number;
    fretFrom: number;
    fretTo: number;
    voicingStyle: VoicingStyle;
    voicingInversion: number;
    voicingWidth: 3 | 4;
    voicingSetStart: number;
  },
): VoicedNote[] {
  const style = opts.voicingStyle === 'drop2' ? 'drop2' : 'close';
  const width = style === 'drop2' ? 4 : opts.voicingWidth;
  if (tuning.length < width) return [];
  const start = Math.max(0, Math.min(opts.voicingSetStart, tuning.length - width));
  const inversion = Math.min(Math.max(0, opts.voicingInversion), width - 1);
  return (
    findVoicings(tuning, opts.fretCount, chord, style, inversion, start, width).find((grip) =>
      grip.every((note) => note.fret >= opts.fretFrom && note.fret <= opts.fretTo),
    ) ?? []
  );
}

function cloneWeights(w: Weights): Weights {
  return { ...w, roleMotion: { ...w.roleMotion } };
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

export function ProgressionControls(props: Props) {
  const {
    rootPc,
    shift,
    tuning,
    fretCount,
    fretFrom,
    fretTo,
    voicingStyle,
    voicingInversion,
    voicingWidth,
    voicingSetStart,
    activeGrip,
    active,
    activeChord,
    ghostScale,
    onShowChord,
    onShowVoicing,
    onGhostScale,
    guideTones,
    onGuideTones,
    positionWindow,
    session,
    loadId,
    onSessionChange,
    identifyOn,
    onToggleIdentify,
  } = props;

  const [, setTick] = useState(0);
  const [progression, setProgression] = useState<Chord[]>(session.chords);
  const [playIndex, setPlayIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(session.tempo);
  const [beatsPerChord, setBeatsPerChord] = useState(session.beatsPerChord);
  const [octave, setOctave] = useState(session.octave);
  const [loop, setLoop] = useState(session.loop);
  const [useSevenths, setUseSevenths] = useState(session.useSevenths);
  const [spicy, setSpicy] = useState(session.spicy);
  const [templateId, setTemplateId] = useState(session.templateId);
  const [voiceLeading, setVoiceLeading] = useState(true);
  const [weights, setWeights] = useState<Weights>(() => cloneWeights(DEFAULT_WEIGHTS));

  const timerRef = useRef<number | null>(null);
  const onShowVoicingRef = useRef(onShowVoicing);
  onShowVoicingRef.current = onShowVoicing;
  const voiceLeadingRef = useRef(voiceLeading);
  voiceLeadingRef.current = voiceLeading;

  // Re-render when the MIDI engine's state changes (to reflect readiness).
  useEffect(() => midiEngine.subscribe(() => setTick((t) => t + 1)), []);

  const onSessionRef = useRef(onSessionChange);
  onSessionRef.current = onSessionChange;
  useEffect(() => {
    onSessionRef.current({
      chords: progression,
      tempo,
      beatsPerChord,
      octave,
      loop,
      useSevenths,
      spicy,
      templateId,
    });
  }, [progression, tempo, beatsPerChord, octave, loop, useSevenths, spicy, templateId]);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  const stop = () => {
    stopTimer();
    setPlaying(false);
    player.stop();
    onShowVoicingRef.current(null);
  };

  // Replace the working progression when a saved setup is loaded.
  useEffect(() => {
    if (loadId === 0) return;
    stop();
    setProgression(session.chords);
    setTempo(session.tempo);
    setBeatsPerChord(session.beatsPerChord);
    setOctave(session.octave);
    setLoop(session.loop);
    setUseSevenths(session.useSevenths);
    setSpicy(session.spicy);
    setTemplateId(session.templateId);
    setPlayIndex(-1);
    // session is the snapshot captured for this loadId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId]);

  // A new progression is no longer the one that was just played.
  useEffect(() => {
    onShowVoicingRef.current(null);
  }, [progression]);

  // Clean up timers / silence notes on unmount, and stop when leaving chord view.
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (!active) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const midiReady = midiEngine.enabled && !!midiEngine.outputId;
  // The built-in synth makes sound on its own; MIDI output is optional extra.
  const soundReady = synth.supported || midiReady;

  const voice = (chord: Chord): number[] => chordToMidi(chord.rootPc, chord.tones.map((t) => t.interval), octave);
  const fretRange = useMemo<[number, number] | undefined>(
    () => (positionWindow.enabled ? [positionWindow.min, positionWindow.max] : undefined),
    [positionWindow.enabled, positionWindow.min, positionWindow.max],
  );
  const allowOpen = positionWindow.enabled ? positionWindow.min === 0 : undefined;
  const lead = useMemo(() => {
    try {
      return {
        path: leadProgression(
          progression,
          tuning,
          weights,
          fretRange ? { fretRange, allowOpen } : undefined,
        ),
        error: null as string | null,
      };
    } catch (err) {
      return { path: null as Voicing[] | null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [progression, tuning, weights, fretRange, allowOpen]);
  const leadRef = useRef(lead);
  leadRef.current = lead;
  const shownGripIndex = activeGrip && activeChord ? progression.indexOf(activeChord) : -1;
  const tabText = useMemo(() => {
    const columns = progression.map((chord, index) => ({
      label: chordSymbol(chord, shift),
      notes:
        index === shownGripIndex && activeGrip
          ? activeGrip
          : firstStringSetGrip(tuning, chord, {
              fretCount,
              fretFrom,
              fretTo,
              voicingStyle,
              voicingInversion,
              voicingWidth,
              voicingSetStart,
            }),
    }));
    return formatTab(tuning, columns, { labelShift: shift });
  }, [
    progression,
    shownGripIndex,
    activeGrip,
    shift,
    tuning,
    fretCount,
    fretFrom,
    fretTo,
    voicingStyle,
    voicingInversion,
    voicingWidth,
    voicingSetStart,
  ]);
  const tabFileName = `fretboard-${noteName(mod(rootPc + shift, 12)).replace(/#/g, 'sharp')}-progression.txt`;

  const play = () => {
    const chords = progression;
    if (chords.length === 0) return;
    stopTimer();
    const dur = (60000 / tempo) * beatsPerChord;
    let i = 0;
    const fire = (idx: number) => {
      setPlayIndex(idx);
      onShowChord(chords[idx]);
      const current = leadRef.current;
      const grip =
        voiceLeadingRef.current && current.path && !current.error && current.path.length === chords.length
          ? current.path[idx]
          : null;
      if (grip) {
        player.playChord(
          grip.notes.map((n) => n.midi),
          { durationMs: dur * 0.95 },
        );
        onShowVoicingRef.current(grip);
      } else {
        player.playChord(voice(chords[idx]), { durationMs: dur * 0.95 });
        onShowVoicingRef.current(null);
      }
    };
    setPlaying(true);
    fire(0);
    timerRef.current = window.setInterval(() => {
      i += 1;
      if (i >= chords.length) {
        if (loop) {
          i = 0;
        } else {
          stopTimer();
          setPlaying(false);
          onShowVoicingRef.current(null);
          return;
        }
      }
      fire(i);
    }, dur);
  };

  // Export the progression as a downloadable Standard MIDI File. Independent of
  // Web MIDI output, so this works even where "Hear"/"Play" are unavailable.
  const exportMidi = () => {
    if (progression.length === 0) return;
    const keyLabel = noteName(mod(rootPc + shift, 12));
    const midiChords =
      voiceLeading && lead.path && !lead.error
        ? lead.path.map((v) => v.notes.map((n) => n.midi))
        : progression.map(voice);
    const bytes = progressionToSmf(midiChords, {
      bpm: tempo,
      beatsPerChord,
      trackName: `Fretboard progression in ${keyLabel}`,
    });
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
    const safeKey = keyLabel.replace('\u266f', 'sharp').replace('\u266d', 'flat');
    const a = document.createElement('a');
    a.href = url;
    a.download = `fretboard-${safeKey}-progression.mid`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="prog-bar">
      <div className="prog-head">
        <span className="midi-bar-label">Chords &amp; progressions</span>
        <span className="prog-key muted">Key centre: {noteName(mod(rootPc + shift, 12))}</span>
        {!active && <span className="midi-note muted">Shows in the &ldquo;Chords&rdquo; view.</span>}
        {!soundReady && <span className="midi-note muted">Sound isn&rsquo;t available in this browser.</span>}
      </div>

      {/* Transport */}
      <div className="prog-row">
        <label className="midi-field">
          Tempo
          <input
            type="number"
            min={40}
            max={240}
            value={tempo}
            onChange={(e) => setTempo(clamp(40, 240, Number(e.target.value) || 100))}
          />
        </label>
        <label className="midi-field">
          Beats/chord
          <select value={beatsPerChord} onChange={(e) => setBeatsPerChord(Number(e.target.value))}>
            {[1, 2, 4].map((b) => (
              <option key={b} value={b}>
                {b}
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
        <label className="checkbox-row">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
        </label>
        <label
          className="checkbox-row"
          title="Play and export each chord as the next voicing in a smooth path. Off uses a root-position stack in the selected octave."
        >
          <input
            type="checkbox"
            checked={voiceLeading}
            onChange={(e) => {
              const on = e.target.checked;
              setVoiceLeading(on);
              if (!on) onShowVoicing(null);
            }}
          />{' '}
          Voice leading
        </label>
        <span className="midi-sep" />
        <button className="btn-mini" onClick={play} disabled={progression.length === 0}>
          &#9654; Play
        </button>
        <button className="btn-mini" onClick={stop}>
          &#9632; Stop
        </button>
        <button
          type="button"
          className={identifyOn ? 'btn-mini active' : 'btn-mini'}
          aria-pressed={identifyOn}
          onClick={onToggleIdentify}
        >
          Identify
        </button>
        <button
          className="btn-mini"
          onClick={exportMidi}
          disabled={progression.length === 0}
          title="Download this progression as a .mid file (works without MIDI output)"
        >
          &#x2913; Export .mid
        </button>
        <span className="midi-sep" />
        <label className="checkbox-row">
          <input type="checkbox" checked={ghostScale} onChange={(e) => onGhostScale(e.target.checked)} /> Ghost key
          notes
        </label>
        <label className="checkbox-row" title="Keep the chord on the neck and mark its 3rd and 7th. A line shows their shortest step from the previous chord.">
          <input type="checkbox" checked={guideTones} onChange={(e) => onGuideTones(e.target.checked)} /> Guide tones
        </label>
      </div>
      {progression.length > 0 && <TabExport text={tabText} fileName={tabFileName} />}
      {voiceLeading && (
        <details className="vl-weights">
          <summary>Voice leading weights</summary>
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
                  value={weights.roleMotion[field.key]}
                  onChange={(e) => {
                    const value = snapToStep(Number(e.target.value), 0.1);
                    setWeights((w) => ({ ...w, roleMotion: { ...w.roleMotion, [field.key]: value } }));
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
                  value={weights[field.key]}
                  onChange={(e) => {
                    const value = snapToStep(Number(e.target.value), field.step);
                    setWeights((w) => ({ ...w, [field.key]: value }));
                  }}
                />
              </label>
            ))}
            <button type="button" className="btn-mini vl-weights-reset" onClick={() => setWeights(cloneWeights(DEFAULT_WEIGHTS))}>
              Reset
            </button>
          </div>
        </details>
      )}
      {voiceLeading && lead.error && <p className="prog-error">{lead.error}</p>}
    </div>
  );
}
