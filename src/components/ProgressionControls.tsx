import { useEffect, useMemo, useRef, useState } from 'react';
import './ProgressionControls.css';
import type { Chord, ChordToneRole } from '../music/chords';
import { midiEngine } from '../audio/midi';
import { synth } from '../audio/synth';
import { mod, noteName } from '../music/notes';
import type { GuitarString } from '../music/tunings';
import { DEFAULT_WEIGHTS, leadProgression } from '../music/voiceLeading';
import type { Weights } from '../music/voiceLeading';
import type { VoicedNote, Voicing, VoicingStyle } from '../music/voicings';

interface Props {
  /** Key centre (concert pitch class). */
  rootPc: number;
  /** Label shift (concert vs standard). */
  shift: number;
  /** Current guitar tuning. Voice leading places grips on these strings. */
  tuning: GuitarString[];
  /** Neck length and the frets currently in view. */
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
    positionWindow,
    session,
    loadId,
    onSessionChange,
    identifyOn,
    onToggleIdentify,
  } = props;

  const [, setTick] = useState(0);
  const [progression, setProgression] = useState<Chord[]>(session.chords);
  const [tempo, setTempo] = useState(session.tempo);
  const [beatsPerChord, setBeatsPerChord] = useState(session.beatsPerChord);
  const [octave, setOctave] = useState(session.octave);
  const [loop, setLoop] = useState(session.loop);
  const [useSevenths, setUseSevenths] = useState(session.useSevenths);
  const [spicy, setSpicy] = useState(session.spicy);
  const [templateId, setTemplateId] = useState(session.templateId);
  const [weights, setWeights] = useState<Weights>(() => cloneWeights(DEFAULT_WEIGHTS));

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

  // Replace the working progression when a saved setup is loaded.
  useEffect(() => {
    if (loadId === 0) return;
    setProgression(session.chords);
    setTempo(session.tempo);
    setBeatsPerChord(session.beatsPerChord);
    setOctave(session.octave);
    setLoop(session.loop);
    setUseSevenths(session.useSevenths);
    setSpicy(session.spicy);
    setTemplateId(session.templateId);
    // session is the snapshot captured for this loadId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadId]);

  const midiReady = midiEngine.enabled && !!midiEngine.outputId;
  const soundReady = synth.supported || midiReady;

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

  return (
    <div className="prog-bar">
      <div className="prog-head">
        <span className="midi-bar-label">Chords &amp; progressions</span>
        <span className="prog-key muted">Key centre: {noteName(mod(rootPc + shift, 12))}</span>
        {!soundReady && <span className="midi-note muted">Sound isn&rsquo;t available in this browser.</span>}
      </div>

      {/* Transport lives in the steps strip. Beats per step stays in settings state. */}
      <div className="prog-row">
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
        <button
          type="button"
          className={identifyOn ? 'btn-mini active' : 'btn-mini'}
          aria-pressed={identifyOn}
          onClick={onToggleIdentify}
        >
          Identify
        </button>
      </div>
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
      {lead.error && <p className="prog-error">{lead.error}</p>}
    </div>
  );
}
