// Web MIDI input. The parser is pure; the engine below it owns the port,
// the sustain pedal, and the set of notes currently held.
//
// Output always writes a status byte (see midi.ts). Hardware streams may
// omit it under running status, so the parser accepts a previous status
// when the buffer starts with a data byte. Web MIDI normally expands that
// before the page sees the message.

import { useEffect, useState } from 'react';
import {
  currentMidiAccess,
  onMidiAccessChange,
  requestMidiAccess,
  webMidiSupported,
  type MidiInputPort,
} from './midi';
import { synth } from './synth';

export interface MidiPortInfo {
  id: string;
  name: string;
}

export type MidiInputEvent =
  | { type: 'noteOn'; channel: number; note: number; velocity: number }
  | { type: 'noteOff'; channel: number; note: number; velocity: number }
  | { type: 'cc'; channel: number; controller: number; value: number };

export interface HeldState {
  down: ReadonlySet<number>;
  sustained: ReadonlySet<number>;
  pedal: boolean;
}

const EMPTY_SET: ReadonlySet<number> = new Set();
const EMPTY_NOTES: ReadonlySet<number> = new Set();

export const EMPTY_HELD: HeldState = { down: EMPTY_SET, sustained: EMPTY_SET, pedal: false };

/**
 * One channel-voice message. Note-on with velocity 0 is a note-off.
 * System messages, program changes, and short buffers return null.
 * Realtime bytes (clock, active sensing) are skipped wherever they sit.
 */
export function parseMidiMessage(bytes: ArrayLike<number>, runningStatus = 0): MidiInputEvent | null {
  if (!bytes || bytes.length === 0) return null;
  const data: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i] & 0xff;
    if (byte >= 0xf8) continue;
    data.push(byte);
  }
  if (data.length === 0) return null;

  let index = 0;
  let status = data[0];
  if (status >= 0xf0) return null;
  if (status >= 0x80) {
    index = 1;
  } else {
    status = runningStatus & 0xff;
    if (status < 0x80 || status >= 0xf0) return null;
  }

  const kind = status & 0xf0;
  const channel = status & 0x0f;
  if (kind !== 0x80 && kind !== 0x90 && kind !== 0xb0) return null;
  if (data.length < index + 2) return null;
  const d1 = data[index] & 0x7f;
  const d2 = data[index + 1] & 0x7f;

  if (kind === 0x90) {
    if (d2 === 0) return { type: 'noteOff', channel, note: d1, velocity: 0 };
    return { type: 'noteOn', channel, note: d1, velocity: d2 };
  }
  if (kind === 0x80) return { type: 'noteOff', channel, note: d1, velocity: d2 };
  return { type: 'cc', channel, controller: d1, value: d2 };
}

function without(notes: ReadonlySet<number>, note: number): ReadonlySet<number> {
  if (!notes.has(note)) return notes;
  const next = new Set(notes);
  next.delete(note);
  return next;
}

/**
 * Apply one parsed event to the keys that are down and the keys the sustain
 * pedal is still holding. CC 64 at 64 or above is pedal down. Other
 * controllers leave the state alone.
 */
export function reduceHeldNotes(state: HeldState, event: MidiInputEvent): HeldState {
  if (event.type === 'cc') {
    if (event.controller !== 64) return state;
    const pedal = event.value >= 64;
    if (pedal === state.pedal) return state;
    if (pedal) return { down: state.down, sustained: state.sustained, pedal: true };
    if (state.sustained.size === 0) return { down: state.down, sustained: state.sustained, pedal: false };
    return { down: state.down, sustained: EMPTY_SET, pedal: false };
  }

  const note = event.note & 0x7f;
  if (event.type === 'noteOn') {
    if (state.down.has(note) && !state.sustained.has(note)) return state;
    const down = new Set(state.down);
    down.add(note);
    return { down, sustained: without(state.sustained, note), pedal: state.pedal };
  }

  if (!state.down.has(note)) return state;
  const down = without(state.down, note);
  if (!state.pedal) return { down, sustained: without(state.sustained, note), pedal: false };
  const sustained = new Set(state.sustained);
  sustained.add(note);
  return { down, sustained, pedal: true };
}

/** Keys physically down, plus keys the pedal has not released yet. */
export function heldNoteSet(state: HeldState): Set<number> {
  if (state.down.size === 0 && state.sustained.size === 0) return new Set();
  const notes = new Set<number>(state.down);
  for (const note of state.sustained) notes.add(note);
  return notes;
}

/** The saved port, or null when that name is not connected. Never throws. */
export function resolveMidiInput<T extends { name: string }>(ports: readonly T[], savedName: string): T | null {
  const name = savedName.trim();
  if (!name) return null;
  return ports.find((port) => port.name === name) ?? null;
}

function sameSet(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false;
  for (const note of a) if (!b.has(note)) return false;
  return true;
}

type HeldListener = (notes: ReadonlySet<number>) => void;
type PortListener = () => void;

class MidiInputEngine {
  private wantedName = '';
  private bound: MidiInputPort | null = null;
  private runningStatus = 0;
  private held: HeldState = EMPTY_HELD;
  private velocities = new Map<number, number>();
  private published: ReadonlySet<number> = EMPTY_NOTES;
  private thru = false;
  private heldListeners = new Set<HeldListener>();
  private portListeners = new Set<PortListener>();
  private unsubAccess: (() => void) | null = null;

