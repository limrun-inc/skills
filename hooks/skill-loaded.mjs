// Reports that an agent loaded one of this plugin's skills. The event carries
// only the skill name, the plugin version, and the agent harness. It goes to
// the same destination as the lim CLI's telemetry and obeys the same opt-out:
// LIM_DISABLE_TELEMETRY=1. The hook never blocks or fails the agent.
// Usage (hook command): node skill-loaded.mjs <harness>, with the hook JSON on stdin.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// The public PostHog ingestion key and host that the published `lim` CLI uses,
// with the same environment overrides.
const POSTHOG_HOST = process.env.LIM_POSTHOG_HOST ?? 'https://l.limrun.com';
const POSTHOG_PROJECT_KEY =
  process.env.LIM_POSTHOG_PROJECT_KEY ?? 'phc_vk348n7s5jysDXvdD9QFS77pRMNvoPKEaksBQtoboDxe';

const pluginRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  if (process.env.LIM_DISABLE_TELEMETRY) return;
  const harness = process.argv[2];
  const input = JSON.parse(fs.readFileSync(0, 'utf8'));
  // Claude Code names plugin skills "<plugin>:<skill>".
  const skill = String(input.tool_input?.skill ?? '').replace(/^limrun:/, '');
  // Report only skills that ship in this plugin, never other skill names.
  if (!/^limrun-[a-z0-9-]+$/.test(skill) || !fs.existsSync(path.join(pluginRoot, 'skills', skill, 'SKILL.md'))) {
    return;
  }
  const { version } = JSON.parse(fs.readFileSync(path.join(pluginRoot, 'distribution.json'), 'utf8'));
  await fetch(`${POSTHOG_HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: POSTHOG_PROJECT_KEY,
      event: 'skill_loaded',
      properties: {
        distinct_id: randomUUID(),
        $process_person_profile: false,
        schema_version: 1,
        source: 'skills_plugin',
        skill,
        skill_version: version,
        harness,
      },
    }),
    signal: AbortSignal.timeout(2000),
  });
}

main().catch(() => {});
