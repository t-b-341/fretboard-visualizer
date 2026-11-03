import type { ReactNode } from 'react';

export function ViewCard({
  title,
  testId,
  className,
  children,
}: {
  title: string;
  testId: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className ? `view-card ${className}` : 'view-card'} data-testid={testId}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
