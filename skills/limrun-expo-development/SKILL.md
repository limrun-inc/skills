---
name: limrun-expo-development
description: "Prepare and run Expo / React Native apps on Limrun with Expo dev-client iteration. Use when the user wants an Expo dev build, Metro tunnel, hot reload, JS/TS iteration without repeated native rebuilds, or to run/test an Expo app on a remote iOS simulator or Android emulator."
user-invocable: true
effort: high
---

# Developing Expo Apps on Limrun

Use this skill for Expo / React Native-specific setup and dev-client iteration, on iOS simulators and Android emulators. Use **limrun-ios-simulator** and **limrun-android-emulator** for command details, device interaction, screenshots, recordings, and cleanup, and the build skills (**limrun-xcode**, **limrun-gradle**) for build flag details and non-Expo workflows.

All builds and device operations must run on Limrun. Do not use local Xcode, local simulators, a local Android SDK, or local emulators; local `adb` is used only to talk to the remote emulator through the CLI's tunnel.

## Expo Readiness

Before changing Expo dependencies or app config, check the app's Expo SDK version and use the matching Expo versioned docs.

Verify this is an Expo app:

```bash
npx expo config --type introspect --json
```

Derive:

- `BUNDLE_ID` from `ios.bundleIdentifier` (iOS) and `PACKAGE` from `android.package` (Android). When `android.package` is missing, introspect reports a placeholder (like `com.placeholder.appid`) while the build generates a different real applicationId; set `android.package` in `app.json` before building so `$PACKAGE` matches the installed app.
- `SLUG` from `slug`
- `SCHEME` from `scheme`, falling back to `exp+${SLUG}`
- `BRANCH` from `git branch --show-current`, falling back to `main`
- `ASSET_NAME="${BUNDLE_ID}/${BRANCH}-debug.zip"` on iOS, `ASSET_NAME="${PACKAGE}/${BRANCH}-debug.apk"` on Android

## Ensure Dev Client

Expo development builds require `expo-dev-client`. If it is missing from `package.json`, install it automatically:

```bash
npx expo install expo-dev-client
```

Installing `expo-dev-client`, adding/removing/updating native dependencies, or changing native app config means the uploaded Debug asset is stale. Build a fresh Debug app before starting the dev loop. Do not merely warn the user that a rebuild may be needed; perform the rebuild.

## Debug Build Asset

First check whether a reusable Debug dev-client asset already exists:

```bash
lim asset list --name-prefix "$BUNDLE_ID/"   # iOS
lim asset list --name-prefix "$PACKAGE/"     # Android
```

Reuse the exact `$ASSET_NAME` only when:

- it exists, and
- no native dependency or native config changed in this session.

If the current task changed native dependencies or native config, skip asset reuse even if `$ASSET_NAME` exists.

When reusing the asset, create or reuse a device and install it:

```bash
lim ios create \
  --reuse-if-exists \
  --install-asset "$ASSET_NAME" \
  --label repo=<repo> \
  --label agent=<agent>

lim android create \
  --reuse-if-exists \
  --install-asset "$ASSET_NAME" \
  --no-open \
  --label repo=<repo> \
  --label agent=<agent>
```

Android note: keep the tunnel that `create` opens by default (do not pass
`--no-connect` here, unlike plain driving sessions); the Metro reverse
tunnel below runs over it. Note the instance ID from the output and pass
`--id` to every later `lim android` call: Metro and Expo run from the app
directory, and instance resolution is per git worktree, so commands run from
elsewhere will not find the instance on their own.

### Fresh build on Android

Build the Debug APK remotely and upload it as the asset (Expo prebuild,
`--expo-app-dir`, and other build flags belong to **limrun-gradle**; the
default `assembleDebug` task is the right dev-client build):

```bash
lim gradle build . --upload "$ASSET_NAME"
lim android create --reuse-if-exists --install-asset "$ASSET_NAME" --no-open --label repo=<repo> --label agent=<agent>
```

For a later native rebuild on a running emulator, rebuild with `--upload` and
install the new APK via the Download URL the build prints (the instance
fetches it server-side):

```bash
lim gradle build . --upload "$ASSET_NAME"
lim android install-app "<Download URL from the build output>" --id <android-instance-id>
```

