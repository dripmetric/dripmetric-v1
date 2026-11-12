import type { ReactNode } from 'react';

/** A short label, the heading and an optional lede: the head of every section. */
export function SectionHead({
  label,
  id,
  title,
  lede,
}: {
  label: string;
  id: string;
  title: ReactNode;
  lede?: ReactNode;
}) {
  return (
    <header className="section-head">
      <p className="label">{label}</p>
      <h2 id={id} className="h2">
        {title}
      </h2>
      {lede ? <p className="lede">{lede}</p> : null}
    </header>
  );
}
