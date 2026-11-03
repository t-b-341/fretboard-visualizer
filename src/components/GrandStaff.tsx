import type { Chord } from '../music/chords';
import { noteFillClass, type NoteHighlight } from '../music/highlight';
import { mod } from '../music/notes';
import {
  BASS_BOTTOM_STEP,
  TREBLE_BOTTOM_STEP,
  TREBLE_TOP_STEP,
  keySignatureSpots,
  octaveMark,
  staffLayoutFor,
  type LayoutNote,
  type StaffLayout,
  type StaffName,
} from '../music/staff';
import type { LabelMode, ViewMode } from '../music/types';

interface Props {
  viewMode: ViewMode;
  rootPc: number;
  intervals: number[];
  chord: Chord | null;
  /** Sounding notes of the grip on the neck, when one grip is selected. */
  voicingMidis: number[] | null;
  pickedMidis: number[];
  guitarWritten: boolean;
  onGuitarWritten: (guitarWritten: boolean) => void;
  labelMode: LabelMode;
  colorByDegree: boolean;
  compareEnabled: boolean;
  clickToHear: boolean;
  evaluate: (pc: number, opts?: { placed?: boolean; midi?: number }) => NoteHighlight | null;
  onPlay: (midi: number) => void;
  /** While interval reference is armed, a click sets or clears that pitch class. */
  onReference?: (pc: number) => void;
  /** Every step, when the staff should show one measure per step. */
  measures?: { chord: Chord; voicingMidis: number[] | null }[] | null;
  currentMeasure?: number;
  /** Dim every measure except the current one. */
  dimRest?: boolean;
  /** Index of the written scale note that is sounding. */
  soundingDegree?: number | null;
}

const STEP = 6;
const HEAD_RX = 7.6;
const HEAD_RY = 5.2;
const HEAD_SHIFT = 13;
const ADVANCE = 48;
const CLEF_W = 50;
const SIG_W = 15;
const ACC_W = 16;
const RIGHT = 20;

