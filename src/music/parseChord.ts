// Chord-symbol parser for the Add chord field.
//
// Roots accept ASCII and unicode accidentals. Qualities cover every catalog
// symbol plus the short aliases players actually type. A slash sets the bass
// only when the note after it is a pitch ("Eb/G"), never when it is part of
// the symbol ("C6/9").

import { CHORD_QUALITIES, roleForDegree, type Chord, type ChordQuality } from './chords';
import { chromaticDegreeLabel, mod } from './notes';

export interface ParsedChord {
  rootPc: number;
  quality: ChordQuality;
  bassPc?: number;
}

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function normalizeToken(symbol: string): string {
  return symbol
    .replace(/[♭]/g, 'b')
    .replace(/[♯]/g, '#')
    .replace(/[∆Δ]7/g, 'maj7')
    .replace(/[∆Δ]/g, 'maj7')
    .replace(/[øØ∅]7/g, 'm7b5')
    .replace(/[øØ∅]/g, 'm7b5')
    .replace(/[°º]7/g, 'dim7')
    .replace(/[°º]/g, 'dim');
}

/** Lookup key shared by catalog symbols and aliases. */
function canonQuality(raw: string): string {
  const norm = normalizeToken(raw.trim());
  if (
    norm === 'M7' ||
    norm === 'maj7' ||
    /^maj7$/i.test(norm) ||
    /^ma7$/i.test(norm) ||
    /^major7$/i.test(norm)
  ) {
    return 'maj7';
  }
  const lower = norm.toLowerCase();
  switch (lower) {
    case 'min7':
    case '-7':
    case 'mi7':
      return 'm7';
    case 'min':
    case 'mi':
    case '-':
      return 'm';
    case 'aug':
      return '+';
    case 'o':
      return 'dim';
    case 'o7':
      return 'dim7';
    case 'min7b5':
    case 'm7-5':
      return 'm7b5';
    case '7sus':
      return '7sus4';
    case '69':
      return '6/9';
    case 'madd9':
    case 'minadd9':
      return 'm(add9)';
    case 'mmaj7':
    case 'minmaj7':
      return 'm(maj7)';
    default:
      return lower;
  }
}

const QUALITY_BY_KEY = new Map<string, ChordQuality>();
for (const def of CHORD_QUALITIES) {
  QUALITY_BY_KEY.set(canonQuality(def.symbol), def.key);
}
QUALITY_BY_KEY.set('', 'maj');

function lookupQuality(raw: string): ChordQuality | null {
  return QUALITY_BY_KEY.get(canonQuality(raw)) ?? null;
}

function parseNote(raw: string): number | null {
  const match = /^([A-Ga-g])([b#])?$/.exec(raw);
  if (!match) return null;
  const base = LETTER_PC[match[1].toUpperCase()];
  const acc = match[2] === 'b' ? -1 : match[2] === '#' ? 1 : 0;
  return mod(base + acc, 12);
}

function finish(rootPc: number, quality: ChordQuality, bassPc: number | undefined): ParsedChord {
  if (bassPc === undefined || bassPc === rootPc) return { rootPc, quality };
  return { rootPc, quality, bassPc };
}

/** `null` when the text is not a chord symbol. */
export function parseChordSymbol(text: string): ParsedChord | null {
  const compact = text.trim().replace(/[♭]/g, 'b').replace(/[♯]/g, '#').replace(/\s+/g, '');
  if (!compact) return null;
  const match = /^([A-Ga-g])([b#])?(.*)$/.exec(compact);
  if (!match) return null;
  const rootPc = parseNote(`${match[1]}${match[2] ?? ''}`);
  if (rootPc === null) return null;
  const rest = match[3] ?? '';

  const whole = lookupQuality(rest);
  if (whole) return finish(rootPc, whole, undefined);

  const slash = rest.lastIndexOf('/');
  if (slash < 0) return null;
  const left = rest.slice(0, slash);
  const right = rest.slice(slash + 1);
  if (!right) return null;
  const bassPc = parseNote(right);
  if (bassPc === null) return null;
  const quality = left === '' ? 'maj' : lookupQuality(left);
  if (!quality) return null;
  return finish(rootPc, quality, bassPc);
}

/**
 * A display copy of `chord` whose bass pitch is the lowest tone.
 * The stored chord is unchanged. No bass, or a bass on the root, returns the same object.
 */
export function placeBassLowest(chord: Chord, bassPc?: number): Chord {
  if (bassPc === undefined) return chord;
  const bass = mod(bassPc, 12);
  const root = mod(chord.rootPc, 12);
  if (bass === root) return chord;
  const delta = mod(bass - root, 12);
  const tones = chord.tones.map((tone) => ({ ...tone }));
  const index = tones.findIndex((tone) => mod(tone.interval, 12) === delta);
  if (index >= 0) {
    tones[index] = { ...tones[index], interval: mod(tones[index].interval, 12) - 12 };
  } else {
    const degree = chromaticDegreeLabel(delta);
    tones.unshift({ interval: delta - 12, degree, role: roleForDegree(degree) });
  }
  return {
    ...chord,
    tones,
    pcs: [...new Set(tones.map((tone) => mod(chord.rootPc + tone.interval, 12)))],
  };
}
