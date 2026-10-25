---
name: limrun-xcode
description: "Build an iOS / Apple app on remote Xcode with `lim xcode build` instead of local xcodebuild, run project commands with `lim xcode run`, or run its XCTest suites with `lim xcode test`, from any environment (Linux, Windows, macOS, VM, container). Use for non-Bazel projects (an `.xcodeproj` / `.xcworkspace`, an XcodeGen `project.yml` with a gitignored project, React Native / Expo native build) when the user wants to build, compile, run code generation or Make targets, test, inspect build logs, reload, produce a preview build, or ship a signed device IPA. To run, tap, screenshot, or otherwise interact with the result on a simulator, use limrun-ios-simulator. For Bazel workspaces, use limrun-xcode-bazel."
user-invocable: true
effort: high
---

# Remote Xcode build

Build Apple projects on Limrun's remote Xcode, from any environment (Linux,
Windows, macOS, VM, container). `lim xcode build` syncs your sources to a remote
Xcode instance, builds there, and (when a simulator is attached) installs and
relaunches the app. This workflow builds on the remote instance; local Xcode, local simulators,
and local build tools are not part of it. A finished run has the app running
and verified on a Limrun simulator.

For driving the app once it's running (tap, type, element tree, screenshot,
record), use the **`limrun-ios-simulator`** skill. For Bazel workspaces, use
**`limrun-bazel`** instead of this skill.

## Auth and CLI

