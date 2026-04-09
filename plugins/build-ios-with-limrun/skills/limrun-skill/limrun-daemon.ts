#!/usr/bin/env npx tsx
/**
 * Limrun Daemon — long-running background process that holds WebSocket
 * connections to the simulator and sandbox. CLI commands communicate with
 * this daemon over a Unix domain socket, avoiding per-command reconnection.
 *
 * Protocol (newline-delimited JSON over Unix socket):
 *   Client sends:  { "command": "screenshot", "args": ["/tmp/screen.jpg"] }
 *   Daemon replies: { "type": "stdout", "data": "..." }   (zero or more)
 *                   { "type": "stderr", "data": "..." }   (zero or more)
 *                   { "type": "done", "exitCode": 0 }     (exactly one, last)
 */

import fs from 'fs';
import path from 'path';
import net from 'net';
import { Limrun, createXCodeSandboxClient, type XCodeSandboxClient } from '@limrun/api';
import { createInstanceClient, type InstanceClient } from '@limrun/api/ios-client.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SOCKET_PATH = '/tmp/limrun-daemon.sock';
export const PID_FILE = '/tmp/limrun-daemon.pid';
const STATE_FILE = '/tmp/limrun-ios-builder-state.json';
const DEFAULT_SCREENSHOT_PATH = '/tmp/limrun-screen.jpg';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type State = {
  instanceId: string;
  token: string;
  apiUrl: string;
  sandboxUrl: string;
  simulatorUrl: string;
};

type ClientRequest = {
  command: string;
  args: string[];
};

type DaemonMessage =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'done'; exitCode: number };

// ---------------------------------------------------------------------------
// State management
// ---------------------------------------------------------------------------

