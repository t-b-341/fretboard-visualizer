// Steps the on-screen material in time with the built-in synth and MIDI out.
import { useCallback, useEffect, useRef, useState } from 'react';
import { scaleToMidi } from './midi';
import { player } from './player';

export interface SoundingNote {
  midi: number;
  /** Index into the ascending scale, so the staff can light the written note. */
  degree: number;
}

export interface TransportLive {
  tempo: number;
  beats: number;
  loop: boolean;
  midis: number[][];
}

/** Scale up to the octave and back down, without repeating the top note. */
export function scaleUpAndDown(rootPc: number, intervals: readonly number[], octave: number): SoundingNote[] {
  const up = scaleToMidi(rootPc, [...intervals], octave);
  if (up.length === 0) return [];
  const down = up.slice(0, -1).reverse();
  return [...up, ...down].map((midi, index) => ({
    midi,
    degree: index < up.length ? index : up.length - 2 - (index - up.length),
  }));
}

export function useTransportPlayback() {
  const [playing, setPlaying] = useState(false);
  const [sounding, setSounding] = useState<SoundingNote | null>(null);
  const generation = useRef(0);
  const timer = useRef<number | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const stop = useCallback(() => {
    generation.current += 1;
    clearTimer();
    player.stop();
    setPlaying(false);
    setSounding(null);
  }, []);

  useEffect(
    () => () => {
      generation.current += 1;
      clearTimer();
      player.stop();
    },
    [],
  );

  const playSteps = useCallback(
    (onStep: (index: number) => void, read: () => TransportLive) => {
      generation.current += 1;
      const gen = generation.current;
      clearTimer();
      player.stop();
      const first = read();
      if (first.midis.length === 0) {
        setPlaying(false);
        setSounding(null);
        return;
      }
      setPlaying(true);
      setSounding(null);
      let index = 0;
      const tick = () => {
        if (generation.current !== gen) return;
        const live = read();
        if (live.midis.length === 0) {
          player.stop();
          setPlaying(false);
          return;
        }
        if (index >= live.midis.length) index = 0;
        onStep(index);
        const notes = live.midis[index] ?? [];
        const dur = (60000 / Math.max(1, live.tempo)) * Math.max(1, live.beats);
        if (notes.length > 0) player.playChord(notes, { durationMs: Math.max(40, dur * 0.92) });
        else player.stop();
        const last = index >= live.midis.length - 1;
        timer.current = window.setTimeout(() => {
          if (generation.current !== gen) return;
          const now = read();
          if (last && !now.loop) {
            player.stop();
            setPlaying(false);
            return;
          }
          index = last ? 0 : index + 1;
          tick();
        }, dur);
      };
      tick();
    },
    [],
  );

  const playScale = useCallback((notes: SoundingNote[], readTempo: () => number) => {
    generation.current += 1;
    const gen = generation.current;
    clearTimer();
    player.stop();
    if (notes.length === 0) {
      setPlaying(false);
      setSounding(null);
      return;
    }
    setPlaying(true);
    let index = 0;
    const tick = () => {
      if (generation.current !== gen) return;
      const note = notes[index];
      if (!note) {
        player.stop();
        setPlaying(false);
        setSounding(null);
        return;
      }
      const beat = 60000 / Math.max(1, readTempo());
      setSounding(note);
      player.stop();
      player.playNote(note.midi, Math.max(40, beat * 0.9));
      const last = index >= notes.length - 1;
      timer.current = window.setTimeout(() => {
        if (generation.current !== gen) return;
        if (last) {
          player.stop();
          setPlaying(false);
          setSounding(null);
          return;
        }
        index += 1;
        tick();
      }, beat);
    };
    tick();
  }, []);

  return { playing, sounding, stop, playSteps, playScale };
}
