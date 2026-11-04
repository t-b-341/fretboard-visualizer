import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { detectKeys } from './detectKey';
import { getFamily } from './scales';
import { keyLabel, scaleReadout } from './keyLabel';

const ionian = getFamily('major').modes.find((mode) => mode.key === 'Ionian')!.intervals;
const dorian = getFamily('major').modes.find((mode) => mode.key === 'Dorian')!.intervals;
const aeolian = getFamily('major').modes.find((mode) => mode.key === 'Aeolian')!.intervals;

function id(key: { rootPc: number; familyKey: string; modeKey: string }): string {
  return `${key.rootPc}:${key.familyKey}:${key.modeKey}`;
}

describe('key labels', () => {
  it('spells a major scale and shifts it for Standard names', () => {
    expect(scaleReadout(10, 'Ionian', ionian)).toBe('Bb major \u00b7 Bb C D Eb F G A');
    expect(scaleReadout(4, 'Ionian', ionian)).toBe('E major \u00b7 E F# G# A B C# D#');
    expect(scaleReadout(4, 'Ionian', ionian, 1)).toBe('F major \u00b7 F G A Bb C D E');
    expect(scaleReadout(4, 'Dorian', dorian)).toBe('E Dorian \u00b7 E F# G A B C# D');
    expect(scaleReadout(4, 'Aeolian', aeolian)).toBe('E minor \u00b7 E F# G A B C D');
    expect(keyLabel(3, 'Aeolian')).toBe('Eb minor');
    expect(keyLabel(3, 'Aeolian', 1)).toBe('E minor');
  });
});

describe('detectKeys', () => {
  const cm7 = buildChord(0, 'm7');
  const f7 = buildChord(5, '7');
  const bbmaj7 = buildChord(10, 'maj7');

  it('ranks Bb major first for Cm7 F7 Bbmaj7 and lists G minor', () => {
    const found = detectKeys([cm7, f7, bbmaj7], null);
    expect(found).toHaveLength(3);
    expect(id(found[0])).toBe('10:major:Ionian');
    expect(found[0].reason).toBe('All 3 chords diatonic. ii\u2013V\u2013I ends on its tonic.');
    const minor = found.find((key) => id(key) === '7:major:Aeolian');
    expect(minor?.reason).toBe('Same notes as Bb major. No G minor chord yet, so weaker.');
    expect(found.map((key) => key.score)).toEqual([...found.map((key) => key.score)].sort((a, b) => b - a));
  });

  it('puts C major and A minor in the top two for Am F C G', () => {
    const found = detectKeys(
      [buildChord(9, 'min'), buildChord(5, 'maj'), buildChord(0, 'maj'), buildChord(7, 'maj')],
      [0, 4, 7],
    );
    expect(found.slice(0, 2).map(id).sort()).toEqual(['0:major:Ionian', '9:major:Aeolian']);
  });

  it('returns three keys for a single C major triad', () => {
    const found = detectKeys([buildChord(0, 'maj')], null);
    expect(found).toHaveLength(3);
    expect(found.every((key) => Number.isFinite(key.score) && key.reason.length > 0)).toBe(true);
  });

  it('ranks a held C major seventh as C major, C Lydian, or G major', () => {
    const found = detectKeys(null, [0, 4, 7, 11]);
    expect(found).toHaveLength(3);
    expect(['0:major:Ionian', '0:major:Lydian', '7:major:Ionian']).toContain(id(found[0]));
    expect(id(found[0])).toBe('0:major:Ionian');
    expect(found.map(id)).toContain('0:major:Lydian');
  });

  it('returns nothing when there is nothing to hear', () => {
    expect(detectKeys(null, null)).toEqual([]);
    expect(detectKeys([], null)).toEqual([]);
    expect(detectKeys(null, [])).toEqual([]);
    expect(detectKeys([], [])).toEqual([]);
  });
});
