#!/usr/bin/env node
// Command-truth lint: every `lim` invocation in skill docs must exist in the
// real CLI. Enumerates commands at runtime via oclif Config.load (the CLI
// ships no manifest, and flags are composed dynamically, so parsing sources
// or help text would lie). Run with --self-test to check the lint's own rules.
//
// Truth source: the `lim` package resolved from LIM_ROOT or node_modules.
// CI installs lim@latest first; the linted version is printed on every run.

import { createRequire } from 'node:module';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const require_ = createRequire(import.meta.url);
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// CLI enumeration

async function loadCli() {
  const limRoot =
    process.env.LIM_ROOT ?? dirname(require_.resolve('lim/package.json'));
  const limPkg = JSON.parse(readFileSync(join(limRoot, 'package.json'), 'utf8'));
  // Use lim's own @oclif/core so plugin-loading internals match the CLI.
  const limRequire = createRequire(join(limRoot, 'package.json'));
  const { Config } = limRequire('@oclif/core/config');
  const config = await Config.load(limRoot);
  return { config, version: limPkg.version, limRoot };
}

// Longest-prefix command resolution, mirroring bin/run.js inferCommandArgv:
// positional tokens before the first flag, longest joined id wins.
function resolveCommand(config, positionals) {
  for (let n = positionals.length; n > 0; n--) {
    const id = positionals.slice(0, n).join(':');
    const cmd = config.findCommand(id);
    if (cmd) return { cmd, consumed: n };
  }
  return { cmd: null, consumed: 0 };
}

function knownTopic(config, positionals) {
  if (positionals.length === 0) return true; // bare `lim` prints help
  const id = positionals.join(':');
  return config.topics.some((t) => t.name === id);
}

function nearestSuggestion(config, badId) {
  const visible = config.commands.filter((c) => !c.hidden).map((c) => c.id);
  let best = null;
  let bestDist = Infinity;
  for (const id of visible) {
    const d = levenshtein(badId, id);
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return bestDist <= 3 ? best : null;
}

function levenshtein(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return m[a.length][b.length];
}

// ---------------------------------------------------------------------------
// Markdown extraction: fenced bash blocks + inline code spans starting `lim `.

const FENCE_LANGS = new Set(['bash', 'sh', 'shell', 'zsh', '']);

function extractCandidates(markdown) {
  const out = []; // {line, text, origin: 'fence'|'inline'}
  const lines = markdown.split('\n');
  let fenceLang = null;
  let buffer = null; // for continuation joining: {line, text}

  const flush = () => {
    if (buffer) out.push({ ...buffer, origin: 'fence' });
    buffer = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^\s*```(\S*)\s*$/);
    if (fence) {
      flush();
      fenceLang = fenceLang === null ? fence[1].toLowerCase() : null;
      continue;
    }
    if (fenceLang !== null && FENCE_LANGS.has(fenceLang)) {
      if (buffer) {
        buffer.text += ' ' + line.trim();
      } else {
        buffer = { line: i + 1, text: line };
      }
      if (buffer.text.trimEnd().endsWith('\\')) {
        buffer.text = buffer.text.trimEnd().replace(/\\$/, ' ');
        continue; // keep joining
      }
      flush();
      continue;
    }
    if (fenceLang === null) {
      // Inline spans: only those that BEGIN with `lim ` are contracts;
      // prose mentions of flags or others' commands are not linted.
      for (const span of line.matchAll(/`([^`]+)`/g)) {
        if (/^lim\s/.test(span[1])) {
          out.push({ line: i + 1, text: span[1], origin: 'inline' });
        }
      }
    }
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Shell-ish tokenizing and segment splitting.

function splitSegments(text) {
  // Strip comments (unquoted # to end of line), then split on |, &&, ||, ;
  const segments = [];
  let cur = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === '#' && (i === 0 || /\s/.test(text[i - 1]))) break;
    if (c === '|' || c === ';' || (c === '&' && text[i + 1] === '&')) {
      segments.push(cur);
      cur = '';
      if (c === '&') i++;
      if (c === '|' && text[i + 1] === '|') i++;
      continue;
    }
    cur += c;
  }
  segments.push(cur);
  return segments.map((s) => s.trim()).filter(Boolean);
}

