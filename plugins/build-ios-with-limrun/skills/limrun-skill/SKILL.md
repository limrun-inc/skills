---
name: limrun-skill
description: "Provision and operate Limrun cloud iOS simulators and Xcode sandboxes — sync code, build, launch, interact with UI, and capture screenshots on a remote simulator. TRIGGER when user wants to build, run, or test an iOS app and a cloud simulator is needed (no local Xcode/simulator available or user explicitly requests Limrun)."
user-invocable: true
effort: high
---

# Limrun iOS Cloud Build & Simulator

## Overview

Provision and operate **Limrun cloud iOS simulators** so the user can build, run, and interact with their iOS app without local Xcode or a local simulator. This skill owns the full cloud-infrastructure lifecycle: instance creation, code syncing, building, launching, UI interaction, screenshots, and teardown.

All operations use the **`lim` CLI** (`@limrun/cli`).

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

## Step 0: Verify CLI and API Key (MANDATORY)

**Before running ANY other command**, verify `lim` is available. Run this at the start of every session:

```bash
lim --version
```

If `lim` is not found, install it: `npm install -g @limrun/cli`

Then verify the API key:

```bash
if [ -z "$LIM_API_KEY" ]; then
  echo "ERROR: LIM_API_KEY is not set."
  echo "Get an API key from https://console.limrun.com and set it:"
  echo "  export LIM_API_KEY=<your-key>"
  exit 1
fi
```

If `LIM_API_KEY` is not set, stop and tell the user:
> "Set your Limrun API key: `export LIM_API_KEY=<key>` (get one from <https://console.limrun.com>)"

## Architecture

The `lim` CLI uses a **session/daemon** pattern for fast device interaction:

- `lim session start <id>` spawns a background daemon that holds a persistent WebSocket connection to the simulator
- All `lim exec` commands route through the daemon when a session is active (~50ms latency vs ~2s cold connect)
- `lim sync` and `lim build` use HTTP/SSE directly (no session needed for these)
- Each instance gets its own independent daemon, so **multiple simulators can be controlled simultaneously**

## CLI Commands Reference

All `--json` flag outputs structured JSON. All commands accept `--api-key` (or env `LIM_API_KEY`).

### Authentication

| Command | What it does |
| ------- | ------------ |
| `lim login` | Open browser to authenticate, stores API key locally |
| `lim logout` | Remove stored API key |

### Instance Creation (`run`)

**iOS** (most common for this skill):

```
lim run ios [flags] --json
```

| Flag | Description |
| ---- | ----------- |
| `--xcode` | Enable Xcode sandbox (required for sync/build) |
| `--model <iphone\|ipad\|watch>` | Device model |
| `--reuse-if-exists` | Reuse existing instance with same labels/region |
| `--rm` | Delete instance on exit (waits for SIGINT) |
| `--display-name <name>` | Display name |
| `--region <region>` | Region to create in |
| `--hard-timeout <duration>` | Hard timeout (e.g. 1h, 30m) |
| `--inactivity-timeout <duration>` | Inactivity timeout (default: 3m) |
| `--label <key=value>` | Labels (repeatable) |
| `--install <path>` | Local file to install on creation (repeatable) |
| `--install-asset <name>` | Asset name to install on creation (repeatable) |

**Android:**

```
lim run android [flags] --json
```

Same flags as iOS plus:

| Flag | Description |
| ---- | ----------- |
| `--connect` / `--no-connect` | ADB tunnel (default: true) |
| `--stream` / `--no-stream` | scrcpy streaming (default: true) |
| `--adb-path <path>` | Path to adb binary (default: adb) |

**Xcode** (standalone sandbox, no simulator):

```
lim run xcode [flags] --json
```

Supports: `--rm`, `--display-name`, `--region`, `--hard-timeout`, `--inactivity-timeout`, `--label`, `--reuse-if-exists`

### Instance Listing (`get`)

| Command | What it does |
| ------- | ------------ |
| `lim get ios [ID]` | List iOS instances or get one by ID |
| `lim get android [ID]` | List Android instances or get one by ID |
| `lim get xcode [ID]` | List Xcode instances or get one by ID |
| `lim get asset [ID]` | List assets or get one by ID |

Listing flags: `--state <state>`, `--region <region>`, `--label-selector <selector>`, `--all` (show all states, not just ready)

Asset flags: `--name <name>`, `--download-url`, `--upload-url`

### Instance Deletion (`delete`)

| Command | What it does |
| ------- | ------------ |
| `lim delete <ID>` | Auto-detect type from ID prefix and delete |
| `lim delete ios <ID>` | Delete iOS instance |
| `lim delete android <ID>` | Delete Android instance |
| `lim delete xcode <ID>` | Delete Xcode instance |
| `lim delete asset <ID>` | Delete asset |

### Asset Management

