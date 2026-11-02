import { chordSymbol } from '../music/chords';
import type { ChordMatch } from '../music/identify';
import { mod, noteName } from '../music/notes';
import type { Cell } from '../music/fretboard';
import { player } from '../audio/player';

interface Props {
  identifyMatches: ChordMatch[];
  pickedNotes: Cell[];
  shift: number;
  onClear: () => void;
}

export function IdentifyPanel({ identifyMatches, pickedNotes, shift, onClear }: Props) {
  return (
    <div className="identify-panel" aria-label="Chord identify">
      <div className="identify-matches">
        {identifyMatches.length === 0 ? (
          <span className="muted">
            {pickedNotes.length < 2 ? 'Pick two or more notes' : 'No match'}
          </span>
        ) : (
          identifyMatches.map((match, i) => {
            const bass =
              match.inversion && match.bassPc !== undefined
                ? `/${noteName(mod(match.bassPc + shift, 12))}`
                : '';
            const missing = match.match === 'subset' ? ' (no 5th)' : '';
            return (
              <span
                key={`${match.chord.rootPc}-${match.chord.symbol}-${match.match}-${i}`}
                className={match.match === 'subset' ? 'identify-match muted' : 'identify-match'}
              >
                {chordSymbol(match.chord, shift)}
                {bass}
                {missing}
              </span>
            );
          })
        )}
      </div>
      <div className="identify-actions">
        <button type="button" className="btn-mini" onClick={onClear} disabled={pickedNotes.length === 0}>
          Clear
        </button>
        <button
          type="button"
          className="btn-mini"
          onClick={() =>
            player.playChord(
              pickedNotes.map((note) => note.midi),
              { durationMs: 1200 },
            )
          }
          disabled={pickedNotes.length === 0}
        >
          Play
        </button>
      </div>
    </div>
  );
}
