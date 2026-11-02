import { useMemo } from 'react';
import './App.css';
import { Controls } from './components/Controls';
import { FormulaBar } from './components/FormulaBar';
import { Fretboard } from './components/Fretboard';
import { IdentifyPanel } from './components/IdentifyPanel';
import { Keyboard } from './components/Keyboard';
import { Legend } from './components/Legend';
import { MidiControls } from './components/MidiControls';
import { ProgressionControls } from './components/ProgressionControls';
import { QuizPanel } from './components/QuizPanel';
import { SetupBar } from './components/SetupBar';
import { player } from './audio/player';
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
  } = useAppState();

  const derived = useMemo(
    () => deriveView(state, session, playbackVoicing),
    [state, session, playbackVoicing],
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Fretboard Visualizer</h1>
        <p className="subtitle">
          6-string bass, 7/8-string guitar &amp; keyboard &middot; scales, modes &amp; diatonic triads
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
      />

      <ProgressionControls
        rootPc={state.rootPc}
        intervals={derived.intervals}
        scalePcs={derived.scalePcs}
        shift={derived.shift}
        tuning={state.tuning}
        active={state.viewMode === 'chord'}
        activeChord={state.activeChord}
        ghostScale={state.ghostScale}
        onShowChord={handleShowChord}
        onShowVoicing={setPlaybackVoicing}
        onGhostScale={(v) => update({ ghostScale: v })}
        diatonicIntervals={derived.diatonic.intervals}
        parentName={derived.diatonic.name}
        guideTones={state.guideTones}
        onGuideTones={(guideTones) => update({ guideTones })}
        positionWindow={state.positionWindow}
        session={session}
        loadId={loadId}
        onSessionChange={onSessionChange}
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
        {(state.instrumentView === 'fretboard' || state.instrumentView === 'both') && (
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
            caption={null}
          />
        )}
        {state.viewMode === 'quiz' && state.quiz.question && (
          <QuizPanel
            prompt={state.quiz.question.prompt}
            score={state.quiz.score}
            total={state.quiz.total}
            onNext={nextQuiz}
          />
        )}
        {state.viewMode === 'identify' && (
          <IdentifyPanel
            identifyMatches={derived.identifyMatches}
            pickedNotes={derived.pickedNotes}
            shift={derived.shift}
            onClear={() => update({ picked: {} })}
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
        degreeLabels={derived.degreeLabels}
        guideTones={derived.guideActive}
      />
    </div>
  );
}
