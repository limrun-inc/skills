---
name: ios-app-builder
description: "Build and test iOS apps on Limrun cloud iOS simulators and Xcode sandboxes. TRIGGER when user wants to build, run, or test an iOS app on a cloud simulator. Do NOT trigger for general Swift questions or local builds."
---

# Limrun iOS Cloud Build & Simulator

This skill handles **Limrun cloud infrastructure only**: creating simulators, syncing code, building, and interacting with the remote simulator. It does NOT dictate how the user writes Swift code, structures their project, or designs their app.

**IMPORTANT: All iOS builds and iOS simulator operations MUST run on Limrun.** Do NOT attempt to use local Xcode, local simulators, or any local macOS build tools. Never suggest installing Xcode locally or running `xcodebuild` on the user's machine.

## Architecture

A background daemon (`limrun-daemon.ts`) holds WebSocket connections to the simulator and sandbox. The CLI (`limrun-cli.ts`) is a thin client that sends commands to the daemon over a Unix socket. The daemon starts automatically on first CLI use and stays alive, so every command reuses the same connections — no reconnection overhead.

## Locating the CLI

The CLI scripts live in the `scripts/` subdirectory of this skill. Determine the absolute path to this skill's directory and set:

```bash
SKILL="<absolute-path-to-.agents/skills/ios-app-builder>"
```

For example, if the repo root is `/home/user/project`:

```bash
SKILL="/home/user/project/.agents/skills/ios-app-builder"
```

All CLI commands use:

```bash
npx tsx $SKILL/scripts/limrun-cli.ts <command> [args...]
```

## CLI Commands

Run from anywhere. Install deps once: `cd $SKILL && yarn install`

| Command | What it does |
| ------- | ------------ |
| `npx tsx $SKILL/scripts/limrun-cli.ts init` | Create iOS instance with Xcode sandbox. Prints instance ID and simulator URL |
| `npx tsx $SKILL/scripts/limrun-cli.ts sync <folder>` | Sync project folder to sandbox |
| `npx tsx $SKILL/scripts/limrun-cli.ts build` | Build with xcodebuild (streams output) |
| `npx tsx $SKILL/scripts/limrun-cli.ts launch <bundleId>` | Launch (or relaunch) app on the simulator |
| `npx tsx $SKILL/scripts/limrun-cli.ts screenshot [path]` | Save screenshot to path (default: `/tmp/limrun-screen.jpg`), prints path |
| `npx tsx $SKILL/scripts/limrun-cli.ts tap <x> <y>` | Tap at coordinates |
| `npx tsx $SKILL/scripts/limrun-cli.ts tap-element <axId>` | Tap element by `accessibilityIdentifier` |
| `npx tsx $SKILL/scripts/limrun-cli.ts tap-label <label>` | Tap element by label text |
| `npx tsx $SKILL/scripts/limrun-cli.ts element-tree` | Print full accessibility element tree as JSON |
| `npx tsx $SKILL/scripts/limrun-cli.ts status` | Show instance ID and simulator URL |
| `npx tsx $SKILL/scripts/limrun-cli.ts destroy` | Delete the instance |
| `npx tsx $SKILL/scripts/limrun-cli.ts daemon-stop` | Stop the background daemon |

The daemon starts automatically on first command. All subsequent commands reuse the same WebSocket connections. Use `daemon-stop` when you're done or to force a reconnection.

## Setup (one-time per session)

1. **Install CLI deps**:

   ```bash
   cd $SKILL && yarn install
   ```

2. **Check `LIM_API_KEY`** is set. If not, tell the user:
   > "Set your Limrun API key: `export LIM_API_KEY=<key>` (get one from <https://console.limrun.com>)"

3. **Create the instance**:

   ```bash
   npx tsx $SKILL/scripts/limrun-cli.ts init
   ```

   This prints the **Instance ID** and **Simulator URL**. Share the simulator URL with the user immediately so they can watch live.

   You can always retrieve these later with:

   ```bash
   npx tsx $SKILL/scripts/limrun-cli.ts status
   ```

## Workflow: Sync, Build, Run

### Sync and Build

```bash
npx tsx $SKILL/scripts/limrun-cli.ts sync ./<ProjectFolder>
npx tsx $SKILL/scripts/limrun-cli.ts build
```

If build fails: read errors, fix code, re-sync, rebuild. Do NOT give up after one failure. Iterate until it compiles.

