import type { ReactNode } from 'react';

/** Numbered kicker, serif heading and an optional lede — the head of every section. */
export function SectionHead({
  n,
  kicker,
  id,
  title,
  lede,
  center = false,
}: {
  n: string;
  kicker: string;
  id: string;
  title: ReactNode;
  lede?: ReactNode;
  center?: boolean;
}) {
  return (
    <header className={center ? 'section-head section-head--center' : 'section-head'} data-reveal>
      <p className="kicker">
        <span className="kicker__n">{n}</span> {kicker}
      </p>
      <h2 id={id} className="h2">
        {title}
      </h2>
      {lede ? <p className="lede">{lede}</p> : null}
    </header>
  );
}

/** "◇ Sample … · simulated data" — every sample on the page carries one. */
export function SampleLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="sample-label" id={id}>
      {children}
    </p>
  );
}
