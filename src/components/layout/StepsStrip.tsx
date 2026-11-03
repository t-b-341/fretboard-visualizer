import { classifyChord } from '../../music/chordColor';
import { chordSymbol, romanForChord } from '../../music/chords';
import { explainStep, functionOf } from '../../music/explain';
import { mod, noteName } from '../../music/notes';
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
  onToggleLock,
  onReroll,
  onRemove,
}: {
  steps: Step[];
  currentStep: number;
  rootPc: number;
  intervals: number[];
  shift: number;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (index: number) => void;
  onToggleLock: (index: number) => void;
  onReroll: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const key = { rootPc, intervals };
  const current = steps[currentStep];
  const why = current ? explainStep(steps, currentStep, key) : '';
  const locked = current?.locked === true;
  return (
    <div className="steps-strip" data-testid="steps-strip">
      <div className="steps-top">
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
          <button
            type="button"
            className="add-step"
            onClick={() => document.getElementById('add-chord-symbol')?.focus()}
          >
            + Add step
          </button>
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
      <p className="step-why" data-testid="step-why">
        Why: {why}
      </p>
      <div className="step-actions">
        <button type="button" onClick={() => onToggleLock(currentStep)} disabled={!current}>
          {locked ? 'Unlock this step' : 'Lock this step'}
        </button>
        <button type="button" onClick={() => onReroll(currentStep)} disabled={!current}>
          Reroll this step
        </button>
        <button type="button" onClick={() => onRemove(currentStep)} disabled={!current}>
          Remove
        </button>
      </div>
    </div>
  );
}

function stepSymbol(step: Step, shift: number): string {
  const symbol = chordSymbol(step.chord, shift);
  if (step.bassPc === undefined) return symbol;
  return `${symbol}/${noteName(mod(step.bassPc + shift, 12))}`;
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg className="step-lock" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      {locked ? (
        <path fill="currentColor" d="M5 7V5a3 3 0 0 1 6 0v2h1.2v7H3.8V7H5zm1.4 0h3.2V5a1.6 1.6 0 0 0-3.2 0v2z" />
      ) : (
        <path
          fill="currentColor"
          d="M8 2.2A3 3 0 0 1 11 5.2V6H9.6V5.2a1.6 1.6 0 0 0-3.2 0V7H3.8v7h8.4V7H6.4V5.2A3 3 0 0 1 8 2.2zM5.2 8.4h5.6v4.2H5.2V8.4z"
        />
      )}
    </svg>
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
  const fn = functionOf(step.chord, { rootPc, intervals });
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
      data-locked={step.locked ? 'true' : 'false'}
      aria-current={current ? 'step' : undefined}
      onClick={() => onSelect(index)}
    >
      <span className="step-symbol">{stepSymbol(step, shift)}</span>
      <span className="step-roman">{romanForChord(rootPc, step.chord)}</span>
      {fn && <span className="step-fn">{fn}</span>}
      <LockIcon locked={step.locked} />
      <span className="visually-hidden">{step.locked ? 'locked' : 'unlocked'}</span>
    </button>
  );
}
