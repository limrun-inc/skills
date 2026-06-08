---
name: limrun-xcode-bazel
description: "Build a Bazel-based iOS / macOS / Apple app on Limrun's remote build execution (RBE) instead of a local Mac. Use when the project is a Bazel workspace (has MODULE.bazel or WORKSPACE) building rules_apple / rules_swift targets and the user wants to `bazel build` it, or when a `--config=limrun` build fails with a digest/BLAKE3 error, 'no matching worker', a CoreSimulator permission error, 'name xcode_version is not defined', or finishes suspiciously fast. For non-Bazel (plain xcodebuild) projects use limrun-xcode-and-ios-simulator instead."
user-invocable: true
effort: high
---

# Bazel iOS builds on Limrun RBE

You build Bazel Apple projects on Limrun's remote Mac workers, so the build runs
from any environment (Linux, Windows, macOS, VM, container) with no local Xcode.
Limrun runs an embedded Bazel RBE stack on a remote Xcode instance; `lim xcode
rbe` brings it up, tunnels its gRPC frontend to a local port, and generates a
`.limrun/` Bazel config so `bazelisk build --config=limrun` executes Apple
actions remotely. Never fall back to local Xcode or local build tools.

Use this skill only for **Bazel** workspaces (a `MODULE.bazel` / `WORKSPACE`
exists). For plain `xcodebuild` projects, use `limrun-xcode-and-ios-simulator`.

## Auth and CLI

Install if needed: `npm install --global lim`. Authentication is via `lim
login` or `LIM_API_KEY`; credentials may already be set outside the project, so
don't ask for `LIM_API_KEY` just because it's absent from the shell. The CLI is
the source of truth, run `lim xcode rbe --help` before relying on flags.

## Core workflow

1. From the **Bazel workspace root** (the directory with `MODULE.bazel` /
   `WORKSPACE`), run `lim xcode rbe`. It targets/creates an Xcode instance,
   opens the tunnel, writes `.limrun/` (an `xcode_config` pinning the fleet's
   Xcode plus the RBE flags under `--config=limrun`, wired via `try-import`),
   and **prints the exact build command**. Keep it running; Ctrl+C tears down
   the tunnel and the remote stack.
2. In another shell, run the printed command, e.g.
   `bazelisk --digest_function=sha256 build --config=limrun //App`.

Do not hand-write the flags or `.limrun/` files, the CLI generates them and
adapts to the fleet's Xcode and your OS. Re-run `lim xcode rbe` to refresh after
a fleet Xcode upgrade.

## Gotchas

- **Always build with `--digest_function=sha256`, placed *before* `build`.** The
  Limrun cache is SHA256-only. Bazel 9 defaults to BLAKE3, and some workspaces
  configure BLAKE3 explicitly (even on Bazel 8, e.g. `startup --digest_function=blake3`),
  so the flag is required there; where SHA256 is already the default it is a
  harmless no-op — which is why the CLI prints it unconditionally. It is a
  *startup* flag, so it can't live in `--config=limrun` (and putting it in
  `.bazelrc` would change the digest for all the user's builds, not just limrun);
  hence it precedes `build`. Use the command the CLI prints verbatim. Symptom if
  missing: `Cannot use hash function BLAKE3 with remote cache. Server supported
  functions are: [SHA256]`.
- **Run `lim xcode rbe` from inside the workspace**, not a subdirectory dump. It
  writes `.limrun/` at the workspace root (where bazelrc `%workspace%` resolves)
  and fails fast if you're not in a workspace.
- **A green build does not prove remote execution, the cache hides it.** Repeat
  builds report `action cache hit` / `remote cache hit` and run no actions, so
  they succeed even with the tunnel gone. To exercise and verify real remote
  execution, see `references/verify-remote.md`.
- **`You don't have permission to save … in "CoreSimulator"`** during
  AssetCatalogCompile (actool) or StoryboardCompile (ibtool) is a fleet-side
  simulator-device gap, not your config. Retry; if it persists, report it to
  Limrun.
- **The project's own Bazel settings can fight RBE** (an Xcode pinned via a
  Starlark transition, custom `remote_default_exec_properties`, a foreign-build
  genrule that won't run in the sandbox, …). These are per-project, not Limrun
  bugs. Walk `references/project-compatibility.md` before concluding RBE is
  broken.

## Onboarding a repo

`lim xcode rbe` + the printed command is the whole happy path for an idiomatic
rules_apple / rules_swift project on Bazel 8 or 9. If it doesn't go green, work
through `references/project-compatibility.md` (symptom → cause → fix), and append
new patterns there as you hit them.
