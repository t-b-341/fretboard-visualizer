// Shared pitch-class highlighting logic.
//
// The instrument views (fretboard, keyboard, staff) ask the same question of a
// pitch class: "should I draw this note, and if so with what colour and label?"
// Keeping that answer in one place guarantees a given note looks identical no
// matter which diagram it is drawn on.

import type { DisplayMode, ViewMode } from './types';
import type { Chord, Triad } from './chords';
import { chromaticDegreeLabel, mod, noteName } from './notes';
import { scaleDegreeLabel, spelledDegreeLabel } from './scales';
import { LETTERS, spellScale } from './spelling';
import type { SpelledTone } from './spelling';

export type Role =
  | 'root'
  | 'third'
  | 'fifth'
  | 'seventh'
  | 'ext'
  | 'scale'
  | 'ghost'
  | 'shared'
  | 'primaryOnly'
  | 'overlayOnly'
  | 'right'
  | 'wrong';

export interface NoteHighlight {
  role: Role;
  label: string;
  /** Index of this pitch in the primary scale, when it belongs to that scale. */
  degreeIndex?: number;
  /** Draw the gold "root" ring around the note. */
  ring?: boolean;
  /** Draw the reference-note ring. This is not the gold root ring. */
  reference?: boolean;
  /** Draw the dashed ring flagging a chord tone outside the overlaid scale. */
  outside?: boolean;
}

export interface HighlightContext {
  rootPc: number;
  intervals: number[];
  pcToIndex: Map<number, number>;
  viewMode: ViewMode;
  triad: Triad;
  /** The chord shown in 'chord' view (builder pick or progression step). */
  activeChord: Chord | null;
  displayMode: DisplayMode;
  shift: number;
  ghostScale: boolean;
  compareEnabled: boolean;
  comparePcSet: Set<number>;
  compareRootPc: number;
  sharedOnly: boolean;
  /** When set, only these pitch classes are drawn (guide tones or a voicing). */
  restrictPcs?: Set<number> | null;
  /** MIDI of the lowest picked note. Identify view paints that cell as the root. */
  identifyBassMidi?: number;
  /** Quiz view: "stringIndex:fret" cells already answered right or wrong. */
  quizMarks?: Record<string, 'right' | 'wrong'>;
  /**
   * Sounding pitch class labels are measured from. Null keeps the ordinary
   * note or degree labels. Colors and which notes are drawn stay the same.
   */
  referencePc?: number | null;
  /**
   * Spelled names keyed by the displayed pitch class (concert pitch plus the
   * label shift). Scale tones first; chord tones the scale doesn't cover fill
   * the rest. Missing entries keep the chromatic name.
   */
  spelling?: ReadonlyMap<number, string> | null;
}

/**
 * Build a pitch-class evaluator from the current view context. Returns a
 * function that, given a pitch class (0-11), yields how that note should be
 * drawn, or `null` when it should not be shown at all.
 */
