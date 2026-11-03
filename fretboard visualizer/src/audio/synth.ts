// Built-in Web Audio synthesizer. Unlike Web MIDI (which only *sends* note
// messages to some external device/synth), this actually makes sound in the
// browser with zero setup. It mirrors the slice of the MIDI engine API the UI
// uses (playNote / playChord / playSequence / stop) so the two can run through
// a common player facade. No dependencies.

type Listener = () => void;

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

interface Voice {
  oscillators: OscillatorNode[];
  gain: GainNode;
}

interface ChordOpts {
  durationMs?: number;
  velocity?: number; // 1-127, matching MIDI
  strumMs?: number;
}
interface SequenceOpts {
  bpm?: number;
  velocity?: number;
  gate?: number; // fraction of the beat a note sounds
}

type AudioCtor = typeof AudioContext;

class WebAudioSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Set<Voice>();
  /** Notes held from MIDI input. Kept out of `voices` so Stop does not cut them. */
  private heldVoices = new Map<number, Voice>();
  /** Held root. Kept out of `voices` so melodic stop() does not cut the drone. */
  private drone: Voice | null = null;
  private _volume = 0.5; // 0-1
  private _muted = false;
  private listeners = new Set<Listener>();

  get supported(): boolean {
    return (
      typeof window !== 'undefined' &&
      (typeof window.AudioContext !== 'undefined' ||
        typeof (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext !== 'undefined')
    );
  }

  get volume(): number {
    return this._volume;
  }
  get muted(): boolean {
    return this._muted;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  /**
   * Lazily create / resume the AudioContext. Must first run inside a user
   * gesture (a click handler) to satisfy browser autoplay policies — every
   * caller here is wired to a button, so that holds.
   */
  private ensure(): AudioContext | null {
    if (!this.supported) return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: AudioCtor }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this._muted ? 0 : this._volume;
      // A gentle limiter so fat chords don't clip.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 20;
      comp.ratio.value = 12;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  setVolume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this._muted ? 0 : this._volume, this.ctx.currentTime, 0.01);
    }
    this.emit();
  }
  setMuted(m: boolean) {
    this._muted = m;
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : this._volume, this.ctx.currentTime, 0.01);
    }
    this.emit();
  }

  /** Schedule one note with a soft ADSR envelope. */
  private voiceOn(ctx: AudioContext, freq: number, startAt: number, durSec: number, velocity: number) {
    const master = this.master!;
    const peak = Math.max(0.0001, (Math.max(1, Math.min(127, velocity)) / 127) * 0.3);
    const a = 0.008;
    const d = 0.12;
    const sustain = Math.max(0.0001, peak * 0.6);
    const r = 0.18;
    const atk = startAt + a;
    const dec = atk + d;
    const rel = Math.max(dec, startAt + durSec); // note-off moment

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, startAt);
    g.gain.exponentialRampToValueAtTime(peak, atk);
    g.gain.exponentialRampToValueAtTime(sustain, dec);
    g.gain.setValueAtTime(sustain, rel);
    g.gain.exponentialRampToValueAtTime(0.0001, rel + r);
    g.connect(master);

    // A triangle body plus a quiet octave-up sine for a little shimmer.
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.25;
    o1.connect(g);
    o2.connect(o2g);
    o2g.connect(g);

    const hardStop = rel + r + 0.05;
    o1.start(startAt);
    o2.start(startAt);
    o1.stop(hardStop);
    o2.stop(hardStop);

    const voice: Voice = { oscillators: [o1, o2], gain: g };
    this.voices.add(voice);
    o1.onended = () => {
      try {
        g.disconnect();
      } catch {
        /* already gone */
      }
      this.voices.delete(voice);
    };
  }

  /** Play notes together (a chord), optionally lightly strummed. */
  playChord(midis: number[], opts: ChordOpts = {}) {
    const ctx = this.ensure();
    if (!ctx || midis.length === 0) return;
    this.stop();
    const dur = (opts.durationMs ?? 1200) / 1000;
    const vel = opts.velocity ?? 95;
    const strum = (opts.strumMs ?? 8) / 1000;
    const now = ctx.currentTime + 0.02;
    midis.forEach((m, i) => this.voiceOn(ctx, midiToFreq(m), now + i * strum, dur, vel));
  }

  /** Play notes one after another (a scale run). */
  playSequence(midis: number[], opts: SequenceOpts = {}) {
    const ctx = this.ensure();
    if (!ctx || midis.length === 0) return;
    this.stop();
    const beat = 60 / (opts.bpm ?? 120);
    const gate = opts.gate ?? 0.9;
    const vel = opts.velocity ?? 100;
    const now = ctx.currentTime + 0.02;
    midis.forEach((m, i) => this.voiceOn(ctx, midiToFreq(m), now + i * beat, beat * gate, vel));
  }

  /**
   * Sustain the root under whatever else is playing. Replaces any previous drone.
   * Must be called from a click the first time, so the audio context can start.
   */
  startDrone(midi: number) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.stopDrone();
    const g = ctx.createGain();
    g.gain.value = 0.07;
    g.connect(this.master);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = midiToFreq(midi);
    o.connect(g);
    o.start();
    this.drone = { oscillators: [o], gain: g };
  }

  stopDrone() {
    if (!this.drone || !this.ctx) {
      this.drone = null;
      return;
    }
    const now = this.ctx.currentTime;
    try {
      this.drone.gain.gain.setTargetAtTime(0.0001, now, 0.03);
      this.drone.oscillators.forEach((o) => {
        try {
          o.stop(now + 0.15);
        } catch {
          /* already stopped */
        }
      });
    } catch {
      /* ignore */
    }
    this.drone = null;
  }

  /** Resume the audio context. Call from a click before MIDI thru starts. */
  resume() {
    this.ensure();
  }

  /** Hold a note until `releaseHeldNote`. Used for MIDI input thru. */
  holdNote(midi: number, velocity = 100) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const note = midi & 0x7f;
    this.releaseHeldNote(note, 0.02);
    const now = ctx.currentTime;
    const peak = Math.max(0.0001, (Math.max(1, Math.min(127, velocity)) / 127) * 0.28);
    const sustain = Math.max(0.0001, peak * 0.65);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    g.gain.exponentialRampToValueAtTime(sustain, now + 0.12);
    g.connect(this.master);

    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = midiToFreq(note);
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = midiToFreq(note) * 2;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.22;
    o1.connect(g);
    o2.connect(o2g);
    o2g.connect(g);
    o1.start(now);
    o2.start(now);
    this.heldVoices.set(note, { oscillators: [o1, o2], gain: g });
  }

  /** Release one thru note. Missing notes are ignored. */
  releaseHeldNote(midi: number, release = 0.06) {
    const note = midi & 0x7f;
    const voice = this.heldVoices.get(note);
    if (!voice) return;
    this.heldVoices.delete(note);
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(voice.gain.gain.value, 0.0001), now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.02, release));
      const stopAt = now + Math.max(0.02, release) + 0.03;
      voice.oscillators.forEach((osc) => {
        try {
          osc.stop(stopAt);
        } catch {
          /* already stopped */
        }
      });
      voice.oscillators[0].onended = () => {
        try {
          voice.gain.disconnect();
        } catch {
          /* already gone */
        }
      };
    } catch {
      /* ignore */
    }
  }

  releaseAllHeld() {
    for (const note of [...this.heldVoices.keys()]) this.releaseHeldNote(note);
  }

  /** Play a single note (e.g. click-to-hear). */
  playNote(midi: number, durationMs = 500, velocity = 100) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.voiceOn(ctx, midiToFreq(midi), ctx.currentTime + 0.01, durationMs / 1000, velocity);
  }

  /** Quickly silence everything currently sounding. */
  stop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.voices.forEach((v) => {
      try {
        v.gain.gain.cancelScheduledValues(now);
        v.gain.gain.setTargetAtTime(0.0001, now, 0.03);
        v.oscillators.forEach((o) => {
          try {
            o.stop(now + 0.12);
          } catch {
            /* already stopped */
          }
        });
      } catch {
        /* ignore */
      }
    });
  }
}

export const synth = new WebAudioSynth();
