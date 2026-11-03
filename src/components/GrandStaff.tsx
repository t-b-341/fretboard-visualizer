import { useEffect, useState } from 'react';
import type { Chord } from '../music/chords';
import { noteFillClass, type NoteHighlight } from '../music/highlight';
import { mod } from '../music/notes';
import {
  BASS_BOTTOM_STEP,
  BASS_TOP_STEP,
  TREBLE_BOTTOM_STEP,
  TREBLE_TOP_STEP,
  bassStaffOriginShift,
  keySignatureSpots,
  measuresPerSystem,
  octaveMark,
  staffLayoutFor,
  wrapMeasures,
  type LayoutNote,
  type StaffLayout,
  type StaffName,
  type StaffSystem,
} from '../music/staff';
import type { LabelMode, ViewMode } from '../music/types';
import { BASS_CLEF, BRAVURA_SPACE, TREBLE_CLEF } from './clefs';

interface MeasureInput {
  chord: Chord;
  voicingMidis: number[] | null;
  /** Chord symbol already shifted for Names. */
  symbol: string;
}

interface Props {
  viewMode: ViewMode;
  rootPc: number;
  intervals: number[];
  chord: Chord | null;
  /** Sounding notes of the grip on the neck, when one grip is selected. */
  voicingMidis: number[] | null;
  pickedMidis: number[];
  guitarWritten: boolean;
  /** Guitar writes on treble. 6-string bass writes on bass. */
  writtenStaff: StaffName;
  labelMode: LabelMode;
  colorByDegree: boolean;
  compareEnabled: boolean;
  clickToHear: boolean;
  evaluate: (pc: number, opts?: { placed?: boolean; midi?: number }) => NoteHighlight | null;
  onPlay: (midi: number) => void;
  /** While interval reference is armed, a click sets or clears that pitch class. */
  onReference?: (pc: number) => void;
  /** Every step, when the staff should show one measure per step. */
  measures?: MeasureInput[] | null;
  currentMeasure?: number;
  onSelectMeasure?: (index: number) => void;
  /** Scale name drawn on the single scale measure. */
  scaleLabel?: string;
  /** Dim every measure except the current one. */
  dimRest?: boolean;
  /** Index of the written scale note that is sounding. */
  soundingDegree?: number | null;
}

const STEP = 6;
const HEAD_RX = 7.6;
const HEAD_RY = 5.2;
const EIGHTH_RX = 5.5;
const EIGHTH_RY = 4;
const HEAD_SHIFT = 13;
const CLEF_W = 46;
const SIG_W = 14;
const ACC_W = 15;
const RIGHT = 18;
const MIN_MEASURE = 84;
const NARROW_QUERY = '(max-width: 900px)';

/** G4, the treble clef's curl. Two steps above the treble bottom line E4. */
const G_LINE = TREBLE_BOTTOM_STEP + 2;
/** F3, the bass clef's dots. Six steps above the bass bottom line G2. */
const F_LINE = BASS_BOTTOM_STEP + 6;

interface DrawnMeasure {
  index: number;
  symbol: string;
  current: boolean;
  layout: StaffLayout;
}

interface MeasureBox extends DrawnMeasure {
  left: number;
  notesLeft: number;
  right: number;
  span: number;
}

interface Frame {
  system: StaffSystem;
  yOf: (step: number, staff: StaffName) => number;
  top: number;
  bottom: number;
  height: number;
}

