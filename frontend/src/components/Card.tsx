import type { ReactNode } from 'react';

interface CardProps {
  icon: string;
  title: string;
  span?: 2 | 3;
  children: ReactNode;
}

export default function Card({ icon, title, span, children }: CardProps) {
  const cls = `card${span ? ` span-${span}` : ''}`;
  return (
    <div className={cls}>
      <div className="card-header">
        <div className="icon">{icon}</div>
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
