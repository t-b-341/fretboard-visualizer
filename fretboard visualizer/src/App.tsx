import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Controls } from './components/Controls';
import { FormulaBar } from './components/FormulaBar';
import { Fretboard } from './components/Fretboard';
import { GrandStaff } from './components/GrandStaff';
import { IdentifyPanel } from './components/IdentifyPanel';
import { Keyboard } from './components/Keyboard';
import { Legend } from './components/Legend';
import { MidiControls } from './components/MidiControls';
import { TabExport } from './components/TabExport';
import { ProgressionControls } from './components/ProgressionControls';
import type { BuilderSeed } from './components/ProgressionControls';
import { Quiz, useNoteQuiz } from './components/Quiz';
import { QuizPanel } from './components/QuizPanel';
import { SetupBar } from './components/SetupBar';
import { useHeldNotes } from './audio/midiIn';
import { player } from './audio/player';
import { chordSymbol } from './music/chords';
import { heldChordNotes, identifyChord } from './music/identify';
import { mod, noteName } from './music/notes';
import { formatTab } from './music/tab';
import type { DisplayMode, InstrumentView, LabelMode, ViewMode } from './music/types';
import { deriveView } from './state/derive';
import type { AppState, ColorMode } from './state/appState';
import { createInitialState } from './state/appState';
import { useAppState } from './state/useAppState';

export type { ViewMode, LabelMode, DisplayMode, InstrumentView };
export type { AppState, ColorMode };
export { createInitialState };

