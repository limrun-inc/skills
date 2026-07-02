---
name: limrun-xcode
description: "Build an iOS / Apple app on remote Xcode with `lim xcode build` instead of local xcodebuild, from any environment (Linux, Windows, macOS, VM, container). Use for non-Bazel projects (an `.xcodeproj` / `.xcworkspace`, React Native / Expo native build) when the user wants to build, compile, reload, or produce a preview build. To run, tap, screenshot, or otherwise interact with the result on a simulator, use limrun-ios-simulator. For Bazel workspaces, use limrun-xcode-bazel."
user-invocable: true
effort: high
---

# Remote Xcode build

Build Apple projects on Limrun's remote Xcode, from any environment (Linux,
Windows, macOS, VM, container). `lim xcode build` syncs your sources to a remote
Xcode instance, builds there, and (when a simulator is attached) installs and
relaunches the app. Never fall back to local Xcode, local simulators, or local
build tools. Your job doesn't end at a green build: get the app running, verify
it works, and iterate until the user is satisfied.

For driving the app once it's running (tap, type, element tree, screenshot,
record), use the **`limrun-ios-simulator`** skill. For Bazel workspaces, use
**`limrun-xcode-bazel`** instead of this skill.

## Auth and CLI

Install if needed: `npm install --global lim`. Auth is `lim login` or
`LIM_API_KEY` (it may be set outside the project, so don't ask for it just
because it's missing from `.env` or the shell). The CLI is the source of truth:
the commands in this skill are verified, but if a flag errors or you need one
not shown here, check `--help` instead of guessing:

```bash
lim xcode --help
lim xcode build --help
```

## Build

Instead of `xcodebuild`, build with:

```bash
lim xcode build .
```

This creates or reuses the remembered Xcode target, syncs the current directory,
and streams the build logs through stdout and stderr.

Use `--scheme` and `--workspace` if the project has multiple schemes or uses a
workspace file:

```bash
lim xcode build . --scheme MyApp --workspace MyApp.xcworkspace
```

Use `--configuration Debug` or `--configuration Release` for a specific Xcode
configuration. If omitted, Limrun uses limbuild's project-type default: `Debug`
for native Xcode builds, `Release` for React Native / Expo builds.

```bash
lim xcode build . --configuration Debug
```

`--dev-server-url` is only supported with `--configuration Debug` for React
Native / Expo builds. It's a post-install launch URL: limbuild validates it is a
parseable absolute URL, then opens it unchanged after installing on the attached
simulator. Framework-specific skills construct the correct URL.

```bash
lim xcode build . --configuration Debug --dev-server-url '<absolute-url>'
```

If the app launches without using the expected URL, open it explicitly to
separate build/install issues from URL routing:

```bash
lim ios open-url --id <ios-instance-id> '<absolute-url>'
```

## Run on a simulator

`lim xcode build` is build-and-install. Don't attach a simulator until the user
needs to see or interact with the app. Check / attach:

```bash
lim xcode get             # is a simulator already attached?
lim ios create --attach   # attach one (installs the last build immediately)
```

If the attach output includes a signed stream URL, share it with the user as a
Markdown link, such as [Live simulator](<signed-stream-url>).

When a simulator is attached, every successful `lim xcode build` automatically
reinstalls and relaunches the app, no separate install step. To tap, type, read
the element tree, screenshot, or record, switch to **`limrun-ios-simulator`**.

## Preview builds

Only create a reusable preview asset when the user asks for a preview build or
when you're opening a PR. Build and upload:

```bash
ASSET_NAME="<bundle id / pr number / or any session identifier>.zip"
lim xcode build . --upload ${ASSET_NAME}
# Debug preview build:
lim xcode build . --configuration Debug --upload ${ASSET_NAME}
```

Then construct the preview link and include it in your last message (and in the
PR, if you're opening one):

```
https://console.limrun.com/preview?asset=${ASSET_NAME}&platform=ios
```

## Gotchas

- **Build errors are your job to fix.** If a build fails, read the error output,
  fix the code, and rebuild. Don't ask the user to fix build errors.
- **Instance ID for `lim ios` commands.** They resolve the current instance
  from the git worktree of your cwd and can fail with `No instance ID provided
  and no recent ios instance found`. Get the ID from `lim xcode get` and pass
  `--id <ios-instance-id>`; full recipe in limrun-ios-simulator's "Targeting
  the right instance" section.
- **Bundle ID discovery.** If you don't know the bundle ID, check the Xcode
  project files or run `lim ios list-apps` after a successful build.
- **Auth errors** on an authenticated command mean the session expired or
  `LIM_API_KEY` is wrong; ask the user to run `lim login` or provide a key.
