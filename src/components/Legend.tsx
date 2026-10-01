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
  } = props;

  const comparing = compareEnabled && viewMode === 'scale';

  return (
    <div className="legend">
      <div className="legend-title">
        {comparing ? (
          <>
            {rootName} {modeName} <span className="muted">vs</span> {compareRootName} {compareModeName}
          </>
        ) : (
          <>
            {rootName} {modeName} <span className="muted">&middot; {familyName}</span>
          </>
        )}
      </div>

      <div className="legend-items">
        {comparing ? (
          <>
            <Item cls="shared" label={`In both (${sharedCount})`} />
            <Item cls="primaryOnly" label="Primary only" />
            <Item cls="overlayOnly" label="Overlay only" />
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
