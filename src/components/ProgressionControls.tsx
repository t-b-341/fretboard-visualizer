import { useEffect, useRef, useState } from 'react';
import './ProgressionControls.css';
import {
  CHORD_QUALITIES,
  buildChord,
  buildDiatonicChord,
  chordInKey,
  chordSymbol,
  romanForChord,
} from '../music/chords';
import type { Chord, ChordQuality } from '../music/chords';
import { PROGRESSION_TEMPLATES, generateProgression, getTemplate } from '../music/progression';
import { chordToMidi, midiEngine, progressionToSmf } from '../audio/midi';
import { player } from '../audio/player';
import { synth } from '../audio/synth';
import { mod, noteName } from '../music/notes';

interface Props {
  /** Key centre (concert pitch class). */
  rootPc: number;
  /** Current scale intervals. */
  intervals: number[];
  /** Current scale pitch classes, for the in/out-of-key test. */
  scalePcs: number[];
  /** Label shift (concert vs standard). */
  shift: number;
  /** Whether the chord view is currently active (viewMode === 'chord'). */
  active: boolean;
  /** The chord currently shown on the instruments. */
  activeChord: Chord | null;
  ghostScale: boolean;
  /** Show a chord on the instruments (also switches into chord view). */
  onShowChord: (chord: Chord | null) => void;
  onGhostScale: (v: boolean) => void;
}

// Group the quality catalog into optgroups, preserving catalog order.
const QUALITY_GROUPS = (() => {
  const order: string[] = [];
  const map = new Map<string, typeof CHORD_QUALITIES>();
  for (const q of CHORD_QUALITIES) {
    if (!map.has(q.group)) {
      map.set(q.group, []);
      order.push(q.group);
    }
    map.get(q.group)!.push(q);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
})();

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v));

