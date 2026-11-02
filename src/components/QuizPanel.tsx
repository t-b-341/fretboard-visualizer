interface Props {
  prompt: string;
  score: number;
  total: number;
  onNext: () => void;
}

export function QuizPanel({ prompt, score, total, onNext }: Props) {
  return (
    <div className="quiz-panel" aria-label="Quiz">
      <p className="quiz-prompt">{prompt}</p>
      <div className="quiz-actions">
        <span className="quiz-score" aria-label="Score">
          {score} / {total}
        </span>
        <button type="button" className="btn-mini" onClick={onNext}>
          Next
        </button>
      </div>
    </div>
  );
}
