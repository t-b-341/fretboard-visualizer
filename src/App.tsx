import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './components/layout/layout.css';
import { useHeldNotes } from './audio/midiIn';
import { player } from './audio/player';
import { Controls } from './components/Controls';
import { Fretboard } from './components/Fretboard';
import { GrandStaff } from './components/GrandStaff';
import { Keyboard } from './components/Keyboard';
import { AppHeader } from './components/layout/AppHeader';
import { MaterialPanel } from './components/layout/MaterialPanel';
import { PracticeTab } from './components/layout/PracticeTab';
import { SettingsDrawer } from './components/layout/SettingsDrawer';
import { StepsStrip } from './components/layout/StepsStrip';
import { ViewBar } from './components/layout/ViewBar';
import { ViewCard } from './components/layout/ViewCard';
import { MidiControls } from './components/MidiControls';
import { ProgressionControls } from './components/ProgressionControls';
import type { ProgressionSnapshot } from './components/ProgressionControls';
import { Quiz, useNoteQuiz } from './components/Quiz';
import { TabExport } from './components/TabExport';
import { chordSymbol } from './music/chords';
import { mod, noteName } from './music/notes';
import type { NoteQuizSettings } from './music/quiz';
import { chordWrittenNotes } from './music/staff';
import { formatTab } from './music/tab';
import type { DisplayMode, InstrumentView, LabelMode, ViewMode } from './music/types';
import { createInitialState, defaultProgression } from './state/appState';
import type { AppState, ColorMode } from './state/appState';
import { deriveView } from './state/derive';
import { toLegacy } from './state/v2/adapter';
import { useAppV2 } from './state/v2/useAppV2';
import { chooseVoicings } from './state/v2/voicingChoice';

export type { ViewMode, LabelMode, DisplayMode, InstrumentView };
export type { AppState, ColorMode };
export { createInitialState };

const noop = () => {};