export default function App() {
  const {
    state,
    update,
    session,
    loadId,
    named,
    setupName,
    setSetupName,
    setupId,
    setSetupId,
    playbackVoicing,
    setPlaybackVoicing,
    saveSetup,
    loadSetup,
    removeSetup,
    resetSession,
    onSessionChange,
    handleNumStrings,
    handlePreset,
    handleStringEdit,
    togglePicked,
    answerQuiz,
    handleFamily,
    handleShowChord,
    handleToggleCompare,
    handleCompareFamily,
    handleComparePreset,
    handleShape,
    nextQuiz,
    referenceOn,
    referencePc,
    toggleReference,
    chooseReference,
    clearReference,
  } = useAppState();

  const derived = useMemo(
    () => deriveView(state, session, playbackVoicing, referenceOn ? referencePc : null),
    [state, session, playbackVoicing, referenceOn, referencePc],
  );
  const held = useHeldNotes();
  const identifyNotes = useMemo(
    () => (state.viewMode === 'identify' ? heldChordNotes(derived.pickedNotes, held) : []),
    [state.viewMode, derived.pickedNotes, held],
  );
  const identifyMatches = useMemo(
    () => (state.viewMode === 'identify' ? identifyChord(identifyNotes) : derived.identifyMatches),
    [state.viewMode, identifyNotes, derived.identifyMatches],
  );
  const [builderSeed, setBuilderSeed] = useState<BuilderSeed | null>(null);
  const noteQuiz = useNoteQuiz({
    enabled: state.noteQuiz.enabled,
    settings: state.noteQuiz,
    grid: derived.grid,
    shift: derived.shift,
    musicalKey: { rootPc: state.rootPc, intervals: derived.intervals },
  });
  const showFretboard =
    state.noteQuiz.enabled || state.instrumentView === 'fretboard' || state.instrumentView === 'both';
  const gripSymbol = state.activeChord ? chordSymbol(state.activeChord, derived.shift) : '';
  const gripTab = derived.shownVoicing ? (
    <TabExport
      text={formatTab(
        state.tuning,
        [
          {
            label: gripSymbol || undefined,
            notes: derived.shownVoicing.notes,
          },
        ],
        { labelShift: derived.shift },
      )}
      fileName={`fretboard-${gripSymbol.replace(/#/g, 'sharp').replace(/[^\w.-]+/g, '') || 'grip'}-grip.txt`}
    />
  ) : null;
  const answerPlayed = noteQuiz.answerPlayed;
  const seenHeld = useRef<ReadonlySet<number> | null>(null);
  useEffect(() => {
    const prev = seenHeld.current;
    seenHeld.current = held;
    if (prev === null) return;
    for (const midi of held) {
      if (!prev.has(midi)) answerPlayed(midi);
    }
  }, [held, answerPlayed]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fretboard Visualizer</h1>
        <p className="subtitle">
          6-string bass, 7/8-string guitar, keyboard &amp; staff &middot; scales, modes &amp; diatonic triads
        </p>
      </header>

      <SetupBar
        setupName={setupName}
        setupId={setupId}
        named={named}
        onSetupName={setSetupName}
        onSetupId={setSetupId}
        onSave={saveSetup}
        onLoad={loadSetup}
        onRemove={removeSetup}
        onReset={resetSession}
      />

      <Controls
        state={state}
        family={derived.family}
        mode={derived.mode}
        compareFamily={derived.compareFamily}
        compareMode={derived.compareMode}
        shift={derived.shift}
        onUpdate={update}
        onNumStrings={handleNumStrings}
        onPreset={handlePreset}
        onStringEdit={handleStringEdit}
        onFamily={handleFamily}
        onToggleCompare={handleToggleCompare}
        onCompareFamily={handleCompareFamily}
        onComparePreset={handleComparePreset}
        npsShapes={derived.npsShapes}
        cagedShapes={derived.cagedShapes}
        voicingToneCount={derived.voicingToneCount}
        onShape={(mode, index) => handleShape(mode, index, derived.npsShapes, derived.cagedShapes)}
        voicingCount={derived.voicingCount}
        voicingIndex={derived.voicingIndex}
        referenceOn={referenceOn}
        referenceName={derived.referenceName}
        onToggleReference={toggleReference}
        onClearReference={clearReference}
        onPlayVoicing={() => {
          if (!derived.selectedVoicing) return;
          player.playChord(
            derived.selectedVoicing.notes.map((note) => note.midi),
            { durationMs: 1200 },
          );
        }}
      />

      <MidiControls
        rootPc={state.rootPc}
        intervals={derived.intervals}
        triad={derived.triad}
        soundOctave={state.soundOctave}
        onSoundOctave={(soundOctave) => update({ soundOctave })}
        drone={state.drone}
        onDrone={(drone) => update({ drone })}
        clickToHear={state.clickToHear}
        onClickToHear={(clickToHear) => update({ clickToHear })}
        midiInputName={state.midiInputName}
        showPlayedNotes={state.showPlayedNotes}
        soundPlayedNotes={state.soundPlayedNotes}
        onMidiInputName={(midiInputName) =>
          update({
            midiInputName,
            showPlayedNotes: midiInputName ? true : state.showPlayedNotes,
          })
        }
        onShowPlayedNotes={(showPlayedNotes) => update({ showPlayedNotes })}
        onSoundPlayedNotes={(soundPlayedNotes) => update({ soundPlayedNotes })}
      />

      <ProgressionControls
        rootPc={state.rootPc}
        intervals={derived.intervals}
        scalePcs={derived.scalePcs}
        shift={derived.shift}
        tuning={state.tuning}
        fretCount={state.fretCount}
        fretFrom={state.fretFrom}
        fretTo={Math.min(state.fretTo, state.fretCount)}
        voicingStyle={state.voicingStyle}
        voicingInversion={state.voicingInversion}
        voicingWidth={state.voicingWidth}
        voicingSetStart={state.voicingSetStart}
        activeGrip={derived.shownVoicing?.notes ?? null}
        active={state.viewMode === 'chord'}
        activeChord={state.activeChord}
        ghostScale={state.ghostScale}
        onShowChord={handleShowChord}
        onShowVoicing={setPlaybackVoicing}
        onGhostScale={(v) => update({ ghostScale: v })}
        diatonicIntervals={derived.diatonic.intervals}
        parentName={derived.diatonic.name}
        guideTones={state.guideTones}
        colorChordsByRoot={state.colorChordsByRoot}
        onGuideTones={(guideTones) => update({ guideTones })}
        positionWindow={state.positionWindow}
        session={session}
        loadId={loadId}
        onSessionChange={onSessionChange}
        identifyOn={state.viewMode === 'identify'}
        onToggleIdentify={() => update({ viewMode: state.viewMode === 'identify' ? 'chord' : 'identify' })}
        builderSeed={builderSeed}
      />

      <FormulaBar
        viewMode={state.viewMode}
        formula={derived.formula}
        colorByDegree={derived.colorByDegree}
        origin={derived.origin}
        pulls={derived.pulls}
        pullIndexes={derived.pullIndexes}
        scaleSpelling={derived.scaleSpelling}
        spellFormula={derived.spellFormula}
        reading={derived.reading}
        diatonicName={derived.diatonic.name}
        caption={derived.caption}
      />

      <div className="instrument-views">
        {state.viewMode === 'identify' && (
          <IdentifyPanel
            candidates={identifyMatches}
            notes={identifyNotes}
            canClear={derived.pickedNotes.length > 0}
            shift={derived.shift}
            onClear={() => update({ picked: {} })}
            onSend={() => {
              const top = derived.identifyMatches[0];
              const quality = top?.chord.quality;
              if (!top || !quality) return;
              setBuilderSeed((seed) => ({
                token: (seed?.token ?? 0) + 1,
                rootPc: top.chord.rootPc,
                quality,
              }));
              update({ activeChord: top.chord });
            }}
          />
        )}
        {showFretboard && (
          <Fretboard
            grid={derived.grid}
            tuning={state.tuning}
            fretCount={state.fretCount}
            fretFrom={state.fretFrom}
            fretTo={Math.min(state.fretTo, state.fretCount)}
            hiddenStrings={state.hiddenStrings}
            leftHanded={state.leftHanded}
            onlyCells={derived.onlyCells}
            guideTones={state.guideTones}
            viewMode={state.viewMode}
            activeChord={state.activeChord}
            shift={derived.shift}
            compareEnabled={state.compareEnabled}
            colorByDegree={derived.colorByDegree}
            clickToHear={state.clickToHear}
            guidePcs={derived.guidePcs}
            activeCells={derived.activeCells}
            onPick={togglePicked}
            onQuizAnswer={answerQuiz}
            evaluate={derived.evaluateFretboard}
            window={
              state.positionWindow.enabled
                ? { min: state.positionWindow.min, max: state.positionWindow.max }
                : undefined
            }
            onPlay={(midi) => player.playNote(midi, 420)}
            onReference={referenceOn ? chooseReference : undefined}
            caption={null}
            practice={noteQuiz.practice}
            showPlayed={state.showPlayedNotes}
            playedMidis={held}
          >
            {gripTab}
          </Fretboard>
        )}
        {!showFretboard && gripTab && <div className="fretboard-wrap">{gripTab}</div>}
        {state.noteQuiz.enabled && (
          <Quiz
            api={noteQuiz}
            settings={state.noteQuiz}
            numStrings={state.numStrings}
            fretCount={state.fretCount}
            neckFrom={state.fretFrom}
            neckTo={Math.min(state.fretTo, state.fretCount)}
            shift={derived.shift}
            musicalKey={{ rootPc: state.rootPc, intervals: derived.intervals }}
            stringLabels={state.tuning.map((item) => noteName(mod(item.pc + derived.shift, 12)))}
            keyLabel={`${noteName(mod(state.rootPc + derived.shift, 12))} ${derived.mode.name}`}
            onSettings={(next) => update({ noteQuiz: next })}
          />
        )}
        {state.viewMode === 'quiz' && state.quiz.question && !state.noteQuiz.enabled && (
          <QuizPanel
            prompt={state.quiz.question.prompt}
            score={state.quiz.score}
            total={state.quiz.total}
            onNext={nextQuiz}
          />
        )}
        {(state.instrumentView === 'keyboard' || state.instrumentView === 'both') && (
          <Keyboard
            octaves={state.keyboardOctaves}
            lowestMidi={derived.keyboardLowestMidi}
            viewMode={state.viewMode}
            compareEnabled={state.compareEnabled}
            guidePcs={derived.guidePcs}
            colorByDegree={derived.colorByDegree}
            clickToHear={state.clickToHear}
            evaluate={derived.evaluateKeyboard}
            onPlay={(midi) => player.playNote(midi, 420)}
            onReference={referenceOn ? chooseReference : undefined}
            showPlayed={state.showPlayedNotes}
            playedMidis={held}
          />
        )}
        {state.showStaff && (
          <GrandStaff
            viewMode={state.viewMode}
            rootPc={state.rootPc}
            intervals={derived.intervals}
            chord={derived.voicedChord}
            voicingMidis={derived.shownVoicing ? derived.shownVoicing.notes.map((note) => note.midi) : null}
            pickedMidis={derived.pickedNotes.map((note) => note.midi)}
            guitarWritten={state.staffPitch === 'guitar'}
            onGuitarWritten={(guitarWritten) => update({ staffPitch: guitarWritten ? 'guitar' : 'concert' })}
            labelMode={state.labelMode}
            colorByDegree={derived.colorByDegree}
            compareEnabled={state.compareEnabled}
            clickToHear={state.clickToHear}
            evaluate={derived.evaluateFretboard}
            onPlay={(midi) => player.playNote(midi, 420)}
            onReference={referenceOn ? chooseReference : undefined}
          />
        )}
      </div>

      <Legend
        viewMode={state.viewMode}
        triad={derived.triad}
        rootName={derived.rootName}
        modeName={derived.mode.name}
        familyName={derived.family.name}
        chordRootName={derived.chordRootName}
        chordQualityName={derived.chordQualityName}
        compareEnabled={state.compareEnabled}
        compareRootName={derived.compareRootName}
        compareModeName={derived.compareMode.name}
        sharedCount={derived.sharedCount}
        activeChordSymbol={derived.activeChordSymbol}
        activeChordRoman={derived.activeChordRoman}
        activeChordInKey={derived.activeChordInKey}
        colorByDegree={derived.colorByDegree}
        colorChordsByRoot={state.colorChordsByRoot}
        degreeLabels={derived.degreeLabels}
        guideTones={derived.guideActive}
      />
    </div>
  );
}
