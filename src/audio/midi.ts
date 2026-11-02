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
  /** MIDI note held as a drone. Note-offs for this pitch are ignored. */
  private drone: number | null = null;
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
    if (n === this.drone) return;
    p.send([0x80 | this.channel, n, 0]);
    this.sounding.delete(n);
  }

  /** Hold a root on the external device. Survives stop(), which re-sounds it. */
  startDrone(midi: number) {
    const n = midi & 0x7f;
    const p = this.port();
    if (this.drone !== null && this.drone !== n) {
      const prev = this.drone;
      this.drone = null;
      this.sendOff(prev);
    }
    this.drone = n;
    if (!p) return;
    p.send([0x90 | this.channel, n, 64]);
  }

  stopDrone() {
    if (this.drone === null) return;
    const n = this.drone;
    this.drone = null;
    this.sendOff(n);
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
    if ((midi & 0x7f) === this.drone) return;
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
    if (this.drone !== null && p) p.send([0x90 | this.channel, this.drone, 64]);
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

/**
 * Voice a chord as spread MIDI notes from its intervals (semitones above the
 * root, which may exceed 12 for upper extensions). `octave` 4 -> root MIDI 60.
 */
export function chordToMidi(rootPc: number, intervalsFromRoot: number[], octave: number): number[] {
  const rootMidi = (octave + 1) * 12 + rootPc;
  return intervalsFromRoot.map((i) => rootMidi + i);
}

export interface MidiFileOptions {
  bpm?: number; // quarter-note tempo written into the file
  beatsPerChord?: number; // how long each chord lasts, in beats
  ticksPerBeat?: number; // division / PPQ (default 480)
  velocity?: number; // 1-127 (default 95)
  gate?: number; // fraction of each chord's length the notes sound, 0-1 (default 0.95)
  trackName?: string;
}

/**
 * Encode a chord progression as a Standard MIDI File (format 0) and return the
 * raw bytes, ready to wrap in a Blob for download. Each entry in `chords` is one
 * chord's MIDI note numbers (e.g. from chordToMidi); chords play back-to-back,
 * each lasting `beatsPerChord` beats. Pure data — no Web MIDI, no dependencies,
 * so it works even where MIDI output is unavailable.
 */
export function progressionToSmf(chords: number[][], opts: MidiFileOptions = {}): Uint8Array<ArrayBuffer> {
  const ppq = Math.max(24, Math.round(opts.ticksPerBeat ?? 480));
  const bpm = Math.max(1, opts.bpm ?? 120);
  const beats = Math.max(0.25, opts.beatsPerChord ?? 2);
  const vel = Math.max(1, Math.min(127, Math.round(opts.velocity ?? 95)));
  const gate = Math.max(0.1, Math.min(1, opts.gate ?? 0.95));
  const chordTicks = Math.max(1, Math.round(ppq * beats));
  const onTicks = Math.max(1, Math.round(chordTicks * gate));
  const restTicks = Math.max(0, chordTicks - onTicks); // gap between chords

  // MIDI delta times are variable-length quantities: 7 bits per byte, big-endian,
  // with the high bit set on every byte except the last.
  const vlq = (value: number): number[] => {
    let v = Math.max(0, Math.floor(value));
    const out = [v & 0x7f];
    v = Math.floor(v / 128);
    while (v > 0) {
      out.unshift((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    return out;
  };
  const u16 = (n: number): number[] => [(n >> 8) & 0xff, n & 0xff];
  const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const ascii = (s: string): number[] => Array.from(s, (c) => c.charCodeAt(0) & 0x7f);

  const track: number[] = [];
  const push = (...bytes: number[]) => track.push(...bytes);
  const ch = 0; // channel 1

  // --- Meta events, all at delta 0 at the head of the track ---
  if (opts.trackName) {
    const name = ascii(opts.trackName).slice(0, 127);
    push(0x00, 0xff, 0x03, ...vlq(name.length), ...name);
  }
  push(0x00, 0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08); // time signature 4/4
  const mpq = Math.round(60000000 / bpm); // microseconds per quarter note
  push(0x00, 0xff, 0x51, 0x03, (mpq >> 16) & 0xff, (mpq >> 8) & 0xff, mpq & 0xff); // set tempo
  push(0x00, 0xc0 | ch, 0x00); // program change -> Acoustic Grand Piano

  // --- Chord events ---
  let lead = 0; // ticks to wait before the next chord's first note-on
  for (const raw of chords) {
    const notes = raw
      .filter((n) => Number.isFinite(n))
      .map((n) => Math.max(0, Math.min(127, Math.round(n))));
    if (notes.length === 0) {
      lead += chordTicks; // preserve timing for an empty slot
      continue;
    }
    push(...vlq(lead), 0x90 | ch, notes[0], vel); // first note-on after the lead gap
    for (let k = 1; k < notes.length; k++) push(0x00, 0x90 | ch, notes[k], vel);
    push(...vlq(onTicks), 0x80 | ch, notes[0], 0); // note-offs after the sounding portion
    for (let k = 1; k < notes.length; k++) push(0x00, 0x80 | ch, notes[k], 0);
    lead = restTicks; // carry the gap to the next chord
  }
  push(0x00, 0xff, 0x2f, 0x00); // end of track

  const header = [...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(ppq)];
  const chunk = [...ascii('MTrk'), ...u32(track.length), ...track];
  const out = new Uint8Array(header.length + chunk.length);
  out.set(header, 0);
  out.set(chunk, header.length);
  return out;
}