### Fresh build on iOS

When building fresh, create or reuse an iOS simulator with Xcode:

```bash
lim ios create --xcode \
  --reuse-if-exists \
  --label repo=<repo> \
  --label agent=<agent>
```

Add `--no-open` to any `create` when you have no browser to show the user; it
skips opening the stream URL and leaves the URL in the output to share.

If an iOS simulator is already running from a reused asset and a later native rebuild becomes necessary, attach or create Xcode for that same simulator instead of creating a second iOS simulator:

```bash
lim xcode create --reuse-if-exists --label repo=<repo> --label agent=<agent>
lim xcode attach-simulator <ios-instance-id> --id <xcode-instance-id>
```

Then build and upload Debug:

```bash
lim xcode build . \
  --configuration Debug \
  --upload "$ASSET_NAME"
```

Use `--expo-app-dir`, `--scheme`, or `--workspace` when the project layout requires it. A successful build installs and launches the app on the attached simulator.

## Start Metro Tunnel

Start Metro after the Debug app is installed:

```bash
npx expo start --dev-client --tunnel
```

`--tunnel` needs `@expo/ngrok`, and Expo tries to install it interactively, which
fails in non-interactive environments with `Input is required, but 'npx expo' is
in non-interactive mode`. Install it up front: `npm install --global @expo/ngrok`.

If `8081` is busy, choose a free port with `--port <port>`. If tunnel startup fails or exits, retry a few times; if it still fails, use the Limrun reverse fallback below. Keep Metro running while the user iterates.

Get the `https://*.exp.direct` tunnel URL from Expo output. If Expo does not print it, query the local ngrok API:

```bash
curl -sS http://127.0.0.1:4040/api/tunnels
```

### Fallback: Reverse Tunnel

If Expo's `--tunnel` repeatedly fails, expose the local Metro to the device
through a reverse tunnel. The mechanism differs per platform.

**Android** uses plain `adb reverse` over the CLI's ADB tunnel and is simpler
than iOS: Metro stays on its default port 8081, no packager hostname override
is needed, and after the reverse the device reaches Metro at
`http://127.0.0.1:8081`:

```bash
lim android connect --id <android-instance-id>   # background shell; prints "Tunnel started on 127.0.0.1:<port>."
adb -s 127.0.0.1:<port> reverse tcp:8081 tcp:8081

npx expo start --dev-client --port 8081

DEV_CLIENT_URL="${SCHEME}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081"
lim android open-url "$DEV_CLIENT_URL" --id <android-instance-id>
```

The ADB tunnel dies with the shell that started it, and the port changes on
every reconnect; re-run `adb reverse` with the new serial after any
reconnect. See **limrun-android-emulator** for tunnel details.

**iOS** uses `lim ios reverse` with a matched remote/local port. Expo dev-client can derive or advertise multiple packager URLs, so mismatched mappings like `57090:8081` can leave some URLs pointing at the local Metro port instead of the simulator-facing tunnel port.

Use the simulator-facing host printed by `lim ios reverse` in both `REACT_NATIVE_PACKAGER_HOSTNAME` and the encoded dev-client URL. Keep the reverse command running in a separate or background terminal while Metro is running:

```bash
lim ios reverse 57090:57090 --id <ios-instance-id>

REACT_NATIVE_PACKAGER_HOSTNAME=<reverse-host> \
  npx expo start --dev-client --host lan --port 57090

ENCODED_URL="$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "http://<reverse-host>:57090")"
DEV_CLIENT_URL="${SCHEME}://expo-development-client/?url=${ENCODED_URL}"
lim ios open-url --id <ios-instance-id> "$DEV_CLIENT_URL"
```

Tunnel lifecycle: only traffic flowing through the tunnel counts as instance activity, so an open idle tunnel does not stop the instance's inactivity timeout. If the port is `already in use`, first kill any leftover `lim ios reverse` process from an earlier attempt; a port whose session died uncleanly frees on its own within about two minutes, so wait and retry rather than switching ports.

## Launch Dev Client

Open the Debug app through the dev-client URL, with `TUNNEL_URL` set to the
`https://*.exp.direct` URL collected above (or the reverse-tunnel URL from the
fallback):

