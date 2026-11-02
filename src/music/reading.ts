// Plain-language reading of a scale or a chord: where the scale came from,
// which degrees actually moved, and which notes over a chord can sit, colour,
// or lean.

import type { Chord, ChordToneRole } from './chords';
import { mod } from './notes';
import type { FamilyKey } from './scales';
import { pitchSpelling, spellChordTone, spellScale, spellStep } from './spelling';
import type { SpelledTone } from './spelling';

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const DEGREE_FUNCTION = [
  'tonic',
  'subdominant',
  'tonic',
  'subdominant',
  'dominant',
  'tonic',
  'dominant',
] as const;

interface ParentMove {
  /** Degree index in the parent scale that was raised or lowered. */
  parentIndex: number;
  direction: 'raised' | 'lowered';
  /** "7th", "3rd", "6th". */
  degreeName: string;
  /** What the parent is, relative to a familiar scale. */
  summary: string;
}

const PARENT_MOVE: Partial<Record<FamilyKey, ParentMove | null>> = {
  major: null,
  melodicMinor: {
    parentIndex: 2,
    direction: 'lowered',
    degreeName: '3rd',
    summary: 'major with a lowered 3rd',
  },
  harmonicMinor: {
    parentIndex: 6,
    direction: 'raised',
    degreeName: '7th',
    summary: 'natural minor with a raised 7th',
  },
  harmonicMajor: {
    parentIndex: 5,
    direction: 'lowered',
    degreeName: '6th',
    summary: 'major with a lowered 6th',
  },
};

const FAMILY_PHRASE: Partial<Record<FamilyKey, string>> = {
  major: 'major',
  melodicMinor: 'melodic minor',
  harmonicMinor: 'harmonic minor',
  harmonicMajor: 'harmonic major',
};

export interface ScaleOrigin {
  text: string;
  /** Degree index, in this mode, of the note the parent scale moved. */
  movedIndex: number | null;
}

export interface ScalePull {
  index: number;
  text: string;
}

function familyPhrase(key: FamilyKey): string {
  return FAMILY_PHRASE[key] ?? key;
}

/**
 * Where a heptatonic mode comes from. Major modes only change the starting
 * note. The other three parents move one degree, and the rotation carries
 * that note onto a new degree number.
 */
export function scaleOrigin(
  familyKey: FamilyKey,
  modeIndex: number,
  rootPc: number,
  parentIntervals: number[],
  modeIntervals: number[],
): ScaleOrigin | null {
  if (!(familyKey in PARENT_MOVE)) return null;
  if (modeIntervals.length !== 7 || parentIntervals.length !== 7) return null;
  if (modeIndex < 0 || modeIndex > 6) return null;

  const spelled = spellScale(rootPc, modeIntervals);
  const rootName = spelled?.[0]?.name ?? pitchSpelling(rootPc);
  const parentRoot = mod(rootPc - parentIntervals[modeIndex], 12);
  const parentName = spellScale(parentRoot, parentIntervals)?.[0]?.name ?? pitchSpelling(parentRoot);
  const move = PARENT_MOVE[familyKey];
  const phrase = familyPhrase(familyKey);

  if (!move) {
    if (modeIndex === 0) return { text: `${rootName} major.`, movedIndex: null };
    return {
      text: `Mode ${modeIndex + 1} of ${parentName} major. Same notes, started on ${rootName}.`,
      movedIndex: null,
    };
  }

  const landed = mod(move.parentIndex - modeIndex, 7);
  const landedName = spelled?.[landed]?.name ?? '';
  if (modeIndex === 0) {
    return {
      text: `${rootName} ${phrase} is ${move.summary}.`,
      movedIndex: landed,
    };
  }
  return {
    text: `Mode ${modeIndex + 1} of ${parentName} ${phrase}. The ${move.direction} ${move.degreeName} of that scale is the ${ORDINALS[landed]} here (${landedName}).`,
    movedIndex: landed,
  };
}

/**
 * Scale degrees a half step from a resting tone of the tonic triad, skipping
 * the ordinary 2–b3 step. A half step above a resting tone falls to it. The
 * leading tone, a half step under the root, rises.
 */
