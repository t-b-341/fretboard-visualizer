// Names for a root + mode, in the spelling the rest of the theory code uses.
// `shift` is the Concert (0) / Standard (+1) label offset.

import { mod } from './notes';
import { SCALE_FAMILIES } from './scales';
import { pitchSpelling, spellScale } from './spelling';

function modeTitle(modeKey: string): string {
  for (const family of SCALE_FAMILIES) {
    const mode = family.modes.find((item) => item.key === modeKey);
    if (!mode) continue;
    const cut = mode.name.indexOf(' (');
    return cut >= 0 ? mode.name.slice(0, cut) : mode.name;
  }
  return modeKey;
}

/** "Bb major", "G minor", "E Dorian", "A harmonic minor". */
export function keyLabel(rootPc: number, modeKey: string, shift = 0): string {
  const pitch = pitchSpelling(mod(rootPc + shift, 12));
  if (modeKey === 'Ionian') return `${pitch} major`;
  if (modeKey === 'Aeolian') return `${pitch} minor`;
  if (modeKey === 'HarmonicMinor') return `${pitch} harmonic minor`;
  if (modeKey === 'MelodicMinor') return `${pitch} melodic minor`;
  return `${pitch} ${modeTitle(modeKey)}`;
}

/** Start-in summary: Aeolian keeps the mode in parentheses, "E minor (Aeolian)". */
export function keySummary(rootPc: number, modeKey: string, shift = 0): string {
  if (modeKey === 'Aeolian') return `${pitchSpelling(mod(rootPc + shift, 12))} minor (Aeolian)`;
  return keyLabel(rootPc, modeKey, shift);
}

/** Spelled scale tones, one letter each when the scale has seven notes. */
export function spelledScaleNotes(rootPc: number, intervals: number[], shift = 0): string {
  const root = mod(rootPc + shift, 12);
  const spelled = spellScale(root, intervals);
  if (spelled) return spelled.map((tone) => tone.name).join(' ');
  return intervals.map((interval) => pitchSpelling(mod(root + interval, 12))).join(' ');
}

/** "Bb major · Bb C D Eb F G A". */
export function scaleReadout(rootPc: number, modeKey: string, intervals: number[], shift = 0): string {
  return `${keyLabel(rootPc, modeKey, shift)} \u00b7 ${spelledScaleNotes(rootPc, intervals, shift)}`;
}
