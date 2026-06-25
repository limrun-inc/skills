---
name: limrun-xcode-bazel
description: "Build a Bazel-based iOS / macOS / Apple app on Limrun's remote build execution (RBE) instead of a local Mac, and optionally run it on a remote iOS simulator. Use when the project is a Bazel workspace (MODULE.bazel / WORKSPACE) building rules_apple / rules_swift targets and the user wants to `bazel build` it or run it on a simulator, or when a `--config=limrun` build or install misbehaves. For non-Bazel (plain xcodebuild) projects use limrun-xcode-and-ios-simulator instead."
user-invocable: true
effort: high
---

# Bazel iOS builds on Limrun RBE

Build Bazel Apple projects on Limrun's remote Mac workers — from any environment
(Linux, Windows, macOS, VM, container), no local Xcode. `lim xcode rbe` brings up
a remote RBE stack, tunnels it to a local port, and writes a `.limrun/` config so
`bazelisk build --config=limrun` runs Apple actions remotely. Never fall back to
local Xcode or build tools.

## Auth and CLI

Install if needed: `npm install --global lim`. Auth is `lim login` or
`LIM_API_KEY` (may be set outside the project — don't ask for it just because
it's absent). The CLI is the source of truth; run `lim xcode rbe --help` before
relying on flags.

## Build

1. From the **Bazel workspace root** (has `MODULE.bazel` / `WORKSPACE`), run
   `lim xcode rbe`. It sets up the instance + `.limrun/` config and **prints the
   exact build command**. The tunnel runs in the background (prints a PID);
   `--no-daemon` keeps it foreground.
2. Run the printed command, e.g.
   `bazelisk --digest_function=sha256 build --config=limrun //App`.

Don't hand-write `.limrun/` or the flags — the CLI generates them for the fleet's
Xcode and your OS. Re-run `lim xcode rbe` (after `--stop`) to refresh after a
fleet Xcode upgrade.

To add your own Bazel flags to the limrun path without editing the generated
config, put them in **`user.limrun.bazelrc`** at the workspace root. The
generated config try-imports it last, so your `build:limrun --…` lines win, and
it survives `lim xcode rbe` regeneration (`.limrun/` does not).

## Run on a simulator

`lim xcode rbe` is build-only. Don't attach a simulator until the user needs
simulator interaction such as launching the app, tapping UI, reading the element
tree, taking screenshots, or recording video. Builds run remotely without one.

When the user needs simulator interaction, inspect whether the rbe target
already has a simulator attached:

```bash
lim xcode get
```

If a simulator is attached, continue using the current target. If not, create
one and attach it — it installs the last build immediately, so you don't need to
rebuild:

```bash
lim ios create --attach
```

If the create output includes a signed stream URL, share it with the user as a
Markdown link, such as [Live simulator](<signed-stream-url>).

When a simulator is attached, every successful `--config=limrun` build
automatically re-installs the app on the iOS Simulator and re-launches it — no
separate install step:

```bash
bazelisk --digest_function=sha256 build --config=limrun //App
```

Notes:
- **Attach upfront** if you already know you want a sim: `lim xcode rbe --ios`
  (attaches at startup, removed on `--stop`).
- **Multi-app workspaces:** pass `--target //App` so auto-install knows which app
  to install (a single-app workspace is inferred).
- **Disable** with `--no-auto-install` for a tunnel-only / CI session.
- **Manual install** remains as a fallback or to force a reinstall:
  `lim xcode rbe install` (`install //App` in a multi-app workspace).

## Teardown

Stop with **`lim xcode rbe --stop`** (~20s to tear the remote stack down) and delete the instance with **`lim xcode delete <id>`**

## Gotchas

- **Always pass `--digest_function=sha256` before `build`** (use the command the
  CLI prints verbatim). The Limrun cache is SHA256-only; Bazel 9 defaults to
  BLAKE3. It's a startup flag, so it can't live in `--config=limrun`. Symptoms:
  build → `Cannot use hash function BLAKE3 with remote cache`; install →
  `non-SHA256 digest … rebuild with --digest_function=sha256`.
- **Run `lim xcode rbe` from the workspace root**, not a subdirectory — it writes
  `.limrun/` there and fails fast otherwise.
- **A green build doesn't prove remote execution** — cache hits (`action cache
  hit` / `remote cache hit`) make builds pass even with the tunnel gone. To force
  and verify real remote execution, see `references/verify-remote.md`.
- **The printed `.ipa` path won't exist on your machine** — the build command
  carries `--remote_download_outputs=minimal`, which keeps the artifact in the
  instance's cache and downloads nothing. Bazel still prints its usual
  `Target //App:App up-to-date: …/App.ipa` line, but that file is **not** on
  disk. This is expected, not a failed build. With a simulator attached, the
  build auto-installs from the artifact's cache digest (read from the build event
  log, not the local file). Only if you genuinely need the `.ipa` locally, drop
  `--remote_download_outputs=minimal` from the build command and Bazel downloads
  the top-level output; auto-install keeps working either way.
- **`You don't have permission to save … in "CoreSimulator"`** (actool/ibtool) is
  a fleet-side device gap, not your config. Retry; if it persists, report it to
  Limrun.
- **The project's own Bazel settings can fight RBE** (Xcode pinned via a Starlark
  transition, custom `remote_default_exec_properties`, sandbox-hostile genrules).
  These are per-project, not Limrun bugs — walk
  `references/project-compatibility.md` before concluding RBE is broken.
