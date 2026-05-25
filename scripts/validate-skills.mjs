import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = path.join(repoRoot, 'skills');
const catalogPath = path.join(repoRoot, 'catalog.json');

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

function readSkillFrontmatter(skillMdPath) {
  const text = fs.readFileSync(skillMdPath, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    fail(`${path.relative(repoRoot, skillMdPath)} is missing YAML frontmatter`);
  }

  try {
    const frontmatter = yaml.load(match[1]);
    if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
      fail(`${path.relative(repoRoot, skillMdPath)} frontmatter must be a YAML object`);
    }
    return frontmatter;
  } catch (err) {
    fail(`Invalid YAML frontmatter in ${path.relative(repoRoot, skillMdPath)}: ${err.message}`);
  }
}

function listSkillDirs() {
  if (!fs.existsSync(skillsDir)) {
    fail('skills/ directory is missing');
  }

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function assertString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${label} must be a non-empty string`);
  }
}

function main() {
  const catalog = readJson(catalogPath);
  if (catalog.schemaVersion !== 1) {
    fail('catalog.json schemaVersion must be 1');
  }
  if (!Array.isArray(catalog.skills)) {
    fail('catalog.json skills must be an array');
  }

  const skillDirs = listSkillDirs();
  const catalogNames = catalog.skills.map((skill, index) => {
    if (!skill || typeof skill !== 'object' || Array.isArray(skill)) {
      fail(`catalog.json skills[${index}] must be an object`);
    }
    assertString(skill.name, `catalog.json skills[${index}].name`);
    if (typeof skill.defaultSelected !== 'boolean') {
      fail(`catalog.json skills[${index}].defaultSelected must be a boolean`);
    }
    return skill.name;
  });

  const duplicateCatalogNames = catalogNames.filter((name, index) => catalogNames.indexOf(name) !== index);
  if (duplicateCatalogNames.length > 0) {
    fail(`catalog.json has duplicate skill names: ${[...new Set(duplicateCatalogNames)].join(', ')}`);
  }

  const missingFromCatalog = skillDirs.filter((dir) => !catalogNames.includes(dir));
  const missingFromDisk = catalogNames.filter((name) => !skillDirs.includes(name));
  if (missingFromCatalog.length > 0) {
    fail(`skills missing from catalog.json: ${missingFromCatalog.join(', ')}`);
  }
  if (missingFromDisk.length > 0) {
    fail(`catalog.json entries missing from skills/: ${missingFromDisk.join(', ')}`);
  }
  if (!catalog.skills.some((skill) => skill.defaultSelected)) {
    fail('catalog.json must mark at least one skill as defaultSelected');
  }

  const frontmatterNames = [];
  for (const dir of skillDirs) {
    const skillMdPath = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skillMdPath)) {
      fail(`skills/${dir}/SKILL.md is missing`);
    }

    const frontmatter = readSkillFrontmatter(skillMdPath);
    assertString(frontmatter.name, `skills/${dir}/SKILL.md frontmatter name`);
    assertString(frontmatter.description, `skills/${dir}/SKILL.md frontmatter description`);
    if (frontmatter.name !== dir) {
      fail(`skills/${dir}/SKILL.md frontmatter name must match directory name`);
    }
    frontmatterNames.push(frontmatter.name);
  }

  const duplicateFrontmatterNames = frontmatterNames.filter(
    (name, index) => frontmatterNames.indexOf(name) !== index,
  );
  if (duplicateFrontmatterNames.length > 0) {
    fail(`duplicate frontmatter names: ${[...new Set(duplicateFrontmatterNames)].join(', ')}`);
  }

  process.stdout.write(`Validated ${skillDirs.length} skills.\n`);
}

try {
  main();
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