```bash
TUNNEL_URL="https://<subdomain>.exp.direct"
ENCODED_URL="$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$TUNNEL_URL")"
DEV_CLIENT_URL="${SCHEME}://expo-development-client/?url=${ENCODED_URL}"
lim ios open-url "$DEV_CLIENT_URL"
lim android open-url "$DEV_CLIENT_URL" --id <android-instance-id>
```

If opening fails and the primary scheme came from `scheme`, retry once with `exp+${SLUG}`.

Platform difference on the first launch: on iOS the dev-menu onboarding sheet
consumes the first deep link, so you reopen the URL after tapping through it.
On Android the bundle loads behind the sheet; tap through it
(`lim android tap-element --text Continue`, the dev menu is native UI and
exposes accessibility nodes even when the app does not), close the dev menu,
and the app is already connected.

## Verify

For quick static validation, prefer:

```bash
npx tsc --noEmit
```

Only run `npm run lint` or `npx expo lint` when the repo already has ESLint configured. Expo lint can create ESLint config and mutate dependencies in projects that have not configured linting yet.

On iOS, use the element tree first:

```bash
lim ios element-tree
```

Success means the app UI is visible or the Expo dev menu shows it is connected to the tunnel. On a fresh instance the first dev-client launch can land on the dev-menu onboarding sheet covering the launcher: tap through it (`lim ios tap-element --ax-label Continue`), then open the dev-client URL again, since the first deep link is consumed by the sheet. If the tree does not confirm the connection, inspect app logs:

```bash
lim ios app-log "$BUNDLE_ID" --tail 100
```

On Android, verify with screenshots, not the element tree: Expo apps
typically expose no accessibility nodes there, so a rendered screen and an
empty tree coexist (see **limrun-android-emulator**):

```bash
lim android screenshot check.png --id <android-instance-id>
```

To see why the app died (crash, ANR), relaunch it watched; the command blocks
while the app runs (run it in a background shell) and prints the exit reason,
stack trace, and a recent app log tail when the app dies:

```bash
lim android launch-app "$PACKAGE" --mode RelaunchIfRunning --id <android-instance-id>
```

## Iterating

Once connected, JS/TS edits should update through Metro without another native build. If the task changes native dependencies, native config, or build settings, rebuild Debug before relaunching the dev loop.

Tell the user:

- device stream as a short Markdown link, for example `[Open simulator stream](<signedStreamUrl>)` or `[Open emulator stream](<signedStreamUrl>)`
- uploaded Debug asset name
- that JS/TS changes can now iterate through Metro
- that native changes require a new Debug build

## Final Preview

For a final shareable preview or PR demo, use a Release build so the user does not need Metro running:

```bash
ASSET_NAME="<bundle-id>/<pr-or-session>.zip"
lim xcode build . --configuration Release --upload "$ASSET_NAME"

ASSET_NAME="<package>/<pr-or-session>.apk"
lim gradle build . --task assembleRelease --upload "$ASSET_NAME"
```

Preview URL (`platform=android` for APK assets):

```text
https://console.limrun.com/preview?asset=${ASSET_NAME}&platform=ios
```

## Gotchas

- `npx expo start --dev-client` requires `expo-dev-client`; without it Expo cannot determine the development-build scheme.
- `No script URL provided` usually means the app is not a dev-client build or was launched without a dev-client URL.
- After a fresh native rebuild/install, a stale Metro/runtime error like `Cannot find native module` may come from the old app process. Relaunch the dev-client URL and verify with `element-tree` before assuming the rebuild failed.
- If a Debug build after adding a native dependency still behaves like the old native graph, that is unexpected Limrun behavior. Retry the build; creating a fresh build/device target is only a troubleshooting fallback.
- Expo tunnel startup can be flaky. Retry before changing the workflow.
- Do not reuse uploaded Debug assets after native dependency or native config changes.
- On Android, pass `--id <android-instance-id>` to every `lim android` call in this loop: instance resolution is per git worktree and the loop's commands run from mixed directories.
- An empty Android element tree while the screenshot shows the app is normal for Expo apps; verify by screenshot.