function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = () => setNarrow(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

function staffAria(symbol: string, layout: StaffLayout): string {
  const names = layout.notes.map((note) => note.written.name).join(' ');
  if (symbol && names) return `Staff, ${symbol}: ${names}`;
  if (names) return `Staff: ${names}`;
  if (symbol) return `Staff, ${symbol}`;
  return 'Staff';
}

function SharpGlyph() {
  return (
    <g fill="currentColor">
      <polygon points="-4.1,-11.2 -2.4,-11.2 -4.5,11.2 -6.2,11.2" />
      <polygon points="2.3,-11.2 4,-11.2 1.9,11.2 0.2,11.2" />
      <polygon points="-7.5,-3.2 6.4,-7 6.4,-4.1 -7.5,-0.3" />
      <polygon points="-7.5,2.6 6.4,-1.2 6.4,1.7 -7.5,5.5" />
    </g>
  );
}

function FlatGlyph() {
  return (
    <g fill="currentColor">
      <rect x="-1.55" y="-17.5" width="1.85" height="22" rx="0.4" />
      <path d="M0.3 -1.6 C6.6 -1.2 7.2 7.4 0.5 8 C-0.7 8.1 -1.55 6.7 -1.55 5.2 L0.3 5.2 C0.55 6.1 1.7 6.5 2.8 5.6 C5.1 3.8 4.8 0.2 0.3 0 Z" />
    </g>
  );
}

function NaturalGlyph() {
  return (
    <g fill="currentColor">
      <polygon points="-4.5,-10.4 -2.8,-10.4 -4.1,10.4 -5.8,10.4" />
      <polygon points="2.5,-10.4 4.2,-10.4 2.9,10.4 1.2,10.4" />
      <polygon points="-6.3,-1.2 4.5,-4.5 4.5,-1.8 -6.3,1.5" />
      <polygon points="-6.6,3.4 4.2,0.1 4.2,2.8 -6.6,6.1" />
    </g>
  );
}

function AccidentalMark({ value, x, y }: { value: number; x: number; y: number }) {
  const count = value === 0 ? 1 : Math.min(Math.abs(value), 3);
  const Glyph = value === 0 ? NaturalGlyph : value > 0 ? SharpGlyph : FlatGlyph;
  const span = 9;
  const origin = -((count - 1) * span) / 2;
  const bowl = value < 0 ? -3.2 : 0;
  return (
    <g className="staff-ink" transform={`translate(${x} ${y + bowl})`}>
      {Array.from({ length: count }, (_, i) => (
        <g key={i} transform={`translate(${origin + i * span} 0)`}>
          <Glyph />
        </g>
      ))}
    </g>
  );
}

function Clef({ name, x, y }: { name: StaffName; x: number; y: number }) {
  const scale = (STEP * 2) / BRAVURA_SPACE;
  return (
    <g className={`staff-clef staff-clef-${name}`} transform={`translate(${x} ${y}) scale(${scale} ${-scale})`}>
      <path d={name === 'treble' ? TREBLE_CLEF : BASS_CLEF} />
    </g>
  );
}

function Brace({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  const mid = (top + bottom) / 2;
  const tip = x - 14;
  const d = [
    `M ${x} ${top}`,
    `C ${x - 11} ${top + 22}, ${x - 8} ${mid - 36}, ${tip + 3} ${mid - 8}`,
    `Q ${tip - 4} ${mid}, ${tip + 3} ${mid + 8}`,
    `C ${x - 8} ${mid + 36}, ${x - 11} ${bottom - 22}, ${x} ${bottom}`,
  ].join(' ');
  return <path className="staff-brace" d={d} />;
}

function StaffLines({
  staff,
  x1,
  x2,
  yOf,
}: {
  staff: StaffName;
  x1: number;
  x2: number;
  yOf: (step: number, staff: StaffName) => number;
}) {
  const bottom = staff === 'treble' ? TREBLE_BOTTOM_STEP : BASS_BOTTOM_STEP;
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => {
        const y = yOf(bottom + i * 2, staff);
        return <line key={i} className="staff-line" data-staff={staff} x1={x1} y1={y} x2={x2} y2={y} />;
      })}
    </>
  );
}

function stavesOf(system: StaffSystem): StaffName[] {
  if (system === 'grand') return ['treble', 'bass'];
  return system === 'bass' ? ['bass'] : ['treble'];
}

/**
 * Pixel frame for one system. Bass notes on a grand staff use bassStaffOriginShift
 * and nothing else, so a ledger line keeps the staffStep placeNotes already chose.
 */
