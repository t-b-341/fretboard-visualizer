import { describe, expect, it } from 'vitest';
import { buildChord, getDiatonicTriad } from '../music/chords';
import { buildGrid } from '../music/fretboard';
import { guideTonePcs } from '../music/guide';
import { getScaleNotes, parentScale } from '../music/scales';
import type { NeckShape } from '../music/shapes';
import { createInitialState, defaultProgression } from './appState';
import {
  deriveShapes,
  deriveView,
  deriveVoicings,
  highlightEvaluator,
  keyboardHighlight,
  pcToIndex,
  selectScale,
  spellingMap,
  voicedChordOf,
  type VoicingInputs,
} from './derive';

const box: NeckShape = {
  id: 'box',
  name: 'Box 1',
  cells: [{ stringIndex: 0, fret: 5 }],
  fretFrom: 5,
  fretTo: 8,
};

function voicingArgs(over: Partial<VoicingInputs> = {}): VoicingInputs {
  const state = createInitialState();
  const { intervals } = selectScale(state.familyKey, state.modeKey);
  const diatonic = parentScale(intervals);
  const grid = buildGrid(state.tuning, state.fretCount);
  return {
    viewMode: state.viewMode,
    activeChord: state.activeChord,
    triad: getDiatonicTriad(state.rootPc, diatonic.intervals, state.triadDegree),
    chordDisplay: state.chordDisplay,
    voicingIndex: state.voicingIndex,
    voicingStyle: state.voicingStyle,
    voicingInversion: state.voicingInversion,
    voicingWidth: state.voicingWidth,
    voicingSetStart: state.voicingSetStart,
    tuning: state.tuning,
    fretCount: state.fretCount,
    fretFrom: state.fretFrom,
    fretTo: state.fretTo,
    positionWindow: state.positionWindow,
    playbackVoicing: null,
    picked: state.picked,
    grid,
    guideTones: state.guideTones,
    shapeMode: state.shapeMode,
    activeShape: null,
    ...over,
  };
}

