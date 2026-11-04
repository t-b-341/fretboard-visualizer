import type { ReactNode } from 'react';

export function PracticeTab({ children }: { children: ReactNode }) {
  return (
    <section className="practice-panel" data-testid="practice-panel" aria-label="Practice">
      {children}
    </section>
  );
}
