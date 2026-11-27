---
name: limrun-macos
description: "Create, list, inspect, and delete Limrun macOS instances (full macOS virtual machines in the cloud) with `lim macos` or the SDKs, and show or control the desktop in a browser. Use when the user wants a cloud Mac, a macOS VM or desktop, a remote Mac to look at or click around in, or to embed a macOS desktop stream in their own web app. To build an iOS or Mac app, use limrun-xcode (it installs Mac builds on an attached macOS instance); to run an iOS app, use limrun-ios-simulator."
user-invocable: true
---

# Limrun macOS instances

A macOS instance is a full macOS virtual machine in the cloud. Its ID looks
like `macos_<region>_<id>`. You can create, list, inspect, and delete it, and
the user can see and control its desktop in a browser.

The CLI and SDKs offer no command execution or file transfer for macOS
instances. Don't improvise any (no SSH, no guessed subcommands). When a task
needs work inside the Mac, give the user the console URL so they can do it on
the desktop. The one way to put an app on the Mac is to build it on an Xcode
sandbox with the macOS instance attached; the "Run your Mac app" section shows
how. To build iOS apps, use **limrun-xcode**; to run them, use
**limrun-ios-simulator**.

## Auth and CLI

Install if needed: `npm install --global lim`. The `lim macos` commands need a
`lim` release newer than 0.61.0; run `npm install --global lim@latest` if
`lim macos --help` reports an unknown command. Auth is `lim login` or
`LIM_API_KEY` (it may already be set in the user's environment even when
`.env` and the shell do not show it; check before asking for it). If a flag
errors or you need one not shown here, check `lim macos <subcommand> --help`
instead of guessing.

## Create

```bash
lim macos create --inactivity-timeout 30m
```

Create waits until the instance is ready, then prints the instance ID, the
console URL (`<console>/stream/<id>`), and the region. Share the console URL
with the user as a Markdown link, such as `[macOS desktop](<console-url>)`;
that page shows the desktop and lets them control it.

Timeouts default to the organization's macOS defaults, and the default
inactivity timeout is only a few minutes. For any session longer than that,
pass `--inactivity-timeout` (and `--hard-timeout` if the default hard limit is
too short). Both take durations like `10m` or `3h`.

Other flags:

- `--jurisdiction us|eu|as`: create in that jurisdiction. Creation fails when
  no region there has capacity.
- `--display-name <name>`: name shown in listings and the console.
- `--label key=value`: repeatable metadata label.
- `--reuse-if-exists`: return an existing instance with matching labels
  instead of creating a new one. Its permissions stay unchanged.
- `--permission <permission>`: repeatable asset permission for the instance.
- `--json`: print the instance record plus `consoleUrl`.

```bash
MAC_ID=$(lim macos create --inactivity-timeout 30m --json | jq -r .metadata.id)
```

## List, get, and delete

```bash
lim macos list                       # ready instances only
lim macos list --all                 # every state
lim macos list --state creating,ready
lim macos list --label-selector env=dev
lim macos get [ID]                   # details and console URL
lim macos delete [ID]
```

`get` and `delete` default to the last macOS instance created in the current
workspace; pass the ID when you mean a different one. `get` without an ID lists
instances when none is remembered.

Deleting discards the instance's disk. Nothing on it can be recovered, so
delete only when the user is done with it, and confirm first if they may have
unsaved work on the desktop.

## Run your Mac app

To run the user's own Mac app, attach the macOS instance to an Xcode sandbox.
Every successful `lim xcode build --sdk macosx` then installs the app in the
instance's `~/Applications` and launches it, sending only the files that
changed:

```bash
lim xcode create                            # if there is no Xcode sandbox yet
lim xcode attach-macos [macos-instance-id]  # defaults to the last one created here
lim xcode build . --sdk macosx
```

The build workflow, its options, and its limits are covered by
**`limrun-xcode`** ("Run a Mac app on a macOS instance").

## SDKs

TypeScript (`@limrun/api`) uses `client.macosInstances` with `create`, `list`,
`get`, `update` (labels and delegated permissions), and `delete`:

```ts
import Limrun from '@limrun/api';

const client = new Limrun(); // Reads LIM_API_KEY.
const mac = await client.macosInstances.create({
  wait: true,
  spec: { inactivityTimeout: '30m' },
});
// ...
await client.macosInstances.delete(mac.metadata.id);
```

Go uses `client.MacosInstances` with `New`, `List`, `Get`, `Update`, and
`Delete`.

## Show the desktop in a web app

To embed the desktop in the user's own React app, render `RemoteControl` from
`@limrun/ui` with the instance's WebSocket URL and stream token:

```tsx
import { RemoteControl } from '@limrun/ui';

<RemoteControl url={mac.status.endpointWebSocketUrl!} token={mac.status.streamToken!} />;
```

`status.streamToken` opens the stream with input, so the browser can see and
control the desktop, but it can't reach the instance API or change the
instance record. `status.token` is the control token: keep it on the user's
backend and don't send it to the browser.
