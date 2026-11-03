import { describe, expect, it } from 'vitest';
import {
  EMPTY_HELD,
  heldNoteSet,
  parseMidiMessage,
  reduceHeldNotes,
  resolveMidiInput,
} from './midiIn';

describe('parseMidiMessage', () => {
  it('parses note-on, note-off, and note-on with velocity 0', () => {
    expect(parseMidiMessage([0x90, 60, 100])).toEqual({
      type: 'noteOn',
      channel: 0,
      note: 60,
      velocity: 100,
    });
    expect(parseMidiMessage([0x81, 62, 40])).toEqual({
      type: 'noteOff',
      channel: 1,
      note: 62,
      velocity: 40,
    });
    expect(parseMidiMessage([0x90, 60, 0])).toEqual({
      type: 'noteOff',
      channel: 0,
      note: 60,
      velocity: 0,
    });
  });

  it('parses the sustain pedal and ignores other channel messages', () => {
    expect(parseMidiMessage([0xb0, 64, 127])).toEqual({
      type: 'cc',
      channel: 0,
      controller: 64,
      value: 127,
    });
    expect(parseMidiMessage([0xb2, 64, 0])).toEqual({
      type: 'cc',
      channel: 2,
      controller: 64,
      value: 0,
    });
    expect(parseMidiMessage([0xc0, 0])).toBeNull();
    expect(parseMidiMessage([0xe0, 0, 64])).toBeNull();
    expect(parseMidiMessage([0xf8])).toBeNull();
    expect(parseMidiMessage([])).toBeNull();
    expect(parseMidiMessage([0x90, 60])).toBeNull();
  });

  it('skips realtime bytes and accepts running status', () => {
    expect(parseMidiMessage([0x90, 0xf8, 60, 0xfe, 100])).toEqual({
      type: 'noteOn',
      channel: 0,
      note: 60,
      velocity: 100,
    });
    expect(parseMidiMessage([60, 100], 0x90)).toEqual({
      type: 'noteOn',
      channel: 0,
      note: 60,
      velocity: 100,
    });
    expect(parseMidiMessage([60, 0], 0x91)).toEqual({
      type: 'noteOff',
      channel: 1,
      note: 60,
      velocity: 0,
    });
    expect(parseMidiMessage([64, 127], 0xb0)).toEqual({
      type: 'cc',
      channel: 0,
      controller: 64,
      value: 127,
    });
    expect(parseMidiMessage([60, 100])).toBeNull();
    expect(parseMidiMessage([60, 100], 0)).toBeNull();
  });
});

function notesOf(bytes: number[], runningStatus = 0) {
  const event = parseMidiMessage(bytes, runningStatus);
  if (!event) throw new Error('expected a MIDI event');
  return event;
}

describe('reduceHeldNotes', () => {
  it('holds a note until note-off, including velocity 0', () => {
    let held = reduceHeldNotes(EMPTY_HELD, notesOf([0x90, 60, 80]));
    expect([...heldNoteSet(held)]).toEqual([60]);
    held = reduceHeldNotes(held, notesOf([0x90, 60, 0]));
    expect([...heldNoteSet(held)]).toEqual([]);
  });

  it('keeps released notes while the sustain pedal is down', () => {
    let held = reduceHeldNotes(EMPTY_HELD, notesOf([0x90, 60, 100]));
    held = reduceHeldNotes(held, notesOf([0x90, 64, 90]));
    held = reduceHeldNotes(held, notesOf([0xb0, 64, 127]));
    held = reduceHeldNotes(held, notesOf([0x80, 60, 0]));
    expect([...heldNoteSet(held)].sort((a, b) => a - b)).toEqual([60, 64]);

    held = reduceHeldNotes(held, notesOf([0x90, 60, 70]));
    held = reduceHeldNotes(held, notesOf([0x80, 60, 0]));
    expect(heldNoteSet(held).has(60)).toBe(true);

    held = reduceHeldNotes(held, notesOf([0xb0, 64, 63]));
    expect([...heldNoteSet(held)]).toEqual([64]);
  });

  it('keeps a key that is still down when the pedal lifts', () => {
    let held = reduceHeldNotes(EMPTY_HELD, notesOf([0x90, 60, 100]));
    held = reduceHeldNotes(held, notesOf([0xb0, 64, 127]));
    held = reduceHeldNotes(held, notesOf([0xb0, 64, 0]));
    expect([...heldNoteSet(held)]).toEqual([60]);
    expect(reduceHeldNotes(held, notesOf([0xb0, 1, 127]))).toBe(held);
  });
});

describe('resolveMidiInput', () => {
  const ports = [
    { id: 'a', name: 'Keystation' },
    { id: 'b', name: 'Interface' },
  ];

  it('selects a port by name and falls back to none when it is missing', () => {
    expect(resolveMidiInput(ports, 'Keystation')?.id).toBe('a');
    expect(resolveMidiInput(ports, 'Missing')).toBeNull();
    expect(resolveMidiInput(ports, '')).toBeNull();
    expect(resolveMidiInput(ports, '   ')).toBeNull();
  });
});
