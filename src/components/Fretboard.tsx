import type { Cell } from '../music/fretboard';
import type { GuitarString } from '../music/tunings';
import type { Triad } from '../music/chords';
import type { DisplayMode, ViewMode } from '../App';
import { mod, noteName } from '../music/notes';
import { scaleDegreeLabel } from '../music/scales';

interface Props {
  grid: Cell[][];
  tuning: GuitarString[];
  fretCount: number;
  rootPc: number;
  intervals: number[];
  pcToIndex: Map<number, number>;
  viewMode: ViewMode;
  triad: Triad;
  displayMode: DisplayMode;
  shift: number;
  ghostScale: boolean;
}

const INLAY_SINGLE = [3, 5, 7, 9, 15, 17, 19, 21];
const INLAY_DOUBLE = [12, 24];

const ROW_H = 36;
const FRET_W = 56;
const PAD_TOP = 28;
const PAD_BOTTOM = 44;
const LEFT_LABEL_X = 16;
const OPEN_X = 56;
const NUT_X = 92;
const RIGHT_PAD = 24;
const R = 13;

type Role = 'root' | 'third' | 'fifth' | 'scale' | 'ghost';

export function Fretboard(props: Props) {
  const {
    grid,
    tuning,
    fretCount,
    rootPc,
    intervals,
    pcToIndex,
    viewMode,
    triad,
    displayMode,
    shift,
    ghostScale,
  } = props;

  const numStrings = tuning.length;
  const width = NUT_X + fretCount * FRET_W + RIGHT_PAD;
  const height = PAD_TOP + (numStrings - 1) * ROW_H + PAD_BOTTOM;

  const stringY = (si: number) => PAD_TOP + (numStrings - 1 - si) * ROW_H;
  const topY = stringY(numStrings - 1);
  const botY = stringY(0);
  const midY = (topY + botY) / 2;
  const noteX = (fret: number) => (fret === 0 ? OPEN_X : NUT_X + (fret - 0.5) * FRET_W);
  const fretLineX = (f: number) => NUT_X + f * FRET_W;

  function evaluate(pc: number): { role: Role; label: string } | null {
    const idx = pcToIndex.get(pc);
    const inScale = idx !== undefined;

    const labelFor = (): string =>
      displayMode === 'note'
        ? noteName(mod(pc + shift, 12))
        : scaleDegreeLabel(intervals, idx as number);

    if (viewMode === 'scale') {
      if (!inScale) return null;
      return { role: pc === rootPc ? 'root' : 'scale', label: labelFor() };
    }

    // Triad view
    let role: Role | null = null;
    if (pc === triad.pitches[0]) role = 'root';
    else if (pc === triad.pitches[1]) role = 'third';
    else if (pc === triad.pitches[2]) role = 'fifth';

    if (role) return { role, label: labelFor() };
    if (inScale && ghostScale) return { role: 'ghost', label: '' };
    return null;
  }

  return (
    <div className="fretboard-wrap">
      <svg
        className="fretboard"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Fretboard diagram"
      >
        <rect
          className="board"
          x={NUT_X}
          y={topY - 14}
          width={fretCount * FRET_W}
          height={(numStrings - 1) * ROW_H + 28}
          rx={5}
        />

        {/* Inlays */}
        {INLAY_SINGLE.filter((f) => f <= fretCount).map((f) => (
          <circle key={`i-${f}`} className="inlay" cx={NUT_X + (f - 0.5) * FRET_W} cy={midY} r={5} />
        ))}
        {INLAY_DOUBLE.filter((f) => f <= fretCount).map((f) => (
          <g key={`i2-${f}`}>
            <circle className="inlay" cx={NUT_X + (f - 0.5) * FRET_W} cy={midY - ROW_H} r={5} />
            <circle className="inlay" cx={NUT_X + (f - 0.5) * FRET_W} cy={midY + ROW_H} r={5} />
          </g>
        ))}

        {/* Frets (fret 0 = nut) */}
        {Array.from({ length: fretCount + 1 }, (_, f) => (
          <line
            key={`f-${f}`}
            className={f === 0 ? 'nut' : 'fret'}
            x1={fretLineX(f)}
            y1={topY}
            x2={fretLineX(f)}
            y2={botY}
          />
        ))}

        {/* Strings (thicker toward the low strings) */}
        {tuning.map((_, i) => (
          <line
            key={`s-${i}`}
            className="string"
            x1={NUT_X}
            y1={stringY(i)}
            x2={fretLineX(fretCount)}
            y2={stringY(i)}
            strokeWidth={1 + (numStrings - 1 - i) * 0.25}
          />
        ))}

        {/* Open-string tuning labels at the far left */}
        {tuning.map((str, i) => (
          <text
            key={`t-${i}`}
            className="tuning-label"
            x={LEFT_LABEL_X}
            y={stringY(i)}
            textAnchor="start"
            dominantBaseline="central"
          >
            {noteName(mod(str.pc + shift, 12))}
          </text>
        ))}

        {/* Fret numbers */}
        {Array.from({ length: fretCount + 1 }, (_, f) => (
          <text key={`fn-${f}`} className="fret-number" x={noteX(f)} y={height - 16} textAnchor="middle">
            {f}
          </text>
        ))}

        {/* Notes */}
        {grid.map((row, si) =>
          row.map((cell) => {
            const ev = evaluate(cell.pc);
            if (!ev) return null;
            const x = noteX(cell.fret);
            const y = stringY(si);
            if (ev.role === 'ghost') {
              return (
                <circle key={`n-${si}-${cell.fret}`} className="note-ghost" cx={x} cy={y} r={4.5} />
              );
            }
            return (
              <g key={`n-${si}-${cell.fret}`}>
                <circle className={`note note-${ev.role}`} cx={x} cy={y} r={R} />
                <text
                  className={`note-label note-label-${ev.role}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {ev.label}
                </text>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
