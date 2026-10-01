---
name: limrun-gradle
description: "Build an Android app on a remote Gradle sandbox with `lim gradle build` instead of local Gradle or Android Studio, from any environment (Linux, Windows, macOS, VM, container). Use when the user wants to build an APK or AAB, sign a release with an upload key, prepare a Play Store publish, inspect build logs, or select sandbox tools and run shell commands, for native Android projects, React Native, and Expo. To run, tap, screenshot, or otherwise interact with the built APK on an emulator, use limrun-android-emulator. For iOS builds, use limrun-xcode or limrun-expo-development."
user-invocable: true
effort: high
---

# Remote Gradle build

Build Android projects on Limrun's remote Gradle sandboxes, from any
environment (Linux, Windows, macOS, VM, container). `lim gradle build` syncs
your sources to a remote instance, runs the project's own Gradle wrapper
there, and streams the build output. This workflow builds on the remote instance; local Gradle, a local Android
SDK, and local emulators are not part of it. A finished run has the app
running on a Limrun emulator or the artifact delivered.

For iOS builds, use **`limrun-xcode`** instead of this skill. For the Expo
dev-client loop (Metro, hot reload) on either platform, use
**`limrun-expo-development`**; it comes back here for the Android Debug
build.

## Building with the live device extension

When a Limrun live-device panel is open, its context owns the target device and
API environment. Before looking up or creating a builder, set `LIM_API_ENDPOINT`
to the endpoint in that context and verify the CLI credentials work there.
Do not reuse a production builder for a staging panel or silently switch
credentials/environments after an error.

Reuse the panel's ready `instanceId`. If it is empty or terminated, create the
device through `create-ios-simulator` or `create-android-emulator`, passing the
`panelId` from the context. The panel follows that device. Do not use the CLI to
create a separate simulator/emulator in this workflow. CLI commands still own
source sync and builds; use the explicit builder and device IDs for installation.
Use `--no-open` on commands that open a browser, and do not open a console or
signed-stream URL when the user is already using the live panel.

Build with the explicit Gradle builder ID and install the resulting app onto the
panel's existing Android instance. Run
`lim gradle build . --id <builderId> --upload myapp.apk`, then install its returned
download URL with `lim android install-app <downloadUrl> --id <instanceId>`.
For a local APK, use
`lim android sync ./path/to/app-debug.apk --id <instanceId>`.

## Authenticate through the active MCP connection

When the project uses the Limrun MCP extension, reuse its account and environment:

1. Call `get-cli-auth-context`. It returns `apiEndpoint`, `consoleEndpoint`, and `organizationId`, never a key.
2. In the project directory, run `lim login --mcp --api-endpoint <apiEndpoint> --console-endpoint <consoleEndpoint> --organization-id <organizationId>`.
3. Call `approve-cli-login` with the returned `sessionId` and `phrase`.
4. In the same directory, run `lim login --complete <sessionId>`.

The CLI stores the credential and endpoints for that workspace. No second browser
login is needed. Do not read or print private pairing files or ask for an API key.
An older OAuth connection needs the user to reconnect Limrun once to authorize
builds. If these flags are unavailable, update the CLI; do not invent a command.
Paired access lasts up to one hour and depends on the MCP connection remaining
valid. On expiry, repeat pairing instead of browser login or another account.
If inherited `LIM_API_KEY`, `LIM_API_ENDPOINT`, or `LIM_CONSOLE_ENDPOINT` conflicts
with the paired workspace, remove the conflicting override in the build shell;
never copy the MCP credential into those variables. Use the panel's explicit
emulator and builder IDs. Pairing to another account/environment clears remembered
devices for this workspace.

## Auth and CLI