export function createEvaluator(
  ctx: HighlightContext,
): (pc: number, opts?: { placed?: boolean; midi?: number; cellKey?: string }) => NoteHighlight | null {
  const {
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
    restrictPcs,
    spelling,
    identifyBassMidi,
    quizMarks,
    referencePc: referencePcRaw = null,
  } = ctx;

  const referencePc = referencePcRaw == null ? null : mod(referencePcRaw, 12);
  const spelledByPc = new Map<number, SpelledTone>();
  const spelled = spellScale(rootPc, intervals);
  if (spelled) {
    for (const tone of spelled) {
      if (!spelledByPc.has(tone.pc)) spelledByPc.set(tone.pc, tone);
    }
  }

  const labelFromReference = (pc: number): string => {
    const ref = referencePc ?? 0;
    const target = mod(pc, 12);
    const semis = mod(target - ref, 12);
    const from = spelledByPc.get(ref);
    const to = spelledByPc.get(target);
    if (from && to) {
      const fromLetter = LETTERS.indexOf(from.name[0] ?? '');
      const toLetter = LETTERS.indexOf(to.name[0] ?? '');
      if (fromLetter >= 0 && toLetter >= 0) {
        return spelledDegreeLabel(mod(toLetter - fromLetter, 7), semis);
      }
    }
    return chromaticDegreeLabel(semis);
  };

  const applyReference = (highlight: NoteHighlight | null, pc: number): NoteHighlight | null => {
    if (!highlight || referencePc == null || viewMode === 'quiz') return highlight;
    const isReference = mod(pc, 12) === referencePc;
    const label = highlight.label ? labelFromReference(pc) : highlight.label;
    if (!isReference && label === highlight.label) return highlight;
    return isReference ? { ...highlight, label, reference: true } : { ...highlight, label };
  };

  // Pre-map the active chord's pitch classes to their role and degree label.
  const chordRoleByPc = new Map<number, Role>();
  const chordDegreeByPc = new Map<number, string>();
  if (activeChord) {
    for (const t of activeChord.tones) {
      const pc = mod(activeChord.rootPc + t.interval, 12);
      if (!chordRoleByPc.has(pc)) {
        chordRoleByPc.set(pc, t.role);
        chordDegreeByPc.set(pc, t.degree);
      }
    }
  }

  function evaluateNote(
    pc: number,
    opts?: { placed?: boolean; midi?: number; cellKey?: string },
  ): NoteHighlight | null {
    // Quiz: a blank neck. Only cells the player has already tried are drawn,
    // and only as a right or wrong mark — no note name and no scale colour.
    if (viewMode === 'quiz') {
      const mark = opts?.cellKey ? quizMarks?.[opts.cellKey] : undefined;
      if (mark !== 'right' && mark !== 'wrong') return null;
      return { role: mark, label: '' };
    }

    if (restrictPcs && !restrictPcs.has(pc)) return null;
    const idx = pcToIndex.get(pc);
    const inScale = idx !== undefined;

    const decorate = (h: NoteHighlight): NoteHighlight =>
      inScale && idx !== undefined ? { ...h, degreeIndex: idx } : h;

    const named = (): string => {
      const shown = mod(pc + shift, 12);
      return spelling?.get(shown) ?? noteName(shown);
    };

    const labelFor = (): string =>
      displayMode === 'note' ? named() : scaleDegreeLabel(intervals, idx as number);

    // Identify: only the notes the player picked are drawn. The lowest one is
    // the bass (root colour); the rest are scale-coloured. Labels are note names.
    if (viewMode === 'identify') {
      if (!opts?.placed) return null;
      const label = noteName(mod(pc + shift, 12));
      const role: Role =
        opts.midi !== undefined && identifyBassMidi !== undefined && opts.midi === identifyBassMidi
          ? 'root'
          : 'scale';
      return { role, label };
    }

    if (viewMode === 'scale') {
      // Comparison / overlay mode: colour by set membership, label overlay-only
      // tones by their chromatic degree relative to the primary root.
      if (compareEnabled) {
        const inCompare = comparePcSet.has(pc);
        if (!inScale && !inCompare) return null;
        if (sharedOnly && !(inScale && inCompare)) return null;
        const role: Role = inScale && inCompare ? 'shared' : inScale ? 'primaryOnly' : 'overlayOnly';
        const ring = pc === rootPc || pc === compareRootPc;
        const label =
          displayMode === 'note'
            ? named()
            : inScale
              ? scaleDegreeLabel(intervals, idx as number)
              : chromaticDegreeLabel(mod(pc - rootPc, 12));
        return decorate({ role, label, ring });
      }

      if (!inScale) return null;
      return decorate({ role: pc === rootPc ? 'root' : 'scale', label: labelFor() });
    }

    // Chord view: highlight the active chord's tones by role, labelled by their
    // chord-relative degree. Chord tones outside the current key get a dashed
    // ring; remaining key tones can show faintly as ghosts.
    if (viewMode === 'chord') {
      // `placed: false` is a fret or key that is not part of the grip on screen.
      // The pitch class may still belong to the chord; it falls through to a ghost.
      const role = opts?.placed === false ? undefined : chordRoleByPc.get(pc);
      if (role) {
        const label = displayMode === 'note' ? named() : chordDegreeByPc.get(pc) ?? '';
        return decorate({
          role,
          label,
          ring: !!activeChord && pc === activeChord.rootPc,
          outside: !inScale,
        });
      }
      if (inScale && ghostScale) return { role: 'ghost', label: '' };
      return null;
    }

    // Triad view
    let chordRole: Role | null = null;
    if (opts?.placed !== false) {
      if (pc === triad.pitches[0]) chordRole = 'root';
      else if (pc === triad.pitches[1]) chordRole = 'third';
      else if (pc === triad.pitches[2]) chordRole = 'fifth';
    }

    // Compare: overlay a scale on the chord. Chord tones keep their colours; the
    // scale's remaining notes show as colour tones. Everything is labelled
    // relative to the chord root, and chord tones that fall outside the overlaid
    // scale get a dashed ring to flag the clash.
    if (compareEnabled) {
      const inOverlay = comparePcSet.has(pc);
      const label =
        displayMode === 'note' ? named() : chromaticDegreeLabel(mod(pc - triad.rootPc, 12));
      if (chordRole) {
        if (sharedOnly && !inOverlay) return null;
        return decorate({ role: chordRole, label, ring: pc === compareRootPc, outside: !inOverlay });
      }
      if (inOverlay && !sharedOnly) {
        // Non-chord scale notes = colour/tension tones. Use the blue "scale"
        // colour so the red/green/gold chord tones stay visually distinct.
        return decorate({ role: 'scale', label, ring: pc === compareRootPc });
      }
      return null;
    }

    if (chordRole) return decorate({ role: chordRole, label: labelFor() });
    if (inScale && ghostScale) return { role: 'ghost', label: '' };
    return null;
  }

  return function evaluate(
    pc: number,
    opts?: { placed?: boolean; midi?: number; cellKey?: string },
  ): NoteHighlight | null {
    return applyReference(evaluateNote(pc, opts), pc);
  };
}

/** Fill class for a note. Degree colours replace root/scale fills on the full scale. */
export function noteFillClass(ev: NoteHighlight, colorByDegree: boolean): string {
  if (
    colorByDegree &&
    ev.degreeIndex !== undefined &&
    (ev.role === 'root' || ev.role === 'scale')
  ) {
    return `note note-deg-${ev.degreeIndex}`;
  }
  return `note note-${ev.role}`;
}

/** Label class. Light degree fills (gold, cyan) need dark text, as the 5th does. */
export function noteTextClass(ev: NoteHighlight, colorByDegree: boolean): string {
  const long = ev.label.length > 2 ? ' note-label-long' : '';
  if (
    colorByDegree &&
    ev.degreeIndex !== undefined &&
    (ev.role === 'root' || ev.role === 'scale') &&
    (ev.degreeIndex === 2 || ev.degreeIndex === 4)
  ) {
    return `note-label note-label-ink${long}`;
  }
  if (ev.role === 'fifth' || ev.role === 'overlayOnly') return `note-label note-label-${ev.role}${long}`;
  return `note-label${long}`;
}
