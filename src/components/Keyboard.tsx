import type { ViewMode } from '../music/types';
import { noteFillClass, noteTextClass, type NoteHighlight } from '../music/highlight';
import { keyboardWindow } from '../music/keys';
import { pitchName } from '../music/notes';

interface Props {
  /** How many octaves of keys to draw. 3 is a 37-key controller (C to C). */
  octaves: 1 | 2 | 3;
  viewMode: ViewMode;
  compareEnabled: boolean;
  colorByDegree: boolean;
  clickToHear: boolean;
  /** Pitch classes of this chord's guide tones, when that overlay is on. */
  guidePcs?: Set<number> | null;
  /** MIDI note of the lowest C. Octave 4 → 60, the same numbering as the sound bar. */
  lowestMidi: number;
  onPlay: (midi: number) => void;
  /** While interval reference is armed, a click sets or clears that pitch class. */
  onReference?: (pc: number) => void;
  /** Pitch-class highlight. A voicing passes `placed` for its exact MIDI notes. */
  evaluate: (pc: number, opts?: { placed?: boolean; midi?: number }) => NoteHighlight | null;
  /** Exact keys of the current voicing. Omit to light every matching pitch class. */
  voicingMidis?: readonly number[] | null;
  /** MIDI notes held from an input, drawn on the key with that exact number. */
  showPlayed?: boolean;
  playedMidis?: ReadonlySet<number>;
}

const WHITE_W = 40;
const WHITE_H = 188;
const BLACK_W = 25;
const BLACK_H = 116;
const PAD_X = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 28;
const R = 13;
const NO_PLAYED: ReadonlySet<number> = new Set();

function PlayedMark({ x, y, on }: { x: number; y: number; on: boolean }) {
  if (!on) return null;
  return (
    <g className="played-mark">
      <circle className="note-played-edge" cx={x} cy={y} r={R + 3} />
      <circle className="note-played" cx={x} cy={y} r={R + 3} />
    </g>
  );
}
const WHITE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

// Pitch classes of the white keys within one octave: C D E F G A B.
const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
// Black keys: pitch class + the white-key boundary index (within an octave)
// that the key is centred on. Positions 0 and 3 (E|F and B|C) have no black key.
const BLACK_KEYS = [
  { pc: 1, pos: 1 }, // Db / C#
  { pc: 3, pos: 2 }, // Eb / D#
  { pc: 6, pos: 4 }, // Gb / F#
  { pc: 8, pos: 5 }, // Ab / G#
  { pc: 10, pos: 6 }, // Bb / A#
];

