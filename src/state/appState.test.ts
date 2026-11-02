import { describe, expect, it } from 'vitest';
import { buildChord } from '../music/chords';
import { defaultNoteQuizSettings } from '../music/quiz';
import { createInitialState, mergeApp, mergeProgression, persistedApp } from './appState';

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

  it('leaves the staff off when an older setup has no staff flag', () => {
    expect(createInitialState().showStaff).toBe(false);
    expect(createInitialState().staffPitch).toBe('concert');
    expect(mergeApp({ rootPc: 0 }).showStaff).toBe(false);
    expect(mergeApp({ rootPc: 0 }).staffPitch).toBe('concert');
    expect(mergeApp({ showStaff: true, staffPitch: 'guitar' }).showStaff).toBe(true);
    expect(mergeApp({ showStaff: true, staffPitch: 'guitar' }).staffPitch).toBe('guitar');
  });

  it('fills note-quiz settings when an older setup has none', () => {
    const loaded = mergeApp({ rootPc: 2 });
    expect(loaded.noteQuiz).toEqual(defaultNoteQuizSettings(loaded.numStrings, loaded.fretCount));
    expect(loaded.noteQuiz.enabled).toBe(false);
  });

  it('keeps a saved note quiz and drops strings the instrument does not have', () => {
    const loaded = mergeApp({
      numStrings: 6,
      noteQuiz: {
        enabled: true,
        strings: [0, 2, 9],
        fretMin: 1,
        fretMax: 5,
        naturalsOnly: true,
        keyContext: 'key',
        types: { nameNote: true, findNote: false, intervalFromRoot: true, earInterval: false },
        harmonic: true,
      },
    });
    expect(loaded.noteQuiz.enabled).toBe(true);
    expect(loaded.noteQuiz.strings).toEqual([0, 2]);
    expect(loaded.noteQuiz.fretMin).toBe(1);
    expect(loaded.noteQuiz.fretMax).toBe(5);
    expect(loaded.noteQuiz.naturalsOnly).toBe(true);
    expect(loaded.noteQuiz.keyContext).toBe('key');
    expect(loaded.noteQuiz.types.findNote).toBe(false);
    expect(loaded.noteQuiz.types.earInterval).toBe(false);
    expect(loaded.noteQuiz.harmonic).toBe(true);
  });

  it('does not restore an identify grip', () => {
    expect(mergeApp({ picked: { 0: 3, 2: 5 } }).picked).toEqual({});
    const app = createInitialState();
    app.picked = { 1: 2 };
    expect(persistedApp(app).picked).toEqual({});
    expect(app.picked).toEqual({ 1: 2 });
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