Install if needed: `npm install --global lim`. Outside an MCP-paired workspace, auth is `lim login` or
`LIM_API_KEY` (it may already be set in the user's environment even when `.env` and the shell do not show it; check before asking for it). The CLI is the source of truth:
the commands in this skill are verified, but if a flag errors or you need one
not shown here, check `--help` instead of guessing:

```bash
lim gradle --help
lim gradle build --help
```

## Build an APK

Instead of `./gradlew`, build with:

```bash
lim gradle build .
```

This creates or reuses the remembered Gradle instance, syncs the current
directory, and runs `assembleDebug` by default. Pick tasks explicitly with
`--task` (repeatable):

```bash
lim gradle build . --task :app:assembleRelease
```

Use `--project-path` when the Gradle root is nested and auto-discovery is
ambiguous (for example a bare React Native repo where Gradle lives in
`android/`; the server usually finds it on its own):

```bash
lim gradle build . --project-path android
```

Expo managed-workflow projects (no `android/` directory) are detected
automatically: the sandbox installs dependencies and runs `expo prebuild`
before Gradle. Setting `--expo-app-dir` (monorepos) or `--abi` forces that
pipeline and errors when no Expo app is detected:

```bash
lim gradle build ./my-monorepo --expo-app-dir apps/mobile
```

For iterating on an Expo app with Metro and hot reload rather than plain
builds, use **`limrun-expo-development`**.

## Detached builds and logs

Use `--detach` to return once the build is accepted; a webhook is optional.
`logs` reads the latest build without an exec ID, including persisted logs after
instance deletion; add `--follow` to wait for completion.

```bash
lim gradle build . --detach
lim gradle logs
lim gradle logs --follow
```

## Tool versions and shell commands

After syncing, `lim gradle use` selects tools in the sandbox and installs missing versions.
Run `lim gradle tools install` for synced project tool selections ([details](https://docs.limrun.com/docs/android/build-with-gradle)). Builds keep the project's `gradlew`; Android SDK/NDK/CMake use `sdkmanager`.

```bash
lim gradle tools
# Node includes npm/npx.
lim gradle use node@24 pnpm@10 yarn@4 bun@1 java@temurin-17 bundletool@1
lim gradle tools install
lim gradle run -- mise use --pin node@24.5.0
lim gradle run --env APP_ENV=staging -- npm run generate
lim gradle build . --env APP_ENV=staging
```

## Run it on an emulator

When a live panel is open, use its existing instance as described above. Outside
that workflow, upload the built APK as a named asset and create an Android instance:

```bash
lim gradle build . --upload myapp.apk
lim android create --install-asset=myapp.apk
```

Build uploads default to a 14-day TTL: each build pushes the asset's expiry
to 14 days from that upload. Pass `--upload-ttl` with a Go duration (e.g.
`720h`; `1d` is invalid) to change it.

Share the signed stream URL from the create output with the user as a
Markdown link, such as `[Live emulator](<signed-stream-url>)`. For rebuild
iterations, patch the installed APK in place instead of recreating the
instance:

```bash
lim android sync ./path/to/app-debug.apk
```

For everything else on the device (tapping, typing, element tree, screenshots,
video, logcat over adb), use **limrun-android-emulator**.

## Sign a release AAB

The default signing path needs NO credentials from the user:

```bash
lim gradle build . --sign --upload myapp.aab
```

On first use, Limrun generates an upload keystore, escrows it as the
organization's signing key for this app, and signs with it. Every later
`--sign` build of the same app, from any machine or CI, uses the same key, so
Play Store uploads keep matching. The key is named by the Android application
ID, detected from `app.json` (Expo) or `app/build.gradle(.kts)`; pass
`--application-id <id>` when detection fails or picks the wrong flavor.

`--sign` makes `bundleRelease` the default task and the build fails before
starting if an explicit `--task` list contains no bundle task. A SUCCEEDED
build means the AAB carries the signature (the server verifies it before
upload), so don't re-verify the artifact unless the user asks.

Expect one of these lines before the build starts and relay its meaning:

- `Signing with the organization's upload key for <app> (newly generated).`:
  first build of this app; the key now exists for the whole organization.
- `Signing with the organization's upload key for <app> (existing).`: reusing
  the escrowed key, as intended.

## Bring your own upload key

When the app already has a registered upload key (an existing Play listing),
the user can sign with their own keystore instead. The keystore path, key alias
and both passwords are supplied by the user on their own machine, as the
`--keystore`, `--key-alias`, `--keystore-password` and `--key-password` flags or
the `LIM_KEYSTORE_PASSWORD` and `LIM_KEY_PASSWORD` environment variables
(`lim gradle build --help` lists them). Never ask for or handle these values in
the conversation; if one is missing, name the flag or variable to set. All four
travel together. Add
`--save-key` to escrow the provided key so later builds can drop the flags and
use plain `--sign`. `--save-key` refuses to overwrite: if a DIFFERENT key is
already escrowed for the app it fails before any instance is created.

The keystore file itself stays on the user's machine: never commit it or paste
its bytes into files. `keytool -list -keystore <file>` shows the alias when the
user does not know it.

Failure strings to recognize on the bring-your-own path:

- `The organization already has a different upload key escrowed for <app>`:
  `--save-key` conflict. Builds with `--sign` use the escrowed key; drop
  `--save-key` to sign with the provided keystore for this build only, or ask
  the user which key is the real upload key.
- `Signing with your own key requires ... as well`: the BYO flag group is
  incomplete; the message lists exactly the missing flags.
- `signing <field> contains an unsupported character`: the password or alias
  has characters outside ISO-8859-1. Change it in place with keytool
  (`-storepasswd`, `-keypasswd`, or `-changealias`) to a Latin-1 value. Never
  regenerate the key itself: that changes the upload key.

## Publish to Play Store

When the user has Play credentials configured on their own machine (a
service-account JSON file or an access token, passed through the
`--playstore-service-account` or `--playstore-access-token` flag), the build
publishes the signed release AAB directly, no browser involved. Never ask for
these credentials in the conversation:

```bash
lim gradle build . --sign --upload-to-playstore --playstore-service-account sa.json --auto-version-code
```

`--auto-version-code` makes the server resolve the next free versionCode from
Google Play before the build and stamp it into the workspace copy
(`expo.android.versionCode` in app.json for Expo projects, the single literal
`versionCode` in the conventional `app/` module build script for native
Gradle projects), so repeat publishes never collide. Without it, or on
projects with computed or flavor-split versionCodes (which it rejects at
request time), manage the versionCode yourself as below. Without Play
credentials you cannot run the publish itself: it is a browser flow with a
Google sign-in. Prepare the artifact, upload it as an asset, and hand off:

```bash
lim gradle build . --sign --upload <app>-v<versionCode>.aab
```

Tell the user to open https://console.limrun.com and, on the **Secrets** page,
click **Connect Play Console** to sign in with a Google account that has
release access to the app (the session lives in the browser only; nothing is
stored). Then on the **Registry** page they click **Publish to Play Store** on
the uploaded AAB and enter the package name (the application ID). The app
listing must already exist in Play Console. Google Play requires a versionCode
it has never seen: `--auto-version-code` handles that on publish builds;
without it, bump `versionCode` in `app/build.gradle(.kts)` (Expo:
`expo.android.versionCode` in app.json) before the build.

Failure strings to recognize on the `--sign` path:

- `Cannot determine the Android application ID for signing`: detection found
  no `app.json` android.package and no `applicationId` in
  `app/build.gradle(.kts)`; pass `--application-id <id>`.
- `--sign produces a Play-ready signed AAB; include a bundle task`: the
  explicit `--task` list has no bundle task; add `bundleRelease` or drop
  `--task`.
- `the built AAB carries no signature`: the server's post-build check found an
  unsigned bundle; the signing config was not applied. Not a problem in the
  user's code; retry, and report it if it persists.

## Gotchas

- **Build errors are part of the job.** If a build fails, read the error output, fix the code, and rebuild before reporting back.
- **Instance reuse is per git worktree.** Commands resolve the remembered
  instance from the worktree of your cwd; pass `--id <gradle-instance-id>`
  (from `lim gradle list`) to target a specific one.
- **versionCode must increase for every Play upload.** Prefer
  `--auto-version-code` on publish builds. A rejected publish
  saying the version code already exists means bump, rebuild, republish. If a
  publish RETRY reports it, the earlier attempt already succeeded; don't
  publish again.
- **Application ID detection reads the first uncommented `applicationId`.**
  Flavor-specific IDs and dynamic Gradle logic are out of its scope; use
  `--application-id` there.
- **Keystore passwords must be non-empty and ISO-8859-1.** Empty passwords and
  characters outside Latin-1 are rejected at request time instead of failing
  minutes into the build.
- **Keep synced files small and out of build dirs.** Root-level `build/`,
  `.gradle`, `.kotlin` and any `local.properties` never sync, and `.gitignore`
  files (including nested ones) are honored. Use `--ignore <regex>` for other
  large local artifacts and `--include <regex>` to force-sync gitignored
  inputs the build needs.