export function ProgressionControls(props: Props) {
  const { rootPc, intervals, scalePcs, shift, active, activeChord, ghostScale, onShowChord, onGhostScale } =
    props;

  const [, setTick] = useState(0);
  const [builderRootPc, setBuilderRootPc] = useState(rootPc);
  const [builderQuality, setBuilderQuality] = useState<ChordQuality>('maj');
  const [progression, setProgression] = useState<Chord[]>([]);
  const [playIndex, setPlayIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [tempo, setTempo] = useState(100);
  const [beatsPerChord, setBeatsPerChord] = useState(2);
  const [octave, setOctave] = useState(4);
  const [loop, setLoop] = useState(true);
  const [useSevenths, setUseSevenths] = useState(false);
  const [spicy, setSpicy] = useState(false);
  const [templateId, setTemplateId] = useState(PROGRESSION_TEMPLATES[0].id);

  const timerRef = useRef<number | null>(null);

  // Re-render when the MIDI engine's state changes (to reflect readiness).
  useEffect(() => midiEngine.subscribe(() => setTick((t) => t + 1)), []);

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
  };

  // Clean up timers / silence notes on unmount, and stop when leaving chord view.
  useEffect(() => () => stop(), []);
  useEffect(() => {
    if (!active) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const midiReady = midiEngine.enabled && !!midiEngine.outputId;
  // The built-in synth makes sound on its own; MIDI output is optional extra.
  const soundReady = synth.supported || midiReady;

  const noteOptions = Array.from({ length: 12 }, (_, d) => ({
    concertPc: mod(d - shift, 12),
    label: noteName(d),
  }));

  const builderChord = buildChord(builderRootPc, builderQuality);
  const diatonicChords = [0, 1, 2, 3, 4, 5, 6].map((d) => buildDiatonicChord(rootPc, intervals, d, useSevenths));
  const selectedIdx = activeChord ? progression.indexOf(activeChord) : -1;

  const voice = (chord: Chord): number[] => chordToMidi(chord.rootPc, chord.tones.map((t) => t.interval), octave);
  const hear = (chord: Chord, durationMs = 1000) => player.playChord(voice(chord), { durationMs });
  const preview = (chord: Chord) => {
    onShowChord(chord);
    hear(chord);
  };

  const setRoot = (pc: number) => {
    setBuilderRootPc(pc);
    onShowChord(buildChord(pc, builderQuality));
  };
  const setQuality = (q: ChordQuality) => {
    setBuilderQuality(q);
    onShowChord(buildChord(builderRootPc, q));
  };

  const addChord = (chord: Chord) => {
    setProgression((p) => [...p, chord]);
    onShowChord(chord);
  };
  const removeAt = (i: number) => setProgression((p) => p.filter((_, k) => k !== i));
  const clearProg = () => {
    stop();
    setProgression([]);
    setPlayIndex(-1);
  };

  const loadChords = (chords: Chord[]) => {
    stop();
    setProgression(chords);
    setPlayIndex(-1);
    if (chords[0]) onShowChord(chords[0]);
  };
  const genTemplate = () => {
    const t = getTemplate(templateId);
    if (t) loadChords(t.build({ rootPc, intervals }));
  };
  const genRandom = () =>
    loadChords(generateProgression({ rootPc, intervals }, { sevenths: useSevenths, chromaticism: spicy ? 0.35 : 0 }));

  const play = () => {
    const chords = progression;
    if (chords.length === 0) return;
    stopTimer();
    const dur = (60000 / tempo) * beatsPerChord;
    let i = 0;
    const fire = (idx: number) => {
      setPlayIndex(idx);
      onShowChord(chords[idx]);
      player.playChord(voice(chords[idx]), { durationMs: dur * 0.95 });
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
    const bytes = progressionToSmf(progression.map(voice), {
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

      {/* Chord builder: any root + any quality, in or out of key */}
      <div className="prog-row">
        <span className="prog-sublabel">Build</span>
        <label className="midi-field">
          Root
          <select value={builderRootPc} onChange={(e) => setRoot(Number(e.target.value))}>
            {noteOptions.map((o) => (
              <option key={o.concertPc} value={o.concertPc}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="midi-field">
          Quality
          <select value={builderQuality} onChange={(e) => setQuality(e.target.value as ChordQuality)}>
            {QUALITY_GROUPS.map((g) => (
              <optgroup key={g.group} label={g.group}>
                {g.items.map((q) => (
                  <option key={q.key} value={q.key}>
                    {q.symbol === '' ? 'maj' : q.symbol} &mdash; {q.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button className="btn-mini" onClick={() => preview(builderChord)}>
          Show
        </button>
        <button className="btn-mini" onClick={() => addChord(builderChord)}>
          Add &rarr;
        </button>
        <button className="btn-mini" onClick={() => hear(builderChord)} disabled={!soundReady}>
          &#9654; Hear
        </button>
      </div>

      {/* One-click diatonic chords of the current key */}
      <div className="prog-row">
        <span className="prog-sublabel">Diatonic</span>
        <div className="btn-row">
          {diatonicChords.map((ch, d) => (
            <button key={d} className="btn-mini" title={chordSymbol(ch, shift)} onClick={() => addChord(ch)}>
              {romanForChord(rootPc, ch)}
            </button>
          ))}
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={useSevenths} onChange={(e) => setUseSevenths(e.target.checked)} /> 7th
          chords
        </label>
      </div>

      {/* Generators */}
      <div className="prog-row">
        <span className="prog-sublabel">Generate</span>
        <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
          {PROGRESSION_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} &middot; {t.hint}
            </option>
          ))}
        </select>
        <button className="btn-mini" onClick={genTemplate}>
          Use template
        </button>
        <button className="btn-mini" onClick={genRandom}>
          Random
        </button>
        <label className="checkbox-row">
          <input type="checkbox" checked={spicy} onChange={(e) => setSpicy(e.target.checked)} /> Borrowed /
          secondary
        </label>
      </div>

      {/* The progression */}
      <div className="prog-chips">
        {progression.length === 0 && (
          <span className="muted">No chords yet &mdash; add some above or generate a progression.</span>
        )}
        {progression.map((ch, i) => {
          const out = !chordInKey(scalePcs, ch);
          const cls = [
            'prog-chip',
            i === playIndex ? 'playing' : '',
            i === selectedIdx && !playing ? 'selected' : '',
            out ? 'out' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <span key={i} className={cls}>
              <button
                className="prog-chip-main"
                onClick={() => preview(ch)}
                title={out ? 'Outside the key' : 'In key'}
              >
                <span className="prog-chip-symbol">{chordSymbol(ch, shift)}</span>
                <span className="prog-chip-roman">{romanForChord(rootPc, ch)}</span>
              </button>
              <button className="prog-chip-x" onClick={() => removeAt(i)} aria-label="Remove chord">
                &times;
              </button>
            </span>
          );
        })}
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
        <span className="midi-sep" />
        <button className="btn-mini" onClick={play} disabled={progression.length === 0}>
          &#9654; Play
        </button>
        <button className="btn-mini" onClick={stop}>
          &#9632; Stop
        </button>
        <button className="btn-mini" onClick={clearProg} disabled={progression.length === 0}>
          Clear
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
      </div>
    </div>
  );
}
