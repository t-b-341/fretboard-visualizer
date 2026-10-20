// Minimal Web MIDI output engine. Emits standard MIDI note messages to a
// selected output port — a DAW, a hardware synth, or an OS synth such as the
// "Microsoft GS Wavetable Synth" on Windows. No dependencies.

// Minimal Web MIDI typings (Web MIDI is not in every TS lib.dom). We only
// declare the slice we use and cast navigator to it, so there is nothing to
// install and no clash with the built-in DOM lib when it is present.
interface MidiPortLike {
  id: string;
  name?: string | null;
}
interface MidiOutputLike extends MidiPortLike {
  send(data: number[], timestamp?: number): void;
}
interface MidiAccessLike {
  outputs: Map<string, MidiOutputLike>;
  onstatechange: ((e: unknown) => void) | null;
}
interface NavigatorWithMidi {
  requestMIDIAccess?: (opts?: { sysex?: boolean }) => Promise<MidiAccessLike>;
}

export interface MidiOutputInfo {
  id: string;
  name: string;
}

export interface SequenceOptions {
  bpm?: number; // quarter-note tempo
  velocity?: number; // 1-127
  gate?: number; // fraction of the beat a note sounds (0-1)
}

export interface ChordOptions {
  durationMs?: number;
  velocity?: number;
  strumMs?: number; // delay between stacked notes for a light strum
}

type Listener = () => void;

/**
 * Small stateful singleton wrapping a single chosen MIDI output. Scheduling is
 * done with plain timers so that `stop()` can reliably cancel everything and
 * silence any hanging notes (important once real gear/DAWs are listening).
 */
class MidiEngine {
  private access: MidiAccessLike | null = null;
  outputId: string | null = null;
  channel = 0; // 0-15 internally; shown as 1-16 in the UI

  private timers: number[] = [];
  private sounding = new Set<number>();
  private listeners = new Set<Listener>();

  get supported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      typeof (navigator as unknown as NavigatorWithMidi).requestMIDIAccess === 'function'
    );
  }

  get enabled(): boolean {
    return this.access !== null;
  }

  /** Subscribe to device-list / selection changes; returns an unsubscribe fn. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  private emit() {
    this.listeners.forEach((fn) => fn());
  }

  async enable(): Promise<boolean> {
    if (this.access) return true;
    const nav = navigator as unknown as NavigatorWithMidi;
    if (!nav.requestMIDIAccess) return false;
    try {
      this.access = await nav.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => {
        // Keep a valid selection as devices come and go.
        if (this.outputId && !this.access!.outputs.get(this.outputId)) {
          this.outputId = this.firstOutputId();
        }
        this.emit();
      };
      if (!this.outputId) this.outputId = this.firstOutputId();
      this.emit();
      return true;
    } catch {
      this.access = null;
      return false;
    }
  }

  private firstOutputId(): string | null {
    const list = this.outputs();
    return list.length ? list[0].id : null;
  }

  outputs(): MidiOutputInfo[] {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values()).map((o) => ({
      id: o.id,
      name: o.name || o.id,
    }));
  }

  setOutput(id: string) {
    this.outputId = id;
    this.emit();
  }

  /** Accepts a 1-16 channel from the UI. */
  setChannel(ch1to16: number) {
    this.channel = Math.max(0, Math.min(15, Math.round(ch1to16) - 1));
  }

  private port(): MidiOutputLike | null {
    if (!this.access || !this.outputId) return null;
    return this.access.outputs.get(this.outputId) ?? null;
  }

  private sendOn(midi: number, velocity: number) {
    const p = this.port();
    if (!p) return;
    const n = midi & 0x7f;
    p.send([0x90 | this.channel, n, Math.max(1, Math.min(127, velocity)) & 0x7f]);
    this.sounding.add(n);
  }

  private sendOff(midi: number) {
    const p = this.port();
    if (!p) return;
    const n = midi & 0x7f;
    p.send([0x80 | this.channel, n, 0]);
    this.sounding.delete(n);
  }

  /** Play notes one after another (a scale run). */
  playSequence(midis: number[], opts: SequenceOptions = {}) {
    this.stop();
    if (!this.port() || midis.length === 0) return;
    const beat = 60000 / (opts.bpm ?? 120); // ms per note
    const gate = opts.gate ?? 0.9;
    const vel = opts.velocity ?? 100;
    midis.forEach((m, i) => {
      const onAt = i * beat;
      this.timers.push(window.setTimeout(() => this.sendOn(m, vel), onAt));
      this.timers.push(window.setTimeout(() => this.sendOff(m), onAt + beat * gate));
    });
  }

  /** Play notes together (a chord), optionally lightly strummed. */
  playChord(midis: number[], opts: ChordOptions = {}) {
    this.stop();
    if (!this.port() || midis.length === 0) return;
    const dur = opts.durationMs ?? 1200;
    const vel = opts.velocity ?? 95;
    const strum = opts.strumMs ?? 18;
    midis.forEach((m, i) => {
      const onAt = i * strum;
      this.timers.push(window.setTimeout(() => this.sendOn(m, vel), onAt));
      this.timers.push(window.setTimeout(() => this.sendOff(m), onAt + dur));
    });
  }

  /** Play a single note (e.g. click-to-hear). */
  playNote(midi: number, durationMs = 500, velocity = 100) {
    if (!this.port()) return;
    this.sendOn(midi, velocity);
    this.timers.push(window.setTimeout(() => this.sendOff(midi), durationMs));
  }

  /** Cancel pending notes and silence anything still sounding. */
  stop() {
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    const p = this.port();
    if (p) {
      this.sounding.forEach((n) => p.send([0x80 | this.channel, n, 0]));
      p.send([0xb0 | this.channel, 123, 0]); // CC 123 = All Notes Off
    }
    this.sounding.clear();
  }
}

export const midiEngine = new MidiEngine();

/**
 * Concert-pitch MIDI numbers for a one-octave scale run (root up to the octave,
 * inclusive). `octave` follows the app's convention where octave 4 -> MIDI 60.
 */
export function scaleToMidi(rootPc: number, intervals: number[], octave: number): number[] {
  const rootMidi = (octave + 1) * 12 + rootPc;
  return [...intervals.map((i) => rootMidi + i), rootMidi + 12];
}

/** Voice triad pitch classes as an ascending close-position chord. */
export function triadToMidi(pitches: number[], octave: number): number[] {
  const root = pitches[0];
  const rootMidi = (octave + 1) * 12 + root;
  return pitches.map((pc) => rootMidi + ((pc - root + 12) % 12));
}
