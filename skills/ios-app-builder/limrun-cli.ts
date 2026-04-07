#!/usr/bin/env npx tsx
/**
 * Limrun CLI Helper — Xcode sandbox + simulator interaction.
 *
 * State persisted in /tmp/limrun-ios-builder-state.json between calls.
 *
 * Commands:
 *   init                        Create iOS instance with Xcode sandbox
 *   sync <folder>               Sync project folder to sandbox
 *   build                       Build with xcodebuild (streams output)
 *   launch <bundleId>           Launch (or relaunch) app by bundle ID
 *   screenshot [path]           Save screenshot to path (default: /tmp/limrun-screen.jpg) and print path
 *   tap <x> <y>                 Tap at coordinates
 *   tap-element <axId>          Tap element by accessibilityIdentifier
 *   tap-label <label>           Tap element by label text
 *   element-tree                Print accessibility element tree as JSON
 *   status                      Show instance info and simulator URL
 *   destroy                     Delete the instance
 */

import fs from 'fs';
import path from 'path';
import { Limrun, createXCodeSandboxClient } from '@limrun/api';
import { createInstanceClient } from '@limrun/api/ios-client.js';

const STATE_FILE = '/tmp/limrun-ios-builder-state.json';
const DEFAULT_SCREENSHOT_PATH = '/tmp/limrun-screen.jpg';

type State = {
  instanceId: string;
  token: string;
  apiUrl: string;
  sandboxUrl: string;
  simulatorUrl: string;
};