function tokenize(segment) {
  const tokens = [];
  let cur = '';
  let quote = null;
  for (const c of segment) {
    if (quote) {
      if (c === quote) quote = null;
      else cur += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (/\s/.test(c)) {
      if (cur) tokens.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  if (cur) tokens.push(cur);
  return tokens;
}

const isPlaceholder = (tok) =>
  tok.includes('<') || tok.includes('${') || tok.startsWith('$');

// ---------------------------------------------------------------------------
// Core check of one `lim ...` invocation.

function checkInvocation(config, tokens) {
  const findings = [];
  // Skip leading env assignments (FOO=bar lim ...)
  let i = 0;
  while (i < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[i])) i++;
  if (tokens[i] !== 'lim') return findings; // not ours
  i++;

  // Positionals before the first flag decide the command id.
  const positionals = [];
  let j = i;
  while (j < tokens.length && !tokens[j].startsWith('-')) {
    positionals.push(tokens[j]);
    j++;
  }
  const { cmd, consumed } = resolveCommand(config, positionals);
  if (!cmd) {
    if (knownTopic(config, positionals)) return findings; // topic help is valid
    if (positionals.some(isPlaceholder)) return findings; // `lim ios <command>`
    // Trim trailing positionals that are clearly args: report the longest
    // known-topic prefix plus one token (`lim ios ls Documents` -> `lim ios ls`).
    let reportLen = positionals.length;
    for (let n = positionals.length - 1; n > 0; n--) {
      if (knownTopic(config, positionals.slice(0, n))) {
        reportLen = n + 1;
        break;
      }
    }
    const reported = positionals.slice(0, reportLen);
    const badId = reported.join(':') || '(none)';
    const near = nearestSuggestion(config, badId);
    findings.push(
      `unknown command \`lim ${reported.join(' ')}\`` +
        (near ? ` (nearest: \`lim ${near.replaceAll(':', ' ')}\`)` : ''),
    );
    return findings;
  }

  // Validate flags on the resolved command; remaining positionals are args.
  const flags = cmd.flags ?? {};
  const byChar = new Map(
    Object.values(flags).filter((f) => f.char).map((f) => [f.char, f]),
  );
  for (let k = i + consumed; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok === '--') break; // passthrough to maestro/simctl/xcodebuild/...
    if (!tok.startsWith('-') || tok === '-') continue; // positional arg
    if (isPlaceholder(tok)) continue;

    if (tok.startsWith('--')) {
      const eq = tok.indexOf('=');
      const name = (eq === -1 ? tok.slice(2) : tok.slice(2, eq));
      const value = eq === -1 ? null : tok.slice(eq + 1);
      if (name === 'help' || name === 'version') continue; // oclif builtins
      let flag = flags[name];
      if (!flag && name.startsWith('no-')) {
        const base = flags[name.slice(3)];
        if (base && base.type === 'boolean' && base.allowNo) flag = base;
      }
      if (!flag) {
        findings.push(`unknown flag \`--${name}\` on \`lim ${cmd.id.replaceAll(':', ' ')}\``);
        continue;
      }
      if (flag.type === 'option') {
        const v = value ?? (tokens[k + 1] && !tokens[k + 1].startsWith('-') ? tokens[++k] : null);
        if (v && flag.options && !isPlaceholder(v) && !flag.options.includes(v)) {
          findings.push(
            `invalid value \`${v}\` for \`--${name}\` on \`lim ${cmd.id.replaceAll(':', ' ')}\` (allowed: ${flag.options.join(', ')})`,
          );
        }
      }
    } else {
      // short flags: -x or combined -ab
      for (const ch of tok.slice(1)) {
        if (ch === 'h') continue;
        const f = byChar.get(ch);
        if (!f) {
          findings.push(`unknown short flag \`-${ch}\` on \`lim ${cmd.id.replaceAll(':', ' ')}\``);
        } else if (f.type === 'option' && tok.length === 2) {
          if (tokens[k + 1] && !tokens[k + 1].startsWith('-')) k++;
        }
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// File walking + allowlist + reporting.

function loadAllowlist() {
  const p = join(repoRoot, 'scripts', 'lim-lint-allowlist.json');
  if (!existsSync(p)) return [];
  const entries = JSON.parse(readFileSync(p, 'utf8'));
  for (const e of entries) {
    if (!e.file || !e.snippet || !e.reason) {
      throw new Error(`allowlist entry missing file/snippet/reason: ${JSON.stringify(e)}`);
    }
  }
  return entries;
}

function* skillMarkdownFiles() {
  const skillsDir = join(repoRoot, 'skills');
  for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!skill.isDirectory()) continue;
    const dir = join(skillsDir, skill.name);
    const stack = [dir];
    while (stack.length) {
      const d = stack.pop();
      for (const ent of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, ent.name);
        if (ent.isDirectory()) stack.push(p);
        else if (ent.name.endsWith('.md')) yield p;
      }
    }
  }
}

async function lint() {
  const { config, version } = await loadCli();
  const allowlist = loadAllowlist();
  const used = new Set();
  const findings = [];

  for (const file of skillMarkdownFiles()) {
    const rel = relative(repoRoot, file);
    const md = readFileSync(file, 'utf8');
    for (const cand of extractCandidates(md)) {
      for (const segment of splitSegments(cand.text)) {
        const tokens = tokenize(segment);
        for (const msg of checkInvocation(config, tokens)) {
          const allowed = allowlist.find(
            (e) => rel.endsWith(e.file) && segment.includes(e.snippet),
          );
          if (allowed) {
            used.add(allowed);
            continue;
          }
          findings.push(`${rel}:${cand.line}: ${msg}`);
        }
      }
    }
  }

  console.log(`lint-lim-commands: checked against lim@${version} (${config.commands.length} commands)`);
  for (const e of allowlist) {
    const tag = used.has(e) ? 'active' : 'UNUSED (remove?)';
    console.log(`allowlist [${tag}]: ${e.file} :: ${e.snippet} (${e.reason})`);
  }
  if (findings.length) {
    console.error(`\n${findings.length} finding(s):`);
    for (const f of findings) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log('OK: all lim invocations resolve against the CLI.');
}

// ---------------------------------------------------------------------------
// Self-test: each rule gets a fixture so future edits can't silently regress.

async function selfTest() {
  const { config, version } = await loadCli();
  const cases = [
    // [description, snippet, expected finding count]
    ['valid simple command', 'lim ios create --attach', 0],
    ['unknown command', 'lim ios frobnicate', 1],
    ['unknown flag', 'lim ios create --does-not-exist', 1],
    ['builtin help', 'lim ios create --help', 0],
    ['builtin version', 'lim --version', 0],
    ['bare topic is help', 'lim ios', 0],
    ['placeholder command', 'lim ios <subcommand>', 0],
    ['passthrough stops at --', 'lim ios maestro -- test flow.yaml --include-tags smoke', 0],
    ['pipe splits segments', 'lim ios element-tree | grep -i button', 0],
    ['non-lim segment ignored', 'npm install --global lim && lim login', 0],
    ['env prefix skipped', 'LIM_API_KEY=x lim ios list', 0],
    ['allowNo negative form', 'lim ios create --no-open', 0],
    ['no- on non-allowNo flag', 'lim ios create --no-attach', 1],
    ['option value from options list', 'lim ios launch-app com.x --mode RelaunchIfRunning', 0],
    ['bad option value', 'lim ios launch-app com.x --mode Nonsense', 1],
    ['positional args are not flags', 'lim ios tap 201 450', 0],
    ['quoted values', 'lim ios type "hello --world"', 0],
    ['comment stripped', 'lim ios list # --bogus is only a comment', 0],
    ['continuation handled upstream', 'lim xcode build . --detach', 0],
  ];
  let failed = 0;
  for (const [desc, snippet, expected] of cases) {
    let got = 0;
    for (const segment of splitSegments(snippet)) {
      got += checkInvocation(config, tokenize(segment)).length;
    }
    const ok = got === expected;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${desc} (expected ${expected}, got ${got})`);
  }
  console.log(`self-test against lim@${version}: ${cases.length - failed}/${cases.length} passed`);
  if (failed) process.exit(1);
}

if (process.argv.includes('--self-test')) {
  await selfTest();
} else {
  await lint();
}
