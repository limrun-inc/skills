---
name: limrun-ios-simulator
description: "Drive an app running on a Limrun cloud iOS simulator: launch, tap, type, read the accessibility element tree, read app logs and simulator syslog, screenshot, record video, connect the app to local services or a private tunnel, play a video file as the camera, send all traffic through the user's proxy and trust its CA, set the clipboard, read and write user defaults, post notifications, and run timed action chains. Use after a build (from any builder) when the user wants to see, test, or interact with their app on a simulator, or says 'show me a screenshot', 'tap', 'run the UI test', 'record a video', 'read the logs', 'connect localhost', 'reach my local server from the simulator', 'route all traffic through my proxy', 'trust my CA', 'mock the camera', 'paste into the app', 'change the language', 'simulate Face ID', or 'launch on simulator'. To build the app first, use limrun-xcode-bazel (Bazel workspaces) or limrun-xcode (xcodebuild projects)."
user-invocable: true
effort: high
---

# Limrun iOS Simulator

Interact with an app running on a Limrun cloud iOS simulator, from any
environment (Linux, Windows, macOS, VM, container). This skill is build-agnostic:
it assumes the app was already built and installed by a build skill
(`limrun-bazel` for Bazel, `limrun-xcode` for xcodebuild). Keep build
concerns in those skills; this one is about driving the running simulator.

Never use local Xcode, local simulators, or local macOS tools.

## Auth and CLI

