// Generates every marketplace manifest from distribution.json + catalog.json +
// SKILL.md frontmatter, so the skills stay the single source of truth.
// Usage: node scripts/generate-manifests.mjs [--check]
// --check regenerates in memory and fails if any committed manifest is stale.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fail(message) {
  throw new Error(message);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail(`Invalid JSON at ${path.relative(repoRoot, filePath)}: ${err.message}`);
  }
}

function readSkillDescriptions() {
  const skillsDir = path.join(repoRoot, 'skills');
  const descriptions = {};
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const text = fs.readFileSync(path.join(skillsDir, entry.name, 'SKILL.md'), 'utf8');
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) fail(`skills/${entry.name}/SKILL.md is missing YAML frontmatter`);
    const frontmatter = yaml.load(match[1]);
    descriptions[entry.name] = frontmatter.description;
  }
  return descriptions;
}

function buildManifests() {
  const dist = readJson(path.join(repoRoot, 'distribution.json'));
  const catalog = readJson(path.join(repoRoot, 'catalog.json'));
  readSkillDescriptions(); // validates frontmatter is parseable before emitting
  const skillNames = catalog.skills.map((skill) => skill.name);

  const shared = {
    version: dist.version,
    description: dist.description,
    author: dist.author,
    homepage: dist.homepage,
    repository: dist.repository,
    license: dist.license,
    keywords: dist.keywords,
  };

  return {
    // Agent Plugins 1.0.0 (Cursor, VS Code/Copilot, Kiro). Skills and mcp.json
    // load from their fixed locations; the spec forbids pointing at them here.
    'plugin.json': {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
      name: dist.name,
      ...shared,
    },
    'mcp.json': {
      $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
      mcpServers: {
        [dist.mcpServerName]: { type: 'streamable-http', url: dist.mcpUrl },
      },
    },
    '.claude-plugin/plugin.json': {
      name: dist.name,
      displayName: dist.displayName,
      ...shared,
      mcpServers: './.mcp.json',
    },
    '.claude-plugin/marketplace.json': {
      name: dist.name,
      description: dist.description,
      owner: dist.author,
      plugins: [
        {
          name: dist.name,
          source: './',
          displayName: dist.displayName,
          description: dist.description,
          version: dist.version,
          homepage: dist.homepage,
          license: dist.license,
          keywords: dist.keywords,
          category: 'development',
        },
      ],
    },
    '.mcp.json': {
      mcpServers: {
        [dist.mcpServerName]: { type: 'http', url: dist.mcpUrl },
      },
    },
    'gemini-extension.json': {
      name: dist.name,
      version: dist.version,
      description: dist.description,
      mcpServers: {
        [dist.mcpServerName]: { httpUrl: dist.mcpUrl },
      },
    },
    '.codex-plugin/plugin.json': {
      name: dist.name,
      ...shared,
      skills: './skills/',
      mcpServers: './.mcp.json',
      interface: {
        displayName: dist.displayName,
        shortDescription: dist.interface.shortDescription,
        longDescription: `${dist.interface.longDescription} Included skills: ${skillNames.join(', ')}.`,
        developerName: dist.author.name,
        category: dist.category,
        capabilities: dist.interface.capabilities,
        websiteURL: dist.homepage,
        defaultPrompt: [dist.interface.defaultPrompt],
        brandColor: dist.brandColor,
        logo: dist.icon,
        screenshots: [],
      },
    },
    '.agents/plugins/marketplace.json': {
      name: dist.name,
      interface: { displayName: dist.displayName },
      plugins: [
        {
          name: dist.name,
          source: { source: 'local', path: './' },
          category: dist.category,
        },
      ],
    },
  };
}

function main() {
  const check = process.argv.includes('--check');
  const manifests = buildManifests();
  const stale = [];
  for (const [relPath, contents] of Object.entries(manifests)) {
    const filePath = path.join(repoRoot, relPath);
    const rendered = `${JSON.stringify(contents, null, 2)}\n`;
    if (check) {
      const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
      if (existing !== rendered) stale.push(relPath);
    } else {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, rendered);
    }
  }
  if (check && stale.length > 0) {
    fail(`stale manifests (run: npm run generate): ${stale.join(', ')}`);
  }
  process.stdout.write(
    check ? 'All manifests up to date.\n' : `Generated ${Object.keys(manifests).length} manifests.\n`,
  );
}

try {
  main();
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
