import { describe, expect, it } from 'vitest';
import { buildChord } from '../music/chords';
import { createInitialState, mergeApp, mergeProgression } from './appState';

describe('mergeApp', () => {
  it('round-trips a full saved setup', () => {
    const saved = createInitialState();
    expect(mergeApp(saved)).toEqual(saved);
  });

  it('opens older sessions on 37 keys until the span is chosen', () => {
    const older = mergeApp({ keyboardOctaves: 2 });
    expect(older.keyboardOctaves).toBe(3);
    expect(older.keyboardSpanChosen).toBe(false);

    const chosen = mergeApp({ keyboardOctaves: 1, keyboardSpanChosen: true });
    expect(chosen.keyboardOctaves).toBe(1);
    expect(chosen.keyboardSpanChosen).toBe(true);
  });

  it('colors chords by root unless a saved setup turns it off', () => {
    expect(mergeApp({ rootPc: 0 }).colorChordsByRoot).toBe(true);
    expect(mergeApp({ colorChordsByRoot: false }).colorChordsByRoot).toBe(false);
    expect(createInitialState().colorChordsByRoot).toBe(true);
  });

  it('rebuilds a saved chord from its quality key', () => {
    const loaded = mergeApp({ activeChord: { rootPc: 10, quality: '7' } });
    expect(loaded.activeChord).toEqual(buildChord(10, '7'));
  });
});

describe('mergeProgression', () => {
  it('keeps readable chords and drops the rest', () => {
    const chord = buildChord(0, 'maj');
    const loaded = mergeProgression({
      chords: [chord, { nope: true }, null],
      tempo: 90,
      loop: false,
    });
    expect(loaded.chords).toEqual([chord]);
    expect(loaded.tempo).toBe(90);
    expect(loaded.loop).toBe(false);
  });
});