describe('selectScale', () => {
  it('returns the mode intervals, and the first mode when the key is unknown', () => {
    const ionian = selectScale('major', 'Ionian');
    expect(ionian.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(ionian.mode.key).toBe('Ionian');

    const fallback = selectScale('major', 'not-a-mode');
    expect(fallback.mode.key).toBe('Ionian');
    expect(fallback.intervals).toBe(ionian.intervals);
  });
});

describe('pcToIndex', () => {
  it('maps each scale pitch class to its degree index', () => {
    const index = pcToIndex([10, 0, 2, 3, 5, 7, 9]);
    expect(index.get(10)).toBe(0);
    expect(index.get(0)).toBe(1);
    expect(index.get(3)).toBe(3);
    expect(index.has(1)).toBe(false);
  });
});

describe('voicedChordOf', () => {
  const triad = getDiatonicTriad(0, [0, 2, 4, 5, 7, 9, 11], 1);

  it('uses the built chord in chord view and the diatonic triad in triad view', () => {
    const chord = buildChord(5, 'm7');
    expect(voicedChordOf('scale', chord, triad)).toBeNull();
    expect(voicedChordOf('chord', chord, triad)).toBe(chord);
    expect(voicedChordOf('triad', null, triad)).toEqual(buildChord(triad.rootPc, triad.quality));
  });
});

describe('spellingMap', () => {
  it('spells the scale first and fills chord tones the scale does not cover', () => {
    const chord = buildChord(0, '7');
    const { spelling } = spellingMap(0, [0, 2, 4, 5, 7, 9, 11], chord, 0);
    expect(spelling.get(4)).toBe('E');
    expect(spelling.get(10)).toBe('Bb');
    expect(spelling.get(0)).toBe('C');
  });

  it('leaves non-heptatonic scales without letter spellings', () => {
    const { scaleSpelling, spelling } = spellingMap(0, [0, 2, 4, 7, 9], null, 0);
    expect(scaleSpelling).toBeNull();
    expect(spelling.size).toBe(0);
  });
});

describe('highlightEvaluator', () => {
  const intervals = [0, 2, 4, 5, 7, 9, 11];
  const base = {
    rootPc: 0,
    intervals,
    pcToIndex: pcToIndex(intervals),
    viewMode: 'scale' as const,
    triad: getDiatonicTriad(0, intervals, 0),
    activeChord: null,
    displayMode: 'note' as const,
    shift: 0,
    ghostScale: true,
    compareEnabled: false,
    comparePcSet: new Set<number>(),
    compareRootPc: 0,
    sharedOnly: false,
  };

  it('draws the scale root and hides pitches outside the scale', () => {
    const evaluate = highlightEvaluator(base);
    expect(evaluate(0)).toMatchObject({ role: 'root', label: 'C' });
    expect(evaluate(1)).toBeNull();
  });

  it('forwards quiz cell marks', () => {
    const evaluate = highlightEvaluator({
      ...base,
      viewMode: 'quiz',
      quizMarks: { '0:3': 'right' },
    });
    expect(evaluate(0, { cellKey: '0:3' })).toEqual({ role: 'right', label: '' });
    expect(evaluate(0)).toBeNull();
  });

  it('measures labels from a reference pitch on both instruments', () => {
    const state = { ...createInitialState(), rootPc: 0, viewMode: 'scale' as const };
    const concert = deriveView(state, defaultProgression(), null, 7);
    expect(concert.referenceName).toBe('G');
    expect(concert.evaluateFretboard(5)?.label).toBe('b7');
    expect(concert.evaluateFretboard(5)?.role).toBe('scale');
    expect(concert.evaluateKeyboard(11)?.label).toBe('3');
    expect(concert.evaluateKeyboard(7)?.reference).toBe(true);

    const standard = deriveView({ ...state, labelMode: 'standard' }, defaultProgression(), null, 7);
    expect(standard.referenceName).toBe('Ab');
    expect(standard.evaluateFretboard(5)?.label).toBe('b7');
  });

  it('hides pitch classes outside a voicing restriction', () => {
    const evaluate = highlightEvaluator({ ...base, restrictPcs: new Set([0]) });
    expect(evaluate(0)?.role).toBe('root');
    expect(evaluate(4)).toBeNull();
  });
});

describe('keyboardHighlight', () => {
  it('places only the voicing pitch classes as chord tones', () => {
    const intervals = [0, 2, 4, 5, 7, 9, 11];
    const chord = buildChord(0, 'maj');
    const evaluate = keyboardHighlight(
      {
        rootPc: 0,
        intervals,
        pcToIndex: pcToIndex(getScaleNotes(0, intervals)),
        viewMode: 'chord',
        triad: getDiatonicTriad(0, intervals, 0),
        activeChord: chord,
        displayMode: 'note',
        shift: 0,
        ghostScale: true,
        compareEnabled: false,
        comparePcSet: new Set(),
        compareRootPc: 0,
        sharedOnly: false,
      },
      new Set([0]),
    );
    expect(evaluate(0)?.role).toBe('root');
    expect(evaluate(4)?.role).toBe('ghost');
  });
});

describe('deriveShapes', () => {
  it('builds position boxes for a heptatonic scale on the default neck', () => {
    const state = createInitialState();
    const { intervals } = selectScale(state.familyKey, state.modeKey);
    const grid = buildGrid(state.tuning, state.fretCount);
    const shapes = deriveShapes(grid, getScaleNotes(state.rootPc, intervals), intervals, state.rootPc);
    expect(shapes.npsShapes.length).toBeGreaterThan(0);
    expect(shapes.cagedShapes.length).toBeGreaterThan(0);
  });
});

describe('deriveVoicings', () => {
  it('leaves the scale view without grips or a caption', () => {
    const got = deriveVoicings(voicingArgs());
    expect(got.voicedChord).toBeNull();
    expect(got.voicingShapes).toEqual([]);
    expect(got.generatedVoicings).toEqual([]);
    expect(got.caption).toBeNull();
    expect(got.onlyCells).toBeNull();
    expect(got.guidePcs).toBeNull();
    expect(got.restrictPcs).toBeNull();
  });

  it('steps through generated grips and lets playback replace the one on screen', () => {
    const chord = buildChord(0, 'maj');
    const got = deriveVoicings(
      voicingArgs({ viewMode: 'chord', activeChord: chord, chordDisplay: 'voicing', voicingIndex: 9999 }),
    );
    expect(got.voicingCount).toBeGreaterThan(1);
    expect(got.voicingIndex).toBe(got.voicingCount - 1);
    expect(got.shownVoicing).toBe(got.generatedVoicings[got.voicingIndex]);
    expect(got.onlyCells).toBeNull();

    const playback = got.generatedVoicings[0];
    const playing = deriveVoicings(
      voicingArgs({
        viewMode: 'chord',
        activeChord: chord,
        chordDisplay: 'voicing',
        playbackVoicing: playback,
      }),
    );
    expect(playing.shownVoicing).toBe(playback);
    expect(playing.voicingPcs).toEqual(new Set(playback.notes.map((note) => note.pc)));
  });

  it('names guide tones and a position box, and clears both for quiz', () => {
    const chord = buildChord(0, 'maj7');
    const guide = deriveVoicings(voicingArgs({ viewMode: 'chord', activeChord: chord, guideTones: true }));
    expect(guide.guideActive).toBe(true);
    expect(guide.guidePcs).toEqual(new Set(guideTonePcs(chord)));
    expect(guide.caption?.startsWith('Guide tones')).toBe(true);

    const shaped = deriveVoicings(voicingArgs({ shapeMode: 'nps', activeShape: box }));
    expect(shaped.caption).toBe('Box 1');
    expect(shaped.onlyCells).toEqual(box.cells);

    const quiz = deriveVoicings(voicingArgs({ viewMode: 'quiz', shapeMode: 'nps', activeShape: box }));
    expect(quiz.caption).toBeNull();
    expect(quiz.onlyCells).toBeNull();
  });

  it('reports when a close voicing does not fit the fret range', () => {
    const got = deriveVoicings(
      voicingArgs({
        viewMode: 'chord',
        activeChord: buildChord(0, 'maj7'),
        voicingStyle: 'close',
        fretFrom: 24,
        fretTo: 24,
      }),
    );
    expect(got.voicingShapes).toEqual([]);
    expect(got.caption).toMatch(/^No close voicing on strings /);
  });

  it('collects picked notes for identify', () => {
    const got = deriveVoicings(voicingArgs({ viewMode: 'identify', picked: { 0: 3, 2: 5 } }));
    expect(got.pickedNotes.map((note) => [note.stringIndex, note.fret])).toEqual([
      [0, 3],
      [2, 5],
    ]);
    expect([...got.activeCells!]).toEqual(['0:3', '2:5']);
  });
});

describe('deriveView', () => {
  it('describes the default Bb major scale', () => {
    const derived = deriveView(createInitialState(), defaultProgression(), null);
    expect(derived.intervals).toEqual([0, 2, 4, 5, 7, 9, 11]);
    expect(derived.pcToIndex.get(10)).toBe(0);
    expect(derived.formula).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(derived.origin?.text).toBe('Bb major.');
    expect(derived.rootName).toBe('Bb');
    expect(derived.scaleSpelling?.map((tone) => tone.name)).toEqual(['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A']);
    expect(derived.voicedChord).toBeNull();
    expect(derived.spellFormula).toBeNull();
    expect(derived.evaluateFretboard(10)).toMatchObject({ role: 'root', label: 'Bb' });
    expect(derived.evaluateFretboard(1)).toBeNull();
    expect(derived.keyboardLowestMidi).toBe(48);
  });

  it('spells the active chord and ghosts scale tones that are not chord tones', () => {
    const chord = buildChord(10, '7');
    const derived = deriveView(
      { ...createInitialState(), viewMode: 'chord', activeChord: chord },
      defaultProgression(),
      null,
    );
    expect(derived.voicedChord).toBe(chord);
    expect(derived.activeChordSymbol).toBe(`Bb${chord.symbol}`);
    expect(derived.spellFormula).toBe(chord.tones.map((tone) => tone.degree).join('  '));
    expect(derived.evaluateFretboard(10)?.role).toBe('root');
    expect(derived.evaluateFretboard(0)).toEqual({ role: 'ghost', label: '' });
    expect(derived.pulls).toEqual([]);
  });
});
