// Bumps the single source-of-truth version in distribution.json and
// regenerates every manifest. Usage: npm run bump [patch|minor|major]
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distPath = path.join(repoRoot, 'distribution.json');

const kind = process.argv[2] ?? 'patch';
const index = { major: 0, minor: 1, patch: 2 }[kind];
if (index === undefined) {
  process.stderr.write(`unknown bump kind "${kind}"; use patch, minor, or major\n`);
  process.exit(1);
}

const dist = JSON.parse(fs.readFileSync(distPath, 'utf8'));
const parts = dist.version.split('.').map(Number);
parts[index] += 1;
for (let i = index + 1; i < 3; i += 1) parts[i] = 0;
dist.version = parts.join('.');
fs.writeFileSync(distPath, `${JSON.stringify(dist, null, 2)}\n`);

execFileSync('node', [path.join(repoRoot, 'scripts', 'generate-manifests.mjs')], { stdio: 'inherit' });
process.stdout.write(`Bumped to ${dist.version}.\n`);
