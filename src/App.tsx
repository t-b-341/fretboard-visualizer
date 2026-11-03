import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import './components/layout/layout.css';
import { midiEngine } from './audio/midi';
import { midiInput, useHeldNotes } from './audio/midiIn';
import { player } from './audio/player';
import { progressionToSmf } from './audio/midi';
import { synth } from './audio/synth';
import { scaleUpAndDown, useTransportPlayback } from './audio/useTransport';
import { Fretboard } from './components/Fretboard';
import { GrandStaff } from './components/GrandStaff';
import { IdentifyPanel, toggleKeyPick, toggleNeckPick } from './components/IdentifyPanel';
import type { KeyPick, NeckPick } from './components/IdentifyPanel';
import { Keyboard } from './components/Keyboard';
import { AppHeader } from './components/layout/AppHeader';
import { CompareLegend } from './components/layout/CompareLegend';
import { MaterialPanel } from './components/layout/MaterialPanel';
import { SetupsMenu } from './components/layout/SetupsMenu';
import { SettingsDrawer } from './components/layout/SettingsDrawer';
import { StepsStrip } from './components/layout/StepsStrip';
import { ViewBar } from './components/layout/ViewBar';
import { ViewCard } from './components/layout/ViewCard';
import { Quiz, useNoteQuiz } from './components/Quiz';
import { TabExport } from './components/TabExport';
import { downloadBytes } from './components/layout/ExportMenu';
import { formatVoiceMotion, linkVoices, nextStepIndex } from './music/voiceMotion';
import type { MotionPoint } from './music/voiceMotion';
import { chordSymbol } from './music/chords';
import { candidateLabel, heldChordNotes, identifyChord } from './music/identify';
import { keyLabel } from './music/keyLabel';
import type { ChordToneRole } from './music/chords';
import { mod, noteName } from './music/notes';
import { notesPerString } from './music/shapes';
import type { NoteQuizSettings } from './music/quiz';
import { chordWrittenNotes } from './music/staff';
import { formatTab } from './music/tab';
import type { DisplayMode, InstrumentView, LabelMode, ViewMode } from './music/types';
import { createInitialState, defaultProgression } from './state/appState';
import type { AppState, ColorMode, ProgressionSnapshot } from './state/appState';
import { deriveView } from './state/derive';
import { toLegacy } from './state/v2/adapter';
import { clampKeyboardLowest } from './state/v2/keyboardSpan';
import { useAppV2 } from './state/v2/useAppV2';
import type { Step } from './state/v2/types';
import { chooseVoicings } from './state/v2/voicingChoice';

