// Unified playback facade. Always drives the built-in Web Audio synth (so the
// app makes sound with no setup) and, when an external MIDI output is enabled,
// mirrors the same notes to it. Components call `player` instead of either
// engine directly so sound "just works" regardless of MIDI availability.
import { midiEngine } from './midi';
import type { ChordOptions, SequenceOptions } from './midi';
import { synth } from './synth';

export const player = {
  playNote(midi: number, durationMs?: number, velocity?: number) {
    synth.playNote(midi, durationMs, velocity);
    midiEngine.playNote(midi, durationMs, velocity);
  },
  playChord(midis: number[], opts: ChordOptions = {}) {
    synth.playChord(midis, opts);
    midiEngine.playChord(midis, opts);
  },
  playSequence(midis: number[], opts: SequenceOptions = {}) {
    synth.playSequence(midis, opts);
    midiEngine.playSequence(midis, opts);
  },
  stop() {
    synth.stop();
    midiEngine.stop();
  },
  /** Sustain the root. Independent of stop(), so a scale can play over it. */
  startDrone(midi: number) {
    synth.startDrone(midi);
    midiEngine.startDrone(midi);
  },
  stopDrone() {
    synth.stopDrone();
    midiEngine.stopDrone();
  },
};
