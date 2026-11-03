// A keyboard window: a run of MIDI notes starting on C.
//
// The on-screen keyboard draws this window. A 37-key controller is the
// three-octave case (C to C, inclusive).

/** Three octaves from C to C. The key count of a 37-key controller. */
export const CONTROLLER_KEY_COUNT = 37;

/** Home positions offered for "octave 0" on the controller. App octaves (2 → C2). */
export const CONTROLLER_BASE_OCTAVES = [1, 2, 3, 4] as const;

export type ControllerBaseOctave = (typeof CONTROLLER_BASE_OCTAVES)[number];

export interface KeyWindow {
  /** MIDI note of the lowest key. Always a C. */
  lowest: number;
  /** Number of keys, including the top note. */
  keyCount: number;
}

/** MIDI number of C in the app's octave numbering (octave 4 → 60). */
export function cMidi(octave: number): number {
  return (octave + 1) * 12;
}

/** How far the octave buttons can move a 37-key window and stay inside MIDI 0–127. */
export function shiftLimits(baseOctave: number): { min: number; max: number } {
  const base = cMidi(baseOctave);
  const span = CONTROLLER_KEY_COUNT - 1;
  return {
    min: Math.ceil((0 - base) / 12),
    max: Math.floor((127 - span - base) / 12),
  };
}

export function clampControllerShift(baseOctave: number, octaveShift: number): number {
  const { min, max } = shiftLimits(baseOctave);
  return Math.max(min, Math.min(max, Math.round(octaveShift)));
}

/**
 * 37-key window. `baseOctave` is the lowest C when the controller's octave
 * buttons read 0; `octaveShift` is those buttons. The result stays on C and
 * inside MIDI 0–127.
 */
export function controllerWindow(baseOctave: number, octaveShift: number): KeyWindow {
  const base = CONTROLLER_BASE_OCTAVES.includes(baseOctave as ControllerBaseOctave)
    ? baseOctave
    : 3;
  const shift = clampControllerShift(base, octaveShift);
  return { lowest: cMidi(base) + shift * 12, keyCount: CONTROLLER_KEY_COUNT };
}

/** C-to-C window of `octaves` octaves plus the top C. 3 octaves → 37 keys. */
export function keyboardWindow(octaves: number, lowestCMidi: number): KeyWindow {
  const oct = Math.max(1, Math.round(octaves));
  return { lowest: lowestCMidi, keyCount: 12 * oct + 1 };
}
