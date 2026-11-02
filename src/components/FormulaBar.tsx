import type { ChordReading, ScaleOrigin, ScalePull } from '../music/reading';
import type { ChoiceNote } from '../music/reading';
import type { SpelledTone } from '../music/spelling';
import type { ViewMode } from '../music/types';

interface Props {
  viewMode: ViewMode;
  formula: string[];
  colorByDegree: boolean;
  origin: ScaleOrigin | null;
  pulls: ScalePull[];
  pullIndexes: Set<number>;
  scaleSpelling: SpelledTone[] | null;
  spellFormula: string | null;
  reading: ChordReading | null;
  diatonicName: string | null;
  caption: string | null;
}

export function FormulaBar({
  viewMode,
  formula,
  colorByDegree,
  origin,
  pulls,
  pullIndexes,
  scaleSpelling,
  spellFormula,
  reading,
  diatonicName,
  caption,
}: Props) {
  return (
    <div className="formula-bar" aria-label="Scale and harmony reading">
      <div className="formula-line">
        <span className="formula-k">Scale</span>
        {formula.map((label, i) => {
          const moved = origin?.movedIndex === i;
          const className = [
            colorByDegree ? `formula-deg formula-deg-${i}` : 'formula-token',
            pullIndexes.has(i) ? 'formula-pull' : '',
          ]
            .filter(Boolean)
            .join(' ');
          const title = [
            moved ? 'This degree was moved to build the scale' : '',
            pulls.find((pull) => pull.index === i)?.text ?? '',
          ]
            .filter(Boolean)
            .join('. ');
          return (
            <span key={`${label}-${i}`} className={className} title={title || undefined}>
              {label}
              {moved ? '\u2191' : ''}
            </span>
          );
        })}
      </div>
      {scaleSpelling && (
        <div className="formula-line">
          <span className="formula-k">Notes</span>
          {scaleSpelling.map((tone, i) => (
            <span key={`${tone.name}-${i}`} className="formula-token">
              {tone.name}
            </span>
          ))}
        </div>
      )}
      {origin && <p className="formula-caption">{origin.text}</p>}
      {pulls.length > 0 && <p className="formula-caption">{pulls.map((pull) => pull.text).join(' ')}</p>}
      {spellFormula && (
        <div className="formula-line">
          <span className="formula-k">{viewMode === 'chord' ? 'Chord' : 'Triad'}</span>
          <span className="formula-token">{spellFormula}</span>
        </div>
      )}
      {reading && (
        <>
          <p className="formula-caption">{reading.summary}</p>
          <ChoiceLine label="Sit" notes={reading.sit} />
          <ChoiceLine label="Color" notes={reading.color} />
          <ChoiceLine label="Lean" notes={reading.lean} />
          {reading.inversion && <p className="formula-caption">{reading.inversion}</p>}
        </>
      )}
      {diatonicName && (viewMode === 'triad' || viewMode === 'chord') && (
        <p className="formula-caption">Triads follow {diatonicName}</p>
      )}
      {caption && <p className="formula-caption">{caption}</p>}
    </div>
  );
}

function ChoiceLine({ label, notes }: { label: string; notes: ChoiceNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="formula-line">
      <span className="formula-k">{label}</span>
      {notes.map((note) => (
        <span key={`${note.degree}-${note.name}`} className="formula-token">
          {note.name}
          <span className="formula-degree"> {note.degree}</span>
          {note.detail && <span className="formula-detail"> · {note.detail}</span>}
        </span>
      ))}
    </div>
  );
}
