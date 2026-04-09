#!/usr/bin/env npx tsx
/**
 * Limrun CLI — thin client that sends commands to the background daemon.
 *
 * The daemon (limrun-daemon.ts) holds WebSocket connections open, so every
 * CLI invocation reuses the same connection instead of reconnecting.
 *
 * If the daemon isn't running, the CLI starts it automatically.
 *
 * Commands:
 *   init                        Create iOS instance with Xcode sandbox
 *   sync <folder>               Sync project folder to sandbox
 *   build                       Build with xcodebuild (streams output)
 *   launch <bundleId>           Launch (or relaunch) app by bundle ID
 *   screenshot [path]           Save screenshot (default: /tmp/limrun-screen.jpg)
 *   tap <x> <y>                 Tap at coordinates
 *   tap-element <axId>          Tap element by accessibilityIdentifier
 *   tap-label <label>           Tap element by label text
 *   element-tree                Print accessibility element tree as JSON
 *   status                      Show instance info and simulator URL
 *   destroy                     Delete the instance
 *   daemon-stop                 Stop the background daemon
 */

import fs from 'fs';
import path from 'path';
import net from 'net';
import { spawn } from 'child_process';

const SOCKET_PATH = '/tmp/limrun-daemon.sock';
const PID_FILE = '/tmp/limrun-daemon.pid';
const SKILL_DIR = path.dirname(new URL(import.meta.url).pathname);

// ---------------------------------------------------------------------------
// Daemon lifecycle
// ---------------------------------------------------------------------------

function isDaemonRunning(): boolean {
  if (!fs.existsSync(PID_FILE)) return false;
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
  if (isNaN(pid)) return false;
  try {
    process.kill(pid, 0); // Signal 0 = check if process exists
    return true;
  } catch {
    // Process doesn't exist, clean up stale files
    try { fs.unlinkSync(PID_FILE); } catch {}
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
    return false;
  }
}

function startDaemon(): Promise<void> {
  return new Promise((resolve, reject) => {
    const daemonPath = path.join(SKILL_DIR, 'limrun-daemon.ts');

    // Fork the daemon as a detached background process
    const child = spawn('npx', ['tsx', daemonPath], {
      detached: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env },
      cwd: SKILL_DIR,
    });

    child.unref();

    // Wait for the daemon to be ready (socket file appears)
    const startTime = Date.now();
    const timeout = 15000;

    const checkReady = () => {
      if (fs.existsSync(SOCKET_PATH)) {
        resolve();
        return;
      }
      if (Date.now() - startTime > timeout) {
        reject(new Error('Daemon failed to start within 15s'));
        return;
      }
      setTimeout(checkReady, 100);
    };

    child.stderr?.on('data', () => {
      // Daemon prints startup message to stderr; check if ready
      setTimeout(checkReady, 50);
    });

    // Also poll in case we miss the stderr event
    setTimeout(checkReady, 200);
  });
}

async function ensureDaemon(): Promise<void> {
  if (isDaemonRunning() && fs.existsSync(SOCKET_PATH)) return;
  await startDaemon();
}

// ---------------------------------------------------------------------------
// Send command to daemon
// ---------------------------------------------------------------------------

type DaemonMessage =
  | { type: 'stdout'; data: string }
  | { type: 'stderr'; data: string }
  | { type: 'done'; exitCode: number };

function sendCommand(command: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(SOCKET_PATH);
    let buffer = '';

    socket.on('connect', () => {
      const req = JSON.stringify({ command, args }) + '\n';
      socket.write(req);
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line) continue;

        let msg: DaemonMessage;
        try {
          msg = JSON.parse(line);
        } catch {
          process.stderr.write(`Invalid daemon response: ${line}\n`);
          continue;
        }

        switch (msg.type) {
          case 'stdout':
            process.stdout.write(msg.data + '\n');
            break;
          case 'stderr':
            process.stderr.write(msg.data + '\n');
            break;
          case 'done':
            socket.end();
            resolve(msg.exitCode);
            return;
        }
      }
    });

    socket.on('error', (err) => {
      reject(new Error(`Failed to connect to daemon: ${err.message}`));
    });

    socket.on('close', () => {
      // If we didn't get a 'done' message, treat as error
      reject(new Error('Daemon connection closed unexpectedly'));
    });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error('Usage: npx tsx limrun-cli.ts <command> [args...]');
  console.error('Commands: init, sync <folder>, build, launch <bundleId>,');
  console.error('          screenshot [path], tap <x> <y>, tap-element <axId>,');
  console.error('          tap-label <label>, element-tree, status, destroy,');
  console.error('          daemon-stop');
  process.exit(1);
}

// Special: stop the daemon
if (command === 'daemon-stop') {
  if (!isDaemonRunning()) {
    console.log('Daemon is not running.');
    process.exit(0);
  }
  try {
    const exitCode = await sendCommand('shutdown', []);
    process.exit(exitCode);
  } catch {
    // Force kill if socket comm fails
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
      try { process.kill(pid, 'SIGTERM'); } catch {}
    }
    try { fs.unlinkSync(PID_FILE); } catch {}
    try { fs.unlinkSync(SOCKET_PATH); } catch {}
    console.log('Daemon stopped.');
    process.exit(0);
  }
}

try {
  await ensureDaemon();
  const exitCode = await sendCommand(command, args);
  process.exit(exitCode);
} catch (err: any) {
  console.error(`Error: ${err.message || err}`);
  process.exit(1);
}
