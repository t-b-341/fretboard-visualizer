import { classifyChord } from '../../music/chordColor';
import { chordSymbol, romanForChord } from '../../music/chords';
import type { Step } from '../../state/v2/types';

export function StepsStrip({
  steps,
  currentStep,
  rootPc,
  intervals,
  shift,
  onPrev,
  onNext,
  onSelect,
}: {
  steps: Step[];
  currentStep: number;
  rootPc: number;
  intervals: number[];
  shift: number;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="steps-strip" data-testid="steps-strip">
      <div className="step-chips">
        {steps.map((step, index) => (
          <StepChip
            key={step.id}
            step={step}
            index={index}
            current={index === currentStep}
            rootPc={rootPc}
            intervals={intervals}
            shift={shift}
            onSelect={onSelect}
          />
        ))}
      </div>
      <div className="step-nav">
        <button type="button" aria-label="Prev" onClick={onPrev} disabled={steps.length === 0 || currentStep <= 0}>
          ‹ Prev
        </button>
        <button
          type="button"
          aria-label="Next"
          onClick={onNext}
          disabled={steps.length === 0 || currentStep >= steps.length - 1}
        >
          Next ›
        </button>
      </div>
    </div>
  );
}

function StepChip({
  step,
  index,
  current,
  rootPc,
  intervals,
  shift,
  onSelect,
}: {
  step: Step;
  index: number;
  current: boolean;
  rootPc: number;
  intervals: number[];
  shift: number;
  onSelect: (index: number) => void;
}) {
  const painted = classifyChord(step.chord, rootPc, intervals);
  const classes = ['step-chip'];
  if (current) classes.push('is-current');
  if (painted.status === 'outside') classes.push('is-outside');
  else if (painted.status === 'borrowed') classes.push('is-borrowed');
  if (painted.degreeIndex !== null) classes.push(`step-deg-${painted.degreeIndex}`);
  return (
    <button
      type="button"
      className={classes.join(' ')}
      data-testid="step-chip"
      data-step-index={index}
      aria-current={current ? 'step' : undefined}
      onClick={() => onSelect(index)}
    >
      <span className="step-symbol">{chordSymbol(step.chord, shift)}</span>
      <span className="step-roman">{romanForChord(rootPc, step.chord)}</span>
    </button>
  );
}
