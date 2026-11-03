import { describe, expect, it } from 'vitest';
import { buildChord } from './chords';
import { formatTab } from './tab';
import { getPreset } from './tunings';
import { findVoicings, type VoicedNote } from './voicings';

function at(stringIndex: number, fret: number): VoicedNote {
  return { stringIndex, fret, midi: 0, pc: 0, role: 'root' };
}

const halfDown7 = getPreset('7-half-down')!.notes;

describe('formatTab', () => {
  it('formats a single drop-2 grip on a 7-string', () => {
    const tuning = getPreset('7-standard')!.notes;
    const chord = buildChord(0, 'maj7');
    const grip = findVoicings(tuning, 12, chord, 'drop2', 0, 1, 4).find(
      (notes) => notes.map((note) => note.fret).join(',') === '8,10,9,9',
    );
    expect(grip).toBeDefined();
    expect(formatTab(tuning, [{ label: 'Cmaj7', notes: grip! }])).toBe(
      [
        '  Cmaj7',
        'E|-----',
        'B|-----',
        'G|9----',
        'D|9----',
        'A|10---',
        'E|8----',
        'B|-----',
      ].join('\n'),
    );
  });

  it('aligns a 3-chord progression and widens the column that holds a two-digit fret', () => {
    const tab = formatTab(halfDown7, [
      { label: 'Dm7', notes: [at(6, 5), at(5, 6), at(4, 7), at(3, 7)] },
      { label: 'G7', notes: [at(6, 3), at(5, 4), at(4, 3), at(3, 5)] },
      { label: 'C', notes: [at(6, 8), at(5, 8), at(4, 9), at(3, 10)] },
    ]);
    expect(tab).toBe(
      [
        '   Dm7 G7 C',
        'Eb|5-- 3- 8-',
        'Bb|6-- 4- 8-',
        'Gb|7-- 3- 9-',
        'Db|7-- 5- 10',
        'Ab|--- -- --',
        'Eb|--- -- --',
        'Bb|--- -- --',
      ].join('\n'),
    );
    const db = tab.split('\n')[4];
    expect(db.endsWith('10')).toBe(true);
    expect(db).toContain('5-');
  });

  it('prints an 8-string with the low F padded to the flat names', () => {
    const tuning = getPreset('8-half-down')!.notes;
    expect(formatTab(tuning, [{ notes: [at(7, 1), at(0, 12)] }])).toBe(
      ['Eb|1-', 'Bb|--', 'Gb|--', 'Db|--', 'Ab|--', 'Eb|--', 'Bb|--', ' F|12'].join('\n'),
    );
  });

  it('prints a 6-string bass with the high B padded', () => {
    const tuning = getPreset('6-bass-bb-standard')!.notes;
    expect(formatTab(tuning, [{ notes: [at(5, 3), at(0, 10)] }])).toBe(
      [' B|3-', 'Gb|--', 'Db|--', 'Ab|--', 'Eb|--', 'Bb|10'].join('\n'),
    );
  });

  it('spells open strings in concert and a half step higher in standard', () => {
    const notes = [{ notes: [at(6, 0)] }];
    expect(formatTab(halfDown7, notes)).toBe(
      ['Eb|0', 'Bb|-', 'Gb|-', 'Db|-', 'Ab|-', 'Eb|-', 'Bb|-'].join('\n'),
    );
    // Low to high, Standard reads the half-step-down 7-string as B E A D G B E.
    expect(formatTab(halfDown7, notes, { labelShift: 1 })).toBe(
      ['E|0', 'B|-', 'G|-', 'D|-', 'A|-', 'E|-', 'B|-'].join('\n'),
    );
  });

  it('wraps at a narrow width without splitting a column', () => {
    const columns = ['C', 'D', 'E'].map((label, index) => ({
      label,
      notes: [at(6, index + 1)],
    }));
    expect(formatTab(halfDown7, columns, { maxWidth: 6 })).toBe(
      [
        '   C D',
        'Eb|1 2',
        'Bb|- -',
        'Gb|- -',
        'Db|- -',
        'Ab|- -',
        'Eb|- -',
        'Bb|- -',
        '',
        '   E',
        'Eb|3',
        'Bb|-',
        'Gb|-',
        'Db|-',
        'Ab|-',
        'Eb|-',
        'Bb|-',
      ].join('\n'),
    );

    const wide = formatTab(
      halfDown7,
      [
        { label: 'Cmaj7', notes: [at(6, 12)] },
        { label: 'D', notes: [at(6, 1)] },
      ],
      { maxWidth: 6 },
    );
    const systems = wide.split('\n\n');
    expect(systems).toHaveLength(2);
    expect(systems[0].split('\n')[0]).toBe('   Cmaj7');
    expect(systems[0].split('\n')[1]).toBe('Eb|12---');
    expect(systems[1].split('\n')[0]).toBe('   D');
    expect(systems[1].split('\n')[1]).toBe('Eb|1');
  });
});
