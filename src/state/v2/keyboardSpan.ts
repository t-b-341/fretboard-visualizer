/** Keys drawn for a span. 3 octaves is the 37-key controller, C to C. */
export function keyboardKeyCount(octaves: 1 | 2 | 3): number {
  return octaves === 3 ? 37 : 12 * octaves + 1;
}

/** Lowest C that keeps this span inside MIDI 0–127. */
export function clampKeyboardLowest(octaves: 1 | 2 | 3, lowest: number): number {
  const span = keyboardKeyCount(octaves) - 1;
  const midi = Number.isFinite(lowest) ? Math.round(lowest) : 48;
  const snapped = Math.round(midi / 12) * 12;
  const max = Math.floor((127 - span) / 12) * 12;
  return Math.max(0, Math.min(max, snapped));
}

/** Every C the span can start on. */
export function keyboardStarts(octaves: 1 | 2 | 3): number[] {
  const max = clampKeyboardLowest(octaves, 127);
  const starts: number[] = [];
  for (let midi = 0; midi <= max; midi += 12) starts.push(midi);
  return starts;
}
