// CI guard: a PR that changes what agents install (skills or manifests) must
// bump distribution.json's version so marketplaces pick up the new release.
// Usage: node scripts/check-version-bump.mjs <base-ref>
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseRef = process.argv[2] ?? 'origin/main';

function git(...args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
}

const changed = git('diff', '--name-only', `${baseRef}...HEAD`).split('\n').filter(Boolean);
const shipped = changed.filter(
  (f) =>
    f.startsWith('skills/') ||
    f === 'distribution.json' ||
    f === 'plugin.json' ||
    f === 'mcp.json' ||
    f === '.mcp.json' ||
    f === 'gemini-extension.json' ||
    f.startsWith('.claude-plugin/') ||
    f.startsWith('.codex-plugin/') ||
    f.startsWith('.agents/') ||
    f.startsWith('assets/'),
);
if (shipped.length === 0) {
  process.stdout.write('No shipped files changed; version bump not required.\n');
  process.exit(0);
}

const headVersion = JSON.parse(fs.readFileSync(path.join(repoRoot, 'distribution.json'), 'utf8')).version;
const baseVersion = JSON.parse(git('show', `${baseRef}:distribution.json`)).version;
if (headVersion === baseVersion) {
  process.stderr.write(
    `Shipped files changed (${shipped.length}) but version is still ${headVersion}; run: npm run bump\n`,
  );
  process.exit(1);
}
// A concurrent PR may have already released this version; releases are
// immutable, so a bump must land on a version with no tag yet.
const existingTag = git('tag', '--list', `v${headVersion}`);
if (existingTag) {
  process.stderr.write(`v${headVersion} is already released; run: npm run bump again\n`);
  process.exit(1);
}
process.stdout.write(`Version bumped ${baseVersion} -> ${headVersion}.\n`);
