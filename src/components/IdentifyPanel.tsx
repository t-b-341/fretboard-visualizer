import { player } from '../audio/player';
import type { Cell } from '../music/fretboard';
import { candidateDetail, candidateLabel, type ChordCandidate } from '../music/identify';

interface Props {
  candidates: ChordCandidate[];
  pickedNotes: Cell[];
  shift: number;
  onClear: () => void;
  onSend: () => void;
}

export function IdentifyPanel({ candidates, pickedNotes, shift, onClear, onSend }: Props) {
  const top = candidates[0];
  const rest = candidates.slice(1);
  const distinct = new Set(pickedNotes.map((note) => note.pc)).size;
  const detail = top ? candidateDetail(top) : '';

  return (
    <div className="identify-panel" aria-label="Chord identify">
      <div className="identify-readout">
        {top ? (
          <>
            <div className="identify-primary">
              <span className="identify-name">{candidateLabel(top, shift)}</span>
              {detail && <span className="identify-detail">{detail}</span>}
            </div>
            {rest.length > 0 && (
              <div className="identify-alts">
                {rest.map((candidate, index) => {
                  const altDetail = candidateDetail(candidate);
                  return (
                    <span
                      key={`${candidate.chord.rootPc}-${candidate.chord.quality ?? candidate.chord.symbol}-${index}`}
                      className="identify-alt"
                    >
                      {candidateLabel(candidate, shift)}
                      {altDetail ? ` · ${altDetail}` : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <span className="muted">{distinct < 2 ? 'Pick two or more notes' : 'No match'}</span>
        )}
      </div>
      <div className="identify-actions">
        <button type="button" className="btn-mini" onClick={onClear} disabled={pickedNotes.length === 0}>
          Clear
        </button>
        <button type="button" className="btn-mini" onClick={onSend} disabled={!top}>
          Send to builder
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
