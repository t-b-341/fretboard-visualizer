import type { ReactNode } from 'react';

export function ViewCard({
  title,
  testId,
  className,
  extra,
  children,
}: {
  title: string;
  testId: string;
  className?: string;
  /** Sits in the card header, on the right of the title. */
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={className ? `view-card ${className}` : 'view-card'} data-testid={testId}>
      <div className="view-card-head">
        <h2>{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
