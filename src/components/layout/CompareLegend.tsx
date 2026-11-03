export function CompareLegend({
  primary,
  overlay,
  sharedCount,
}: {
  primary: string;
  overlay: string;
  sharedCount: number;
}) {
  return (
    <div className="card-legend" aria-label="Compare legend">
      <span className="legend-title">
        {primary} <span className="muted">vs</span> {overlay}
      </span>
      <span className="legend-item">
        <span className="swatch swatch-shared" /> In both ({sharedCount})
      </span>
      <span className="legend-item">
        <span className="swatch swatch-primaryOnly" /> Primary only
      </span>
      <span className="legend-item">
        <span className="swatch swatch-overlayOnly" /> Overlay only
      </span>
    </div>
  );
}
