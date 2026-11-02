import { describe, expect, it } from 'vitest';
import { SCALE_FAMILIES } from './scales';

const HEPTATONIC_FAMILIES = ['major', 'melodicMinor', 'harmonicMinor', 'harmonicMajor'];

describe('SCALE_FAMILIES', () => {
  for (const family of SCALE_FAMILIES) {
    for (const mode of family.modes) {
      it(`${family.key}/${mode.key} starts at 0, ascends strictly, stays below 12`, () => {
        const iv = mode.intervals;
        expect(iv[0]).toBe(0);
        for (let i = 1; i < iv.length; i++) {
          expect(iv[i]).toBeGreaterThan(iv[i - 1]);
        }
        for (const semi of iv) {
          expect(semi).toBeGreaterThanOrEqual(0);
          expect(semi).toBeLessThan(12);
        }
      });
    }
  }

  for (const family of SCALE_FAMILIES.filter((f) => HEPTATONIC_FAMILIES.includes(f.key))) {
    for (const mode of family.modes) {
      it(`${family.key}/${mode.key} has 7 intervals`, () => {
        expect(mode.intervals).toHaveLength(7);
      });
    }
  }
});
