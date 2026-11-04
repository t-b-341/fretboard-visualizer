import { candidateDetail, candidateLabel, type ChordCandidate } from '../music/identify';
import { mod } from '../music/notes';

export interface NeckPick {
  stringIndex: number;
  fret: number;
  pc: number;
  midi: number;
}

export interface KeyPick {
  pc: number;
  midi: number;
}

/** One note per string. The same cell clears it; another fret on that string moves it. */
export function toggleNeckPick(picks: readonly NeckPick[], pick: NeckPick): NeckPick[] {
  const rest = picks.filter((item) => item.stringIndex !== pick.stringIndex);
  const same = picks.some((item) => item.stringIndex === pick.stringIndex && item.fret === pick.fret);
  return same ? rest : [...rest, pick];
}

/** A keyboard click adds that MIDI note, or removes it when it is already a keyboard pick. */
export function toggleKeyPick(picks: readonly KeyPick[], midi: number): KeyPick[] {
  if (picks.some((item) => item.midi === midi)) return picks.filter((item) => item.midi !== midi);
  return [...picks, { pc: mod(midi, 12), midi }];
}

interface Alternative {
  index: number;
  candidate: ChordCandidate;
}

interface Props {
  /** The candidate the large name and the step actions share. */
  chosen: ChordCandidate | null;
  chosenIndex: number;
  /** The other readings, at most two, in rank order. */
  alternatives: Alternative[];
  /** Distinct pitch classes in the grip. */
  distinct: number;
  shift: number;
  canReplace: boolean;
  onChoose: (index: number) => void;
  onAdd: () => void;
  onReplace: () => void;
}

export function IdentifyPanel({
  chosen,
  chosenIndex,
  alternatives,
  distinct,
  shift,
  canReplace,
  onChoose,
  onAdd,
  onReplace,
}: Props) {
  const detail = chosen ? candidateDetail(chosen) : '';

  return (
    <div className="identify-panel" data-testid="identify-result">
      <div className="identify-readout">
        {chosen ? (
          <>
            <button
              type="button"
              className="identify-choice is-primary"
              data-testid="identify-primary"
              data-slash={chosen.slashName}
              aria-pressed="true"
              onClick={() => onChoose(chosenIndex)}
            >
              <span className="identify-name">{candidateLabel(chosen, shift)}</span>
              {detail && <span className="identify-detail">{detail}</span>}
            </button>
            {alternatives.length > 0 && (
              <div className="identify-alts">
                {alternatives.map(({ candidate, index }) => {
                  const altDetail = candidateDetail(candidate);
                  return (
                    <button
                      key={`${candidate.chord.rootPc}-${candidate.chord.symbol}-${index}`}
                      type="button"
                      className="identify-choice is-alt"
                      data-testid="identify-alt"
                      data-slash={candidate.slashName}
                      aria-pressed="false"
                      onClick={() => onChoose(index)}
                    >
                      <span className="identify-name">{candidateLabel(candidate, shift)}</span>
                      {altDetail && <span className="identify-detail">{altDetail}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <span className="muted">{distinct < 2 ? 'Play or pick two or more notes' : 'No match'}</span>
        )}
      </div>
      <div className="identify-actions">
        <button type="button" className="btn-mini" onClick={onAdd} disabled={!chosen}>
          Add as step
        </button>
        <button type="button" className="btn-mini" onClick={onReplace} disabled={!chosen || !canReplace}>
          Replace current step
        </button>
      </div>
    </div>
  );
}
