---
name: limrun-maestro-testing
description: "Run Maestro YAML flows against a Limrun cloud iOS simulator with `lim ios maestro`, from any environment (Linux, Windows, macOS, VM, container). Use when the user wants to run, write, or debug Maestro flows or `maestro test` on iOS, migrate an existing Maestro suite to remote simulators, or asks for UI testing with Maestro. For Detox suites use limrun-detox-testing; for driving the simulator without a test framework use limrun-ios-simulator."
user-invocable: true
---

# Maestro on Limrun iOS

Run the stock upstream Maestro CLI against a remote Limrun iOS simulator.
`lim ios maestro` wires `maestro test` to the instance transparently: it
installs and launches the Maestro XCTest runner on the simulator when needed,
then routes the driver traffic to it. No fork of Maestro, no local simulator,
no local Xcode.

## Prerequisites

- `lim` CLI 0.22.0 or newer: `npm install --global lim`. Auth is `lim login` or
  `LIM_API_KEY` (it may be set outside the project, so don't ask for it just
  because it's missing from `.env` or the shell).
- Maestro CLI on PATH: `curl -fsSL https://get.maestro.mobile.dev | bash`.
  Maestro needs Java 17+ (`java -version` to check). Both Maestro 2.5.x and
  2.6+ work; `lim` adapts to the installed version automatically.

The CLI is the source of truth: if a flag errors or you need one not shown
here, check `lim ios maestro --help` instead of guessing.

## Run a flow

```bash
lim ios maestro test flow.yaml
lim ios maestro test flows/
```

This targets the most recently created iOS instance in the current workspace
(pass `--id <ios-id>` explicitly in scripts, agents, or when running from a
different directory). Extra Maestro flags go after `--`:

```bash
lim ios maestro -- test flow.yaml --include-tags smoke --test-output-dir artifacts
```

Do not pass `--platform`, `--device`, `--udid`, `--no-reinstall-driver`, or
`--driver-host-port`; `lim` sets those itself and rejects duplicates.
Real Maestro exit codes and reports are preserved, so CI wiring works as with
local Maestro.

## Instance setup

Any running iOS instance works; the runner is installed on first use. Creating
the instance with the runner preinstalled skips that step:

```bash
lim ios create --install-asset appstore/maestro-ios-runner-2.5.1.tar.gz
```

Install the app under test as usual (`lim ios create --install app.ipa`,
`lim ios install-app`, or a build skill), then reference its bundle id via
`appId:` in the flow. For Expo Go testing, also preinstall
`appstore/Expo-Go-54.0.6.tar.gz` and open the project URL with `openLink`
(env vars must be prefixed `MAESTRO_` to be visible in flows):

```bash
MAESTRO_EXPO_URL='exp://<tunnel-host>' lim ios maestro test flow.yaml
```

## Flow gotchas on Limrun

- `startRecording`/`stopRecording` YAML commands are not supported (the
  simulator is remote). Record with `lim ios record start` / `lim ios record
  stop -o video.mp4` around the run instead.
- `addMedia` and flow commands that reference local simulator file paths are
  not supported.
- HTTP calls from `runScript`/`evalScript` must use `https://` URLs. Plain
  `http://` calls are refused (except to the driver itself), because Maestro's
  plain-HTTP traffic is routed through a local bridge that only forwards to
  the remote simulator.
- When a flow re-runs against an app that is already open (for example Expo
  Go), start it with `- stopApp` before `openLink`/`launchApp`; deep links
  can be dropped by an app that is mid-foreground, and stale screens fail
  early assertions.
- Fleet variance: anchor assertions on stable accessibility identifiers and
  text, not on timing. Use `extendedWaitUntil` with a generous timeout for
  first app load.

## Validation signals

- `Running maestro <version> against <ios-id>...` then
  `Running on Limrun iPhone - iOS ...`: the driver is connected end to end.
- `Installing the Maestro runner...` / `Launching the Maestro runner...`:
  first use on this instance; subsequent runs skip both.
- Flow failures print Maestro's own debug output directory with screenshots
  and the UI hierarchy; `lim ios element-tree --id <ios-id>` shows the live
  screen when debugging selectors.

## Cleanup

Delete the instance when done: `lim ios delete <ios-id>` (`--id` is not valid
for delete). The wiring `lim ios maestro` starts is torn down when the command
exits.
