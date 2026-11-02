import type { ViewMode } from '../App';
import type { Triad } from '../music/chords';

interface Props {
  viewMode: ViewMode;
  triad: Triad;
  rootName: string;
  modeName: string;
  familyName: string;
  chordRootName: string;
  chordQualityName: string;
  compareEnabled: boolean;
  compareRootName: string;
  compareModeName: string;
  sharedCount: number;
  /** Chord-view summary (symbol with root, Roman numeral, in/out of key). */
  activeChordSymbol?: string;
  activeChordRoman?: string;
  activeChordInKey?: boolean;
  /** Colour each scale degree instead of root vs scale tone. */
  colorByDegree: boolean;
  degreeLabels: string[];
  /** Chord view is marking the 3rd and 7th inside the chord. */
  guideTones?: boolean;
}

export function Legend(props: Props) {
  const {
    viewMode,
    triad,
    rootName,
    modeName,
    familyName,
    chordRootName,
    chordQualityName,
    compareEnabled,
    compareRootName,
    compareModeName,
    sharedCount,
    activeChordSymbol,
    activeChordRoman,
    activeChordInKey,
    colorByDegree,
    degreeLabels,
    guideTones,
  } = props;

  const chordView = viewMode === 'chord';
  const comparingScale = compareEnabled && viewMode === 'scale';
  const comparingTriad = compareEnabled && viewMode === 'triad';

  return (
    <div className="legend">
      <div className="legend-title">
        {chordView ? (
          activeChordSymbol ? (
            <>
              {activeChordSymbol}{' '}
              <span className="muted">
                &middot; {activeChordRoman} &middot;{' '}
                {activeChordInKey ? 'in key' : 'outside the key'}
              </span>
            </>
          ) : (
            <span className="muted">Pick or add a chord</span>
          )
        ) : comparingScale ? (
          <>
            {rootName} {modeName} <span className="muted">vs</span> {compareRootName} {compareModeName}
          </>
        ) : comparingTriad ? (
          <>
            {chordRootName} {chordQualityName} <span className="muted">chord vs</span> {compareRootName}{' '}
            {compareModeName}
          </>
        ) : (
          <>
            {rootName} {modeName} <span className="muted">&middot; {familyName}</span>
          </>
        )}
      </div>

      <div className="legend-items">
        {chordView ? (
          <>
            <Item cls="root" label="Root" />
            <Item cls="third" label="3rd" />
            <Item cls="fifth" label="5th" />
            <Item cls="seventh" label="6th / 7th" />
            <Item cls="ext" label="9 / 11 / 13" />
            {guideTones && (
              <span className="legend-item">
                <span className="swatch swatch-guide" /> Guide tone
              </span>
            )}
            <span className="legend-note muted">
              {guideTones ? 'Red dashed ring = note outside the key' : 'Dashed ring = note outside the key'}
            </span>
          </>
        ) : comparingScale ? (
          <>
            <Item cls="shared" label={`In both (${sharedCount})`} />
            <Item cls="primaryOnly" label="Primary only" />
            <Item cls="overlayOnly" label="Overlay only" />
          </>
        ) : comparingTriad ? (
          <>
            <Item cls="root" label="Chord root" />
            <Item cls="third" label="3rd" />
            <Item cls="fifth" label="5th" />
            <Item cls="scale" label="Scale tone" />
            <span className="legend-note muted">Dashed ring = chord tone outside the scale</span>
          </>
        ) : viewMode === 'scale' && colorByDegree ? (
          <>
            {degreeLabels.map((label, i) => (
              <span key={label + i} className="legend-item">
                <span className={`swatch swatch-deg swatch-deg-${i}`} /> {label}
              </span>
            ))}
            <span className="legend-note muted">Ring marks the root</span>
          </>
        ) : viewMode === 'scale' ? (
          <>
            <Item cls="root" label="Root" />
            <Item cls="scale" label="Scale tone" />
          </>
        ) : (
          <>
            <Item cls="root" label="Chord root" />
            <Item cls="third" label="3rd" />
            <Item cls="fifth" label="5th" />
            <Item cls="ghost" label="Scale tone" />
          </>
        )}
      </div>

      {viewMode === 'triad' && (
        <div className="legend-chord">
          Chord: <strong>{triad.roman}</strong> &middot; {chordRootName} {chordQualityName}
        </div>
      )}
    </div>
  );
}

function Item({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="legend-item">
      <span className={`swatch swatch-${cls}`} /> {label}
    </span>
  );
}
