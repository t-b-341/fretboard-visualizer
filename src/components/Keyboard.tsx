import type { Triad } from '../music/chords';
import type { DisplayMode, ViewMode } from '../App';
import { createEvaluator } from '../music/highlight';

interface Props {
  /** How many octaves of keys to draw (1 or 2). A trailing C is always added. */
  octaves: number;
  rootPc: number;
  intervals: number[];
  pcToIndex: Map<number, number>;
  viewMode: ViewMode;
  triad: Triad;
  displayMode: DisplayMode;
  shift: number;
  ghostScale: boolean;
  compareEnabled: boolean;
  comparePcSet: Set<number>;
  compareRootPc: number;
  sharedOnly: boolean;
}

const WHITE_W = 40;
const WHITE_H = 188;
const BLACK_W = 25;
const BLACK_H = 116;
const PAD_X = 14;
const PAD_TOP = 14;
const PAD_BOTTOM = 14;
const R = 13;

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
  const { octaves } = props;
  const evaluate = createEvaluator(props);

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

  const blackKeys: { key: string; pc: number; x: number }[] = [];
  for (let o = 0; o < octaves; o++) {
    for (const b of BLACK_KEYS) {
      blackKeys.push({ key: `b-${o}-${b.pc}`, pc: b.pc, x: whiteX(o * 7 + b.pos) - BLACK_W / 2 });
    }
  }

  // Dots sit low on each key so they read clearly and never overlap each other.
  const whiteDotY = PAD_TOP + WHITE_H - 26;
  const blackDotY = PAD_TOP + BLACK_H - 22;

  const renderDot = (key: string, cx: number, cy: number, pc: number) => {
    const ev = evaluate(pc);
    if (!ev) return null;
    if (ev.role === 'ghost') {
      return <circle key={key} className="note-ghost" cx={cx} cy={cy} r={4.5} />;
    }
    return (
      <g key={key}>
        <circle className={`note note-${ev.role}`} cx={cx} cy={cy} r={R} />
        {ev.ring && <circle className="note-root-ring" cx={cx} cy={cy} r={R + 3} />}
        {ev.outside && <circle className="note-outside-ring" cx={cx} cy={cy} r={R + 3} />}
        <text
          className={`note-label note-label-${ev.role}`}
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

  return (
    <div className="keyboard-wrap">
      <svg
        className="keyboard"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Keyboard diagram"
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
          />
        ))}

        {/* Note markers */}
        {whiteKeys.map((k) => renderDot(`wd-${k.i}`, k.x + WHITE_W / 2, whiteDotY, k.pc))}
        {blackKeys.map((k) => renderDot(`${k.key}-dot`, k.x + BLACK_W / 2, blackDotY, k.pc))}
      </svg>
    </div>
  );
}