  get supported(): boolean {
    return webMidiSupported();
  }

  get enabled(): boolean {
    return currentMidiAccess() !== null;
  }

  heldNotes(): ReadonlySet<number> {
    return this.published;
  }

  /** Port list and selection changes. Held notes use `onHeldNotesChange`. */
  subscribe(fn: PortListener): () => void {
    this.portListeners.add(fn);
    return () => {
      this.portListeners.delete(fn);
    };
  }

  /**
   * Held MIDI note numbers. The same function the views, the quiz, and
   * chord identification listen through.
   */
  onHeldNotesChange(fn: HeldListener): () => void {
    this.heldListeners.add(fn);
    fn(this.published);
    return () => {
      this.heldListeners.delete(fn);
    };
  }

  inputs(): MidiPortInfo[] {
    const inputs = currentMidiAccess()?.inputs;
    if (!inputs) return [];
    const ports: MidiPortInfo[] = [];
    for (const port of inputs.values()) {
      if (port.state === 'disconnected') continue;
      ports.push({ id: port.id, name: port.name || port.id });
    }
    return ports;
  }

  /** Remember a port by name. An unknown name selects none and does not throw. */
  selectByName(name: string) {
    this.wantedName = name.trim();
    this.bind();
  }

  async enable(): Promise<boolean> {
    const ok = await requestMidiAccess();
    if (!ok) return false;
    if (!this.unsubAccess) this.unsubAccess = onMidiAccessChange(() => this.bind());
    this.bind();
    return true;
  }

  /** Play held notes on the built-in synth. Off leaves a hardware synth alone. */
  setThru(on: boolean) {
    if (this.thru === on) {
      if (on) synth.resume();
      return;
    }
    this.thru = on;
    if (!on) {
      synth.releaseAllHeld();
      return;
    }
    synth.resume();
    for (const note of this.published) synth.holdNote(note, this.velocities.get(note) ?? 96);
  }

  private bind() {
    try {
      const access = currentMidiAccess();
      const inputs = access?.inputs;
      if (!access || !inputs) {
        this.attach(null);
        return;
      }
      const match = resolveMidiInput(this.inputs(), this.wantedName);
      const port = match ? inputs.get(match.id) ?? null : null;
      const usable = port && port.state !== 'disconnected' ? port : null;
      if (usable === this.bound) {
        this.emitPorts();
        return;
      }
      this.attach(usable);
    } catch {
      this.attach(null);
    }
  }

  private attach(port: MidiInputPort | null) {
    if (this.bound && this.bound !== port) {
      try {
        this.bound.onmidimessage = null;
      } catch {
        /* the port may already be gone */
      }
    }
    this.bound = port;
    this.runningStatus = 0;
    this.held = EMPTY_HELD;
    this.velocities.clear();
    if (this.thru) synth.releaseAllHeld();
    this.publish(EMPTY_NOTES);
    if (!port) {
      this.emitPorts();
      return;
    }
    port.onmidimessage = (event) => {
      try {
        if (event?.data) this.ingest(event.data);
      } catch {
        /* a bad packet must not take down the page */
      }
    };
    this.emitPorts();
  }

  private ingest(data: ArrayLike<number>) {
    if (data.length === 0) return;
    let statusByte = 0;
    let sawChannel = false;
    for (let i = 0; i < data.length; i++) {
      const byte = data[i] & 0xff;
      if (byte >= 0xf8) continue;
      statusByte = byte;
      sawChannel = true;
      break;
    }
    if (!sawChannel) return;
    if (statusByte >= 0xf0) {
      this.runningStatus = 0;
      return;
    }
    if (statusByte >= 0x80) this.runningStatus = statusByte;
    const event = parseMidiMessage(data, this.runningStatus);
    if (!event) return;
    this.apply(event);
  }

  private apply(event: MidiInputEvent) {
    const note = event.type === 'cc' ? -1 : event.note & 0x7f;
    if (event.type === 'noteOn') this.velocities.set(note, event.velocity);
    const before = heldNoteSet(this.held);
    const next = reduceHeldNotes(this.held, event);
    this.held = next;
    const after = heldNoteSet(next);
    if (this.thru) {
      for (const held of before) {
        if (!after.has(held)) synth.releaseHeldNote(held);
      }
      if (event.type === 'noteOn') synth.holdNote(note, event.velocity);
      else {
        for (const held of after) {
          if (!before.has(held)) synth.holdNote(held, this.velocities.get(held) ?? 96);
        }
      }
    }
    this.publish(after);
  }

  private publish(notes: ReadonlySet<number>) {
    if (sameSet(this.published, notes)) return;
    this.published = notes.size === 0 ? EMPTY_NOTES : notes;
    const snapshot = this.published;
    this.heldListeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {
        /* a listener must not break input */
      }
    });
  }

  private emitPorts() {
    this.portListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  }
}

export const midiInput = new MidiInputEngine();

/** MIDI note numbers currently held, including notes the sustain pedal is keeping. */
export function useHeldNotes(): ReadonlySet<number> {
  const [notes, setNotes] = useState<ReadonlySet<number>>(() => midiInput.heldNotes());
  useEffect(() => midiInput.onHeldNotesChange(setNotes), []);
  return notes;
}