export type { ViewMode, LabelMode, DisplayMode, InstrumentView };
export type { AppState, ColorMode };
export { createInitialState };

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
  const {
    state,
    setMaterialType,
    setKey,
    setView,
    setVoicing,
    setStepVoicing,
    setCurrentStep,
    prevStep,
    nextStep,
    addChord,
    addIdentified,
    replaceIdentified,
    removeStep,
    toggleLock,
    rerollStep,
    suggest,
    setNoteQuiz,
    setStartIn,
    setMyDefault,
    setTransport,
    reset,
    setNumStrings,
    setTuningPreset,
    setStringPitch,
    setLeftHanded,
    setNeck,
    setKeyboard,
    setSound,
    setMidi,
    setWeights,
    resetWeights,
    setCompare,
    setScale,
    replaceState,
  } = useAppV2();
  const tab = useTab();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [identifyOn, setIdentifyOn] = useState(false);
  const [neckPicks, setNeckPicks] = useState<NeckPick[]>([]);
  const [keyPicks, setKeyPicks] = useState<KeyPick[]>([]);
  const [identifyChoice, setIdentifyChoice] = useState({ key: '', index: 0 });
  const settingsRef = useRef<HTMLButtonElement>(null);
  const [referenceOn, setReferenceOn] = useState(false);
  const [referencePc, setReferencePc] = useState<number | null>(null);

  const legacy = useMemo(() => ({ ...toLegacy(state), guideTones: false }), [state]);
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
  const identifyPicked = useMemo(
    () => [...neckPicks.map(({ pc, midi }) => ({ pc, midi })), ...keyPicks],
    [neckPicks, keyPicks],
  );
  const identifyNotes = useMemo(
    () => (identifyOn ? heldChordNotes(identifyPicked, held) : []),
    [identifyOn, identifyPicked, held],
  );
  const identifyCandidates = useMemo(
    () => (identifyOn ? identifyChord(identifyNotes) : []),
    [identifyOn, identifyNotes],
  );
  const identifyKey = identifyNotes.map((note) => note.midi).join(',');
  const identifyIndex =
    identifyCandidates.length === 0
      ? 0
      : identifyChoice.key === identifyKey
        ? Math.min(identifyChoice.index, identifyCandidates.length - 1)
        : 0;
  const identified = identifyCandidates[identifyIndex] ?? null;
  const identifyAlts = identifyCandidates
    .map((candidate, index) => ({ candidate, index }))
    .filter((item) => item.index !== identifyIndex)
    .slice(0, 2);
  const identifyCells = useMemo(
    () => new Set(neckPicks.map((pick) => `${pick.stringIndex}:${pick.fret}`)),
    [neckPicks],
  );
  const identifyKeyMidis = useMemo(() => new Set(keyPicks.map((pick) => pick.midi)), [keyPicks]);
  const pickedRingMidis = useMemo(() => {
    const midis = new Set<number>();
    for (const pick of neckPicks) midis.add(pick.midi);
    for (const pick of keyPicks) midis.add(pick.midi);
    return midis;
  }, [neckPicks, keyPicks]);
  const leaveIdentify = useCallback(() => {
    setIdentifyOn(false);
    setNeckPicks([]);
    setKeyPicks([]);
    setIdentifyChoice({ key: '', index: 0 });
  }, []);
  const commitIdentified = (mode: 'add' | 'replace') => {
    if (!identified) return;
    if (mode === 'add') addIdentified(identified.chord, identified.bassPc);
    else replaceIdentified(identified.chord, identified.bassPc);
    leaveIdentify();
  };
  const quizSettings = useMemo<NoteQuizSettings>(
    () => ({
      ...legacy.noteQuiz,
      enabled: tab === 'practice',
    }),
    [legacy, tab],
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
      setNoteQuiz(settings);
    },
    [setNoteQuiz],
  );

  const midiInputName = state.settings.midi.inputName;
  const soundPlayed = state.settings.midi.soundPlayed;
  const midiChannel = state.settings.midi.channel;
  const midiOutputName = state.settings.midi.outputName;
  useEffect(() => {
    midiInput.selectByName(midiInputName);
  }, [midiInputName]);
  useEffect(() => {
    midiInput.setThru(soundPlayed);
  }, [soundPlayed]);
  useEffect(() => {
    midiEngine.setChannel(midiChannel);
  }, [midiChannel]);
  useEffect(() => {
    const apply = () => {
      if (!midiEngine.enabled || !midiOutputName) return;
      const port = midiEngine.outputs().find((item) => item.name === midiOutputName);
      if (port && port.id !== midiEngine.outputId) midiEngine.setOutput(port.id);
    };
    apply();
    return midiEngine.subscribe(apply);
  }, [midiOutputName]);
  useEffect(() => {
    if (Math.abs(synth.volume - state.settings.sound.volume) > 0.001) synth.setVolume(state.settings.sound.volume);
    if (synth.muted !== state.settings.sound.muted) synth.setMuted(state.settings.sound.muted);
  }, [state.settings.sound.volume, state.settings.sound.muted]);
  const droneOn = state.settings.sound.drone;
  const droneMidi = (state.settings.sound.octave + 1) * 12 + state.material.key.rootPc;
  useEffect(() => {
    if (droneOn) player.startDrone(droneMidi);
    else player.stopDrone();
  }, [droneOn, droneMidi]);
  useEffect(() => () => player.stopDrone(), []);
  useEffect(() => {
    if (!midiInputName || !midiEngine.supported || midiEngine.enabled) return;
    let cancel = false;
    void (async () => {
      const ok = await midiEngine.enable();
      if (!cancel && ok) await midiInput.enable();
    })();
    return () => {
      cancel = true;
    };
  }, [midiInputName]);

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

  useEffect(() => {
    if (!identifyOn) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const target = event.target;
      if (target instanceof Element && target.closest('button, input, textarea, select')) return;
      event.preventDefault();
      leaveIdentify();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [identifyOn, leaveIdentify]);

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
  const { playing, sounding, stop, playSteps, playScale } = useTransportPlayback();
  const stepMidis = useMemo(
    () =>
      state.material.steps.map((step, index) => {
        const choice = choices[index];
        const voicing = choice?.voicings[choice.index];
        if (voicing && voicing.notes.length > 0) return voicing.notes.map((note) => note.midi);
        return chordWrittenNotes(step.chord).map((note) => note.midi);
      }),
    [choices, state.material.steps],
  );
  const transportRef = useRef({
    tempo: state.transport.tempo,
    beats: state.settings.sound.beatsPerStep,
    loop: state.transport.loop,
    midis: stepMidis,
  });
  transportRef.current = {
    tempo: state.transport.tempo,
    beats: state.settings.sound.beatsPerStep,
    loop: state.transport.loop,
    midis: stepMidis,
  };
  const togglePlay = () => {
    if (playing) {
      stop();
      return;
    }
    if (state.material.type === 'scale') {
      playScale(scaleUpAndDown(state.material.key.rootPc, derived.intervals, state.settings.sound.octave), () => transportRef.current.tempo);
      return;
    }
    if (stepMidis.length === 0) return;
    playSteps((index) => setCurrentStep(index), () => transportRef.current);
  };
  const toggleRef = useRef(togglePlay);
  toggleRef.current = togglePlay;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== ' ' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest('button, input, textarea, select')) return;
      event.preventDefault();
      toggleRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pointsOf = (index: number): MotionPoint[] => {
    const choice = choices[index];
    const voicing = choice?.voicings[choice.index];
    if (voicing && voicing.notes.length > 0) {
      return voicing.notes.map((note) => ({
        midi: note.midi,
        pc: note.pc,
        role: note.role,
        stringIndex: note.stringIndex,
        fret: note.fret,
      }));
    }
    const chord = state.material.steps[index]?.chord;
    if (!chord) return [];
    return chordWrittenNotes(chord).map((note) => ({ midi: note.midi, pc: mod(note.midi, 12) }));
  };
  const following =
    state.material.type === 'scale' ? null : nextStepIndex(stepIndex, state.material.steps.length, state.transport.loop);
  const fromPoints = following == null ? [] : pointsOf(stepIndex);
  const toPoints = following == null ? [] : pointsOf(following);
  const nextText = following == null ? '' : formatVoiceMotion(fromPoints, toPoints, derived.shift);
  const placed = (point: MotionPoint): point is MotionPoint & { stringIndex: number; fret: number; role: ChordToneRole } =>
    point.stringIndex != null && point.fret != null && point.role != null;
  const neckMotion =
    state.view.voiceMotion && following != null && fromPoints.some(placed) && toPoints.some(placed)
      ? {
          rings: toPoints.filter(placed).map((point) => ({
            stringIndex: point.stringIndex,
            fret: point.fret,
            role: point.role,
          })),
          moves: linkVoices(fromPoints, toPoints).links.flatMap((link) => {
            if (link.semitones === 0 || !placed(link.from) || !placed(link.to)) return [];
            return [
              {
                fromString: link.from.stringIndex,
                fromFret: link.from.fret,
                toString: link.to.stringIndex,
                toFret: link.to.fret,
                semitones: link.semitones,
              },
            ];
          }),
        }
      : null;
  const fromMidis = new Set(fromPoints.map((point) => point.midi));
  const addedMidis =
    state.view.voiceMotion && following != null
      ? toPoints.map((point) => point.midi).filter((midi) => !fromMidis.has(midi))
      : null;
  const columnLabel = (step: Step) => {
    const symbol = chordSymbol(step.chord, derived.shift);
    if (step.bassPc === undefined) return symbol;
    return `${symbol}/${noteName(mod(step.bassPc + derived.shift, 12))}`;
  };
  const progressionTab = formatTab(
    legacy.tuning,
    state.material.steps.map((step, index) => ({
      label: columnLabel(step),
      notes: choices[index]?.voicings[choices[index].index]?.notes ?? [],
    })),
    { labelShift: derived.shift },
  );
  const keyFile = noteName(mod(state.material.key.rootPc + derived.shift, 12)).replace(/#/g, 'sharp');
  const exportMidi = () => {
    if (state.material.steps.length === 0) return;
    const bytes = progressionToSmf(stepMidis, {
      bpm: state.transport.tempo,
      beatsPerChord: state.settings.sound.beatsPerStep,
      trackName: `Fretboard progression in ${noteName(mod(state.material.key.rootPc + derived.shift, 12))}`,
    });
    downloadBytes(bytes, 'audio/midi', `fretboard-${keyFile}-progression.mid`);
  };
  const scaleSound = state.material.type === 'scale' ? sounding : null;
  const staffMeasures =
    state.material.type === 'scale'
      ? null
      : state.material.steps.map((step, index) => {
          const choice = choices[index];
          const voicing = choice?.voicings[choice.index];
          return {
            chord: step.chord,
            symbol: columnLabel(step),
            voicingMidis: voicing && voicing.notes.length > 0 ? voicing.notes.map((note) => note.midi) : null,
          };
        });
  const fretTo = Math.min(legacy.fretTo, legacy.fretCount);
  const onPlay = (midi: number) => player.playNote(midi, 420);
  const keyboardLowest = clampKeyboardLowest(state.settings.keyboard.octaves, state.settings.keyboard.lowestMidi);
  const compareLegend =
    state.material.type === 'scale' && state.material.compare.enabled ? (
      <CompareLegend
        primary={`${noteName(mod(state.material.key.rootPc + derived.shift, 12))} ${derived.mode.name}`}
        overlay={`${derived.compareRootName} ${derived.compareMode.name}`}
        sharedCount={derived.sharedCount}
      />
    ) : null;
  const loadSetup = (next: Parameters<typeof replaceState>[0]) => {
    replaceState(next);
    setReferenceOn(false);
    setReferencePc(null);
  };
  const resetSetup = () => {
    reset();
    setReferenceOn(false);
    setReferencePc(null);
  };

  return (
    <div className="app">
      <AppHeader
        tab={tab}
        drawerOpen={drawerOpen}
        settingsRef={settingsRef}
        onOpenSettings={() => setDrawerOpen(true)}
        setups={<SetupsMenu state={state} onLoad={loadSetup} onReset={resetSetup} />}
      />

      {tab === 'workspace' ? (
        <div className="workspace">
          <MaterialPanel
            type={state.material.type}
            onType={(material) => {
              stop();
              setMaterialType(material);
            }}
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
            compare={state.material.compare}
            intervals={derived.intervals}
            shift={derived.shift}
            onCompare={setCompare}
            positions={state.material.scale.positions}
            positionIndex={state.material.scale.positionIndex}
            fretRange={state.material.scale.fretRange}
            perString={notesPerString(derived.intervals.length)}
            npsShapes={derived.npsShapes}
            cagedShapes={derived.cagedShapes}
            onPositions={(positions) => setScale({ positions, positionIndex: positions === 'all' ? 0 : state.material.scale.positionIndex })}
            onPositionIndex={(positionIndex) => setScale({ positionIndex })}
            onFretRange={(fretRange) => setScale({ fretRange })}
          />
          <div className="workspace-main">
            <StepsStrip
              steps={state.material.steps}
              currentStep={state.material.currentStep}
              rootPc={state.material.key.rootPc}
              intervals={derived.intervals}
              shift={derived.shift}
              playing={playing}
              canPlay={state.material.type === 'scale' || state.material.steps.length > 0}
              tempo={state.transport.tempo}
              loop={state.transport.loop}
              nextText={nextText}
              tabText={progressionTab}
              tabFileName={`fretboard-${keyFile}-progression.txt`}
              onPrev={prevStep}
              onTogglePlay={togglePlay}
              onNext={nextStep}
              onTempo={(tempo) => setTransport({ tempo })}
              onLoop={(loop) => setTransport({ loop })}
              onMidi={exportMidi}
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
              showKey={state.view.showKey}
              voiceMotion={state.view.voiceMotion}
              onStaff={(staff) => setView({ staff })}
              onNeck={(neck) => setView({ neck })}
              onKeyboard={(keyboard) => setView({ keyboard })}
              onLabels={(labels) => setView({ labels })}
              onNames={(names) => setView({ names })}
              onShowKey={(showKey) => setView({ showKey })}
              onVoiceMotion={(voiceMotion) => setView({ voiceMotion })}
              referenceOn={referenceOn}
              referenceName={referenceOn ? derived.referenceName : null}
              onToggleReference={toggleReference}
              onClearReference={clearReference}
            />
            {state.view.staff && (
              <ViewCard
                title="Staff"
                testId="staff-card"
                className="staff-card"
                extra={
                  <div className="segmented" role="radiogroup" aria-label="Staff pitch">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={state.view.staffPitch !== 'guitar'}
                      className={state.view.staffPitch === 'guitar' ? undefined : 'active'}
                      onClick={() => setView({ staffPitch: 'concert' })}
                    >
                      Concert
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={state.view.staffPitch === 'guitar'}
                      className={state.view.staffPitch === 'guitar' ? 'active' : undefined}
                      onClick={() => setView({ staffPitch: 'guitar' })}
                    >
                      Written
                    </button>
                  </div>
                }
              >
                <GrandStaff
                  viewMode={legacy.viewMode}
                  rootPc={legacy.rootPc}
                  intervals={derived.intervals}
                  chord={derived.voicedChord}
                  voicingMidis={shownVoicing ? shownVoicing.notes.map((note) => note.midi) : null}
                  pickedMidis={derived.pickedNotes.map((note) => note.midi)}
                  guitarWritten={state.view.staffPitch === 'guitar'}
                  writtenStaff={state.settings.instrument.numStrings === 6 ? 'bass' : 'treble'}
                  labelMode={legacy.labelMode}
                  colorByDegree={derived.colorByDegree}
                  compareEnabled={legacy.compareEnabled}
                  clickToHear={legacy.clickToHear}
                  evaluate={derived.evaluateFretboard}
                  onPlay={onPlay}
                  onReference={referenceOn ? chooseReference : undefined}
                  measures={staffMeasures}
                  currentMeasure={stepIndex}
                  onSelectMeasure={setCurrentStep}
                  identify={
                    identifyOn
                      ? {
                          midis: identifyNotes.map((note) => note.midi),
                          symbol: identified ? candidateLabel(identified, derived.shift) : '',
                        }
                      : null
                  }
                  scaleLabel={keyLabel(state.material.key.rootPc, state.material.key.modeKey, derived.shift)}
                  dimRest={state.view.voiceMotion}
                  soundingDegree={scaleSound?.degree ?? null}
                />
                {compareLegend}
              </ViewCard>
            )}
            {state.view.neck && (
              <ViewCard
                title="Neck"
                testId="neck-card"
                extra={
                  <div className="segmented">
                    <button
                      type="button"
                      className={identifyOn ? 'identify-toggle active' : 'identify-toggle'}
                      data-testid="identify-tool"
                      aria-pressed={identifyOn}
                      onClick={() => (identifyOn ? leaveIdentify() : setIdentifyOn(true))}
                    >
                      Pick notes (identify)
                    </button>
                  </div>
                }
              >
                {identifyOn && (
                  <IdentifyPanel
                    chosen={identified}
                    chosenIndex={identifyIndex}
                    alternatives={identifyAlts}
                    distinct={new Set(identifyNotes.map((note) => note.pc)).size}
                    shift={derived.shift}
                    canReplace={state.material.steps.length > 0}
                    onChoose={(index) => setIdentifyChoice({ key: identifyKey, index })}
                    onAdd={() => commitIdentified('add')}
                    onReplace={() => commitIdentified('replace')}
                  />
                )}
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
                  onPick={
                    identifyOn
                      ? (stringIndex, fret, pc, midi) =>
                          setNeckPicks((picks) => toggleNeckPick(picks, { stringIndex, fret, pc, midi }))
                      : undefined
                  }
                  identifyCells={identifyOn ? identifyCells : undefined}
                  identifyMidis={identifyOn ? identifyKeyMidis : undefined}
                  caption={null}
                  showPlayed={legacy.showPlayedNotes}
                  playedMidis={held}
                  motion={neckMotion}
                  soundingMidi={scaleSound?.midi ?? null}
                >
                  {tabExport}
                </Fretboard>
                {compareLegend}
              </ViewCard>
            )}
            {state.view.keyboard && (
              <ViewCard title="Keyboard" testId="keyboard-card">
                <Keyboard
                  octaves={state.settings.keyboard.octaves}
                  lowestMidi={keyboardLowest}
                  viewMode={legacy.viewMode}
                  compareEnabled={legacy.compareEnabled}
                  guidePcs={derived.guidePcs}
                  colorByDegree={derived.colorByDegree}
                  clickToHear={legacy.clickToHear}
                  evaluate={derived.evaluateFretboard}
                  voicingMidis={shownVoicing ? shownVoicing.notes.map((note) => note.midi) : null}
                  addedMidis={addedMidis}
                  soundingMidi={scaleSound?.midi ?? null}
                  onPlay={onPlay}
                  onReference={referenceOn ? chooseReference : undefined}
                  onIdentify={identifyOn ? (midi) => setKeyPicks((picks) => toggleKeyPick(picks, midi)) : undefined}
                  identifyMidis={identifyOn ? pickedRingMidis : undefined}
                  showPlayed={legacy.showPlayedNotes}
                  playedMidis={held}
                />
                {compareLegend}
              </ViewCard>
            )}
          </div>
        </div>
      ) : (
        <Quiz
          api={noteQuiz}
          settings={quizSettings}
          numStrings={legacy.numStrings}
          fretCount={legacy.fretCount}
          shift={derived.shift}
          musicalKey={{ rootPc: legacy.rootPc, intervals: derived.intervals }}
          stringLabels={legacy.tuning.map((item) => noteName(mod(item.pc + derived.shift, 12)))}
          onSettings={onQuizSettings}
          neck={
            <ViewCard title="Neck" testId="neck-card">
              <Fretboard
                grid={derived.grid}
                tuning={legacy.tuning}
                fretCount={legacy.fretCount}
                fretFrom={quizSettings.fretMin}
                fretTo={quizSettings.fretMax}
                hiddenStrings={legacy.tuning.map((_, index) => index).filter((index) => !quizSettings.strings.includes(index))}
                leftHanded={legacy.leftHanded}
                onlyCells={null}
                guideTones={false}
                viewMode={legacy.viewMode}
                activeChord={null}
                shift={derived.shift}
                compareEnabled={false}
                colorByDegree={false}
                clickToHear={false}
                guidePcs={null}
                evaluate={derived.evaluateFretboard}
                onPlay={onPlay}
                caption={null}
                practice={noteQuiz.practice}
                showPlayed={false}
                playedMidis={held}
              />
            </ViewCard>
          }
          staff={
            noteQuiz.question?.type === 'readStaff' && noteQuiz.question.target && !noteQuiz.heatmap ? (
              <ViewCard title="Staff" testId="staff-card" className="staff-card">
                <GrandStaff
                  viewMode="scale"
                  rootPc={mod(legacy.rootPc + derived.shift, 12)}
                  intervals={derived.intervals}
                  chord={null}
                  voicingMidis={null}
                  pickedMidis={[]}
                  guitarWritten={false}
                  writtenStaff={state.settings.instrument.numStrings === 6 ? 'bass' : 'treble'}
                  labelMode="concert"
                  colorByDegree={false}
                  compareEnabled={false}
                  clickToHear={false}
                  evaluate={derived.evaluateFretboard}
                  onPlay={onPlay}
                  singleNote={noteQuiz.question.target.midi + derived.shift}
                />
              </ViewCard>
            ) : null
          }
        />
      )}

      <SettingsDrawer
        open={drawerOpen}
        onClose={closeDrawer}
        state={state}
        onStartIn={setStartIn}
        onSetFromCurrent={setMyDefault}
        onNumStrings={setNumStrings}
        onPreset={setTuningPreset}
        onStringPitch={setStringPitch}
        onLeftHanded={setLeftHanded}
        onNeck={setNeck}
        onKeyboard={setKeyboard}
        onSound={setSound}
        onMidi={setMidi}
        onWeights={setWeights}
        onResetWeights={resetWeights}
      />
    </div>
  );
}