export function scalePulls(rootPc: number, intervals: number[]): ScalePull[] {
  if (intervals.length !== 7) return [];
  const spelled = spellScale(rootPc, intervals);
  if (!spelled) return [];
  const pulls: ScalePull[] = [];
  const claim = (index: number, text: string) => {
    if (pulls.some((pull) => pull.index === index)) return;
    pulls.push({ index, text });
  };
  for (let i = 1; i < 7; i++) {
    const tone = spelled[i].name;
    if (intervals[i] === 11) {
      claim(i, `The ${ORDINALS[i]} (${tone}) rises to ${spelled[0].name}.`);
    } else if (intervals[i] === 1) {
      claim(i, `The ${ORDINALS[i]} (${tone}) falls to ${spelled[0].name}.`);
    }
    if (mod(intervals[i] - intervals[2], 12) === 1) {
      claim(i, `The ${ORDINALS[i]} (${tone}) falls to ${spelled[2].name}.`);
    }
    if (mod(intervals[i] - intervals[4], 12) === 1) {
      claim(i, `The ${ORDINALS[i]} (${tone}) falls to ${spelled[4].name}.`);
    }
  }
  return pulls;
}

export interface ChoiceNote {
  name: string;
  degree: string;
  /** Why a lean note is tense, and where it can step. */
  detail: string | null;
}

export interface ChordReading {
  summary: string;
  sit: ChoiceNote[];
  color: ChoiceNote[];
  lean: ChoiceNote[];
  inversion: string | null;
}

const TENSIONS: { interval: number; degree: string }[] = [
  { interval: 1, degree: 'b9' },
  { interval: 2, degree: '9' },
  { interval: 3, degree: '#9' },
  { interval: 5, degree: '11' },
  { interval: 6, degree: '#11' },
  { interval: 8, degree: 'b13' },
  { interval: 9, degree: '13' },
];

const INVERSION_TEXT: Record<ChordToneRole, string> = {
  root: 'Root in the bass. This is the settled shape.',
  third: '3rd in the bass. Lighter than root position, and the bass wants to move by step.',
  fifth: '5th in the bass. The chord sounds suspended.',
  seventh: '7th in the bass. The tense tone sits lowest.',
  ext: 'A color tone is in the bass, so the foundation wants to resolve.',
};

interface Structural {
  pc: number;
  interval: number;
  name: string;
  role: ChordToneRole;
  degree: string;
}

function tonePc(chord: Chord, interval: number): number {
  return mod(chord.rootPc + interval, 12);
}

function nameIn(scale: SpelledTone[] | null, pc: number): string {
  const want = mod(pc, 12);
  return scale?.find((tone) => tone.pc === want)?.name ?? pitchSpelling(want);
}

function functionSentence(
  chord: Chord,
  keyRoot: number,
  keyIntervals: number[],
  scale: SpelledTone[] | null,
): string {
  const rel = mod(chord.rootPc - keyRoot, 12);
  const idx = keyIntervals.indexOf(rel);
  const targetPc = mod(chord.rootPc - 7, 12);
  const targetIdx = keyIntervals.indexOf(mod(targetPc - keyRoot, 12));
  const ints = chord.tones.map((tone) => mod(tone.interval, 12));
  const dom7 = ints.includes(4) && ints.includes(10);

  if (dom7 && targetIdx >= 0 && targetPc !== keyRoot) {
    return `Secondary dominant of ${ROMAN[targetIdx]}.`;
  }
  if (dom7 && targetIdx < 0) {
    return `Dominant of ${nameIn(scale, targetPc)}.`;
  }
  if (idx === 4) return 'Dominant.';
  if (idx === 6) {
    const leading = ints.some((interval) => tonePc(chord, interval) === mod(keyRoot - 1, 12)) || chord.rootPc === mod(keyRoot - 1, 12);
    const diminished = ints.includes(3) && ints.includes(6);
    return leading || diminished ? 'Dominant.' : 'Subdominant.';
  }
  if (idx >= 0) {
    const fn = DEGREE_FUNCTION[idx];
    if (fn === 'tonic') return 'Tonic.';
    if (fn === 'subdominant') return 'Subdominant.';
    return 'Dominant.';
  }
  return 'Chromatic.';
}