Install if needed: `npm install --global lim`. Auth is `lim login` or
`LIM_API_KEY` (it may already be set in the user's environment even when `.env` and the shell do not show it; check before asking for it). The CLI is the source of truth:
the commands in this skill are verified, but if a flag errors or you need one
not shown here, check `lim ios <subcommand> --help` instead of guessing.

## Installing an app bundle

You can either use Limrun remote Bazel or Xcode services to build the app bundle and have
it installed to the simulator automatically or you can sync a pre-built local `.ipa`
file or `.app` folder to the simulator. The main requirement is that it must be
built for simulator.

### Build and install

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
`[Live simulator](<signed-stream-url>)`. If you have a browser the user can see,
open the URL there and tell them. Otherwise pass `--no-open` to `create`: it
skips opening the URL locally and still prints it for sharing.

`lim xcode get` prints a Limrun console URL instead. It opens the same live
view but requires a console login, so prefer the signed stream URL for sharing.
If the console URL is all you have, share it and mention it needs login.

### Install app from local

Create a new simulator:

```bash
lim ios create
```

Share the signed stream URL with the user as a Markdown link, like
`[Live simulator](<signed-stream-url>)`. If you have a browser the user can see,
open the URL there and tell them.

You can then run the following command to upload a bundle from local:

```bash
lim ios sync <path to .ipa file or .app folder>
```

You can run the same command every time you need to install a new version of the
bundle. It will patch with the difference and reload it in the simulator.

## Fold an iPhone Duo

For the foldable iPhone Duo model (`lim ios create --model iphone-duo`,
`lim ios fold`, `--display inner`), read `references/iphone-duo.md`.

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

## Network: local services, private tunnels, proxies, and CAs

`localhost` inside the simulator is not the user's machine. To connect the app
to a local or VPN-only service (`lim ios tunnel`), inspect its HTTP traffic or
capture a HAR, or use an organization's private tunnel (`lim ios create
--tunnel`), read `references/tunnels.md`. To send all device traffic through the
user's proxy (`lim ios proxy set`) or trust a CA certificate (`lim ios ca add`),
read `references/proxy-and-ca.md`.

## Launching the app

The build skills reinstall and relaunch the app after every successful build,
so you usually don't need to launch it yourself. When the app is closed (a
fresh attach to an old build, or after a terminate), launch it by bundle ID:

```bash
lim ios launch-app <bundle-id>                            # foregrounds it if already running
lim ios launch-app <bundle-id> --mode RelaunchIfRunning   # restart for a clean state
lim ios launch-app <bundle-id> --env API_URL=https://api.example.com --env FEATURE_FLAG=1
lim ios terminate-app <bundle-id>                         # stop it, e.g. to reset app state
```

If you don't know the bundle ID, run `lim ios list-apps`.

`--env KEY=VALUE` is repeatable and restarts the app so the variables take effect.
An explicit `--mode ForegroundIfRunning` with variables is rejected. Use `KEY=`
for an empty value; the last occurrence of a key wins. Managed Detox launches
can combine `--runtime detox` with `--env`.

`launch-app` streams the app's logs and returns when the app exits or the
command is interrupted. Pass `--detach` to launch and return immediately.
When the app ends, `launch-app` prints the exit reason (`crash`, `exit`, or
`terminated`). After a crash it adds the exception and signal, the crash
message (for example a Swift `Fatal error` line or an uncaught exception's
reason), and the crashed thread's frames with the app's own function names.
That report is the way to see why an app died; frames carry no file and line,
which need the build's dSYM (`atos -l <load address>` with the address from
the report's `Binary Images` lines).

A React Native or Expo red error screen is not an exit: the app process keeps
running, so nothing is reported. In the TypeScript SDK, `launchApp`'s
`onExit(logs, info)` gets the same report, and `watchApp(bundleId, onExit)`
reports the next exit of an app you did not launch, for example one opened
with `lim ios open-url`.

## App logs

Log commands print recent lines and exit. Pass `--follow` only to keep
streaming until interrupted.

```bash
lim ios launch-app <bundle-id> --detach   # launch and return, no log stream
lim ios app-log <bundle-id>               # last 100 lines, then exit
lim ios app-log <bundle-id> --tail 100    # last N lines
lim ios app-log <bundle-id> --follow      # stream until interrupted
lim ios syslog                            # up to 100 captured syslog lines, then exit
lim ios syslog --follow                   # stream simulator syslog
```

Syslog snapshots read the buffer filled by the current or an earlier syslog
stream. An empty buffer returns no lines. Snapshot reads need a runtime with
`syslogTail` support.

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

`tap-element` taps with a real synthesized touch. Elements the accessibility
tree can see are scrolled into view automatically. A selector that matches
nothing in the tree fails in about a second; iOS creates list rows lazily, so
a below-the-fold row often isn't in the tree at all. For those, pass
`--scroll-search`: the CLI pages the screen (a few pages down, then up)
retrying the tap until the row materializes, which can take ~10s. Pass
`--activate ax` to use an accessibility press instead of a touch (no
scrolling, works on elements without a usable frame).

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

For text input, focus a field first (tap it), then type:

```bash
lim ios type "hello world"     # real key events; errors if no field is focused
lim ios type "hi" --no-require-focus  # skip the focus check: for fields focused by coordinate taps when the accessibility focus scan is unreliable
lim ios press-key backspace
lim ios press-key @            # shifted symbols work directly
```

`type` presses real keys, so text delegates fire and the field's own keyboard
behavior applies (a default text field autocapitalizes the first letter, for
example). To set a value verbatim with no keyboard behavior, use `set-text`:

```bash
lim ios set-text "P@ssw0rd!" --focused                 # into the focused field
lim ios set-text "hello" --ax-unique-id emailField     # by selector
```

For scrolling and drags:

```bash
lim ios scroll down --amount 300                       # from the screen center
lim ios scroll down --amount 300 --coordinate 200,400  # from a specific point
lim ios swipe --from 200,600 --to 200,200              # explicit drag; --duration 800 for a slower, precise one
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
lim ios screenshot app-store.png --format png --size full --id <ios-instance-id>
```

Use `--format png --size full` for a full-resolution PNG without alpha, including screenshots intended for store uploads. Combine it with `--display inner` or `--display outer` on Duo. The SDK equivalent is `client.screenshot({ format: 'png', size: 'full' })`; it returns base64 PNG data and pixel dimensions. `--format` accepts `jpeg` or `png` and defaults to `jpeg`. `--size` accepts `scaled` or `full` and defaults to `scaled`. Choose them independently. `scaled` uses point dimensions; `full` preserves native pixel resolution. Tap coordinates remain in points, so use `tapWithScreenSize` for coordinates measured in a native screenshot.

Use the element tree for functional assertions (element existence, labels, state
changes) and screenshots only for visual properties. For anything involving
motion (animations, gameplay, streaming UI), prefer video:

```bash
lim ios record start                       # non-blocking
lim ios record stop -o /tmp/recording.mp4
```

For UI changes, include a demo video in the pull request so the user can see it.

## App files, camera, clipboard, user defaults, and Face ID

Read `references/device-state.md` to list, pull, push, or delete files in an
app's container (`lim ios ls`, `lim ios pull-file`, `lim ios push-file`), play
a video file as the camera (`lim ios camera play`), set or read the clipboard
(`lim ios clipboard`), change user defaults such as the device language
(`lim ios defaults`), or post Darwin notifications such as a Face ID match
(`lim ios notify`).

## Preview URL for humans

Upload the `.ipa` file directly or targz archive of the `.app` folder
to Limrun Asset Storage and return a preview URL for the user to open it and
test the app manually in the browser.

Here is how to upload it:
```bash
export ASSET_NAME=myapp.tar.gz # can be any name
lim asset push ${ASSET_NAME}

echo "https://console.limrun.com/preview?asset=${ASSET_NAME}&platform=ios"
```

Once the command finishes, you can give the following URL to the user to
click to open a simulator stream while the console installs this bundle.

```
https://console.limrun.com/preview?asset=${ASSET_NAME}&platform=ios
```

For nonsecret iOS app configuration, append repeatable URL-encoded `env=KEY=VALUE`
parameters, for example `&env=FEATURE_FLAG%3D1&env=API_URL%3Dhttps%3A%2F%2Fapi.example.com`.
Use `URLSearchParams.append("env", "KEY=VALUE")` when constructing links. The app
receives these variables on its first launch. Values are visible in the link
and browser history.

Add `openUrl` to open a URL or app deep link after launch, for example
`&openUrl=myapp%3A%2F%2Fcheckout`. Use `URLSearchParams.set("openUrl", url)` to
encode the full URL and its query string. This works with or without `env`;
the stream stays visible while the app installs, launches, and opens the URL.
An `Installing <asset name>` overlay shows installation progress and disappears
when the preview is ready.

## Cleanup

When the work is completed, you can delete the iOS simulator.

```bash
lim ios delete
```

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
  failure is upstream; go back to `limrun-bazel` / `limrun-xcode`.