| Command | What it does |
| ------- | ------------ |
| `lim push <file> [-n name]` | Upload a file as an asset |
| `lim pull <id-or-name> [-o dir]` | Download an asset to local directory |

### Connection

| Command | What it does |
| ------- | ------------ |
| `lim connect android <ID> [--adb-path path]` | ADB tunnel to existing Android instance |

### Code Sync & Build

| Command | What it does |
| ------- | ------------ |
| `lim sync <ID> <folder>` | Sync project folder to Xcode sandbox |
| `lim sync <ID> <folder> --no-watch` | Sync once without watching for changes |
| `lim sync <ID> <folder> --no-install` | Sync without installing dependencies |
| `lim build <ID>` | Build with xcodebuild (streams output) |
| `lim build <ID> --scheme <name>` | Build a specific scheme |
| `lim build <ID> --workspace <file>` | Specify workspace file |
| `lim build <ID> --project <file>` | Specify project file |
| `lim build <ID> --upload <name>` | Upload build artifact as asset |

### Session Management

| Command | What it does |
| ------- | ------------ |
| `lim session start <ID>` | Start persistent session (~50ms exec latency vs ~2s) |
| `lim session stop [ID]` | Stop session (or auto-detect if only one) |
| `lim session stop --all` | Stop all active sessions |
| `lim session status --json` | Show all active sessions |

### Device Interaction (`exec`)

All exec commands work with both Android and iOS unless noted.

**Screenshots & Recording:**

| Command | What it does |
| ------- | ------------ |
| `lim exec screenshot <ID> -o <path>` | Save screenshot to file |
| `lim exec record <ID> start [--quality 5-10]` | Start video recording |
| `lim exec record <ID> stop [-o file]` | Stop recording, save to file |

**Tapping:**

| Command | What it does |
| ------- | ------------ |
| `lim exec tap <ID> <x> <y>` | Tap at coordinates |
| `lim exec tap-element <ID> --accessibility-id <axId>` | Tap by accessibilityIdentifier |
| `lim exec tap-element <ID> --label <text>` | Tap by label text |
| `lim exec tap-element <ID> --resource-id <id>` | Tap by Android resource ID |
| `lim exec tap-element <ID> --text <text>` | Tap by Android text content |

**Text Input & Keys:**

| Command | What it does |
| ------- | ------------ |
| `lim exec type <ID> <text>` | Type text into focused input |
| `lim exec type <ID> <text> --press-enter` | Type text then press Enter (iOS) |
| `lim exec press-key <ID> <key>` | Press a key (enter, backspace, a, f1, etc.) |
| `lim exec press-key <ID> <key> --modifier shift` | Press with modifier (shift/command/alt, repeatable) |

**Navigation & Scrolling:**

| Command | What it does |
| ------- | ------------ |
| `lim exec scroll <ID> <up\|down\|left\|right>` | Scroll in direction (default 300px) |
| `lim exec scroll <ID> <direction> --amount 500` | Scroll with custom amount |
| `lim exec open-url <ID> <url>` | Open a URL on the device |

**UI Inspection:**

| Command | What it does |
| ------- | ------------ |
| `lim exec element-tree <ID> --json` | Full accessibility element tree as JSON |

**App Management (iOS only):**

| Command | What it does |
| ------- | ------------ |
| `lim exec launch-app <ID> <bundleId>` | Launch app (default: ForegroundIfRunning) |
| `lim exec launch-app <ID> <bundleId> --mode RelaunchIfRunning` | Force relaunch |
| `lim exec terminate-app <ID> <bundleId>` | Terminate a running app |
| `lim exec list-apps <ID>` | List installed apps |
| `lim exec install-app <ID> <path-or-url>` | Install app from file or URL |

**Logs (iOS only):**

| Command | What it does |
| ------- | ------------ |
| `lim exec log <ID> <bundleId> --lines 50` | Tail last N lines of app logs |
| `lim exec log <ID> <bundleId> --follow` | Stream logs continuously (Ctrl+C to stop) |

## Setup (one-time per session)

After Step 0 passes, set up the cloud instance:

1. **Create the instance and capture the ID**:

   ```bash
   INSTANCE_JSON=$(lim run ios --xcode --reuse-if-exists --label name=claude-ios-builder --json)
   INSTANCE_ID=$(echo "$INSTANCE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['metadata']['id'])")
   echo "Instance ID: $INSTANCE_ID"
   ```

   Share the simulator URL with the user so they can watch live:

   ```bash
   echo "Simulator URL: https://console.limrun.com/stream/$INSTANCE_ID"
   ```

2. **Start a session for fast device interaction**:

   ```bash
   lim session start $INSTANCE_ID
   ```

## Workflow: Sync, Build, Run

### Sync and Build

```bash
lim sync $INSTANCE_ID ./<ProjectFolder>
lim build $INSTANCE_ID
```