Install if needed: `npm install --global lim`. Auth is `lim login` or
`LIM_API_KEY` (it may already be set in the user's environment even when `.env` and the shell do not show it; check before asking for it). The CLI is the source of truth:
the commands in this skill are verified, but if a flag errors or you need one
not shown here, check `--help` instead of guessing:

```bash
lim xcode --help
lim xcode build --help
lim xcode run --help
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

### Detached builds and logs

Use `--detach` to return once the build is accepted; a webhook is optional.
`logs` reads the latest build without an exec ID, including persisted logs after
instance deletion; add `--follow` to wait for completion.

```bash
lim xcode build . --detach
lim xcode logs
lim xcode logs --follow
```

### Pick the Xcode version

A sandbox builds with its node's default Xcode (26.4 today). To pin another
Xcode for the workspace (`lim xcode use xcode@27`, `lim xcode version set 27.1`)
or for one build (`--xcode-version 26`), read `references/xcode-versions.md`
first: switching changes the build cache, and App Store uploads need a GA Xcode.

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

## Disk snapshots

To reuse source files, dependencies, and DerivedData across Xcode instances
(`lim xcode create --snapshot-key`, usually in CI), read
`references/disk-snapshots.md`.

## Private dependency credentials

Copy existing credential files with `--additional-file`, also supported by `sync`:

```bash
lim xcode build . \
  --additional-file "$HOME/.npmrc=~/.npmrc" \
  --additional-file "$HOME/.netrc=~/.netrc"
```

Remote `~/` targets the sandbox home; other destinations are workspace-relative.
Repeat the flags on later syncs to retain the files. Pass `--env` for environment
variables referenced by the configuration.

## Developer tool versions

After syncing, `lim xcode use` selects tools in the sandbox and installs missing versions.
Run `lim xcode tools install` for synced project tool selections ([details](https://docs.limrun.com/docs/ios/build-with-xcode)). Use major versions, or major.minor for Ruby, Flutter, and pre-1.0 tools such as Mint.

```bash
lim xcode tools
# Node includes npm/npx, Ruby includes gem, Flutter includes Dart, CocoaPods includes cocoapods-patch.
lim xcode use node@24 pnpm@10 yarn@4 bun@1 ruby@3.3 bundler@4 cocoapods@1 \
  cmake@3 java@jetbrains-21 corretto@21 flutter@3.44 mint@0.18 \
  xcodegen@2 xcbeautify@3 zsign@1
lim xcode tools install
lim xcode use --cwd apps/mobile node@24
lim xcode tools install --cwd apps/mobile
lim xcode run -- mise use --pin node@24.5.0
```

## Run project commands

Use `lim xcode run [relative-cwd] -- <command>` when the repository needs a
remote macOS command before or outside `xcodebuild`. The CLI syncs the current
directory first. The working directory is relative to that synced root and
defaults to `.`:

```bash
lim xcode run -- make api
lim xcode run apps/api -- make generate
```

Pass environment variables before the delimiter. Use `--no-sync` only when the
same instance already has the source state you need:

```bash
lim xcode run --env API_ENV=development -- npm run generate
lim xcode run --no-sync -- make api
```

The sandbox includes Node, Ruby, CMake, Mint, mise, and Homebrew. Tool installs
made with mise, Mint, or Homebrew stay in the instance's sandbox home and
remain available on later commands on that instance:

```bash
lim xcode run -- 'mise trust && mise install'
lim xcode run -- 'mint install apollographql/apollo-ios-cli'
lim xcode run -- brew install tree
```

Commands are one-shot and non-interactive. There is no TTY or stdin channel.

## Generated Xcode projects (XcodeGen)

If the repo has a `project.yml` and the `.xcodeproj` is gitignored, do not run
xcodegen locally and do not treat the missing project as an error. The remote
sandbox generates the project from `project.yml` before building:

```bash
lim xcode build .
```

The spec is found at the repo root or one directory down (like `ios/`), no
flags needed. The project regenerates on every build, so `project.yml` edits
take effect by just rebuilding. A committed or force-synced `.xcodeproj`
always wins: the sandbox only generates when the sync didn't supply one.

If the repo's codegen produces gitignored inputs the build needs (a generated
local Swift package, config-derived sources), run that step locally first and
force-sync its output with `--include`:

```bash
make generate   # or whatever the repo's codegen step is
lim xcode build . --include '^ios/GeneratedKit/'
```

`--include` takes a regular expression like `--ignore`, not gitignore syntax.
To reach files under a directory that is ignored as a whole, the pattern must
also match the directory path itself, as above.

## Run on a simulator

`lim xcode build` is build-and-install. Don't attach a simulator until the user
needs to see or interact with the app. Check / attach:

```bash
lim xcode get             # is a simulator already attached?
lim ios create --attach   # attach one (installs the last build immediately)
```

Add `--no-open` when you have no browser to show the user; it skips opening
the stream URL locally and still prints it for sharing.

If the attach output includes a signed stream URL, share it with the user as a
Markdown link, such as `[Live simulator](<signed-stream-url>)`.

When a simulator is attached, every successful `lim xcode build` automatically
reinstalls and relaunches the app, no separate install step. To tap, type, read
the element tree, screenshot, or record, switch to **`limrun-ios-simulator`**.

## Run tests (XCTest)

`lim xcode test` builds the scheme's test targets on the sandbox, runs them on
an attached simulator (unit and UI targets alike), and streams one line per
test case. The exec exits non-zero when any test fails, so it works as a CI
gate.

```bash
lim xcode test .
lim xcode test ./MyProject --scheme MyApp
```

It auto-acquires a simulator-backed target like `lim xcode build --ios` and
reuses the instances on repeat runs, so iterating is fast. The scheme must
have a test action configured (shared schemes from Xcode have one when the
project has test targets). `--xcode-version 27` builds the tests with that
major's GA (`27.1` selects the beta); the simulator keeps the fleet default
runtime, so the run warns and proceeds (runtime-dependent failures are possible).

Select a subset with xcodebuild's identifier format
`Target[/Class[/method]]`; repeat the flag for multiple entries. The two flags
are mutually exclusive:

```bash
lim xcode test . --only-testing MyAppTests/LoginTests/testValidLogin
lim xcode test . --skip-testing MyAppUITests
```

A bare target name selects or skips that whole target. An `--only-testing`
entry naming a target the build did not produce fails the run instead of
silently running everything.

For machine consumption, `--json` streams the raw per-case events as NDJSON
and ends with a `{"exitCode": N}` record:

```bash
lim xcode test . --json > results.ndjson
```

`--build-only` compiles the test targets without acquiring a simulator; the
products stay on the sandbox for a later run.

If UI tests fail at the very first interaction on an instance that has run
many suites back to back, prefer fresh instances with
`--inactivity-timeout 30m` on the next run.

## Signed device builds and App Store Connect

For a signed device IPA (`--sdk iphoneos`: Apple cloud signing, manual p12
signing, entitlements, extensions), read `references/signing.md`. To upload a
signed build to App Store Connect or TestFlight (`--upload-to-appstore`), read
`references/app-store-connect.md`.

## Preview builds

For repeatable previews on pull requests, prefer the packaged
[iOS preview action](https://github.com/limrun-inc/ios-preview-action).
It builds and uploads the app, updates the PR preview comment, and cleans up the
builder; see the repository for inputs and workflow examples.

Only create a reusable preview asset when the user asks for a preview build or
when you're opening a PR. Build and upload:

```bash
ASSET_NAME="<bundle id / pr number / or any session identifier>.zip"
lim xcode build . --upload ${ASSET_NAME}
# Debug preview build:
lim xcode build . --configuration Debug --upload ${ASSET_NAME}
```

Build uploads default to a 14-day TTL: each build pushes the asset's expiry
to 14 days from that upload. Pass `--upload-ttl` with a Go duration (e.g.
`720h`; `1d` is invalid) to change it.

Then construct the preview link and include it in your last message (and in the
PR, if you're opening one):

```
https://console.limrun.com/preview?asset=${ASSET_NAME}&platform=ios
```

## Gotchas

- **Build errors are part of the job.** If a build fails, read the error output, fix the code, and rebuild before reporting back.
- **A project mise file installs tools the build never uses.** The first
  build or run in a sandbox runs `mise install` for every `[tools]` entry in the
  synced mise files, so a monorepo's root `mise.toml` full of databases and
  cloud CLIs slows it down or fails it. Keep using the project file when it
  works. If it doesn't, add a `mise.limrun.toml` beside it listing only the
  build's tools (for example node and pnpm); in that directory Limrun reads it
  instead of the other mise files.
- **The embedded Xcode sandbox is gone.** The TypeScript SDK (0.54.0+) and
  `lim` (0.35.0+) no longer create an Xcode sandbox inside an iOS instance.
  Symptoms after an upgrade: `'sandbox' does not exist in type 'Spec'` on
  `iosInstances.create`, `Property 'sandbox' does not exist on type 'Status'`
  where code reads `status.sandbox.xcode.url`, or `Expected an Xcode instance
  (sandbox_...), got ios_...` from a `lim xcode` command. Create the Xcode
  sandbox on its own and attach the simulator: `lim ios create --xcode`, or
  `lim xcode create --attach --simulator-id <ios-instance-id>` for an existing
  simulator; in the SDK, `xcodeInstances.create` then `attachNewSimulator()` or
  `attachSimulator(iosInstance)` on its client. Pass the `sandbox_` ID to
  `lim xcode` commands and the `ios_` ID to `lim ios` commands. Details:
  https://docs.limrun.com/docs/ios/build-with-xcode#moving-off-the-embedded-xcode-sandbox
- **Instance ID for `lim ios` commands.** They resolve the current instance
  from the git worktree of your cwd and can fail with `No instance ID provided
  and no recent ios instance found`. Get the ID from `lim xcode get` and pass
  `--id <ios-instance-id>`; full recipe in limrun-ios-simulator's "Targeting
  the right instance" section.
- **Bundle ID discovery.** If you don't know the bundle ID, check the Xcode
  project files or run `lim ios list-apps` after a successful build.
- **Auth errors** on an authenticated command mean the session expired or
  `LIM_API_KEY` is wrong; `lim login` on the user's machine renews the session.
- **Build settings override Limrun's defaults.** `--build-setting KEY=VALUE`
  accepts any environment-style key and replaces the managed value with the
  same key. Device builds already use standard architectures (an embedded
  watch app keeps `arm64_32`) and disable coverage instrumentation, so App
  Store uploads need no extra settings.
- **Artifact not found after a successful build.** The server resolves the
  built .app on its own, including when the scheme name differs from the
  product name (scheme "MyApp Dev" building MyApp-dev.app). If an upload
  still fails with `built artifact not found`, pass the full bundle filename
  explicitly with `--artifact-name MyApp-dev.app` (including the .app
  extension); the server then takes that name from the build products
  verbatim.
- **Keep synced files small.** A single ~2MB+ file can fail the client-side
  sync with ENOMEM before the build starts; compress large assets.
- **Symlinks sync when relative and in-root.** A symlink whose target is an
  absolute path is skipped with a warning; recreate it with a relative target
  if the build needs it. A relative link escaping the synced folder fails the
  sync; `--ignore` it or sync from the repo root that contains the target.
- **Signing failures are loud and specific.** `Unknown issuer hash` means the
  p12 lacks its CA chain, so re-export it with the chain; `code signature
  verification failed` means the platform's post-sign check rejected the
  artifact, which is not a code problem, so retry or report it.
