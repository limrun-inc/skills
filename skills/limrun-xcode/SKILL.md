---
name: limrun-xcode
description: "Build an iOS / Apple app on remote Xcode with `lim xcode build` instead of local xcodebuild, from any environment (Linux, Windows, macOS, VM, container). Use for non-Bazel projects (an `.xcodeproj` / `.xcworkspace`, an XcodeGen `project.yml` with a gitignored project, React Native / Expo native build) when the user wants to build, compile, reload, produce a preview build, or ship a signed device IPA. To run, tap, screenshot, or otherwise interact with the result on a simulator, use limrun-ios-simulator. For Bazel workspaces, use limrun-xcode-bazel."
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

If the attach output includes a signed stream URL, share it with the user as a
Markdown link, such as [Live simulator](<signed-stream-url>).

When a simulator is attached, every successful `lim xcode build` automatically
reinstalls and relaunches the app, no separate install step. To tap, type, read
the element tree, screenshot, or record, switch to **`limrun-ios-simulator`**.

## Signed device builds (IPA)

To produce a signed IPA for real devices, build with `--sdk iphoneos`, pass the
signing material, and upload the result to Asset Storage:

```bash
lim xcode build . --sdk iphoneos --configuration Release \
  --certificate-p12 dist.p12 --certificate-password "$P12_PASSWORD" \
  --provisioning-profile app.mobileprovision \
  --upload myapp.ipa
```

The upload output includes a download URL for the signed IPA. A SUCCEEDED build
means the signature already passed Apple's verifier on the server, so don't
re-verify the IPA yourself unless the user asks. Invalid signing fails the
build loudly instead of producing a broken artifact.

Use a p12 that includes its full CA chain, not just the leaf certificate. If
needed, re-export it with the chain:

```bash
openssl pkcs12 -export -inkey dist.key -in dist.pem -certfile wwdr.pem -out dist-chain.p12
```

Failure strings to recognize in the build output:

- `Unknown issuer hash`: the p12 lacks its CA chain; re-export it with the
  chain as above.
- `code signature verification failed`: the platform's post-sign check rejected
  the artifact. Not a problem in the user's code; retry, and report it if it
  persists.
- p12 password errors: `--certificate-password` doesn't match the file; ask the
  user for the right password.

## Ship to TestFlight

To upload the signed IPA straight to TestFlight, pass `--upload-to-testflight`
with the App Store Connect API key flags on a signed device build:

```bash
lim xcode build . --sdk iphoneos --configuration Release \
  --certificate-p12 dist.p12 --certificate-password "$P12_PASSWORD" \
  --provisioning-profile app.mobileprovision \
  --upload-to-testflight --asc-key-id "$ASC_KEY_ID" --asc-issuer-id "$ASC_ISSUER_ID" \
  --asc-key AuthKey.p8
```

`--upload-to-testflight` requires the signing flags, `--asc-key-id`, and
`--asc-key`; passing asc flags without it is an error. Combine with
`--upload <asset-name>` when the user also wants the IPA in Asset Storage.

Collect from the user (all three live in App Store Connect under Users and
Access, Integrations tab, App Store Connect API):

- `--asc-key-id`: the Key ID next to their API key. If they don't have one,
  point them at Team Keys with the **Developer** role: the least-privileged
  role that can upload builds. Creating team keys needs an Admin account.
- `--asc-issuer-id`: the Issuer ID at the TOP of the Integrations page (a
  team value, not per-key). Omit this flag entirely for individual API keys.
- `--asc-key`: path to the downloaded `.p8` file. Apple keeps no copy and
  the download link disappears after leaving the page; if the user lost it,
  they must generate a new key. Never commit the `.p8` or paste its content
  into files; pass a filesystem path.

After the upload, the build watches Apple's processing verdict for up to 120
seconds (`--asc-wait-timeout`, 0 skips, max 1800). Read the outcome from the
final lines:

- `TestFlight: accepted by App Store Connect`: done; the build appears in
  TestFlight once Apple finishes.
- `TestFlight: uploaded, still processing on Apple's side (upload <id>).`: the
  exit code is 0 and the upload succeeded; Apple is still processing. Do NOT
  retry the build.
- `TestFlight upload failed: ...`: exit code 1 with Apple's error text. The
  compile and signing succeeded; only the delivery failed.

Failure strings to recognize:

- Apple text about the bundle version being already used: bump
  `CFBundleVersion` (Expo: `expo.ios.buildNumber` in app.json) and rebuild.
- `HTTP 401`: key ID / issuer ID / .p8 mismatch, or a revoked key.
- `HTTP 403`: the key's role cannot upload builds; it needs the Developer role
  or higher.
- `no App Store Connect app with bundle id`: the app record doesn't exist;
  the user must create it in App Store Connect manually (the API cannot).
- Build later stuck at "Missing Compliance" in TestFlight: the app doesn't
  answer the export-compliance question at build time. Set
  `ITSAppUsesNonExemptEncryption` to `NO` in Info.plist (Expo:
  `expo.ios.config.usesNonExemptEncryption: false` in app.json) and rebuild.

For hands-off delivery to testers, the app's internal TestFlight group must
have automatic distribution enabled (create-only setting) and the compliance
key above must be set; then no post-upload steps exist at all.

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
- **Build settings are allowlisted.** Only `APP_CONFIG_*` keys and
  `SWIFT_ACTIVE_COMPILATION_CONDITIONS` pass `--build-setting`; anything else
  is rejected. Bump `CURRENT_PROJECT_VERSION` and friends in the Xcode project
  file instead.
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
