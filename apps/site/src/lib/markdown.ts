import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Marked, type Tokens } from 'marked';
import { SITE } from '@/content/site';
import { BASE_PATH } from '@/lib/paths';

/**
 * The guide pages are written once, in Markdown, in content/pages/*.md.
 *
 * The same file is the HTML page (rendered here at build time) and the Markdown copy
 * for AI clients (copied by tools/build-markdown.mjs), so the two cannot say different
 * things. Links inside those files are absolute (https://dripmetric.com/…) because the
 * Markdown copy is read on its own; here they become root-relative, so the HTML works
 * on any host and under a GitHub Pages base path.
 *
 * Headings take an explicit id with a trailing `{#id}` — the anchors other pages link to
 * must not change when a heading's wording does.
 */

const CONTENT_DIR = join(process.cwd(), 'content');

export interface Heading {
  id: string;
  text: string;
}
export interface FaqItem {
  question: string;
  answer: string;
}
export interface RenderedMarkdown {
  html: string;
  toc: Heading[];
  faq: FaqItem[];
}

const ORIGIN = SITE.origin.replace(/\/$/, '');
const ID_SUFFIX = /\s*\{#([a-z0-9-]+)\}\s*$/;

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plain text of inline Markdown: what a reader sees, for the TOC and the FAQ JSON-LD. */
const plain = (markdown: string): string =>
  markdown
    .replace(ID_SUFFIX, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim();

/** Same-site absolute URL → root-relative (plus the base path); anything else unchanged. */
export function localHref(href: string): string {
  if (href === ORIGIN || href.startsWith(`${ORIGIN}/`) || href.startsWith(`${ORIGIN}#`)) {
    const rest = href.slice(ORIGIN.length) || '/';
    return `${BASE_PATH}${rest.startsWith('#') ? `/${rest}` : rest}`;
  }
  return href;
}

/**
 * Scrollable code blocks and tables are focusable regions, and every region needs its
 * own name (axe: landmark-unique). Name each after the section it sits in.
 */
function regionLabels(tokens: ReturnType<Marked['lexer']>) {
  const code: string[] = [];
  const tables: string[] = [];
  const seen = new Map<string, number>();
  const unique = (label: string) => {
    const count = (seen.get(label) ?? 0) + 1;
    seen.set(label, count);
    return count === 1 ? label : `${label} (${count})`;
  };
  let section = 'Introduction';
  for (const token of tokens) {
    if (token.type === 'heading') section = plain((token as Tokens.Heading).text);
    if (token.type === 'code') {
      const lang = ((token as Tokens.Code).lang ?? '').trim().split(/\s+/)[0];
      code.push(unique(`${section}: ${lang || 'code'} example`));
    }
    if (token.type === 'table') tables.push(unique(`${section}: table`));
  }
  return { code, tables };
}

/** Wide tables scroll inside their own focusable, named region on phones. */
function wrapTables(html: string, labels: string[]): string {
  let index = 0;
  return html
    .replace(/<table>/g, () => {
      const label = escapeHtml(labels[index++] ?? 'Table');
      return `<div class="table-scroll" tabindex="0" role="region" aria-label="${label}"><table>`;
    })
    .replace(/<\/table>/g, '</table></div>');
}

function createRenderer(labels: { code: string[] }): Marked {
  let codeIndex = 0;
  return new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth, text }: Tokens.Heading) {
        const explicit = text.match(ID_SUFFIX)?.[1];
        const id = explicit ?? slugify(plain(text));
        const inner = this.parser.parseInline(tokens).replace(ID_SUFFIX, '');
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const inner = this.parser.parseInline(tokens);
        const target = localHref(href);
        const external = /^https?:\/\//.test(target);
        const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
        const rel = external ? ' rel="noopener"' : '';
        return `<a href="${escapeHtml(target)}"${titleAttr}${rel}>${inner}</a>`;
      },
      code({ text, lang }: Tokens.Code) {
        const language = (lang ?? '').trim().split(/\s+/)[0];
        const cls = language ? ` class="language-${escapeHtml(language)}"` : '';
        const label = escapeHtml(labels.code[codeIndex++] ?? 'Code example');
        // Focusable so a keyboard user can scroll a long line (axe: scrollable-region-focusable).
        return `<pre tabindex="0" role="region" aria-label="${label}"><code${cls}>${escapeHtml(text)}</code></pre>\n`;
      },
    },
  });
}

/**
 * The FAQ is the `## … {#faq}` section: each `###` is a question and everything up to the
 * next heading is its answer. Read from the same tokens as the HTML, so the FAQPage
 * JSON-LD can only ever describe text that is visible on the page.
 */
function extractFaq(tokens: ReturnType<Marked['lexer']>): FaqItem[] {
  const faq: FaqItem[] = [];
  let inFaq = false;
  let current: { question: string; parts: string[] } | null = null;
  const flush = () => {
    if (current && current.parts.length > 0) {
      faq.push({ question: current.question, answer: plain(current.parts.join(' ')) });
    }
    current = null;
  };
  for (const token of tokens) {
    if (token.type === 'heading') {
      const heading = token as Tokens.Heading;
      if (heading.depth <= 2) {
        flush();
        inFaq = heading.text.match(ID_SUFFIX)?.[1] === 'faq';
        continue;
      }
      if (inFaq && heading.depth === 3) {
        flush();
        current = { question: plain(heading.text), parts: [] };
        continue;
      }
    }
    if (inFaq && current && 'raw' in token && token.type !== 'space') {
      current.parts.push(String(token.raw).replace(/^\s*[-*]\s+/gm, ''));
    }
  }
  flush();
  return faq;
}

export function renderMarkdown(markdown: string): RenderedMarkdown {
  const tokens = new Marked({ gfm: true }).lexer(markdown);
  const labels = regionLabels(tokens);
  const marked = createRenderer(labels);
  const toc: Heading[] = tokens
    .filter((t): t is Tokens.Heading => t.type === 'heading' && (t as Tokens.Heading).depth === 2)
    .map((t) => ({
      id: t.text.match(ID_SUFFIX)?.[1] ?? slugify(plain(t.text)),
      text: plain(t.text),
    }));
  // `parser()` skips marked's postprocess hooks, so the table wrapper is applied here.
  const html = wrapTables(marked.parser(tokens), labels.tables);
  return { html, toc, faq: extractFaq(tokens) };
}

/** Reads content/<file> at build time. Every page using it is prerendered. */
export function readContent(file: string): string {
  return readFileSync(join(CONTENT_DIR, file), 'utf8');
}