function loadState(): State | null {
  if (!fs.existsSync(STATE_FILE)) return null;
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state: State): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState(): void {
  if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
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

// ---------------------------------------------------------------------------
// Cached clients — the whole point of the daemon
// ---------------------------------------------------------------------------

let simulatorClient: InstanceClient | null = null;
let sandboxClient: XCodeSandboxClient | null = null;
let currentState: State | null = null;

function stateChanged(): boolean {
  if (!currentState) return true;
  const fresh = loadState();
  if (!fresh) return true;
  return fresh.instanceId !== currentState.instanceId ||
         fresh.token !== currentState.token ||
         fresh.apiUrl !== currentState.apiUrl;
}

async function getSimulatorClient(): Promise<InstanceClient> {
  if (simulatorClient && !stateChanged()) return simulatorClient;
  if (simulatorClient) {
    simulatorClient.disconnect();
    simulatorClient = null;
  }
  const state = loadState();
  if (!state) throw new Error('No active instance. Run "init" first.');
  currentState = state;
  simulatorClient = await createInstanceClient({
    apiUrl: state.apiUrl,
    token: state.token,
    logLevel: 'error',
  });
  return simulatorClient;
}

async function getSandboxClient(): Promise<XCodeSandboxClient> {
  if (sandboxClient && !stateChanged()) return sandboxClient;
  const state = loadState();
  if (!state) throw new Error('No active instance. Run "init" first.');
  currentState = state;
  sandboxClient = await createXCodeSandboxClient({
    apiUrl: state.sandboxUrl,
    token: state.token,
    logLevel: 'error',
  });
  return sandboxClient;
}

function disconnectAll(): void {
  if (simulatorClient) {
    simulatorClient.disconnect();
    simulatorClient = null;
  }
  sandboxClient = null;
  currentState = null;
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------

function send(socket: net.Socket, msg: DaemonMessage): void {
  socket.write(JSON.stringify(msg) + '\n');
}

function sendOut(socket: net.Socket, data: string): void {
  send(socket, { type: 'stdout', data });
}

function sendErr(socket: net.Socket, data: string): void {
  send(socket, { type: 'stderr', data });
}

function sendDone(socket: net.Socket, exitCode: number = 0): void {
  send(socket, { type: 'done', exitCode });
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function handleInit(socket: net.Socket): Promise<void> {
  if (!process.env['LIM_API_KEY']) {
    throw new Error('LIM_API_KEY environment variable is required. Get an API key from https://console.limrun.com');
  }

  const existing = loadState();
  if (existing) {
    const live = await isInstanceLive(existing.instanceId);
    if (live) {
      sendOut(socket, 'Reusing existing live instance.');
      sendOut(socket, `Active instance`);
      sendOut(socket, `  Instance ID:   ${existing.instanceId}`);
      sendOut(socket, `  Simulator URL: ${existing.simulatorUrl}`);
      return;
    }
    sendOut(socket, 'Existing instance is no longer live. Clearing state...');
    clearState();
    disconnectAll();
  }

  sendOut(socket, 'Creating iOS instance with Xcode sandbox...');
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
  if (!sandboxUrl) throw new Error('Xcode sandbox URL not available');

  const apiUrl = instance.status.apiUrl;
  if (!apiUrl) throw new Error('Simulator API URL not available');

  const state: State = {
    instanceId: instance.metadata.id,
    token: instance.status.token,
    apiUrl,
    sandboxUrl,
    simulatorUrl: `https://console.limrun.com/stream/${instance.metadata.id}`,
  };
  saveState(state);
  disconnectAll();

  sendOut(socket, 'Instance created');
  sendOut(socket, `  Instance ID:   ${state.instanceId}`);
  sendOut(socket, `  Simulator URL: ${state.simulatorUrl}`);
}

async function handleSync(socket: net.Socket, args: string[]): Promise<void> {
  if (!args[0]) throw new Error('Usage: sync <folder>');
  const resolvedPath = path.resolve(args[0]);
  if (!fs.existsSync(resolvedPath)) throw new Error(`Folder not found: ${resolvedPath}`);

  sendOut(socket, `Syncing ${resolvedPath} to sandbox...`);
  const sandbox = await getSandboxClient();
  await sandbox.sync(resolvedPath, { watch: false, install: true });
  sendOut(socket, 'Sync complete.');
}

async function handleBuild(socket: net.Socket): Promise<number> {
  const sandbox = await getSandboxClient();

  sendOut(socket, 'Starting xcodebuild...');
  const build = sandbox.xcodebuild();

  build.command.on('data', (line) => sendOut(socket, `[cmd] ${line}`));
  build.stdout.on('data', (line) => sendOut(socket, line));
  build.stderr.on('data', (line) => sendErr(socket, line));

  const result = await build;
  sendOut(socket, `\nBuild ${result.status} (exit code: ${result.exitCode})`);
  return result.exitCode;
}

async function handleLaunch(socket: net.Socket, args: string[]): Promise<void> {
  if (!args[0]) throw new Error('Usage: launch <bundleId>');
  const client = await getSimulatorClient();
  await client.launchApp(args[0], 'RelaunchIfRunning');
  sendOut(socket, `Launched: ${args[0]}`);
}

async function handleScreenshot(socket: net.Socket, args: string[]): Promise<void> {
  const outputPath = args[0] ?? DEFAULT_SCREENSHOT_PATH;
  const client = await getSimulatorClient();
  const data = await client.screenshot();
  const buf = Buffer.from(data.base64, 'base64');
  fs.writeFileSync(outputPath, buf);
  sendOut(socket, outputPath);
}

async function handleTap(socket: net.Socket, args: string[]): Promise<void> {
  if (!args[0] || !args[1]) throw new Error('Usage: tap <x> <y>');
  const client = await getSimulatorClient();
  await client.tap(parseFloat(args[0]), parseFloat(args[1]));
  sendOut(socket, `Tapped (${args[0]}, ${args[1]})`);
}

async function handleTapElement(socket: net.Socket, args: string[]): Promise<void> {
  if (!args[0]) throw new Error('Usage: tap-element <axId>');
  const client = await getSimulatorClient();
  const result = await client.tapElement({ accessibilityId: args[0] });
  sendOut(socket, `Tapped element: ${result.elementLabel ?? args[0]}`);
}

async function handleTapLabel(socket: net.Socket, args: string[]): Promise<void> {
  if (!args[0]) throw new Error('Usage: tap-label <label>');
  const client = await getSimulatorClient();
  const result = await client.tapElement({ label: args[0] });
  sendOut(socket, `Tapped label: ${result.elementLabel ?? args[0]}`);
}

async function handleElementTree(socket: net.Socket): Promise<void> {
  const client = await getSimulatorClient();
  const tree = await client.elementTree();
  sendOut(socket, tree);
}

async function handleStatus(socket: net.Socket): Promise<void> {
  const state = loadState();
  if (!state) throw new Error('No active instance. Run "init" first.');
  sendOut(socket, 'Active instance');
  sendOut(socket, `  Instance ID:   ${state.instanceId}`);
  sendOut(socket, `  Simulator URL: ${state.simulatorUrl}`);
}

async function handleDestroy(socket: net.Socket): Promise<void> {
  if (!process.env['LIM_API_KEY']) {
    throw new Error('LIM_API_KEY environment variable is required.');
  }
  const state = loadState();
  if (!state) throw new Error('No active instance.');
  disconnectAll();
  const lim = new Limrun();
  sendOut(socket, `Deleting instance ${state.instanceId}...`);
  await lim.iosInstances.delete(state.instanceId);
  clearState();
  sendOut(socket, 'Instance deleted.');
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

async function dispatch(socket: net.Socket, req: ClientRequest): Promise<void> {
  let exitCode = 0;
  try {
    switch (req.command) {
      case 'init':
        await handleInit(socket);
        break;
      case 'sync':
        await handleSync(socket, req.args);
        break;
      case 'build':
        exitCode = await handleBuild(socket);
        break;
      case 'launch':
        await handleLaunch(socket, req.args);
        break;
      case 'screenshot':
        await handleScreenshot(socket, req.args);
        break;
      case 'tap':
        await handleTap(socket, req.args);
        break;
      case 'tap-element':
        await handleTapElement(socket, req.args);
        break;
      case 'tap-label':
        await handleTapLabel(socket, req.args);
        break;
      case 'element-tree':
        await handleElementTree(socket);
        break;
      case 'status':
        await handleStatus(socket);
        break;
      case 'destroy':
        await handleDestroy(socket);
        break;
      case 'ping':
        sendOut(socket, 'pong');
        break;
      case 'shutdown':
        sendOut(socket, 'Daemon shutting down.');
        sendDone(socket, 0);
        shutdown();
        return;
      default:
        throw new Error(`Unknown command: ${req.command}`);
    }
  } catch (err: any) {
    sendErr(socket, `Error: ${err.message || err}`);
    exitCode = 1;
  }
  sendDone(socket, exitCode);
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

function cleanup(): void {
  try { if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH); } catch {}
  try { if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE); } catch {}
}

function shutdown(): void {
  disconnectAll();
  server.close();
  cleanup();
  process.exit(0);
}

// Clean up stale socket file
cleanup();

const server = net.createServer((socket) => {
  let buffer = '';

  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    // Process complete lines (newline-delimited JSON)
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newlineIdx).trim();
      buffer = buffer.slice(newlineIdx + 1);
      if (!line) continue;

      let req: ClientRequest;
      try {
        req = JSON.parse(line);
      } catch {
        sendErr(socket, 'Invalid JSON request');
        sendDone(socket, 1);
        continue;
      }
      // Handle one command at a time per connection
      dispatch(socket, req).catch((err) => {
        sendErr(socket, `Internal error: ${err.message || err}`);
        sendDone(socket, 1);
      });
    }
  });

  socket.on('error', () => {
    // Client disconnected mid-command, ignore
  });
});

server.listen(SOCKET_PATH, () => {
  // Write PID file so CLI can check if daemon is alive
  fs.writeFileSync(PID_FILE, String(process.pid));
  // Make socket accessible
  fs.chmodSync(SOCKET_PATH, 0o600);
  console.error(`Limrun daemon started (pid ${process.pid})`);
});

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (err) => {
  console.error('Daemon uncaught exception:', err);
  shutdown();
});