function staffLabel(layout: StaffLayout): string {
  const fifths = layout.signature.fifths;
  const sig =
    fifths === 0
      ? 'no key signature'
      : fifths > 0
        ? `${fifths} ${fifths === 1 ? 'sharp' : 'sharps'}`
        : `${-fifths} ${fifths === -1 ? 'flat' : 'flats'}`;
  const system = layout.system === 'treble' ? 'Treble staff' : 'Grand staff';
  const names = layout.notes
    .map((note) => {
      const mark = octaveMark(note.octaveShift);
      return mark ? `${note.written.name} ${mark}` : note.written.name;
    })
    .join(' ');
  const body = names ? `${system}, ${sig}: ${names}` : `${system}, ${sig}`;
  if (layout.notes.length === 0) return body;
  return `${body}. MIDI ${layout.notes.map((note) => note.midi).join(' ')}`;
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

/** Unicode clefs. Segoe UI Symbol (and the usual fallbacks) draw 𝄞 and 𝄢. */
function TrebleClef({ x, y }: { x: number; y: number }) {
  return (
    <text className="staff-clef-glyph staff-clef-treble" x={x} y={y}>
      {'\u{1D11E}'}
    </text>
  );
}

function BassClef({ x, y }: { x: number; y: number }) {
  return (
    <text className="staff-clef-glyph staff-clef-bass" x={x} y={y}>
      {'\u{1D122}'}
    </text>
  );
}

function Brace({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  const mid = (top + bottom) / 2;
  const tip = x - 13;
  const d = [
    `M ${x} ${top}`,
    `C ${x - 10} ${top + 18}, ${x - 7} ${mid - 32}, ${tip + 3} ${mid - 7}`,
    `Q ${tip - 3} ${mid}, ${tip + 3} ${mid + 7}`,
    `C ${x - 7} ${mid + 32}, ${x - 10} ${bottom - 18}, ${x} ${bottom}`,
  ].join(' ');
  return <path className="staff-brace" d={d} />;
}

function StaffLines({ bottom, x1, x2, yOf }: { bottom: number; x1: number; x2: number; yOf: (step: number) => number }) {
  return (
    <>
      {Array.from({ length: 5 }, (_, i) => {
        const y = yOf(bottom + i * 2);
        return <line key={i} className="staff-line" x1={x1} y1={y} x2={x2} y2={y} />;
      })}
    </>
  );
}

function chordRole(chord: Chord, midi: number): string {
  const pc = mod(midi, 12);
  for (const tone of chord.tones) {
    if (mod(chord.rootPc + tone.interval, 12) === pc) return tone.role;
  }
  return 'scale';
}

function MeasuresStaff({
  measures,
  currentMeasure,
  dimRest,
  viewMode,
  rootPc,
  intervals,
  guitarWritten,
  clickToHear,
  evaluate,
  onPress,
}: {
  measures: { chord: Chord; voicingMidis: number[] | null }[];
  currentMeasure: number;
  dimRest: boolean;
  viewMode: ViewMode;
  rootPc: number;
  intervals: number[];
  guitarWritten: boolean;
  clickToHear: boolean;
  evaluate: (pc: number, opts?: { placed?: boolean; midi?: number }) => NoteHighlight | null;
  onPress: (midi: number) => void;
}) {
  const current = Math.min(Math.max(currentMeasure, 0), measures.length - 1);
  const layouts = measures.map((measure) =>
    staffLayoutFor({
      viewMode,
      rootPc,
      intervals,
      chord: measure.chord,
      voicingMidis: measure.voicingMidis,
      pickedMidis: [],
      guitarWritten,
    }),
  );
  const grand = layouts[0]?.system === 'grand';
  const signature = layouts[current]?.signature ?? layouts[0].signature;
  let maxStep = TREBLE_TOP_STEP;
  let minStep = grand ? BASS_BOTTOM_STEP : TREBLE_BOTTOM_STEP;
  for (const layout of layouts) {
    for (const note of layout.notes) {
      maxStep = Math.max(maxStep, note.drawStep);
      minStep = Math.min(minStep, note.drawStep);
      for (const step of note.ledgerSteps) {
        maxStep = Math.max(maxStep, step);
        minStep = Math.min(minStep, step);
      }
    }
  }
  const hasOttava = layouts.some((layout) => layout.notes.some((note) => note.octaveShift > 0));
  maxStep += 6;
  minStep -= hasOttava ? 5 : 3;
  const yOf = (step: number) => (maxStep - step) * STEP + 4;
  const height = yOf(minStep) + 12;
  const barX = grand ? 30 : 12;
  const sigCount = Math.abs(signature.fifths);
  let cursor = barX + CLEF_W + sigCount * SIG_W;
  const boxes = layouts.map((layout, index) => {
    const acc = layout.notes.reduce((max, note) => Math.max(max, note.accidentalColumn), 0);
    const head = layout.notes.reduce((max, note) => Math.max(max, note.headColumn), 0);
    const notesLeft = cursor + 16 + acc * ACC_W;
    const content = head * HEAD_SHIFT;
    const right = Math.max(notesLeft + content + 28, cursor + 78);
    const box = { layout, index, left: cursor, notesLeft, right };
    cursor = right;
    return box;
  });
  const endX = Math.max(cursor, barX + 148);
  if (boxes.length > 0 && boxes[boxes.length - 1].right < endX) boxes[boxes.length - 1].right = endX;
  const width = endX + RIGHT;
  const gLine = yOf(TREBLE_BOTTOM_STEP + 2);
  const fLine = yOf(BASS_BOTTOM_STEP + 6);
  const top = yOf(TREBLE_TOP_STEP);
  const bottom = yOf(grand ? BASS_BOTTOM_STEP : TREBLE_BOTTOM_STEP);

  return (
    <svg
      className={clickToHear ? 'staff staff-live' : 'staff'}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={staffLabel(layouts[current] ?? layouts[0])}
    >
      {grand && <Brace x={barX - 6} top={top} bottom={bottom} />}
      <StaffLines bottom={TREBLE_BOTTOM_STEP} x1={barX} x2={endX} yOf={yOf} />
      {grand && <StaffLines bottom={BASS_BOTTOM_STEP} x1={barX} x2={endX} yOf={yOf} />}
      <line className="staff-bar" x1={barX} y1={top} x2={barX} y2={bottom} />
      <TrebleClef x={barX + 6} y={gLine + 28} />
      {guitarWritten && (
        <text className="staff-clef-eight" x={barX + 24} y={yOf(TREBLE_BOTTOM_STEP) + 18} textAnchor="middle">
          8
        </text>
      )}
      {grand && <BassClef x={barX + 8} y={fLine + 18} />}
      {(['treble', 'bass'] as StaffName[]).map((staff) => {
        if (staff === 'bass' && !grand) return null;
        return keySignatureSpots(signature, staff).map((spot, index) => (
          <AccidentalMark
            key={`${staff}-${spot.step}`}
            value={spot.accidental}
            x={barX + CLEF_W + index * SIG_W}
            y={yOf(spot.step)}
          />
        ));
      })}
      {boxes.map((box) => {
        const on = box.index === current;
        const chord = measures[box.index].chord;
        const classes = ['staff-measure'];
        if (on) classes.push('is-current');
        if (dimRest && !on) classes.push('is-dim');
        return (
          <g key={box.index} className={classes.join(' ')} data-measure-index={box.index}>
            {on && (
              <rect
                className="staff-current"
                x={box.left}
                y={top - 10}
                width={Math.max(1, box.right - box.left)}
                height={bottom - top + 20}
              />
            )}
            <line className="staff-bar" x1={box.right} y1={top} x2={box.right} y2={bottom} />
            {box.layout.notes.map((note, index) =>
              note.ledgerSteps.map((step) => {
                const x = box.notesLeft + note.headColumn * HEAD_SHIFT;
                const y = yOf(step);
                return (
                  <line
                    key={`${note.written.name}-${index}-${step}`}
                    className="staff-ledger"
                    x1={x - 14}
                    y1={y}
                    x2={x + 14}
                    y2={y}
                  />
                );
              }),
            )}
            {box.layout.notes.map((note, index) => {
              if (note.accidental === null) return null;
              return (
                <AccidentalMark
                  key={`acc-${note.written.name}-${index}`}
                  value={note.accidental}
                  x={box.notesLeft - 18 - note.accidentalColumn * ACC_W}
                  y={yOf(note.drawStep)}
                />
              );
            })}
            {box.layout.notes.map((note, index) => {
              const x = box.notesLeft + note.headColumn * HEAD_SHIFT;
              const y = yOf(note.drawStep);
              const ev = on ? evaluate(mod(note.midi, 12), { placed: true, midi: note.midi }) : null;
              const fill = ev ? noteFillClass(ev, false) : `note note-${chordRole(chord, note.midi)}`;
              const mark = octaveMark(note.octaveShift);
              const title = mark ? `${note.written.name}, ${mark}` : note.written.name;
              return (
                <g key={`head-${index}-${note.midi}`} data-midi={note.midi} onClick={() => onPress(note.midi)}>
                  <title>{title}</title>
                  <ellipse
                    className={`${fill} staff-notehead`}
                    cx={x}
                    cy={y}
                    rx={HEAD_RX}
                    ry={HEAD_RY}
                    transform={`rotate(-18 ${x} ${y})`}
                  />
                  {(ev?.ring || (!ev && mod(note.midi, 12) === chord.rootPc)) && (
                    <ellipse
                      className="note-root-ring"
                      cx={x}
                      cy={y}
                      rx={HEAD_RX + 3.2}
                      ry={HEAD_RY + 2.4}
                      transform={`rotate(-18 ${x} ${y})`}
                    />
                  )}
                  {ev?.reference && (
                    <ellipse
                      className="note-reference-ring"
                      cx={x}
                      cy={y}
                      rx={HEAD_RX + 5.4}
                      ry={HEAD_RY + 4}
                      transform={`rotate(-18 ${x} ${y})`}
                    />
                  )}
                  {ev?.outside && (
                    <ellipse
                      className="note-outside-ring"
                      cx={x}
                      cy={y}
                      rx={HEAD_RX + 3.2}
                      ry={HEAD_RY + 2.4}
                      transform={`rotate(-18 ${x} ${y})`}
                    />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
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
    onGuitarWritten,
    labelMode,
    colorByDegree,
    compareEnabled,
    clickToHear,
    evaluate,
    onPlay,
    onReference,
    measures = null,
    currentMeasure = 0,
    dimRest = false,
    soundingDegree = null,
  } = props;

  const layout = staffLayoutFor({
    viewMode,
    rootPc,
    intervals,
    chord,
    voicingMidis,
    pickedMidis,
    guitarWritten,
  });
  const degreeColors = colorByDegree && viewMode === 'scale' && !compareEnabled;
  const grand = layout.system === 'grand';

  let maxStep = TREBLE_TOP_STEP;
  let minStep = grand ? BASS_BOTTOM_STEP : TREBLE_BOTTOM_STEP;
  for (const note of layout.notes) {
    maxStep = Math.max(maxStep, note.drawStep);
    minStep = Math.min(minStep, note.drawStep);
    for (const step of note.ledgerSteps) {
      maxStep = Math.max(maxStep, step);
      minStep = Math.min(minStep, step);
    }
  }
  const hasOttava = layout.notes.some((note) => note.octaveShift > 0);
  maxStep += 6;
  minStep -= hasOttava ? 5 : 3;
  const yOf = (step: number) => (maxStep - step) * STEP + 4;
  const height = yOf(minStep) + 12;

  const sigCount = Math.abs(layout.signature.fifths);
  const maxAccCol = layout.notes.reduce((max, note) => Math.max(max, note.accidentalColumn), 0);
  const maxHead = layout.notes.reduce((max, note) => Math.max(max, note.headColumn), 0);
  const barX = grand ? 30 : 12;
  const notesLeft =
    barX + CLEF_W + sigCount * SIG_W + 18 + (layout.placement === 'stack' ? maxAccCol * ACC_W : 0);
  const lastX =
    layout.notes.length === 0
      ? notesLeft
      : layout.placement === 'run'
        ? notesLeft + (layout.notes.length - 1) * ADVANCE
        : notesLeft + maxHead * HEAD_SHIFT;
  const endX = Math.max(lastX + 34, barX + 148);
  const width = endX + RIGHT;

  const noteX = (index: number, column: number) =>
    layout.placement === 'run' ? notesLeft + index * ADVANCE + column * HEAD_SHIFT : notesLeft + column * HEAD_SHIFT;

  const markFor = new Map<string, LayoutNote>();
  for (const note of layout.notes) {
    if (note.octaveShift <= 0) continue;
    const key = `${note.staff}:${note.octaveShift}`;
    const prev = markFor.get(key);
    if (!prev || note.drawStep < prev.drawStep) markFor.set(key, note);
  }

  const play = (midi: number) => {
    if (clickToHear) onPlay(midi);
  };
  const press = (midi: number) => {
    onReference?.(mod(midi, 12));
    play(midi);
  };

  const hint =
    layout.notes.length > 0
      ? null
      : viewMode === 'chord' || viewMode === 'triad'
        ? 'Choose a chord and it stacks on the staff.'
        : viewMode === 'identify'
          ? 'Pick notes on the neck and they stack here.'
          : null;

  const gLine = yOf(TREBLE_BOTTOM_STEP + 2);
  const fLine = yOf(BASS_BOTTOM_STEP + 6);

  return (
    <div className="staff-wrap">
      <div className="staff-toolbar">
        <div className="segmented" role="group" aria-label="Staff pitch">
          <button
            type="button"
            className={guitarWritten ? '' : 'active'}
            aria-pressed={!guitarWritten}
            onClick={() => onGuitarWritten(false)}
          >
            Concert pitch
          </button>
          <button
            type="button"
            className={guitarWritten ? 'active' : ''}
            aria-pressed={guitarWritten}
            onClick={() => onGuitarWritten(true)}
          >
            Guitar written
          </button>
        </div>
        <p className="staff-toolbar-note">
          {guitarWritten
            ? 'Written an octave higher, on a treble clef with an 8. It sounds an octave lower.'
            : 'Sounding pitch, on the grand staff.'}
        </p>
      </div>
      {!(measures && measures.length > 0 && (viewMode === 'chord' || viewMode === 'triad')) ? (
      <svg
        className={clickToHear ? 'staff staff-live' : 'staff'}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={staffLabel(layout)}
      >
        {grand && <Brace x={barX - 6} top={yOf(TREBLE_TOP_STEP)} bottom={yOf(BASS_BOTTOM_STEP)} />}
        <StaffLines bottom={TREBLE_BOTTOM_STEP} x1={barX} x2={endX} yOf={yOf} />
        {grand && <StaffLines bottom={BASS_BOTTOM_STEP} x1={barX} x2={endX} yOf={yOf} />}
        <line className="staff-bar" x1={barX} y1={yOf(TREBLE_TOP_STEP)} x2={barX} y2={yOf(grand ? BASS_BOTTOM_STEP : TREBLE_BOTTOM_STEP)} />
        <line className="staff-bar" x1={endX} y1={yOf(TREBLE_TOP_STEP)} x2={endX} y2={yOf(grand ? BASS_BOTTOM_STEP : TREBLE_BOTTOM_STEP)} />
        <TrebleClef x={barX + 6} y={gLine + 28} />
        {guitarWritten && (
          <text className="staff-clef-eight" x={barX + 24} y={yOf(TREBLE_BOTTOM_STEP) + 18} textAnchor="middle">
            8
          </text>
        )}
        {grand && <BassClef x={barX + 8} y={fLine + 18} />}
        {(['treble', 'bass'] as StaffName[]).map((staff) => {
          if (staff === 'bass' && !grand) return null;
          return keySignatureSpots(layout.signature, staff).map((spot, i) => (
            <AccidentalMark
              key={`${staff}-${spot.step}`}
              value={spot.accidental}
              x={barX + CLEF_W + i * SIG_W}
              y={yOf(spot.step)}
            />
          ));
        })}
        {layout.notes.map((note, index) =>
          note.ledgerSteps.map((step) => {
            const x = noteX(index, note.headColumn);
            const y = yOf(step);
            return (
              <line
                key={`${note.written.name}-${index}-${step}`}
                className="staff-ledger"
                x1={x - 14}
                y1={y}
                x2={x + 14}
                y2={y}
              />
            );
          }),
        )}
        {layout.notes.map((note, index) => {
          if (note.accidental === null) return null;
          const base = layout.placement === 'run' ? notesLeft + index * ADVANCE : notesLeft;
          return (
            <AccidentalMark
              key={`acc-${note.written.name}-${index}`}
              value={note.accidental}
              x={base - 18 - note.accidentalColumn * ACC_W}
              y={yOf(note.drawStep)}
            />
          );
        })}
        {layout.notes.map((note, index) => {
          const marked = markFor.get(`${note.staff}:${note.octaveShift}`);
          if (marked !== note) return null;
          const mark = octaveMark(note.octaveShift);
          if (!mark) return null;
          const x = noteX(index, note.headColumn);
          return (
            <text key={`ottava-${index}`} className="staff-ottava" x={x} y={yOf(note.drawStep) + 20} textAnchor="middle">
              {mark}
            </text>
          );
        })}
        {layout.notes.map((note, index) => {
          const x = noteX(index, note.headColumn);
          const y = yOf(note.drawStep);
          const ev = evaluate(mod(note.midi, 12), { placed: true, midi: note.midi });
          const fill = ev ? noteFillClass(ev, degreeColors) : 'note note-scale';
          const mark = octaveMark(note.octaveShift);
          const title = mark ? `${note.written.name}, ${mark}` : note.written.name;
          return (
            <g
              key={`head-${note.written.name}-${index}-${note.midi}`}
              data-midi={note.midi}
              data-sounding={soundingDegree === index ? 'true' : undefined}
              onClick={() => press(note.midi)}
            >
              <title>{title}</title>
              <ellipse className={`${fill} staff-notehead`} cx={x} cy={y} rx={HEAD_RX} ry={HEAD_RY} transform={`rotate(-18 ${x} ${y})`} />
              {soundingDegree === index && (
                <ellipse className="note-sounding" cx={x} cy={y} rx={HEAD_RX + 4} ry={HEAD_RY + 3} transform={`rotate(-18 ${x} ${y})`} />
              )}
              {ev?.ring && (
                <ellipse className="note-root-ring" cx={x} cy={y} rx={HEAD_RX + 3.2} ry={HEAD_RY + 2.4} transform={`rotate(-18 ${x} ${y})`} />
              )}
              {ev?.reference && (
                <ellipse className="note-reference-ring" cx={x} cy={y} rx={HEAD_RX + 5.4} ry={HEAD_RY + 4} transform={`rotate(-18 ${x} ${y})`} />
              )}
              {ev?.outside && (
                <ellipse className="note-outside-ring" cx={x} cy={y} rx={HEAD_RX + 3.2} ry={HEAD_RY + 2.4} transform={`rotate(-18 ${x} ${y})`} />
              )}
            </g>
          );
        })}
      </svg>
      ) : (
        <MeasuresStaff
          measures={measures}
          currentMeasure={currentMeasure}
          dimRest={dimRest}
          viewMode={viewMode}
          rootPc={rootPc}
          intervals={intervals}
          guitarWritten={guitarWritten}
          clickToHear={clickToHear}
          evaluate={evaluate}
          onPress={press}
        />
      )}
      {labelMode === 'standard' && (
        <p className="staff-footnote">Staff shows concert pitch. Standard names are a semitone higher.</p>
      )}
      {hint && <p className="staff-footnote">{hint}</p>}
    </div>
  );
}
