'use client';

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface CodeSample {
  id: string;
  label: string;
  file: string;
  code: ReactNode;
}

/**
 * Install examples as WAI-ARIA tabs (automatic activation).
 *
 * The server renders every sample one after another with no tab bar, which is what a
 * crawler or a visitor without JavaScript sees. After hydration the tab bar appears
 * and only the selected panel shows.
 */
export function CodeTabs({ samples }: { samples: CodeSample[] }) {
  const [enhanced, setEnhanced] = useState(false);
  const [canCopy, setCanCopy] = useState(false);
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const blocks = useRef<(HTMLPreElement | null)[]>([]);

  useEffect(() => {
    setEnhanced(true);
    setCanCopy(Boolean(navigator.clipboard) && window.isSecureContext);
  }, []);

  const select = (index: number, focus: boolean) => {
    setActive(index);
    if (focus) tabs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = samples.length - 1;
    const next =
      event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next !== null) {
      event.preventDefault();
      select(next, true);
    }
  };

  return (
    <div className={enhanced ? 'code code--tabs' : 'code'}>
      {enhanced ? (
        <div className="code__tabs" role="tablist" aria-label="Install examples">
          {samples.map((sample, index) => (
            <button
              key={sample.id}
              ref={(el) => {
                tabs.current[index] = el;
              }}
              className="code__tab"
              role="tab"
              type="button"
              id={`tab-${sample.id}`}
              aria-controls={`panel-${sample.id}`}
              aria-selected={index === active}
              tabIndex={index === active ? 0 : -1}
              onClick={() => select(index, false)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {sample.label}
            </button>
          ))}
        </div>
      ) : null}
      {samples.map((sample, index) => (
        <div
          key={sample.id}
          className="code__panel"
          id={`panel-${sample.id}`}
          role={enhanced ? 'tabpanel' : undefined}
          aria-labelledby={enhanced ? `tab-${sample.id}` : undefined}
          hidden={enhanced && index !== active}
        >
          <p className="code__file">{sample.file}</p>
          <pre
            tabIndex={0}
            ref={(el) => {
              blocks.current[index] = el;
            }}
          >
            <code>{sample.code}</code>
          </pre>
          {canCopy ? <CopyButton text={() => blocks.current[index]?.textContent ?? ''} /> : null}
        </div>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: () => string }) {
  const [label, setLabel] = useState('Copy');
  return (
    <button
      type="button"
      className="copy-btn"
      aria-label="Copy this code"
      onClick={() => {
        navigator.clipboard.writeText(text()).then(
          () => {
            setLabel('Copied');
            window.setTimeout(() => setLabel('Copy'), 1600);
          },
          () => setLabel('Press Ctrl+C'),
        );
      }}
    >
      {label}
    </button>
  );
}