export function Keyboard(props: Props) {
  const {
    octaves,
    colorByDegree,
    clickToHear,
    lowestMidi,
    onPlay,
    onReference,
    viewMode,
    compareEnabled,
    guidePcs,
    evaluate,
    voicingMidis = null,
    showPlayed = false,
    playedMidis = NO_PLAYED,
  } = props;
  const degreeColors = colorByDegree && viewMode === 'scale' && !compareEnabled;
  const play = (midi: number) => {
    if (clickToHear) onPlay(midi);
  };
  const press = (midi: number) => {
    onReference?.(midi % 12);
    play(midi);
  };
  const keyWindow = keyboardWindow(octaves, lowestMidi);
  const placed = voicingMidis ? new Set(voicingMidis) : null;
  const guideByMidi = new Map<number, NoteHighlight>();
  const top = keyWindow.lowest + keyWindow.keyCount;
  for (let midi = keyWindow.lowest; midi < top; midi++) {
    if (midi < 0 || midi > 127) continue;
    const highlight = placed
      ? evaluate(midi % 12, { placed: placed.has(midi), midi })
      : evaluate(midi % 12);
    if (highlight) guideByMidi.set(midi, highlight);
  }
  const midiFor = (octaveOffset: number, pc: number) => lowestMidi + octaveOffset * 12 + pc;

  // Full octaves of 7 white keys, plus a trailing C to close the top octave.
  const whiteCount = 7 * octaves + 1;
  const width = PAD_X * 2 + whiteCount * WHITE_W;
  const height = PAD_TOP + WHITE_H + PAD_BOTTOM;

  const whiteX = (i: number) => PAD_X + i * WHITE_W;

  const whiteKeys = Array.from({ length: whiteCount }, (_, i) => ({
    i,
    pc: WHITE_PCS[i % 7],
    x: whiteX(i),
  }));

  const blackKeys: { key: string; pc: number; octave: number; x: number }[] = [];
  for (let o = 0; o < octaves; o++) {
    for (const b of BLACK_KEYS) {
      blackKeys.push({
        key: `b-${o}-${b.pc}`,
        pc: b.pc,
        octave: o,
        x: whiteX(o * 7 + b.pos) - BLACK_W / 2,
      });
    }
  }

  // Dots sit low on each key so they read clearly and never overlap each other.
  const whiteDotY = PAD_TOP + WHITE_H - 26;
  const blackDotY = PAD_TOP + BLACK_H - 22;

  const renderDot = (key: string, cx: number, cy: number, midi: number) => {
    const ev: NoteHighlight | undefined = guideByMidi.get(midi);
    if (!ev) return null;
    if (ev.role === 'ghost') {
      return (
        <g key={key} className="key-dot">
          <circle className="note-ghost" cx={cx} cy={cy} r={4.5} />
          {ev.reference && <circle className="note-reference-ring" cx={cx} cy={cy} r={9} />}
        </g>
      );
    }
    return (
      <g key={key} className="key-dot" data-midi={midi}>
        <circle className={noteFillClass(ev, degreeColors)} cx={cx} cy={cy} r={R} />
        {ev.ring && <circle className="note-root-ring" cx={cx} cy={cy} r={R + 3} />}
        {ev.reference && <circle className="note-reference-ring" cx={cx} cy={cy} r={R + 6} />}
        {guidePcs?.has(midi % 12) && <circle className="note-guide-ring" cx={cx} cy={cy} r={R + 4} />}
        {ev.outside && <circle className="note-outside-ring" cx={cx} cy={cy} r={R + 3} />}
        <text
          className={noteTextClass(ev, degreeColors)}
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {ev.label}
        </text>
      </g>
    );
  };

  const rangeLabel = `${pitchName(keyWindow.lowest)}–${pitchName(keyWindow.lowest + keyWindow.keyCount - 1)}`;

  return (
    <div className="keyboard-wrap">
      {keyWindow.keyCount === 37 && (
        <p className="keyboard-caption">37 keys · {rangeLabel}</p>
      )}
      <svg
        className={clickToHear || onReference ? 'keyboard keys-live' : 'keyboard'}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label={keyWindow.keyCount === 37 ? `37-key keyboard, ${rangeLabel}` : 'Keyboard diagram'}
      >
        {/* White keys */}
        {whiteKeys.map((k) => (
          <rect
            key={`w-${k.i}`}
            className="pkey-white"
            x={k.x}
            y={PAD_TOP}
            width={WHITE_W}
            height={WHITE_H}
            rx={5}
            onClick={() => press(midiFor(Math.floor(k.i / 7), k.pc))}
          />
        ))}

        {/* Black keys (drawn over the white keys) */}
        {blackKeys.map((k) => (
          <rect
            key={k.key}
            className="pkey-black"
            x={k.x}
            y={PAD_TOP}
            width={BLACK_W}
            height={BLACK_H}
            rx={4}
            onClick={() => press(midiFor(k.octave, k.pc))}
          />
        ))}

        {/* Note markers — taken from the guide for this key window */}
        {whiteKeys.map((k) =>
          renderDot(`wd-${k.i}`, k.x + WHITE_W / 2, whiteDotY, midiFor(Math.floor(k.i / 7), k.pc)),
        )}
        {blackKeys.map((k) =>
          renderDot(`${k.key}-dot`, k.x + BLACK_W / 2, blackDotY, midiFor(k.octave, k.pc)),
        )}

        {showPlayed &&
          whiteKeys.map((k) => (
            <PlayedMark
              key={`wp-${k.i}`}
              x={k.x + WHITE_W / 2}
              y={whiteDotY}
              on={playedMidis.has(midiFor(Math.floor(k.i / 7), k.pc))}
            />
          ))}
        {showPlayed &&
          blackKeys.map((k) => (
            <PlayedMark
              key={`${k.key}-played`}
              x={k.x + BLACK_W / 2}
              y={blackDotY}
              on={playedMidis.has(midiFor(k.octave, k.pc))}
            />
          ))}

        {/* Pitch of each white key, the way fret numbers mark the neck. C carries its octave. */}
        {whiteKeys.map((k) => {
          const midi = midiFor(Math.floor(k.i / 7), k.pc);
          const letter = WHITE_LETTERS[k.i % 7];
          return (
            <text
              key={`kn-${k.i}`}
              className="fret-number"
              x={k.x + WHITE_W / 2}
              y={PAD_TOP + WHITE_H + 16}
              textAnchor="middle"
            >
              {k.pc === 0 ? pitchName(midi) : letter}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
