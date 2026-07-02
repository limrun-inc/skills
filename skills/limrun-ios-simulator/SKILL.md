---
name: limrun-ios-simulator
description: "Drive an app running on a Limrun cloud iOS simulator: launch, tap, type, read the accessibility element tree, screenshot, record video, and run timed action chains. Use after a build (from any builder) when the user wants to see, test, or interact with their app on a simulator, or says 'show me a screenshot', 'tap', 'run the UI test', 'record a video', or 'launch on simulator'. To build the app first, use limrun-xcode-bazel (Bazel workspaces) or limrun-xcode (xcodebuild projects)."
user-invocable: true
effort: high
---

# Limrun iOS Simulator

Interact with an app running on a Limrun cloud iOS simulator, from any
environment (Linux, Windows, macOS, VM, container). This skill is build-agnostic:
it assumes the app was already built and installed by a build skill
(`limrun-xcode-bazel` for Bazel, `limrun-xcode` for xcodebuild). Keep build
concerns in those skills; this one is about driving the running simulator.

Never use local Xcode, local simulators, or local macOS tools.

## Auth and CLI

Install if needed: `npm install --global lim`. Auth is `lim login` or
`LIM_API_KEY` (it may be set outside the project, so don't ask for it just
because it's missing from `.env` or the shell). The CLI is the source of truth:
the commands in this skill are verified, but if a flag errors or you need one
not shown here, check `lim ios <subcommand> --help` instead of guessing.

## Get a simulator attached

A build skill usually attaches the simulator for you (`lim xcode rbe --ios`, or
`lim xcode build .` then attach). Check what's already there:

```bash
lim xcode get      # is a simulator attached to the current build target?
lim ios list       # all running iOS instances
```

If none is attached, create one. It installs the last build immediately, so you
don't need to rebuild:

```bash
lim ios create --attach
```

If the create (or `lim xcode rbe --ios`) output includes a signed stream URL,
share it with the user as a Markdown link, like
[Live simulator](<signed-stream-url>). If you have a browser the user can see,
open the URL there and tell them.

`lim xcode get` prints a Limrun console URL instead. It opens the same live
view but requires a console login, so prefer the signed stream URL for sharing.
If the console URL is all you have, share it and mention it needs login.

## Targeting the right instance

Most `lim ios` commands default to the last created instance and resolve the
"current" one from the **git repo / worktree** of your cwd. So even when a
simulator is attached and `lim xcode get` shows it, a `lim ios` command can still
report `No instance ID provided and no recent ios instance found`, because your
cwd isn't the git worktree where the instance was created (or isn't a git repo at
all). This bites most often right after `lim xcode rbe --ios` in a fresh project.

The reliable recipe when that happens:

```bash
lim xcode get                          # shows the attached simulator's ID
lim ios element-tree --id <that-id>    # pass --id to EVERY lim ios command
```

`lim xcode get` is the dependable source for the attached simulator's ID
(`lim ios list` also works). Once you have it, pass `--id <ios-instance-id>` to
all `lim ios` calls for the rest of the session (screenshot, tap, type,
element-tree, record). Alternatively, `git init` the project so the workspace
resolves on its own. When controlling multiple instances, always pass `--id`.

## Launching the app

The build skills reinstall and relaunch the app after every successful build,
so you usually don't need to launch it yourself. When the app is closed (a
fresh attach to an old build, or after a terminate), launch it by bundle ID:

```bash
lim ios launch-app <bundle-id>                            # foregrounds it if already running
lim ios launch-app <bundle-id> --mode RelaunchIfRunning   # restart for a clean state
lim ios terminate-app <bundle-id>                         # stop it, e.g. to reset app state
```

If you don't know the bundle ID, run `lim ios list-apps`.

## Testing changes

When simulator interaction is part of the task, test new or changed
functionality with the interaction commands after each build. Focus on what
changed, plus a quick smoke test of core flows. Start by reading the element
tree to see what's on screen before acting:

```bash
lim ios element-tree
```

## Interacting with the app

Prefer tapping by accessibility id, then by label, then coordinates as a last
resort:

```bash
lim ios tap-element --ax-unique-id startButton
lim ios tap-element --ax-label "Save"
lim ios tap 201 450
```

**Toolbar / nav-bar items usually can't be tapped by id.** SwiftUI collapses
toolbar children into a single nav-bar group, and those items report
`AXUniqueId: null` even when you set `.accessibilityIdentifier(...)` (regular
content `Button`s do expose it). So `tap-element --ax-unique-id` finds nothing
for a nav-bar button. Set an `.accessibilityLabel` / `.accessibilityIdentifier`
anyway for documentation, but to actually tap it, read its `AXFrame` from the
element tree and tap the center by coordinate:

```bash
lim ios element-tree --id <id> | grep -i -A6 -B2 moon   # find the item's AXFrame
lim ios tap <x> <y> --id <id>                           # tap the frame's center
```

For text input:

```bash
lim ios type "hello world"
```

After every interaction, re-run `element-tree` to confirm the UI transitioned.
No sleep is needed between a tap and `element-tree`; the tap blocks until done.

```bash
lim ios element-tree
```

Chain multiple actions with precise timing via `perform`:

```bash
lim ios perform --action type=tap,x=100,y=200 --action "type=typeText,text=Hello World"
lim ios perform --action type=wait,durationMs=1000 --action type=pressKey,key=enter
lim ios perform --file ./actions.yaml
```

Run `lim ios perform --help` for the full action grammar.

## Screenshots and video

Screenshot takes a **positional path** (not `-o`):

```bash
lim ios screenshot screenshot.png
lim ios screenshot screenshot.png --id <ios-instance-id>
```

Use the element tree for functional assertions (element existence, labels, state
changes) and screenshots only for visual properties. For anything involving
motion (animations, gameplay, streaming UI), prefer video:

```bash
lim ios record start                       # non-blocking
lim ios record stop -o /tmp/recording.mp4
```

For UI changes, include a demo video in the pull request so the user can see it.

## Cleanup

When the user is done with the dev session:

```bash
lim ios delete
```

If they're still iterating in a dev-client / Metro session, leave the simulator
running and tell them it's still available.

## Gotchas

- **Instance resolution can miss in a non-git dir.** See "Targeting the right
  instance" above; pass `--id` when in doubt.
- **`element-tree` can be large.** Pipe through `grep` / `jq` to extract what you
  need rather than dumping the whole tree into context.
- **`type` / `perform typeText` may not drive SwiftUI (or React Native) state.**
  Automated text injection sets the field's value through accessibility, which
  does **not** always fire a SwiftUI `@Binding` / `onChange` the way a real
  keystroke does. Symptom: the text appears in the field (and in `element-tree`),
  but reactive UI tied to it doesn't update (a send button stays disabled, a
  character counter doesn't move) and submit handlers see empty state. A real
  keyboard on the live stream works. When automating, drive submit through a
  tappable control (a button, a suggestion chip) rather than relying on text
  bound to reactive state, or have the app expose a test affordance.
- **Toolbar / nav-bar items aren't tappable by id.** See "Interacting with the
  app" above: read the `AXFrame` from `element-tree` and tap by coordinate.
- **Bundle ID discovery.** If you don't know the bundle ID, run
  `lim ios list-apps` after a successful install.
- **Build errors are the build skill's job.** If the app isn't installing, the
  failure is upstream; go back to `limrun-xcode-bazel` / `limrun-xcode`.