function frameFor(layouts: StaffLayout[], y0: number): Frame {
  const system = layouts[0]?.system ?? 'grand';
  const clefEight = layouts.some((layout) => layout.clefEight);
  const upper: StaffName = system === 'bass' ? 'bass' : 'treble';
  const upperTop = upper === 'bass' ? BASS_TOP_STEP : TREBLE_TOP_STEP;
  const upperBottom = upper === 'bass' ? BASS_BOTTOM_STEP : TREBLE_BOTTOM_STEP;
  let upperHi = upperTop;
  let upperLo = upperBottom;
  let bassLo = BASS_BOTTOM_STEP;
  let ottavaAbove = false;
  let ottavaBelow = false;

  for (const layout of layouts) {
    for (const note of layout.notes) {
      if (note.octaveShift < 0) ottavaAbove = true;
      if (note.octaveShift > 0) ottavaBelow = true;
      const steps = [note.drawStep, ...note.ledgerSteps];
      if (system === 'grand' && note.staff === 'bass') {
        for (const step of steps) bassLo = Math.min(bassLo, step);
      } else {
        for (const step of steps) {
          upperHi = Math.max(upperHi, step);
          upperLo = Math.min(upperLo, step);
        }
      }
    }
  }

  const padTop = 34 + (ottavaAbove ? 16 : 0);
  // The treble clef curls below the staff, so its 8 needs more room than the bass clef's.
  const padBottom = 24 + (ottavaBelow ? 14 : 0) + (clefEight ? (system === 'bass' ? 14 : 28) : 0);
  const shift = system === 'grand' ? bassStaffOriginShift() : 0;
  const yOf = (step: number, staff: StaffName) => {
    const extra = system === 'grand' && staff === 'bass' ? shift : 0;
    return y0 + padTop + (upperHi - step + extra) * STEP;
  };
  const top = yOf(upperTop, upper);
  const bottom = system === 'grand' ? yOf(BASS_BOTTOM_STEP, 'bass') : yOf(upperBottom, upper);
  const lowest = system === 'grand' ? yOf(Math.min(bassLo, BASS_BOTTOM_STEP), 'bass') : yOf(upperLo, upper);
  return { system, yOf, top, bottom, height: lowest + padBottom - y0 };
}

function measureBoxes(measures: DrawnMeasure[], barX: number): MeasureBox[] {
  const sigCount = Math.abs(measures[0]?.layout.signature.fifths ?? 0);
  let cursor = barX + CLEF_W + sigCount * SIG_W;
  return measures.map((measure) => {
    const { layout } = measure;
    const run = layout.placement === 'run';
    const accCols = layout.notes.reduce(
      (max, note) => Math.max(max, note.accidental === null ? 0 : note.accidentalColumn + 1),
      0,
    );
    const headCols = layout.notes.reduce((max, note) => Math.max(max, note.headColumn), 0);
    const left = cursor;
    let notesLeft: number;
    let right: number;
    let span = 0;
    if (run) {
      const count = Math.max(layout.notes.length, 1);
      span = Math.max(112, (count - 1) * 28);
      notesLeft = cursor + 24;
      right = notesLeft + span + 28;
    } else {
      notesLeft = cursor + 20 + accCols * ACC_W;
      right = Math.max(notesLeft + headCols * HEAD_SHIFT + 40, cursor + MIN_MEASURE);
    }
    cursor = right;
    return { ...measure, left, notesLeft, right, span };
  });
}

function noteX(box: MeasureBox, index: number, note: LayoutNote): number {
  if (box.layout.placement === 'run') {
    const count = box.layout.notes.length;
    if (count <= 1) return box.notesLeft + box.span / 2;
    return box.notesLeft + (index / (count - 1)) * box.span;
  }
  return box.notesLeft + note.headColumn * HEAD_SHIFT;
}