/**
 * How a dominant tritone resolves. Into this key, the leading tone rises a
 * half step and its partner falls onto the 3rd (a half step in major, a whole
 * step in minor). Otherwise the chord's own 3rd rises and its flat 7th falls.
 */
function tritoneRelease(
  chord: Chord,
  keyRoot: number,
  keyThird: number,
  scale: SpelledTone[] | null,
  next: Chord | null,
): string | null {
  const name = (pc: number) => nameIn(scale, pc);
  const pcs = [...new Set(chord.tones.map((tone) => tonePc(chord, tone.interval)))];
  const leading = mod(keyRoot - 1, 12);
  if (pcs.includes(leading)) {
    const partner = pcs.find((pc) => pc !== leading && mod(pc - leading, 12) === 6);
    const gap = partner === undefined ? 0 : mod(partner - keyThird, 12);
    if (partner !== undefined && (gap === 1 || gap === 2)) {
      const text = `${name(leading)} rises to ${name(keyRoot)} and ${name(partner)} falls to ${name(keyThird)}`;
      return text + nextClause(keyRoot, keyThird, next, name);
    }
  }

  if (!chord.tones.some((tone) => mod(tone.interval, 12) === 4)) return null;
  if (!chord.tones.some((tone) => mod(tone.interval, 12) === 10)) return null;
  const rise = tonePc(chord, 4);
  const fall = tonePc(chord, 10);
  const up = mod(rise + 1, 12);
  const down = mod(fall - 1, 12);
  const text = `${name(rise)} rises to ${name(up)} and ${name(fall)} falls to ${name(down)}`;
  return text + nextClause(up, down, next, name);
}

function nextClause(
  up: number,
  down: number,
  next: Chord | null,
  name: (pc: number) => string,
): string {
  if (!next) return '.';
  const nextRoot = next.rootPc;
  const third = next.tones.find((tone) => tone.role === 'third');
  const nextThird = third ? tonePc(next, third.interval) : null;
  const arrivals = new Set([up, down]);
  const symbol = `${name(nextRoot)}${next.symbol}`;
  if (nextThird !== null && arrivals.has(nextRoot) && arrivals.has(nextThird)) {
    return `, the root and 3rd of ${symbol}.`;
  }
  return `. Next is ${symbol}.`;
}

function leadingRelease(chord: Chord, keyRoot: number, scale: SpelledTone[] | null): string | null {
  const leading = mod(keyRoot - 1, 12);
  const has = chord.rootPc === leading || chord.tones.some((tone) => tonePc(chord, tone.interval) === leading);
  if (!has) return null;
  return `${nameIn(scale, leading)} is the leading tone. It rises to ${nameIn(scale, keyRoot)}.`;
}

function choices(chord: Chord): { sit: ChoiceNote[]; color: ChoiceNote[]; lean: ChoiceNote[] } {
  const structural: Structural[] = [];
  const seen = new Set<number>();
  for (const tone of chord.tones) {
    if (tone.role === 'ext') continue;
    const interval = mod(tone.interval, 12);
    const pc = tonePc(chord, interval);
    if (seen.has(pc)) continue;
    seen.add(pc);
    structural.push({
      pc,
      interval,
      role: tone.role,
      degree: tone.degree,
      name: spellChordTone(chord.rootPc, interval, tone.degree),
    });
  }
  const foundation = new Set(
    structural.filter((tone) => tone.role === 'root' || tone.role === 'third' || tone.role === 'fifth').map((tone) => tone.pc),
  );
  const hasFifth = structural.some((tone) => tone.interval === 7);

  const sit: ChoiceNote[] = structural
    .filter((tone) => foundation.has(tone.pc))
    .sort((a, b) => a.interval - b.interval)
    .map((tone) => ({ name: tone.name, degree: tone.degree, detail: null }));

  const color: ChoiceNote[] = [];
  const lean: ChoiceNote[] = [];
  const inChord = new Set(chord.pcs.map((pc) => mod(pc, 12)));

  for (const tension of TENSIONS) {
    const pc = tonePc(chord, tension.interval);
    if (foundation.has(pc)) continue;
    const name = spellChordTone(chord.rootPc, tension.interval, tension.degree);
    const above = structural.find((tone) => mod(tension.interval - tone.interval, 12) === 1);
    const whole = structural.find((tone) => mod(tension.interval - tone.interval, 12) === 2);
    // A half step above a chord tone is the harsh one (the minor 9th). A half
    // step below is milder, except #9 under the 3rd and #11 under the 5th.
    const underThird = tension.interval === 3 && structural.some((tone) => tone.interval === 4);
    const underFifth = tension.interval === 6 && hasFifth;

    if (above) {
      const up = spellStep(above.name, above.pc, 2, 1);
      lean.push({
        name,
        degree: tension.degree,
        detail: `a half step above ${above.name}, steps down to ${above.name} or up to ${up}`,
      });
      continue;
    }
    if (underThird || underFifth) {
      const rubbed = structural.find((tone) => tone.interval === (underThird ? 4 : 7));
      if (rubbed) {
        const down = spellStep(rubbed.name, rubbed.pc, -2, -1);
        lean.push({
          name,
          degree: tension.degree,
          detail: `a half step under ${rubbed.name}, steps up to ${rubbed.name} or down to ${down}`,
        });
        continue;
      }
    }
    if (whole || (tension.interval === 6 && !hasFifth)) {
      color.push({ name, degree: tension.degree, detail: null });
      continue;
    }
    if (tension.interval === 8 && !hasFifth && inChord.has(pc)) {
      lean.push({
        name,
        degree: tension.degree,
        detail: 'a half step above the 5th, which this chord leaves out',
      });
      continue;
    }
    if (inChord.has(pc)) color.push({ name, degree: tension.degree, detail: null });
  }

  return { sit, color, lean };
}

