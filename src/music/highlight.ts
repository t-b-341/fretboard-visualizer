// Shared pitch-class highlighting logic.
//
// Both instrument views (fretboard, keyboard, ...) ask the same question of a
// pitch class: "should I draw this note, and if so with what colour and label?"
// Keeping that answer in one place guarantees a given note looks identical no
// matter which diagram it is drawn on.

import type { DisplayMode, ViewMode } from '../App';
import type { Triad } from './chords';
import { chromaticDegreeLabel, mod, noteName } from './notes';
import { scaleDegreeLabel } from './scales';

export type Role =
  | 'root'
  | 'third'
  | 'fifth'
  | 'scale'
  | 'ghost'
  | 'shared'
  | 'primaryOnly'
  | 'overlayOnly';

export interface NoteHighlight {
  role: Role;
  label: string;
  /** Draw the gold "root" ring around the note. */
  ring?: boolean;
  /** Draw the dashed ring flagging a chord tone outside the overlaid scale. */
  outside?: boolean;
}

export interface HighlightContext {
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

/**
 * Build a pitch-class evaluator from the current view context. Returns a
 * function that, given a pitch class (0-11), yields how that note should be
 * drawn, or `null` when it should not be shown at all.
 */
export function createEvaluator(ctx: HighlightContext): (pc: number) => NoteHighlight | null {
  const {
    rootPc,
    intervals,
    pcToIndex,
    viewMode,
    triad,
    displayMode,
    shift,
    ghostScale,
    compareEnabled,
    comparePcSet,
    compareRootPc,
    sharedOnly,
  } = ctx;

  return function evaluate(pc: number): NoteHighlight | null {
    const idx = pcToIndex.get(pc);
    const inScale = idx !== undefined;

    const labelFor = (): string =>
      displayMode === 'note'
        ? noteName(mod(pc + shift, 12))
        : scaleDegreeLabel(intervals, idx as number);

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
            ? noteName(mod(pc + shift, 12))
            : inScale
              ? scaleDegreeLabel(intervals, idx as number)
              : chromaticDegreeLabel(mod(pc - rootPc, 12));
        return { role, label, ring };
      }

      if (!inScale) return null;
      return { role: pc === rootPc ? 'root' : 'scale', label: labelFor() };
    }

    // Triad view
    let chordRole: Role | null = null;
    if (pc === triad.pitches[0]) chordRole = 'root';
    else if (pc === triad.pitches[1]) chordRole = 'third';
    else if (pc === triad.pitches[2]) chordRole = 'fifth';

    // Compare: overlay a scale on the chord. Chord tones keep their colours; the
    // scale's remaining notes show as colour tones. Everything is labelled
    // relative to the chord root, and chord tones that fall outside the overlaid
    // scale get a dashed ring to flag the clash.
    if (compareEnabled) {
      const inOverlay = comparePcSet.has(pc);
      const label =
        displayMode === 'note'
          ? noteName(mod(pc + shift, 12))
          : chromaticDegreeLabel(mod(pc - triad.rootPc, 12));
      if (chordRole) {
        if (sharedOnly && !inOverlay) return null;
        return { role: chordRole, label, ring: pc === compareRootPc, outside: !inOverlay };
      }
      if (inOverlay && !sharedOnly) {
        // Non-chord scale notes = colour/tension tones. Use the blue "scale"
        // colour so the red/green/gold chord tones stay visually distinct.
        return { role: 'scale', label, ring: pc === compareRootPc };
      }
      return null;
    }

    if (chordRole) return { role: chordRole, label: labelFor() };
    if (inScale && ghostScale) return { role: 'ghost', label: '' };
    return null;
  };
}
