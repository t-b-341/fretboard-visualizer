import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildChord } from '../music/chords';
import { defaultNoteQuizSettings } from '../music/quiz';
import { createInitialState, defaultProgression, mergeApp, mergeProgression, persistedApp } from './appState';
import { loadStore } from './setups';

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

  it('keeps the MIDI input name and played-note toggles, and fills them in for older setups', () => {
    expect(createInitialState().midiInputName).toBe('');
    expect(createInitialState().showPlayedNotes).toBe(true);
    expect(createInitialState().soundPlayedNotes).toBe(false);

    const loaded = mergeApp({
      midiInputName: 'Keystation 61',
      showPlayedNotes: false,
      soundPlayedNotes: true,
    });
    expect(loaded.midiInputName).toBe('Keystation 61');
    expect(loaded.showPlayedNotes).toBe(false);
    expect(loaded.soundPlayedNotes).toBe(true);

    const older = mergeApp({ rootPc: 0 });
    expect(older.midiInputName).toBe('');
    expect(older.showPlayedNotes).toBe(true);
    expect(older.soundPlayedNotes).toBe(false);
    expect(mergeApp({ midiInputName: '  ' }).midiInputName).toBe('');
    expect(mergeApp({ midiInputName: 12 }).midiInputName).toBe('');
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

  it('tolerates missing and garbage fields and keeps valid ones', () => {
    const fresh = createInitialState();
    expect(mergeApp(undefined)).toEqual(fresh);
    expect(mergeApp(null)).toEqual(fresh);
    expect(mergeApp('not-json')).toEqual(fresh);
    expect(mergeApp(4)).toEqual(fresh);

    const fromArray = mergeApp([1, 'nope', null]);
    expect(fromArray.viewMode).toBe('scale');
    expect(fromArray.rootPc).toBe(fresh.rootPc);
    expect(fromArray.fretFrom).toBe(0);
    expect(fromArray.fretTo).toBe(fresh.fretCount);
    expect(fromArray.tuning).toHaveLength(fresh.numStrings);

    const loaded = mergeApp({
      rootPc: 4,
      familyKey: 'not-a-family',
      modeKey: 'not-a-mode',
      viewMode: 'full-scale',
      numStrings: 9,
      fretCount: 99,
      fretFrom: -3,
      fretTo: 2.2,
      labelMode: 'transposed',
      activeChord: { rootPc: 4 },
      tuning: [{ pc: 0 }],
      hiddenStrings: ['low', -1, 1, 1, 99],
    });
    expect(loaded.rootPc).toBe(4);
    expect(loaded.familyKey).toBe(fresh.familyKey);
    expect(loaded.modeKey).toBe(fresh.modeKey);
    expect(loaded.viewMode).toBe('scale');
    expect(loaded.numStrings).toBe(fresh.numStrings);
    expect(loaded.fretCount).toBe(24);
    expect(loaded.fretFrom).toBe(0);
    expect(loaded.fretTo).toBe(2);
    expect(loaded.labelMode).toBe('concert');
    expect(loaded.activeChord).toBeNull();
    expect(loaded.tuning).toEqual(fresh.tuning);
    expect(loaded.hiddenStrings).toEqual([1]);

    const kept = mergeApp({
      viewMode: 'quiz',
      rootPc: 'nope',
      fretCount: 18,
      fretFrom: 10,
      fretTo: 4,
    });
    expect(kept.viewMode).toBe('quiz');
    expect(kept.rootPc).toBe(fresh.rootPc);
    expect(kept.fretCount).toBe(18);
    expect(kept.fretFrom).toBe(10);
    expect(kept.fretTo).toBe(10);
  });
});

describe('fretboard-visualizer:setups:v1', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a hand-written v1 setup to the state it was saved from', () => {
    const savedFrom = {
      ...createInitialState(),
      rootPc: 2,
      viewMode: 'chord' as const,
      chordDisplay: 'voicing' as const,
      fretFrom: 2,
      fretTo: 14,
      showStaff: true,
      labelMode: 'standard' as const,
      activeChord: buildChord(2, 'm7'),
    };
    const progressionFrom = {
      ...defaultProgression(),
      tempo: 88,
      beatsPerChord: 4,
      loop: false,
      chords: [buildChord(2, 'm7'), buildChord(7, '7')],
    };

    // Written out the way setups.ts stores it under this key: version 1,
    // a last session, and a named setup. The identify grip is in the blob
    // and must not come back. Unknown keys are ignored.
    const document = JSON.parse(`{
      "version": 1,
      "last": {
        "app": {
          "rootPc": 2,
          "viewMode": "chord",
          "chordDisplay": "voicing",
          "fretFrom": 2,
          "fretTo": 14,
          "showStaff": true,
          "labelMode": "standard",
          "keyboardOctaves": 3,
          "keyboardSpanChosen": true,
          "activeChord": { "rootPc": 2, "quality": "m7" },
          "picked": { "0": 4 },
          "futureKnob": true
        },
        "progression": {
          "tempo": 88,
          "beatsPerChord": 4,
          "loop": false,
          "chords": [
            { "rootPc": 2, "quality": "m7" },
            { "rootPc": 7, "quality": "7" }
          ]
        }
      },
      "named": [
        {
          "id": "live-1",
          "name": "D minor groove",
          "savedAt": 1735689600000,
          "app": {
            "rootPc": 2,
            "viewMode": "chord",
            "chordDisplay": "voicing",
            "fretFrom": 2,
            "fretTo": 14,
            "showStaff": true,
            "labelMode": "standard",
            "keyboardOctaves": 3,
            "keyboardSpanChosen": true,
            "activeChord": { "rootPc": 2, "quality": "m7" },
            "picked": { "0": 4 }
          },
          "progression": {
            "tempo": 88,
            "beatsPerChord": 4,
            "loop": false,
            "chords": [
              { "rootPc": 2, "quality": "m7" },
              { "rootPc": 7, "quality": "7" }
            ]
          }
        }
      ]
    }`);

    const memory = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => {
        memory.clear();
      },
    });
    localStorage.setItem('fretboard-visualizer:setups:v1', JSON.stringify(document));

    const store = loadStore();
    expect(store.version).toBe(1);
    expect(store.named).toHaveLength(1);
    expect(store.named[0].id).toBe('live-1');
    expect(store.named[0].name).toBe('D minor groove');
    expect(mergeApp(store.last?.app)).toEqual(savedFrom);
    expect(mergeApp(store.named[0].app)).toEqual(savedFrom);
    expect(mergeProgression(store.last?.progression)).toEqual(progressionFrom);
    expect(mergeProgression(store.named[0].progression)).toEqual(progressionFrom);
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