export function GrandStaff(props: Props) {
  const {
    viewMode,
    rootPc,
    intervals,
    chord,
    voicingMidis,
    pickedMidis,
    guitarWritten,
    writtenStaff,
    labelMode,
    colorByDegree,
    compareEnabled,
    clickToHear,
    evaluate,
    onPlay,
    onReference,
    measures = null,
    currentMeasure = 0,
    onSelectMeasure,
    scaleLabel = '',
    dimRest = false,
    soundingDegree = null,
  } = props;

  const narrow = useNarrowScreen();
  const degreeColors = colorByDegree && viewMode === 'scale' && !compareEnabled;
  const stepped = !!(measures && measures.length > 0 && (viewMode === 'chord' || viewMode === 'triad'));
  const source = {
    viewMode,
    rootPc,
    intervals,
    pickedMidis,
    guitarWritten,
    writtenStaff,
  };

  const drawn: DrawnMeasure[] = stepped
    ? measures.map((measure, index) => ({
        index,
        symbol: measure.symbol,
        current: index === Math.min(Math.max(currentMeasure, 0), measures.length - 1),
        layout: staffLayoutFor({
          ...source,
          viewMode: viewMode === 'triad' ? 'triad' : 'chord',
          chord: measure.chord,
          voicingMidis: measure.voicingMidis,
          pickedMidis: [],
        }),
      }))
    : [
        {
          index: 0,
          symbol: viewMode === 'scale' ? scaleLabel : '',
          current: true,
          layout: staffLayoutFor({ ...source, chord, voicingMidis }),
        },
      ];

  const ranges = stepped ? wrapMeasures(drawn.length, measuresPerSystem(narrow)) : [{ start: 0, end: drawn.length }];
  const current = drawn.find((measure) => measure.current) ?? drawn[0];

  let y0 = 0;
  const systems = ranges.map((range) => {
    const slice = drawn.slice(range.start, range.end);
    const frame = frameFor(slice.map((measure) => measure.layout), y0);
    const grand = frame.system === 'grand';
    const barX = grand ? 28 : 10;
    const boxes = measureBoxes(slice, barX);
    const endX = boxes.length > 0 ? boxes[boxes.length - 1].right : barX + CLEF_W + 80;
    const system = { frame, barX, boxes, endX, y0 };
    y0 += frame.height + 22;
    return system;
  });

  const width = Math.max(...systems.map((system) => system.endX), 160) + RIGHT;
  const height = Math.max(y0 - 22, 40);

  const play = (midi: number) => {
    if (clickToHear) onPlay(midi);
  };
  const press = (midi: number) => {
    onReference?.(mod(midi, 12));
    play(midi);
  };

  const hint =
    drawn.every((measure) => measure.layout.notes.length === 0)
      ? viewMode === 'chord' || viewMode === 'triad'
        ? 'Choose a chord and it stacks on the staff.'
        : viewMode === 'identify'
          ? 'Pick notes on the neck and they stack here.'
          : null
      : null;

  return (
    <div className="staff-wrap">
      <svg
        className={clickToHear ? 'staff staff-live' : 'staff'}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={staffAria(current?.symbol ?? '', current?.layout ?? drawn[0].layout)}
      >
        {systems.map((system, systemIndex) => {
          const { frame, barX, boxes, endX } = system;
          const staves = stavesOf(frame.system);
          const signature = boxes[0]?.layout.signature;
          const clefEight = boxes.some((box) => box.layout.clefEight);
          const clefX = barX + 8;
          return (
            <g key={systemIndex} className="staff-system" data-system-index={systemIndex}>
              {frame.system === 'grand' && <Brace x={barX - 6} top={frame.top} bottom={frame.bottom} />}
              {staves.map((staff) => (
                <StaffLines key={staff} staff={staff} x1={barX} x2={endX} yOf={frame.yOf} />
              ))}
              <line className="staff-bar" x1={barX} y1={frame.top} x2={barX} y2={frame.bottom} />
              <line className="staff-bar" x1={endX} y1={frame.top} x2={endX} y2={frame.bottom} />
              {staves.includes('treble') && <Clef name="treble" x={clefX} y={frame.yOf(G_LINE, 'treble')} />}
              {staves.includes('bass') && <Clef name="bass" x={clefX + 2} y={frame.yOf(F_LINE, 'bass')} />}
              {clefEight && (
                <text
                  className="staff-clef-eight"
                  x={clefX + 16}
                  y={
                    (staves.includes('treble')
                      ? frame.yOf(TREBLE_BOTTOM_STEP, 'treble') + 44
                      : frame.yOf(BASS_BOTTOM_STEP, 'bass') + 16)
                  }
                  textAnchor="middle"
                >
                  8
                </text>
              )}
              {signature &&
                staves.map((staff) =>
                  keySignatureSpots(signature, staff).map((spot, index) => (
                    <AccidentalMark
                      key={`${staff}-${spot.step}`}
                      value={spot.accidental}
                      x={barX + CLEF_W + index * SIG_W}
                      y={frame.yOf(spot.step, staff)}
                    />
                  )),
                )}
              {boxes.map((box) => {
                const eighth = box.layout.placement === 'run';
                const rx = eighth ? EIGHTH_RX : HEAD_RX;
                const ry = eighth ? EIGHTH_RY : HEAD_RY;
                const classes = ['staff-measure'];
                if (box.current) classes.push('is-current');
                if (dimRest && !box.current) classes.push('is-dim');
                const select = () => {
                  if (stepped) onSelectMeasure?.(box.index);
                };
                return (
                  <g
                    key={box.index}
                    className={classes.join(' ')}
                    data-measure-index={box.index}
                    onClick={select}
                  >
                    {box.current && (
                      <rect
                        className="staff-current"
                        x={box.left}
                        y={frame.top - 10}
                        width={Math.max(1, box.right - box.left)}
                        height={frame.bottom - frame.top + 20}
                      />
                    )}
                    <rect
                      className="staff-measure-hit"
                      x={box.left}
                      y={frame.top - 26}
                      width={Math.max(1, box.right - box.left)}
                      height={frame.bottom - frame.top + 44}
                      fill="transparent"
                    />
                    {box.index > boxes[0].index && (
                      <line className="staff-bar" x1={box.left} y1={frame.top} x2={box.left} y2={frame.bottom} />
                    )}
                    {box.symbol && (
                      <text className="staff-chord" x={(box.left + box.right) / 2} y={frame.top - 12} textAnchor="middle">
                        {box.symbol}
                      </text>
                    )}
                    {box.layout.notes.map((note, index) =>
                      note.ledgerSteps.map((step) => {
                        const x = noteX(box, index, note);
                        const y = frame.yOf(step, note.staff);
                        return (
                          <line
                            key={`${note.written.name}-${index}-${step}`}
                            className="staff-ledger"
                            x1={x - 12}
                            y1={y}
                            x2={x + 12}
                            y2={y}
                          />
                        );
                      }),
                    )}
                    {box.layout.notes.map((note, index) => {
                      if (note.accidental === null) return null;
                      const x = noteX(box, index, note);
                      return (
                        <AccidentalMark
                          key={`acc-${note.written.name}-${index}`}
                          value={note.accidental}
                          x={x - 16 - note.accidentalColumn * ACC_W}
                          y={frame.yOf(note.drawStep, note.staff)}
                        />
                      );
                    })}
                    {box.layout.notes.map((note, index) => {
                      const mark = octaveMark(note.octaveShift);
                      if (!mark) return null;
                      const earlier = box.layout.notes.some(
                        (other, otherIndex) =>
                          otherIndex < index && other.staff === note.staff && other.octaveShift === note.octaveShift,
                      );
                      if (earlier) return null;
                      const x = noteX(box, index, note);
                      const y = frame.yOf(note.drawStep, note.staff);
                      return (
                        <text
                          key={`ottava-${index}`}
                          className="staff-ottava"
                          x={x}
                          y={note.octaveShift < 0 ? y - 14 : y + 18}
                          textAnchor="middle"
                        >
                          {mark}
                        </text>
                      );
                    })}
                    {box.layout.notes.map((note, index) => {
                      const x = noteX(box, index, note);
                      const y = frame.yOf(note.drawStep, note.staff);
                      const ev = box.current
                        ? evaluate(mod(note.midi, 12), { placed: true, midi: note.midi })
                        : null;
                      const fill =
                        box.current && ev ? noteFillClass(ev, degreeColors && eighth) : 'staff-notehead-ink';
                      const mark = octaveMark(note.octaveShift);
                      const title = mark ? `${note.written.name}, ${mark}` : note.written.name;
                      const sounding = eighth && soundingDegree === index;
                      return (
                        <g
                          key={`head-${index}-${note.midi}`}
                          data-midi={note.midi}
                          data-sounding={sounding ? 'true' : undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            select();
                            press(note.midi);
                          }}
                        >
                          <title>{title}</title>
                          <ellipse
                            className={`${fill} staff-notehead`}
                            cx={x}
                            cy={y}
                            rx={rx}
                            ry={ry}
                            transform={`rotate(-18 ${x} ${y})`}
                          />
                          {sounding && (
                            <ellipse
                              className="note-sounding"
                              cx={x}
                              cy={y}
                              rx={rx + 4}
                              ry={ry + 3}
                              transform={`rotate(-18 ${x} ${y})`}
                            />
                          )}
                          {ev?.ring && (
                            <ellipse
                              className="note-root-ring"
                              cx={x}
                              cy={y}
                              rx={rx + 3.2}
                              ry={ry + 2.4}
                              transform={`rotate(-18 ${x} ${y})`}
                            />
                          )}
                          {ev?.reference && (
                            <ellipse
                              className="note-reference-ring"
                              cx={x}
                              cy={y}
                              rx={rx + 5.4}
                              ry={ry + 4}
                              transform={`rotate(-18 ${x} ${y})`}
                            />
                          )}
                          {ev?.outside && (
                            <ellipse
                              className="note-outside-ring"
                              cx={x}
                              cy={y}
                              rx={rx + 3.2}
                              ry={ry + 2.4}
                              transform={`rotate(-18 ${x} ${y})`}
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {labelMode === 'standard' && (
        <p className="staff-footnote">Staff shows real pitch. Standard names are a semitone higher.</p>
      )}
      {hint && <p className="staff-footnote">{hint}</p>}
    </div>
  );
}
