import { useEffect, useMemo, useRef } from 'react';
import type { Cell } from '../music/fretboard';
import type { GuitarString } from '../music/tunings';
import type { Chord, Triad } from '../music/chords';
import type { DisplayMode, ViewMode } from '../music/types';
import { mod, noteName } from '../music/notes';
import { createEvaluator, noteFillClass, noteTextClass } from '../music/highlight';
import { guideTonePcs, placeGuideVoices } from '../music/guide';
import type { GuidePoint } from '../music/guide';

interface CellRef {
  stringIndex: number;
  fret: number;
}

interface Props {
  grid: Cell[][];
  tuning: GuitarString[];
  fretCount: number;
  fretFrom: number;
  fretTo: number;
  hiddenStrings: number[];
  leftHanded: boolean;
  /** Cells to keep when a position box or voicing is active. Null shows every lit note. */
  onlyCells: CellRef[] | null;
  guideTones: boolean;
  rootPc: number;
  intervals: number[];
  pcToIndex: Map<number, number>;
  viewMode: ViewMode;
  triad: Triad;
  activeChord: Chord | null;
  displayMode: DisplayMode;
  shift: number;
  ghostScale: boolean;
  compareEnabled: boolean;
  comparePcSet: Set<number>;
  compareRootPc: number;
  sharedOnly: boolean;
  colorByDegree: boolean;
  clickToHear: boolean;
  onPlay: (midi: number) => void;
  caption?: string | null;
  /** Spelled note names keyed by displayed pitch class. */
  spelling?: ReadonlyMap<number, string> | null;
  /** Pitch classes of this chord's guide tones, when that overlay is on. */
  guidePcs?: Set<number> | null;
  /**
   * When set, only these "stringIndex:fret" cells draw as chord tones.
   * Every other cell is a ghost scale tone, or nothing.
   */
  activeCells?: Set<string>;
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

export function Fretboard(props: Props) {
  const {
    grid,
    tuning,
    fretFrom,
    fretTo,
    hiddenStrings,
    leftHanded,
    onlyCells,
    guideTones,
    rootPc,
    intervals,
    pcToIndex,
    viewMode,
    triad,
    activeChord,
    displayMode,
    shift,
    ghostScale,
    compareEnabled,
    comparePcSet,
    compareRootPc,
    sharedOnly,
    colorByDegree,
    clickToHear,
    onPlay,
    caption,
    spelling,
    guidePcs,
    activeCells,
  } = props;

  const hidden = useMemo(() => new Set(hiddenStrings), [hiddenStrings]);
  const visible = tuning.map((_, i) => i).filter((i) => !hidden.has(i));
  const from = Math.max(0, Math.min(fretFrom, fretTo));
  const to = Math.max(from, fretTo);
  const showOpen = from === 0;
  const spaces = showOpen ? to : to - from + 1;

  const numVisible = Math.max(1, visible.length);
  const width = NUT_X + Math.max(spaces, 0) * FRET_W + RIGHT_PAD;
  const height = PAD_TOP + (numVisible - 1) * ROW_H + PAD_BOTTOM;

  const stringY = (si: number) => {
    const rank = visible.indexOf(si);
    if (rank < 0) return PAD_TOP;
    return PAD_TOP + (numVisible - 1 - rank) * ROW_H;
  };
  const topY = stringY(visible[visible.length - 1] ?? 0);
  const botY = stringY(visible[0] ?? 0);
  const midY = (topY + botY) / 2;

  const boardLeft = NUT_X;
  const noteX = (fret: number) => {
    if (fret === 0) return OPEN_X;
    const spaceIndex = fret - (showOpen ? 1 : from);
    return boardLeft + (spaceIndex + 0.5) * FRET_W;
  };
  const fretLineX = (wire: number) => {
    const leftWire = showOpen ? 0 : from - 1;
    return boardLeft + (wire - leftWire) * FRET_W;
  };

  // Mirror x so the nut sits on the right. Text is drawn unflipped at the new x.
  const X = (x: number) => (leftHanded ? width - x : x);
  const rectX = (x: number, w: number) => (leftHanded ? width - x - w : x);

  const evaluate = createEvaluator({
    rootPc,
    intervals,
    pcToIndex,
    viewMode,
    triad,
    activeChord,
    displayMode,
    shift,
    ghostScale,
    compareEnabled,
    comparePcSet,
    compareRootPc,
    sharedOnly,
    spelling,
  });

  const degreeColors = colorByDegree && viewMode === 'scale' && !compareEnabled;
  const guideActive = guideTones && viewMode === 'chord' && !!activeChord;
  const chordId = activeChord
    ? `${activeChord.rootPc}:${activeChord.symbol}:${activeChord.tones.map((t) => t.interval).join(',')}`
    : '';

  const prevPoints = useRef<GuidePoint[] | null>(null);
  const prevChordId = useRef('');

  const onlyKeys = useMemo(() => {
    if (!onlyCells) return null;
    return new Set(onlyCells.map((c) => `${c.stringIndex}:${c.fret}`));
  }, [onlyCells]);

  const guideVoices = useMemo(() => {
    if (!guideActive || !activeChord) return [];
    const pcs = guideTonePcs(activeChord);
    const candidates: GuidePoint[] = [];
    for (const row of grid) {
      for (const cell of row) {
        if (hidden.has(cell.stringIndex)) continue;
        if (cell.fret < from || cell.fret > to) continue;
        if (onlyKeys && !onlyKeys.has(`${cell.stringIndex}:${cell.fret}`)) continue;
        if (!pcs.includes(cell.pc)) continue;
        candidates.push({ stringIndex: cell.stringIndex, fret: cell.fret, pc: cell.pc });
      }
    }
    const link = prevChordId.current !== '' && prevChordId.current !== chordId;
    return placeGuideVoices(candidates, pcs, link ? prevPoints.current : null, Math.round((from + to) / 2));
    // prevPoints is read on purpose: it holds the previous chord's spots, written after paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideActive, chordId, grid, from, to, hiddenStrings, activeChord, onlyCells]);

  useEffect(() => {
    prevChordId.current = chordId;
    prevPoints.current = guideVoices.map((v) => v.point);
  }, [guideVoices, chordId]);

  const allow = onlyKeys;

  const wires: number[] = [];
  if (showOpen) {
    for (let w = 0; w <= to; w++) wires.push(w);
  } else {
    for (let w = from - 1; w <= to; w++) wires.push(w);
  }
  const fretNums: number[] = [];
  for (let f = from; f <= to; f++) fretNums.push(f);

  const play = (midi: number) => {
    if (clickToHear) onPlay(midi);
  };

  return (
    <div className="fretboard-wrap">
      {caption && <div className="board-caption">{caption}</div>}
      {visible.length === 0 ? (
        <p className="board-caption">Show at least one string.</p>
      ) : (
        <svg
          className="fretboard"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="group"
          aria-label="Fretboard diagram"
        >
          <rect
            className="board"
            x={rectX(NUT_X, Math.max(spaces, 0) * FRET_W)}
            y={topY - 14}
            width={Math.max(spaces, 0) * FRET_W}
            height={(numVisible - 1) * ROW_H + 28}
            rx={5}
          />

          {INLAY_SINGLE.filter((f) => f >= from && f <= to && f > 0).map((f) => (
            <circle key={`i-${f}`} className="inlay" cx={X(noteX(f))} cy={midY} r={5} />
          ))}
          {INLAY_DOUBLE.filter((f) => f >= from && f <= to).map((f) =>
            numVisible < 3 ? (
              <circle key={`i2-${f}`} className="inlay" cx={X(noteX(f))} cy={midY} r={5} />
            ) : (
              <g key={`i2-${f}`}>
                <circle className="inlay" cx={X(noteX(f))} cy={midY - ROW_H} r={5} />
                <circle className="inlay" cx={X(noteX(f))} cy={midY + ROW_H} r={5} />
              </g>
            ),
          )}

          {wires.map((w) => (
            <line
              key={`f-${w}`}
              className={w === 0 ? 'nut' : 'fret'}
              x1={X(fretLineX(w))}
              y1={topY}
              x2={X(fretLineX(w))}
              y2={botY}
            />
          ))}

          {visible.map((si) => (
            <line
              key={`s-${si}`}
              className="string"
              x1={X(NUT_X)}
              y1={stringY(si)}
              x2={X(fretLineX(showOpen ? to : to))}
              y2={stringY(si)}
              strokeWidth={1 + (tuning.length - 1 - si) * 0.25}
            />
          ))}

          {visible.map((si) => (
            <text
              key={`t-${si}`}
              className="tuning-label"
              x={X(LEFT_LABEL_X)}
              y={stringY(si)}
              textAnchor={leftHanded ? 'end' : 'start'}
              dominantBaseline="central"
            >
              {noteName(mod(tuning[si].pc + shift, 12))}
            </text>
          ))}

          {fretNums.map((f) => (
            <text key={`fn-${f}`} className="fret-number" x={X(noteX(f))} y={height - 16} textAnchor="middle">
              {f}
            </text>
          ))}

          {guideActive &&
            guideVoices.map((voice, i) => {
              if (!voice.from) return null;
              if (hidden.has(voice.from.stringIndex) || hidden.has(voice.point.stringIndex)) return null;
              if (voice.from.fret < from || voice.from.fret > to) return null;
              if (voice.point.fret < from || voice.point.fret > to) return null;
              return (
                <line
                  key={`g-${i}`}
                  className="guide-line"
                  x1={X(noteX(voice.from.fret))}
                  y1={stringY(voice.from.stringIndex)}
                  x2={X(noteX(voice.point.fret))}
                  y2={stringY(voice.point.stringIndex)}
                />
              );
            })}

          {grid.map((row) =>
            row.map((cell) => {
              if (hidden.has(cell.stringIndex)) return null;
              if (cell.fret < from || cell.fret > to) return null;
              if (allow && !allow.has(`${cell.stringIndex}:${cell.fret}`)) return null;
              const cellKey = `${cell.stringIndex}:${cell.fret}`;
              const ev = activeCells
                ? evaluate(cell.pc, { placed: activeCells.has(cellKey) })
                : evaluate(cell.pc);
              if (!ev) return null;
              const x = X(noteX(cell.fret));
              const y = stringY(cell.stringIndex);
              const key = `n-${cell.stringIndex}-${cell.fret}`;
              if (ev.role === 'ghost') {
                return (
                  <g key={key} className={clickToHear ? 'note-hit' : undefined} onClick={() => play(cell.midi)}>
                    <circle className="note-ghost" cx={x} cy={y} r={4.5} />
                    {clickToHear && <circle className="note-target" cx={x} cy={y} r={R} />}
                  </g>
                );
              }
              return (
                <g
                  key={key}
                  className={clickToHear ? 'note-hit' : undefined}
                  onClick={() => play(cell.midi)}
                >
                  <circle className={noteFillClass(ev, degreeColors)} cx={x} cy={y} r={R} />
                  {ev.ring && <circle className="note-root-ring" cx={x} cy={y} r={R + 3} />}
                  {guidePcs?.has(cell.pc) && <circle className="note-guide-ring" cx={x} cy={y} r={R + 4} />}
                  {ev.outside && <circle className="note-outside-ring" cx={x} cy={y} r={R + 3} />}
                  <text
                    className={noteTextClass(ev, degreeColors)}
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
      )}
    </div>
  );
}
