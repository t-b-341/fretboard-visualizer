// ASCII tab. One line per string, highest string on top.
//
// A column is one grip. Muted strings are "-". A two-digit fret widens every
// cell in that column, and a chord name widens it further, so the next column
// starts at the same character on every line. Systems wrap at maxWidth without
// breaking a column in half.

import { mod, noteName } from './notes';
import type { GuitarString } from './tunings';
import type { VoicedNote } from './voicings';

export interface TabColumn {
  label?: string;
  notes: VoicedNote[];
}

export interface TabOptions {
  /** Semitones added to each open string before it is spelled. Concert is 0, Standard is 1. */
  labelShift?: number;
  /** Maximum characters on a line. Default 80. A column is never split across lines. */
  maxWidth?: number;
}

interface BuiltColumn {
  /** Chord name, space-padded to the column width. */
  label: string;
  /** Fret cells, highest string first. Dash-padded to the column width. */
  cells: string[];
  width: number;
  named: boolean;
}

const DEFAULT_MAX_WIDTH = 80;

export function formatTab(tuning: GuitarString[], columns: TabColumn[], opts?: TabOptions): string {
  if (tuning.length === 0) return '';

  const shift = opts?.labelShift ?? 0;
  const requested = opts?.maxWidth ?? DEFAULT_MAX_WIDTH;
  const maxWidth = Number.isFinite(requested) && requested > 0 ? requested : DEFAULT_MAX_WIDTH;
  const prefixes = stringPrefixes(tuning, shift);
  const prefixWidth = prefixes[0].length;
  const built = columns.map((column) => buildColumn(column, tuning.length));
  const showLabels = built.some((column) => column.named);

  if (built.length === 0) return prefixes.join('\n');

  const systems: BuiltColumn[][] = [];
  let current: BuiltColumn[] = [];
  let currentWidth = 0;
  for (const column of built) {
    const next = current.length === 0 ? prefixWidth + column.width : currentWidth + 1 + column.width;
    if (current.length > 0 && next > maxWidth) {
      systems.push(current);
      current = [column];
      currentWidth = prefixWidth + column.width;
    } else {
      current.push(column);
      currentWidth = next;
    }
  }
  systems.push(current);

  return systems.map((system) => renderSystem(prefixes, system, showLabels)).join('\n\n');
}

function stringPrefixes(tuning: GuitarString[], labelShift: number): string[] {
  const names = tuning.map((string) => noteName(mod(string.pc + labelShift, 12)));
  const width = names.reduce((max, name) => Math.max(max, name.length), 1);
  const prefixes: string[] = [];
  for (let index = tuning.length - 1; index >= 0; index--) {
    prefixes.push(`${names[index].padStart(width, ' ')}|`);
  }
  return prefixes;
}

function buildColumn(column: TabColumn, stringCount: number): BuiltColumn {
  const frets = new Map<number, number>();
  for (const note of column.notes) {
    if (note.stringIndex < 0 || note.stringIndex >= stringCount) continue;
    if (!frets.has(note.stringIndex)) frets.set(note.stringIndex, note.fret);
  }
  const tokens: string[] = [];
  for (let stringIndex = stringCount - 1; stringIndex >= 0; stringIndex--) {
    const fret = frets.get(stringIndex);
    tokens.push(fret === undefined ? '-' : String(fret));
  }
  const rawLabel = column.label ?? '';
  const width = Math.max(rawLabel.length, ...tokens.map((token) => token.length), 1);
  return {
    label: rawLabel.padEnd(width, ' '),
    cells: tokens.map((token) => token.padEnd(width, '-')),
    width,
    named: rawLabel.length > 0,
  };
}

function renderSystem(prefixes: string[], columns: BuiltColumn[], showLabels: boolean): string {
  const lines: string[] = [];
  if (showLabels) {
    const head = ' '.repeat(prefixes[0].length) + columns.map((column) => column.label).join(' ');
    lines.push(head.trimEnd());
  }
  for (let row = 0; row < prefixes.length; row++) {
    lines.push((prefixes[row] + columns.map((column) => column.cells[row]).join(' ')).trimEnd());
  }
  return lines.join('\n');
}
