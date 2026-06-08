# Making an arbitrary Bazel Apple project build on Limrun RBE

The generated `--config=limrun` is the whole happy path for an idiomatic
rules_apple / rules_swift project. When a build doesn't go green, it's almost
always one of the patterns below — each is a property of *the project's* Bazel
setup, not a Limrun bug. Symptom → cause → what to do.

## What the generated config / fleet already handle (don't re-derive these)

- **apple_support rule `load`s on Bazel 9** — the `.limrun/BUILD` loads
  `xcode_version` / `available_xcodes` / `xcode_config` from apple_support on
  Bazel 9 (where they're no longer native globals) and omits them on Bazel 8
  (where loading them fails). Driven off the workspace `.bazelversion`.
- **Remote/local Xcode split + `--xcode_version`** — the fleet's Xcode is pinned
  as a remote-only version so client-side `xcode-locator` never demands it. The
  benign `DEBUG: --xcode_version=… not available locally` line is expected.
- **`--strategy=SwiftCompile=remote` / `--strategy=Genrule=remote`** — overrides
  the common local pins (rules_swift's worker, standalone genrules).
- **Darwin exec platform on non-mac clients**, and `PATH` including `/usr/sbin`.
- **CoreSimulator IB utility devices** (actool/ibtool) — provisioned by the fleet.

## Patterns that require a project-side change

### A pinned Xcode version via a Starlark transition
A repo may lock the Xcode version for a sub-build with a `transition` outputting
`//command_line_option:xcode_version`. **A transition output overrides
`--xcode_version`** — no flag or bazelrc can win against it. If the pinned
version isn't on the fleet, analysis fails in `host_xcodes`. Fix: edit the
transition to drop the `xcode_version` output (or set it to the fleet's).

### Custom `remote_default_exec_properties`
Limrun's worker matches actions by an **exact** platform-property set
(`OSFamily=Darwin`). A project bazelrc that adds extra/mismatched properties
(a lowercase `OSFamily=darwin`, `Arch=arm64`, a `cache_bust=…`) makes the action
platform no longer match any worker → the build stalls or reports no usable
worker. Fix: neutralize those base `build --remote_default_exec_properties=…`
lines for the limrun path (the generated config sets the one the worker needs).

### Per-mnemonic strategy pins beyond Swift/Genrule
If a repo pins other mnemonics local (e.g. `--strategy=ObjcCompile=local`), those
actions run on the client and then need a local Xcode / can't run on a thin
Linux client. Symptom: an action runs `local`/`worker` and fails resolving a
local toolchain. Fix: override the offending mnemonic to `remote`.

### Foreign-build genrules (a host tool compiled from source)
A genrule that downloads a C/C++ tool's source and shells out to `cmake`/`make`
(probing `sysctl` for `-j`, etc.) is **not** sandbox/RBE-friendly: the cage
lacks those tools. Symptom: `sysctl: command not found` / `Exit 127` in a
`[for tool]` genrule once forced remote. Idiomatic host tools built as a normal
`cc_binary` compile fine remotely. Treat the genrule form as a project smell.

### codesign digest algorithm
A target that sets `codesignopts = ["--digest-algorithm=sha1"]` fails under
recent Xcode's codesign: `signing with only SHA1 not allowed`. Use `sha256`.

## Expected, benign

- **A local sub-build before the remote build** — some example repos consume the
  ruleset via a *built release archive*, so the first thing you see is a local
  build of that archive, then the real target builds remote. Not an error.
- `compatibility_level` and `bazel_features` version mismatch **warnings**.

---
Append new patterns here as they're hit — keep them at the pattern level
(symptom → cause → fix), not as one-off patches for a specific app.