export function chordReading(
  keyRootPc: number,
  keyIntervals: number[],
  chord: Chord,
  next: Chord | null,
  bassRole: ChordToneRole | null,
): ChordReading {
  const scale = keyIntervals.length === 7 ? spellScale(keyRootPc, keyIntervals) : null;
  const keyThird = keyIntervals.length > 2 ? mod(keyRootPc + keyIntervals[2], 12) : mod(keyRootPc + 4, 12);
  const ints = chord.tones.map((tone) => mod(tone.interval, 12));
  const hasThird = ints.includes(3) || ints.includes(4);
  const functionText = functionSentence(chord, keyRootPc, keyIntervals, scale);

  let release = tritoneRelease(chord, keyRootPc, keyThird, scale, next);
  if (!release) release = leadingRelease(chord, keyRootPc, scale);
  if (!release && ints.includes(5) && !hasThird) {
    const fourth = tonePc(chord, 5);
    release = `The 4th (${nameIn(scale, fourth)}) falls to ${nameIn(scale, mod(fourth - 1, 12))}.`;
  }
  if (!release && ints.includes(11)) {
    const seventh = tonePc(chord, 11);
    if (seventh !== mod(keyRootPc - 1, 12)) {
      release = `The 7th (${nameIn(scale, seventh)}) rises to ${spellChordTone(chord.rootPc, 0, '1')}.`;
    }
  }
  if (!release && keyIntervals.indexOf(mod(chord.rootPc - keyRootPc, 12)) === 4) {
    const hasLeading = chord.tones.some((tone) => tonePc(chord, tone.interval) === mod(keyRootPc - 1, 12));
    if (!hasLeading) {
      release = 'The leading tone is still lowered, so the pull back to the tonic is soft.';
    }
  }

  const summary = release ? `${functionText} ${release}` : functionText;
  const grouped = choices(chord);
  return {
    summary,
    sit: grouped.sit,
    color: grouped.color,
    lean: grouped.lean,
    inversion: bassRole ? INVERSION_TEXT[bassRole] : null,
  };
}

export function shiftChord(chord: Chord, shift: number): Chord {
  if (shift === 0) return chord;
  const rootPc = mod(chord.rootPc + shift, 12);
  return {
    ...chord,
    rootPc,
    pcs: chord.pcs.map((pc) => mod(pc + shift, 12)),
  };
}

export function nextInProgression(chords: Chord[], active: Chord | null, loop: boolean): Chord | null {
  if (!active || chords.length < 2) return null;
  const index = chords.indexOf(active);
  if (index < 0) return null;
  const next = index + 1;
  if (next < chords.length) return chords[next];
  return loop ? chords[0] : null;
}
