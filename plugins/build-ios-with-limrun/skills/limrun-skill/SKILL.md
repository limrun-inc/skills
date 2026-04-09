---
name: limrun-skill
description: "Provision and operate Limrun cloud iOS simulators and Xcode sandboxes — sync code, build, launch, interact with UI, and capture screenshots on a remote simulator. TRIGGER when user wants to build, run, or test an iOS app and a cloud simulator is needed (no local Xcode/simulator available or user explicitly requests Limrun)."
user-invocable: true
effort: high
---

# Limrun iOS Cloud Build & Simulator

## Overview

Provision and operate **Limrun cloud iOS simulators** so the user can build, run, and interact with their iOS app without local Xcode or a local simulator. This skill owns the full cloud-infrastructure lifecycle: instance creation, code syncing, building, launching, UI interaction, screenshots, and teardown.

## Responsibility Boundaries

This skill handles **Limrun cloud infrastructure only**. It does NOT cover:

| Concern | Handled by |
| ------- | ---------- |
| SwiftUI view design, component patterns, state management | `swiftui-ui-patterns` |
| SwiftUI view refactoring, MV architecture, code cleanup | `swiftui-view-refactor` |
| SwiftUI runtime performance profiling and audit | `swiftui-performance-audit` |
| Liquid Glass API adoption (iOS 26+) | `swiftui-liquid-glass` |
| App Intents, App Shortcuts, Siri / Spotlight integration | `ios-app-intents` |

**IMPORTANT: All iOS builds and simulator operations MUST run on Limrun.** Do NOT attempt to use local Xcode, local simulators, or any local macOS build tools. Never suggest installing Xcode locally or running `xcodebuild` on the user's machine.

**Respect the user's code.** Do not impose Swift conventions, architecture patterns, or project structure. If the user needs guidance on SwiftUI patterns, refactoring, or performance, defer to the appropriate skill listed above.

## Architecture

A background daemon (`limrun-daemon.ts`) holds WebSocket connections to the simulator and sandbox. The CLI (`limrun-cli.ts`) is a thin client that sends commands to the daemon over a Unix socket. The daemon starts automatically on first CLI use and stays alive, so every command reuses the same connections — no reconnection overhead.

## CLI Commands

Run from anywhere. Install deps once: `cd ${CLAUDE_SKILL_DIR} && yarn install`

```bash
SKILL="${CLAUDE_SKILL_DIR}"
```

### Direct invocation (one-off commands)

| Command | What it does |
| ------- | ------------ |
| `npx tsx $SKILL/limrun-cli.ts init` | Create iOS instance with Xcode sandbox. Prints instance ID and simulator URL |
| `npx tsx $SKILL/limrun-cli.ts sync <folder>` | Sync project folder to sandbox |
| `npx tsx $SKILL/limrun-cli.ts build` | Build with xcodebuild (streams output) |
| `npx tsx $SKILL/limrun-cli.ts launch <bundleId>` | Launch (or relaunch) app on the simulator |
| `npx tsx $SKILL/limrun-cli.ts screenshot [path]` | Save screenshot to path (default: `/tmp/limrun-screen.jpg`), prints path |
| `npx tsx $SKILL/limrun-cli.ts tap <x> <y>` | Tap at coordinates |
| `npx tsx $SKILL/limrun-cli.ts tap-element <axId>` | Tap element by `accessibilityIdentifier` |
| `npx tsx $SKILL/limrun-cli.ts tap-label <label>` | Tap element by label text |
| `npx tsx $SKILL/limrun-cli.ts element-tree` | Print full accessibility element tree as JSON |
| `npx tsx $SKILL/limrun-cli.ts status` | Show instance ID and simulator URL |
| `npx tsx $SKILL/limrun-cli.ts destroy` | Delete the instance |

| `npx tsx $SKILL/limrun-cli.ts daemon-stop` | Stop the background daemon |

The daemon starts automatically on first command. All subsequent commands reuse the same WebSocket connections. Use `daemon-stop` when you're done or to force a reconnection.

## Setup (one-time per session)

1. **Install CLI deps**:

   ```bash
   cd ${CLAUDE_SKILL_DIR} && yarn install
   ```

2. **Check `LIM_API_KEY`** is set. If not, tell the user:
   > "Set your Limrun API key: `export LIM_API_KEY=<key>` (get one from <https://console.limrun.com>)"

3. **Create the instance**:

   ```bash
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts init
   ```

   This prints the **Instance ID** and **Simulator URL**. Share the simulator URL with the user immediately so they can watch live.

   You can always retrieve these later with:

   ```bash
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts status
   ```

## Workflow: Sync, Build, Run

### Sync and Build

```bash
npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts sync ./<ProjectFolder>
npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts build
```

If build fails: read errors, fix code, re-sync, rebuild. Do NOT give up after one failure. Iterate until it compiles.

### Launch and Verify

After a successful build:

1. **Launch the app**:

   ```bash
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts launch <bundleId>
   ```

2. **Inspect the element tree** to verify state and find elements:

   ```bash
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts element-tree
   ```

   Use the element tree as your **primary** verification method -- it's faster and more reliable than screenshots. Check for element existence, labels, and hierarchy.

3. **Interact with the app**:

   ```bash
   # Preferred: tap by accessibilityIdentifier
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts tap-element startButton

   # Tap by visible label text
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts tap-label "Save"

   # Last resort: tap at exact coordinates
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts tap 201 450
   ```

   After tapping, re-run `element-tree` to confirm the UI transitioned correctly.

4. **Use screenshots only as a fallback** when element tree is insufficient (colors, gradients, animations, layout positioning):

   ```bash
   npx tsx ${CLAUDE_SKILL_DIR}/limrun-cli.ts screenshot
   # prints: /tmp/limrun-screen.jpg
   ```

   Then call `Read` on `/tmp/limrun-screen.jpg` to view it.

5. If something is wrong: fix code, sync, build, re-launch, re-verify.

### Functional Testing

After every build, **always test new/changed functionality** with a lightweight bash test script. Keep tests fast and focused -- only cover what changed plus a quick smoke test of core flows. Don't re-test unchanged features exhaustively.

**Testing strategy:**

- **Element tree** for functional assertions (element existence, labels, state changes, sizes, positions). This is fast and reliable.
- **Screenshots** only for visual-only properties (colors, gradients, layout aesthetics, animations) that the element tree can't capture.
- **Direct CLI calls** (not REPL) for the test script -- simpler and the output is captured cleanly in bash variables.

**Key rules:**

- Always `sleep 2` after `launch` -- the app needs time to render before `element-tree` returns meaningful results.
- Use `$CLI tap-element <id>` then `$CLI element-tree` as the core tap->assert loop. No sleep needed between these.
- Use `PASS=$((PASS + 1))` not `((PASS++))` -- the latter returns exit code 1 when the variable is 0.

## Important Reminders

- **Prefer element-tree over screenshots** for verification.
- **If a build fails 3+ times on the same error**, explain the error and ask the user how they'd like to proceed.
- **ALWAYS clean up when done.** When the user is satisfied or the conversation is ending, run `destroy` to delete the instance. Unused instances cost money.
- **Don't fix Swift code yourself** beyond what's needed for build errors. For design, architecture, or performance improvements, defer to the appropriate sibling skill.