function loadState(): State {
  if (!fs.existsSync(STATE_FILE)) {
    console.error('Error: No active instance. Run "init" first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

async function isInstanceLive(instanceId: string): Promise<boolean> {
  try {
    const lim = new Limrun();
    const instance = await lim.iosInstances.get(instanceId);
    return instance.status.state !== 'terminated';
  } catch {
    return false;
  }
}

function saveState(state: State): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState(): void {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
}

async function getSimulatorClient() {
  const state = loadState();
  return createInstanceClient({
    apiUrl: state.apiUrl,
    token: state.token,
    logLevel: 'error',
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdInit(): Promise<void> {
  if (!process.env['LIM_API_KEY']) {
    console.error('Error: LIM_API_KEY environment variable is required.');
    console.error('Get an API key from https://console.limrun.com');
    process.exit(1);
  }

  if (fs.existsSync(STATE_FILE)) {
    const existingState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as State;
    const live = await isInstanceLive(existingState.instanceId);
    if (live) {
      console.log('Reusing existing live instance.');
      printInstanceInfo(existingState, 'Active instance');
      return;
    }
    console.log('Existing instance is no longer live. Clearing state...');
    clearState();
  }

  console.log('Creating iOS instance with Xcode sandbox...');
  const lim = new Limrun();
  const instance = await lim.iosInstances.create({
    wait: true,
    reuseIfExists: true,
    metadata: {
      labels: { name: 'claude-ios-builder' },
    },
    spec: {
      sandbox: { xcode: { enabled: true } },
    },
  });

  const sandboxUrl = instance.status.sandbox?.xcode?.url;
  if (!sandboxUrl) {
    console.error('Error: Xcode sandbox URL not available');
    process.exit(1);
  }

  const apiUrl = instance.status.apiUrl;
  if (!apiUrl) {
    console.error('Error: Simulator API URL not available');
    process.exit(1);
  }

  const state: State = {
    instanceId: instance.metadata.id,
    token: instance.status.token,
    apiUrl,
    sandboxUrl,
    simulatorUrl: `https://console.limrun.com/stream/${instance.metadata.id}`,
  };
  saveState(state);

  printInstanceInfo(state, 'Instance created');
}

function printInstanceInfo(state: State, header: string): void {
  console.log(header);
  console.log(`  Instance ID:   ${state.instanceId}`);
  console.log(`  Simulator URL: ${state.simulatorUrl}`);
}

async function cmdSync(folder: string): Promise<void> {
  const state = loadState();
  const resolvedPath = path.resolve(folder);

  if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Folder not found: ${resolvedPath}`);
    process.exit(1);
  }

  console.log(`Syncing ${resolvedPath} to sandbox...`);
  const sandbox = await createXCodeSandboxClient({
    apiUrl: state.sandboxUrl,
    token: state.token,
    logLevel: 'error',
  });
  await sandbox.sync(resolvedPath, { watch: false, install: true });
  console.log('Sync complete.');
}

async function cmdBuild(): Promise<void> {
  const state = loadState();
  const sandbox = await createXCodeSandboxClient({
    apiUrl: state.sandboxUrl,
    token: state.token,
    logLevel: 'error',
  });

  console.log('Starting xcodebuild...');
  const build = sandbox.xcodebuild();

  build.command.on('data', (line) => {
    console.log(`[cmd] ${line}`);
  });
  build.stdout.on('data', (line) => {
    process.stdout.write(line);
  });
  build.stderr.on('data', (line) => {
    process.stderr.write(line);
  });

  const result = await build;
  console.log(`\nBuild ${result.status} (exit code: ${result.exitCode})`);
  process.exit(result.exitCode);
}

async function cmdLaunch(bundleId: string): Promise<void> {
  const client = await getSimulatorClient();
  try {
    await client.launchApp(bundleId, 'RelaunchIfRunning');
    console.log(`Launched: ${bundleId}`);
  } finally {
    client.disconnect();
  }
}

async function cmdScreenshot(outputPath: string): Promise<void> {
  const client = await getSimulatorClient();
  try {
    const data = await client.screenshot();
    const buf = Buffer.from(data.base64, 'base64');
    fs.writeFileSync(outputPath, buf);
    console.log(outputPath);
  } finally {
    client.disconnect();
  }
}

async function cmdTap(x: number, y: number): Promise<void> {
  const client = await getSimulatorClient();
  try {
    await client.tap(x, y);
    console.log(`Tapped (${x}, ${y})`);
  } finally {
    client.disconnect();
  }
}

async function cmdTapElement(axId: string): Promise<void> {
  const client = await getSimulatorClient();
  try {
    const result = await client.tapElement({ accessibilityId: axId });
    console.log(`Tapped element: ${result.elementLabel ?? axId}`);
  } finally {
    client.disconnect();
  }
}

async function cmdTapLabel(label: string): Promise<void> {
  const client = await getSimulatorClient();
  try {
    const result = await client.tapElement({ label });
    console.log(`Tapped label: ${result.elementLabel ?? label}`);
  } finally {
    client.disconnect();
  }
}

async function cmdElementTree(): Promise<void> {
  const client = await getSimulatorClient();
  try {
    const tree = await client.elementTree();
    console.log(tree);
  } finally {
    client.disconnect();
  }
}

async function cmdStatus(): Promise<void> {
  const state = loadState();
  printInstanceInfo(state, 'Active instance');
}

async function cmdDestroy(): Promise<void> {
  if (!process.env['LIM_API_KEY']) {
    console.error('Error: LIM_API_KEY environment variable is required.');
    process.exit(1);
  }
  const state = loadState();
  const lim = new Limrun();
  console.log(`Deleting instance ${state.instanceId}...`);
  await lim.iosInstances.delete(state.instanceId);
  clearState();
  console.log('Instance deleted.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: npx tsx limrun-cli.ts <command> [args...]');
  console.error('Commands: init, sync <folder>, build, launch <bundleId>,');
  console.error('          screenshot [path], tap <x> <y>, tap-element <axId>,');
  console.error('          tap-label <label>, element-tree, status, destroy');
  process.exit(1);
}

try {
  switch (command) {
    case 'init':
      await cmdInit();
      break;
    case 'sync':
      if (!args[0]) { console.error('Usage: sync <folder>'); process.exit(1); }
      await cmdSync(args[0]);
      break;
    case 'build':
      await cmdBuild();
      break;
    case 'launch':
      if (!args[0]) { console.error('Usage: launch <bundleId>'); process.exit(1); }
      await cmdLaunch(args[0]);
      break;
    case 'screenshot':
      await cmdScreenshot(args[0] ?? DEFAULT_SCREENSHOT_PATH);
      break;
    case 'tap':
      if (!args[0] || !args[1]) { console.error('Usage: tap <x> <y>'); process.exit(1); }
      await cmdTap(parseFloat(args[0]), parseFloat(args[1]));
      break;
    case 'tap-element':
      if (!args[0]) { console.error('Usage: tap-element <axId>'); process.exit(1); }
      await cmdTapElement(args[0]);
      break;
    case 'tap-label':
      if (!args[0]) { console.error('Usage: tap-label <label>'); process.exit(1); }
      await cmdTapLabel(args[0]);
      break;
    case 'element-tree':
      await cmdElementTree();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'destroy':
      await cmdDestroy();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} catch (err: any) {
  console.error(`Error: ${err.message || err}`);
  process.exit(1);
}
