import { buildChord, buildDiatonicChord, chordSymbol, type Chord, type ChordQuality } from './chords';
import { mod } from './notes';

export interface Question {
  chord: Chord;
  targetDegree: string;
  targetPc: number;
  prompt: string;
}

const BORROWED: readonly ChordQuality[] = ['7', 'm7', 'maj7', 'm7b5'];

/**
 * One quiz item for the current key. About 80% of chords are diatonic
 * (degree 0-6, a seventh half the time). The rest are a borrowed seventh
 * on a random root. The asked tone is one of that chord's own degrees.
 */
export function makeQuestion(
  rnd: () => number,
  keyRootPc: number,
  intervals: number[],
  shift: number,
): Question {
  const chord =
    rnd() < 0.8
      ? buildDiatonicChord(keyRootPc, intervals, Math.floor(rnd() * 7), rnd() < 0.5)
      : buildChord(Math.floor(rnd() * 12), BORROWED[Math.floor(rnd() * BORROWED.length)]);
  const tone = chord.tones[Math.floor(rnd() * chord.tones.length)];
  const targetDegree = tone.degree;
  const targetPc = mod(chord.rootPc + tone.interval, 12);
  return {
    chord,
    targetDegree,
    targetPc,
    prompt: `Find the ${targetDegree} of ${chordSymbol(chord, shift)}`,
  };
}
