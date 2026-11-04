#!/usr/bin/env node
/**
 * Builds the public Markdown discovery files from apps/site/content:
 *
 *   public/llms.txt            entry point for LLM clients (llmstxt.org format)
 *   public/sitemap.md          every public document, with its canonical HTML page
 *   public/llm/topics/*.md     one map per topic
 *   public/index.md, ...       a Markdown copy of each page, with provenance header
 *
 *   pnpm site:markdown          # write the files
 *   pnpm site:markdown --check  # exit 1 if the committed files are out of date
 *
 * The output format is byte-for-byte the one produced by the SEO suite's
 * manage_markdown_site.py, so either tool can regenerate it and its validator can
 * check it. The bodies in content/*.body.md are reviewed copies of the HTML pages —
 * when the HTML changes, update the body first, then run this.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTENT = fileURLToPath(new URL('../content/', import.meta.url));
const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));
const check = process.argv.includes('--check');

const inv = JSON.parse(await readFile(join(CONTENT, 'inventory.json'), 'utf8'));
const origin = inv.origin.replace(/\/$/, '');
const pages = inv.pages.filter((p) => p.disposition === 'publish');
const topics = [...new Set(pages.map((p) => p.topic))].sort();

const rows = (selected) =>
  selected
    .map(
      (p) =>
        `- [${p.title}](${origin}/${p.md_path}): ${p.purpose} (${p.locale}); [canonical page](${p.url}).`,
    )
    .join('\n');
const topicLinks = topics
  .map(
    (t) => `- [${t}](${origin}/llm/topics/${t}.md): All public ${t} documents in this inventory.`,
  )
  .join('\n');

const outputs = new Map();
for (const p of pages) {
  const body = (await readFile(join(CONTENT, p.body_ref), 'utf8')).trim();
  const header =
    `# ${p.title}\n\nCanonical: [${p.title}](${p.url})\n\n` +
    `Locale: ${p.locale}\n\nPurpose: ${p.purpose}\n\n` +
    `Content updated: ${p.updated_at}\n\nSource revision: ${p.source_revision}\n\n` +
    `Maintenance owner: ${inv.owner}\n\n` +
    `[Topic map](${origin}/llm/topics/${p.topic}.md) · [Complete scoped map](${origin}/sitemap.md)\n\n`;
  outputs.set(p.md_path, header + body + '\n');
}
outputs.set(
  'sitemap.md',
  `# ${inv.site_name} content map\n\nInventory scope: ${inv.inventory_scope}. Public documents: ${pages.length}.\n\n` +
    `${inv.summary}\n\n## Topics\n\n${topicLinks}\n\n## All public documents\n\n${rows(pages)}\n`,
);
for (const t of topics) {
  outputs.set(
    `llm/topics/${t}.md`,
    `# ${t}\n\n[Site content map](${origin}/sitemap.md)\n\n` +
      rows(pages.filter((p) => p.topic === t)) +
      '\n',
  );
}
outputs.set(
  'llms.txt',
  `# ${inv.site_name}\n\n> ${inv.summary}\n\nInventory scope: ${inv.inventory_scope}. Content is maintained by ${inv.owner}.\n\n` +
    `If you are an LLM looking for site information, use the [content map](${origin}/sitemap.md) to locate the relevant topic and its linked Markdown answer.\n` +
    "Use that document's cited sources and canonical page; if the requested information is absent, report that gap.\n\n" +
    `## Content map\n\n- [Site content map](${origin}/sitemap.md): All public document destinations within the declared inventory.\n\n` +
    `## Topics\n\n${topicLinks}\n`,
);

let stale = 0;
for (const [route, text] of outputs) {
  const target = join(PUBLIC, route);
  if (check) {
    const current = await readFile(target, 'utf8').catch(() => null);
    if (current !== text) {
      stale += 1;
      console.error(`out of date: public/${route}`);
    }
  } else {
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, text, 'utf8');
    console.log(`wrote public/${route}`);
  }
}
if (check && stale) {
  console.error(`${stale} Markdown file(s) out of date — run: pnpm site:markdown`);
  process.exit(1);
}
if (check) console.log(`Markdown discovery files are up to date (${outputs.size} files).`);