If build fails: read errors, fix code, re-sync, rebuild. Do NOT give up after one failure. Iterate until it compiles.

### Launch and Verify

After a successful build:

1. **Launch the app**:

   ```bash
   lim exec launch-app $INSTANCE_ID <bundleId>
   ```

2. **Inspect the element tree** to verify state and find elements:

   ```bash
   lim exec element-tree $INSTANCE_ID --json
   ```

   Use the element tree as your **primary** verification method -- it's faster and more reliable than screenshots. Check for element existence, labels, and hierarchy.

3. **Interact with the app**:

   ```bash
   # Preferred: tap by accessibilityIdentifier
   lim exec tap-element $INSTANCE_ID --accessibility-id startButton

   # Tap by visible label text
   lim exec tap-element $INSTANCE_ID --label "Save"

   # Last resort: tap at exact coordinates
   lim exec tap $INSTANCE_ID 201 450
   ```

   After tapping, re-run `element-tree` to confirm the UI transitioned correctly.

4. **Use screenshots only as a fallback** when element tree is insufficient (colors, gradients, animations, layout positioning):

   ```bash
   lim exec screenshot $INSTANCE_ID -o /tmp/limrun-screen.jpg
   ```

   Then call `Read` on `/tmp/limrun-screen.jpg` to view it.

5. If something is wrong: fix code, sync, build, re-launch, re-verify.

### Functional Testing

After every build, **always test new/changed functionality** with a lightweight bash test script. Keep tests fast and focused -- only cover what changed plus a quick smoke test of core flows. Don't re-test unchanged features exhaustively.

**Testing strategy:**

- **Element tree** for functional assertions (element existence, labels, state changes, sizes, positions). This is fast and reliable.
- **Screenshots** only for visual-only properties (colors, gradients, layout aesthetics, animations) that the element tree can't capture.

**Key rules:**

- Always `sleep 2` after `launch-app` -- the app needs time to render before `element-tree` returns meaningful results.
- Use `lim exec tap-element $ID --accessibility-id <id>` then `lim exec element-tree $ID --json` as the core tap->assert loop. No sleep needed between these.
- Use `PASS=$((PASS + 1))` not `((PASS++))` -- the latter returns exit code 1 when the variable is 0.

**Example test script:**

```bash
ID=$INSTANCE_ID

# Launch and wait for render
lim exec launch-app $ID com.example.MyApp
sleep 2

PASS=0
FAIL=0

# Test: main screen loads
TREE=$(lim exec element-tree $ID --json)
if echo "$TREE" | grep -q "welcomeLabel"; then
  echo "PASS: Main screen loaded"
  PASS=$((PASS + 1))
else
  echo "FAIL: Main screen did not load"
  FAIL=$((FAIL + 1))
fi

# Test: tap a button and verify navigation
lim exec tap-element $ID --accessibility-id startButton
TREE=$(lim exec element-tree $ID --json)
if echo "$TREE" | grep -q "detailView"; then
  echo "PASS: Navigated to detail view"
  PASS=$((PASS + 1))
else
  echo "FAIL: Did not navigate to detail view"
  FAIL=$((FAIL + 1))
fi

echo "Results: $PASS passed, $FAIL failed"
```

## Cleanup

**ALWAYS clean up when done.** When the user is satisfied or the conversation is ending:

```bash
lim session stop $INSTANCE_ID
lim delete ios $INSTANCE_ID
```

Unused instances cost money. The session stop is optional (deleting the instance cleans up the session automatically) but is good practice.

## Multi-Instance (Advanced)

The `lim` CLI supports controlling multiple simulators simultaneously. Each instance gets its own session daemon.

```bash
# Create two instances
INSTANCE1=$(lim run ios --xcode --label name=device-a --json | python3 -c "import sys,json; print(json.load(sys.stdin)['metadata']['id'])")
INSTANCE2=$(lim run ios --xcode --label name=device-b --json | python3 -c "import sys,json; print(json.load(sys.stdin)['metadata']['id'])")

# Start sessions for both
lim session start $INSTANCE1
lim session start $INSTANCE2

# Interact with each independently
lim exec screenshot $INSTANCE1 -o /tmp/screen1.jpg
lim exec screenshot $INSTANCE2 -o /tmp/screen2.jpg

# Clean up both
lim delete ios $INSTANCE1
lim delete ios $INSTANCE2
```

## Important Reminders

- **Always run Step 0 first.** Never skip the CLI installation check.
- **Prefer element-tree over screenshots** for verification.
- **If a build fails 3+ times on the same error**, explain the error and ask the user how they'd like to proceed.
- **ALWAYS clean up when done.** Run `lim delete ios $INSTANCE_ID` to delete the instance. Unused instances cost money.
- **Don't fix Swift code yourself** beyond what's needed for build errors. For design, architecture, or performance improvements, defer to the appropriate sibling skill.