### Launch and Verify

After a successful build:

1. **Launch the app**:

   ```bash
   npx tsx $SKILL/scripts/limrun-cli.ts launch <bundleId>
   ```

2. **Inspect the element tree** to verify state and find elements:

   ```bash
   npx tsx $SKILL/scripts/limrun-cli.ts element-tree
   ```

   Use the element tree as your **primary** verification method — it's faster and more reliable than screenshots. Check for element existence, labels, and hierarchy.

3. **Interact with the app**:

   ```bash
   # Preferred: tap by accessibilityIdentifier
   npx tsx $SKILL/scripts/limrun-cli.ts tap-element startButton

   # Tap by visible label text
   npx tsx $SKILL/scripts/limrun-cli.ts tap-label "Save"

   # Last resort: tap at exact coordinates
   npx tsx $SKILL/scripts/limrun-cli.ts tap 201 450
   ```

   After tapping, re-run `element-tree` to confirm the UI transitioned correctly.

4. **Use screenshots only as a fallback** when element tree is insufficient (colors, gradients, animations, layout positioning):

   ```bash
   npx tsx $SKILL/scripts/limrun-cli.ts screenshot
   # prints: /tmp/limrun-screen.jpg
   ```

   Then read `/tmp/limrun-screen.jpg` to view it.

5. If something is wrong: fix code, sync, build, re-launch, re-verify.

### Functional Testing

After every build, **always test new/changed functionality** with a lightweight bash test script. Keep tests fast and focused — only cover what changed plus a quick smoke test of core flows. Don't re-test unchanged features exhaustively.

**Testing strategy:**

- **Element tree** for functional assertions (element existence, labels, state changes, sizes, positions). This is fast and reliable.
- **Screenshots** only for visual-only properties (colors, gradients, layout aesthetics, animations) that the element tree can't capture.
- **Direct CLI calls** (not REPL) for the test script — simpler and the output is captured cleanly in bash variables.

**Write a bash test script** in the project directory (e.g., `test-app.sh`). Structure:

```bash
#!/bin/bash
SKILL="<absolute-path-to-.agents/skills/ios-app-builder>"
CLI="npx tsx $SKILL/scripts/limrun-cli.ts"
PASS=0
FAIL=0

pass() { echo -e "  PASS $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  FAIL $1 -- $2"; FAIL=$((FAIL + 1)); }

# Helpers
has_element() { echo "$1" | grep -q "\"AXUniqueId\" : \"$2\""; }
has_label()   { echo "$1" | grep -q "\"AXLabel\" : \"$2\""; }

# Launch fresh, wait for app to load
$CLI launch com.app.AppName > /dev/null 2>&1
sleep 2

# Test flow: tap -> element-tree -> assert
TREE=$($CLI element-tree 2>&1)
has_label "$TREE" "Expected Label" && pass "Label present" || fail "Label present" "not found"

$CLI tap-element someButton > /dev/null 2>&1
TREE=$($CLI element-tree 2>&1)
has_element "$TREE" "expectedElement" && pass "Element appeared" || fail "Element appeared" "not found"

echo "Results: $PASS passed, $FAIL failed"
exit $FAIL
```

**Key rules:**

- Always `sleep 2` after `launch` — the app needs time to render before `element-tree` returns meaningful results.
- Use `$CLI tap-element <id>` then `$CLI element-tree` as the core tap→assert loop. No sleep needed between these.
- Use `PASS=$((PASS + 1))` not `((PASS++))` — the latter returns exit code 1 when the variable is 0.

## Xcode Project Template

When the user needs a **new** Xcode project from scratch, see [references/xcode-project-template.md](references/xcode-project-template.md) for the minimal boilerplate. `PBXFileSystemSynchronizedRootGroup` auto-discovers `.swift` files — no need to edit `project.pbxproj` when adding files.

Only use this template when creating a brand new project. If the user already has a project, sync and build it as-is.

## Important Reminders

- **Respect the user's code.** Do not impose Swift conventions, architecture patterns, or project structure. This skill is for Limrun infrastructure only.
- **Prefer element-tree over screenshots** for verification.
- **If a build fails 3+ times on the same error**, explain the error and ask the user how they'd like to proceed.
- **ALWAYS clean up when done.** When the user is satisfied or the conversation is ending, run `destroy` to delete the instance. Unused instances cost money.