function useTab(): 'workspace' | 'practice' {
  const read = () => (window.location.hash === '#practice' ? 'practice' : 'workspace');
  const [tab, setTab] = useState<'workspace' | 'practice'>(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return tab;
}

export default function App() {
  const { state, setMaterialType, setKey, setView, setVoicing, setStepVoicing, setCurrentStep, prevStep, nextStep, addChord, removeStep, toggleLock, rerollStep, suggest, setNoteQuiz, setStartIn, setMyDefault } =
    useAppV2();
  const tab = useTab();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const [referenceOn, setReferenceOn] = useState(false);
  const [referencePc, setReferencePc] = useState<number | null>(null);
  const [quizExtras, setQuizExtras] = useState({ naturalsOnly: false, harmonic: false });

  const legacy = useMemo(() => toLegacy(state), [state]);
  const session = useMemo<ProgressionSnapshot>(
    () => ({
      ...defaultProgression(),
      chords: state.material.steps.map((step) => step.chord),
      tempo: state.transport.tempo,
      beatsPerChord: state.settings.sound.beatsPerStep,
      octave: state.settings.sound.octave,
      loop: state.transport.loop,
    }),
    [state],
  );
  const fretRange = state.material.scale.fretRange;
  const choices = useMemo(
    () =>
      chooseVoicings({
        steps: state.material.steps,
        shape: state.voicing.shape,
        stringSet: state.voicing.stringSet,
        smooth: state.voicing.smooth,
        tuning: state.settings.instrument.tuning,
        fretRange: fretRange.enabled ? { min: fretRange.min, max: fretRange.max } : undefined,
        weights: state.settings.voiceLeadingWeights,
      }),
    [state, fretRange],
  );
  const stepIndex =
    state.material.steps.length === 0
      ? 0
      : Math.min(Math.max(state.material.currentStep, 0), state.material.steps.length - 1);
  const currentChoice = choices[stepIndex] ?? { voicings: [], index: 0, fellBack: false };
  const chosenVoicing = currentChoice.voicings[currentChoice.index] ?? null;
  const shownVoicing = state.material.type === 'scale' ? null : chosenVoicing;
  const derived = useMemo(
    () => deriveView(legacy, session, shownVoicing, referenceOn ? referencePc : null),
    [legacy, session, shownVoicing, referenceOn, referencePc],
  );
  const held = useHeldNotes();
  const quizSettings = useMemo<NoteQuizSettings>(
    () => ({
      ...legacy.noteQuiz,
      enabled: tab === 'practice',
      naturalsOnly: quizExtras.naturalsOnly,
      harmonic: quizExtras.harmonic,
    }),
    [legacy, tab, quizExtras],
  );
  const noteQuiz = useNoteQuiz({
    enabled: tab === 'practice',
    settings: quizSettings,
    grid: derived.grid,
    shift: derived.shift,
    musicalKey: { rootPc: legacy.rootPc, intervals: derived.intervals },
  });

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    settingsRef.current?.focus();
  }, []);
  const clearReference = () => setReferencePc(null);
  const toggleReference = (on: boolean) => {
    setReferenceOn(on);
    if (!on) setReferencePc(null);
  };
  const chooseReference = (pc: number) => {
    const next = mod(pc, 12);
    setReferencePc((current) => (current === next ? null : next));
  };
  const onQuizSettings = useCallback(
    (settings: NoteQuizSettings) => {
      setQuizExtras({ naturalsOnly: settings.naturalsOnly, harmonic: settings.harmonic });
      setNoteQuiz(settings);
    },
    [setNoteQuiz],
  );

  useEffect(() => {
    if (referencePc == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target;
      if (target instanceof Element && target.closest('button, input, textarea, select')) return;
      event.preventDefault();
      setReferencePc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [referencePc]);

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

  const tabSymbol = legacy.activeChord ? chordSymbol(legacy.activeChord, derived.shift) : '';
  const tabTitle =
    state.voicing.shape === 'all'
      ? 'All tones has no single voicing to export'
      : 'No voicing to export';
  const tabExport =
    state.material.type === 'scale' ? null : (
      <TabExport
        text={
          shownVoicing
            ? formatTab(legacy.tuning, [{ label: tabSymbol || undefined, notes: shownVoicing.notes }], {
                labelShift: derived.shift,
              })
            : ''
        }
        fileName={`fretboard-${tabSymbol.replace(/#/g, 'sharp').replace(/[^\w.-]+/g, '') || 'voicing'}-voicing.txt`}
        disabled={!shownVoicing}
        title={shownVoicing ? undefined : tabTitle}
      />
    );
  const playStep = () => {
    const notes = state.voicing.shape === 'all' ? null : chosenVoicing;
    if (notes) {
      player.playChord(
        notes.notes.map((note) => note.midi),
        { durationMs: 1200 },
      );
      return;
    }
    const chord = state.material.steps[stepIndex]?.chord;
    if (!chord) return;
    player.playChord(
      chordWrittenNotes(chord).map((note) => note.midi),
      { durationMs: 1200 },
    );
  };
  const fretTo = Math.min(legacy.fretTo, legacy.fretCount);
  const onPlay = (midi: number) => player.playNote(midi, 420);

  return (
    <div className="app">
      <AppHeader
        tab={tab}
        drawerOpen={drawerOpen}
        settingsRef={settingsRef}
        onOpenSettings={() => setDrawerOpen(true)}
      />

      {tab === 'workspace' ? (
        <div className="workspace">
          <MaterialPanel
            type={state.material.type}
            onType={setMaterialType}
            selection={state.material.key}
            names={state.view.names}
            steps={state.material.steps}
            heldMidis={held}
            onKey={setKey}
            onAddChord={addChord}
            onSuggest={suggest}
            voicingShape={state.voicing.shape}
            stringSet={state.voicing.stringSet}
            smooth={state.voicing.smooth}
            stringCount={state.settings.instrument.numStrings}
            chord={state.material.steps[stepIndex]?.chord ?? null}
            voicingCount={currentChoice.voicings.length}
            voicingIndex={currentChoice.index}
            fellBack={currentChoice.fellBack}
            onVoicingShape={(shape) => setVoicing({ shape })}
            onStringSet={(stringSet) => setVoicing({ stringSet })}
            onSmooth={(smooth) => setVoicing({ smooth })}
            onVoicingIndex={(index) => setStepVoicing(stepIndex, index)}
          />
          <div className="workspace-main">
            <StepsStrip
              steps={state.material.steps}
              currentStep={state.material.currentStep}
              rootPc={state.material.key.rootPc}
              intervals={derived.intervals}
              shift={derived.shift}
              onPrev={prevStep}
              onPlay={playStep}
              onNext={nextStep}
              onSelect={setCurrentStep}
              onToggleLock={toggleLock}
              onReroll={rerollStep}
              onRemove={removeStep}
            />
            <ViewBar
              staff={state.view.staff}
              neck={state.view.neck}
              keyboard={state.view.keyboard}
              labels={state.view.labels}
              names={state.view.names}
              onStaff={(staff) => setView({ staff })}
              onNeck={(neck) => setView({ neck })}
              onKeyboard={(keyboard) => setView({ keyboard })}
              onLabels={(labels) => setView({ labels })}
              onNames={(names) => setView({ names })}
            />
            {state.view.staff && (
              <ViewCard title="Staff" testId="staff-card" className="staff-card">
                <GrandStaff
                  viewMode={legacy.viewMode}
                  rootPc={legacy.rootPc}
                  intervals={derived.intervals}
                  chord={derived.voicedChord}
                  voicingMidis={shownVoicing ? shownVoicing.notes.map((note) => note.midi) : null}
                  pickedMidis={derived.pickedNotes.map((note) => note.midi)}
                  guitarWritten={state.view.staffPitch === 'guitar'}
                  onGuitarWritten={(guitarWritten) => setView({ staffPitch: guitarWritten ? 'guitar' : 'concert' })}
                  labelMode={legacy.labelMode}
                  colorByDegree={derived.colorByDegree}
                  compareEnabled={legacy.compareEnabled}
                  clickToHear={legacy.clickToHear}
                  evaluate={derived.evaluateFretboard}
                  onPlay={onPlay}
                  onReference={referenceOn ? chooseReference : undefined}
                />
              </ViewCard>
            )}
            {state.view.neck && (
              <ViewCard title="Neck" testId="neck-card">
                <Fretboard
                  grid={derived.grid}
                  tuning={legacy.tuning}
                  fretCount={legacy.fretCount}
                  fretFrom={legacy.fretFrom}
                  fretTo={fretTo}
                  hiddenStrings={legacy.hiddenStrings}
                  leftHanded={legacy.leftHanded}
                  onlyCells={derived.onlyCells}
                  guideTones={legacy.guideTones}
                  viewMode={legacy.viewMode}
                  activeChord={legacy.activeChord}
                  shift={derived.shift}
                  compareEnabled={legacy.compareEnabled}
                  colorByDegree={derived.colorByDegree}
                  clickToHear={legacy.clickToHear}
                  guidePcs={derived.guidePcs}
                  activeCells={derived.activeCells}
                  evaluate={derived.evaluateFretboard}
                  window={
                    legacy.positionWindow.enabled
                      ? { min: legacy.positionWindow.min, max: legacy.positionWindow.max }
                      : undefined
                  }
                  onPlay={onPlay}
                  onReference={referenceOn ? chooseReference : undefined}
                  caption={null}
                  showPlayed={legacy.showPlayedNotes}
                  playedMidis={held}
                >
                  {tabExport}
                </Fretboard>
              </ViewCard>
            )}
            {state.view.keyboard && (
              <ViewCard title="Keyboard" testId="keyboard-card">
                <Keyboard
                  octaves={state.settings.keyboard.octaves}
                  lowestMidi={state.settings.keyboard.lowestMidi}
                  viewMode={legacy.viewMode}
                  compareEnabled={legacy.compareEnabled}
                  guidePcs={derived.guidePcs}
                  colorByDegree={derived.colorByDegree}
                  clickToHear={legacy.clickToHear}
                  evaluate={derived.evaluateFretboard}
                  voicingMidis={shownVoicing ? shownVoicing.notes.map((note) => note.midi) : null}
                  onPlay={onPlay}
                  onReference={referenceOn ? chooseReference : undefined}
                  showPlayed={legacy.showPlayedNotes}
                  playedMidis={held}
                />
              </ViewCard>
            )}
            <details className="legacy-controls">
              <summary>Legacy controls (temporary)</summary>
              <Controls
                state={legacy}
                mode={derived.mode}
                compareFamily={derived.compareFamily}
                compareMode={derived.compareMode}
                shift={derived.shift}
                onUpdate={noop}
                onNumStrings={noop}
                onPreset={noop}
                onStringEdit={noop}
                onToggleCompare={noop}
                onCompareFamily={noop}
                onComparePreset={noop}
                npsShapes={derived.npsShapes}
                cagedShapes={derived.cagedShapes}
                onShape={noop}
                referenceOn={referenceOn}
                referenceName={derived.referenceName}
                onToggleReference={toggleReference}
                onClearReference={clearReference}
              />
              <ProgressionControls
                rootPc={legacy.rootPc}
                shift={derived.shift}
                tuning={legacy.tuning}
                fretCount={legacy.fretCount}
                fretFrom={legacy.fretFrom}
                fretTo={fretTo}
                voicingStyle={legacy.voicingStyle}
                voicingInversion={legacy.voicingInversion}
                voicingWidth={legacy.voicingWidth}
                voicingSetStart={legacy.voicingSetStart}
                activeGrip={derived.shownVoicing?.notes ?? null}
                active={legacy.viewMode === 'chord'}
                activeChord={legacy.activeChord}
                ghostScale={legacy.ghostScale}
                onShowChord={noop}
                onShowVoicing={noop}
                onGhostScale={noop}
                guideTones={legacy.guideTones}
                onGuideTones={noop}
                positionWindow={legacy.positionWindow}
                session={session}
                loadId={0}
                onSessionChange={noop}
                identifyOn={false}
                onToggleIdentify={noop}
              />
              <MidiControls
                rootPc={legacy.rootPc}
                intervals={derived.intervals}
                triad={derived.triad}
                soundOctave={legacy.soundOctave}
                onSoundOctave={noop}
                drone={legacy.drone}
                onDrone={noop}
                clickToHear={legacy.clickToHear}
                onClickToHear={noop}
                midiInputName={legacy.midiInputName}
                showPlayedNotes={legacy.showPlayedNotes}
                soundPlayedNotes={legacy.soundPlayedNotes}
                onMidiInputName={noop}
                onShowPlayedNotes={noop}
                onSoundPlayedNotes={noop}
              />
            </details>
          </div>
        </div>
      ) : (
        <PracticeTab>
          <Quiz
            api={noteQuiz}
            settings={quizSettings}
            numStrings={legacy.numStrings}
            fretCount={legacy.fretCount}
            neckFrom={legacy.fretFrom}
            neckTo={fretTo}
            shift={derived.shift}
            musicalKey={{ rootPc: legacy.rootPc, intervals: derived.intervals }}
            stringLabels={legacy.tuning.map((item) => noteName(mod(item.pc + derived.shift, 12)))}
            keyLabel={`${noteName(mod(legacy.rootPc + derived.shift, 12))} ${derived.mode.name}`}
            onSettings={onQuizSettings}
          />
        </PracticeTab>
      )}

      <SettingsDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        startIn={state.settings.startIn}
        myDefault={state.settings.myDefault}
        onStartIn={setStartIn}
        onSetFromCurrent={setMyDefault}
      />
    </div>
  );
}
