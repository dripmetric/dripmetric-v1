#!/usr/bin/env node
/**
 * `node scripts/ci-plan.mjs` — the first CI job. It decides how much of CI a run
 * needs, so a push pays only for what it could break.
 *
 * Two answers, written to $GITHUB_OUTPUT:
 *
 *   run=false   This exact commit is already being checked on main. Pushing one commit
 *               to main and to v2-observe used to run all of CI twice. main's runs are
 *               never cancelled (ci.yml, `concurrency`), so that run always finishes,
 *               and its result shows on the commit whichever branch you look at.
 *
 *   full=false  Every changed file is landing page, docs or Markdown. No engine, the
 *               ingest pipeline, the SDK or the dashboard reads those, so the simulator
 *               runs and the browser checks are skipped. Lint, format, typecheck,
 *               licences, the build, the landing-page checks and every other test still
 *               run.
 *
 * It only skips on positive evidence. A new branch, a force-push, an empty diff, a
 * manual run or any error all mean "run everything".
 *
 * Try it against real history. With no $GITHUB_OUTPUT it only prints the decision:
 *
 *   GITHUB_EVENT_NAME=push GITHUB_REF=refs/heads/v2-observe \
 *     BASE_SHA=<before> GITHUB_SHA=<after> node scripts/ci-plan.mjs
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

/**
 * Paths that cannot change what the simulator and browser jobs check. Keep this list
 * short and literal: a path wrongly listed here skips the checks that would catch it.
 */
const LIGHT_PATHS = [
  // The landing page is its own app and nothing imports it. Its own test and
  // `site:check` run in the always-on jobs.
  /^apps\/site\//,
  // Read by people. docs/openapi.yaml has a test, and that test is in the always-on job.
  /^docs\//,
  // No product code reads Markdown at runtime.
  /\.md$/,
  /^\.github\/workflows\/site-pages\.yml$/,
];

const env = process.env;
const event = env.GITHUB_EVENT_NAME ?? '';
const sha = env.GITHUB_SHA ?? '';
const base = env.BASE_SHA ?? '';

/** The url of a non-cancelled CI run on main for this same commit, or null. */
function runOnMain() {
  // "owner/repo/.github/workflows/ci.yml@refs/heads/x" → "ci.yml"
  const workflow = (env.GITHUB_WORKFLOW_REF ?? '').split('@')[0].split('/').pop();
  if (!workflow || !env.GITHUB_REPOSITORY || !sha) return null;
  try {
    const query = `head_sha=${sha}&branch=main&event=push&per_page=20`;
    const body = execFileSync(
      'gh',
      ['api', `repos/${env.GITHUB_REPOSITORY}/actions/workflows/${workflow}/runs?${query}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const match = JSON.parse(body).workflow_runs.find(
      (r) => String(r.id) !== env.GITHUB_RUN_ID && r.conclusion !== 'cancelled',
    );
    return match ? match.html_url : null;
  } catch (error) {
    console.log(`Could not look for a run on main (${error.message.split('\n')[0]}).`);
    return null;
  }
}

/** Every path the change touches, or null when it cannot be worked out. */
function changedFiles() {
  // All zeros is a brand-new branch: there is no "before" to compare with.
  if (!/^[0-9a-f]{40}$/.test(base) || /^0+$/.test(base) || !sha) return null;
  try {
    // --no-renames lists both sides of a move, so moving a file out of packages/
    // still counts as touching packages/.
    const out = execFileSync('git', ['diff', '--name-only', '--no-renames', base, sha], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return out.split('\n').filter(Boolean);
  } catch {
    // A force-push can leave `before` outside the fetched history.
    return null;
  }
}

function decide() {
  if (event === 'workflow_dispatch') {
    return { run: true, full: true, why: 'Started by hand, so everything runs.' };
  }

  if (event === 'push' && env.GITHUB_REF !== 'refs/heads/main') {
    const url = runOnMain();
    if (url) {
      return {
        run: false,
        full: false,
        why: `This commit is already being checked on main, so nothing runs twice: ${url}`,
      };
    }
  }

  const files = changedFiles();
  if (files === null) {
    return { run: true, full: true, why: 'Could not tell what changed, so everything runs.' };
  }
  if (files.length === 0) {
    // An empty commit is how people re-run CI on purpose.
    return { run: true, full: true, why: 'Nothing changed (an empty commit), so everything runs.' };
  }

  const product = files.filter((file) => !LIGHT_PATHS.some((pattern) => pattern.test(file)));
  if (product.length === 0) {
    return {
      run: true,
      full: false,
      why:
        `All ${files.length} changed files are landing page, docs or Markdown, ` +
        'so the simulator runs and browser checks are skipped.',
    };
  }
  const examples = product.slice(0, 3).join(', ') + (product.length > 3 ? ', …' : '');
  return {
    run: true,
    full: true,
    why: `${product.length} of ${files.length} changed files can affect the product (${examples}), so everything runs.`,
  };
}

const decision = decide();
const label = !decision.run ? 'Skipped' : decision.full ? 'Full run' : 'Quick run';
console.log(`${label}. ${decision.why}`);

if (env.GITHUB_OUTPUT) {
  appendFileSync(env.GITHUB_OUTPUT, `run=${decision.run}\nfull=${decision.full}\n`);
}
if (env.GITHUB_STEP_SUMMARY) {
  appendFileSync(env.GITHUB_STEP_SUMMARY, `**${label}.** ${decision.why}\n`);
}
