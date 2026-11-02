import { describe, expect, it } from 'vitest';
import { chordSymbol } from './chords';
import { mulberry32 } from './progression';
import { makeQuestion } from './quiz';

const major = [0, 2, 4, 5, 7, 9, 11];
const pentatonic = [0, 2, 4, 7, 9];
const wholeTone = [0, 2, 4, 6, 8, 10];
const diminished = [0, 1, 3, 4, 6, 7, 9, 10];
const scales = [major, pentatonic, wholeTone, diminished];

describe('makeQuestion', () => {
  it('returns the same question for the same seed', () => {
    const a = makeQuestion(mulberry32(1), 7, major, 0);
    const b = makeQuestion(mulberry32(1), 7, major, 0);
    expect(a).toEqual(b);
    expect(a.prompt).toBe(`Find the ${a.targetDegree} of ${chordSymbol(a.chord, 0)}`);
  });

  it('keeps every target inside the chord across 500 questions', () => {
    const rnd = mulberry32(1);
    let borrowed = 0;
    let diatonic = 0;
    let diatonicSevenths = 0;

    for (let i = 0; i < 500; i++) {
      const keyRootPc = i % 12;
      const shift = i % 2;
      const intervals = scales[i % scales.length];
      const question = makeQuestion(rnd, keyRootPc, intervals, shift);
      const tone = question.chord.tones.find((item) => item.degree === question.targetDegree);

      expect(question.chord.pcs).toContain(question.targetPc);
      expect(tone).toBeDefined();
      expect(question.prompt).toBe(
        `Find the ${question.targetDegree} of ${chordSymbol(question.chord, shift)}`,
      );

      if (question.chord.quality) {
        borrowed += 1;
        expect(['7', 'm7', 'maj7', 'm7b5']).toContain(question.chord.quality);
      } else {
        diatonic += 1;
        if (question.chord.tones.length === 4) diatonicSevenths += 1;
      }
    }

    expect(borrowed).toBeGreaterThan(60);
    expect(borrowed).toBeLessThan(140);
    expect(diatonicSevenths / diatonic).toBeGreaterThan(0.35);
    expect(diatonicSevenths / diatonic).toBeLessThan(0.65);
  });
});
