import { describe, expect, it } from 'vitest';
import { scaleUpAndDown } from './useTransport';

describe('scaleUpAndDown', () => {
  it('plays a major scale up and back down as 15 notes', () => {
    const notes = scaleUpAndDown(10, [0, 2, 4, 5, 7, 9, 11], 4);
    expect(notes.map((note) => note.midi)).toEqual([70, 72, 74, 75, 77, 79, 81, 82, 81, 79, 77, 75, 74, 72, 70]);
    expect(notes.map((note) => note.degree)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0]);
  });
});
