---
name: limrun-expo-development
description: "Prepare and run Expo / React Native apps on Limrun with Expo dev-client iteration. Use when the user wants an Expo dev build, Metro tunnel, hot reload, JS/TS iteration without repeated native rebuilds, or to run/test an Expo app on a remote iOS simulator."
user-invocable: true
effort: high
---

# Developing Expo Apps on Limrun

Use this skill for Expo / React Native-specific setup and dev-client iteration. Use the generic Limrun iOS skill for command details, simulator interaction, screenshots, recordings, cleanup, and non-Expo iOS workflows.

All iOS builds and simulator operations must run on Limrun. Do not use local Xcode, local simulators, or local macOS build tools.

## Expo Readiness

Before changing Expo dependencies or app config, check the app's Expo SDK version and use the matching Expo versioned docs.

Verify this is an Expo app:

```bash
npx expo config --type introspect --json
```

Derive:

- `BUNDLE_ID` from `ios.bundleIdentifier`
- `SLUG` from `slug`
- `SCHEME` from `scheme`, falling back to `exp+${SLUG}`
- `BRANCH` from `git branch --show-current`, falling back to `main`
- `ASSET_NAME="${BUNDLE_ID}/${BRANCH}-debug.zip"`

## Ensure Dev Client

Expo development builds require `expo-dev-client`. If it is missing from `package.json`, install it automatically:

```bash
npx expo install expo-dev-client
```

Installing `expo-dev-client`, adding/removing/updating native dependencies, or changing native app config means the uploaded Debug asset is stale. Build a fresh Debug app before starting the dev loop. Do not merely warn the user that a rebuild may be needed; perform the rebuild.

## Debug Build Asset

First check whether a reusable Debug dev-client asset already exists:

```bash
lim asset list --name-prefix "$BUNDLE_ID/"
```

Reuse the exact `$ASSET_NAME` only when:

- it exists, and
- no native dependency or native config changed in this session.

If the current task changed native dependencies or native config, skip asset reuse even if `$ASSET_NAME` exists.

When reusing the asset, create or reuse a simulator and install it:

```bash
lim ios create \
  --reuse-if-exists \
  --install-asset "$ASSET_NAME" \
  --label repo=<repo> \
  --label agent=<agent>
```

When building fresh, create or reuse an iOS simulator with Xcode:

```bash
lim ios create --xcode \
  --reuse-if-exists \
  --label repo=<repo> \
  --label agent=<agent>
```

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

If `8081` is busy, choose a free port with `--port <port>`. If tunnel startup fails or exits, retry a few times; if it still fails, use the Limrun reverse fallback below. Keep Metro running while the user iterates.

Get the `https://*.exp.direct` tunnel URL from Expo output. If Expo does not print it, query the local ngrok API:

```bash
curl -sS http://127.0.0.1:4040/api/tunnels
```

### Fallback: Limrun Reverse Tunnel

If Expo's `--tunnel` repeatedly fails, use `lim ios reverse` with a matched remote/local port. Expo dev-client can derive or advertise multiple packager URLs, so mismatched mappings like `57090:8081` can leave some URLs pointing at the local Metro port instead of the simulator-facing tunnel port.

Use the simulator-facing host printed by `lim ios reverse` in both `REACT_NATIVE_PACKAGER_HOSTNAME` and the encoded dev-client URL. Keep the reverse command running in a separate or background terminal while Metro is running:

```bash
lim ios reverse 57090:57090 --id <ios-instance-id>

REACT_NATIVE_PACKAGER_HOSTNAME=<reverse-host> \
  npx expo start --dev-client --host lan --port 57090

ENCODED_URL="$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "http://<reverse-host>:57090")"
DEV_CLIENT_URL="${SCHEME}://expo-development-client/?url=${ENCODED_URL}"
lim ios open-url --id <ios-instance-id> "$DEV_CLIENT_URL"
```

## Launch Dev Client

Open the Debug app through the dev-client URL:

```bash
ENCODED_URL="$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$TUNNEL_URL")"
DEV_CLIENT_URL="${SCHEME}://expo-development-client/?url=${ENCODED_URL}"
lim ios open-url "$DEV_CLIENT_URL"
```

If opening fails and the primary scheme came from `scheme`, retry once with `exp+${SLUG}`.

## Verify

For quick static validation, prefer:

```bash
npx tsc --noEmit
```

Only run `npm run lint` or `npx expo lint` when the repo already has ESLint configured. Expo lint can create ESLint config and mutate dependencies in projects that have not configured linting yet.

Use the element tree first:

```bash
lim ios element-tree
```

Success means the app UI is visible or the Expo dev menu shows it is connected to the tunnel. Dismiss the dev menu overlay if needed. If the tree does not confirm the connection, inspect app logs:

```bash
lim ios app-log "$BUNDLE_ID" --tail 100
```

## Iterating

Once connected, JS/TS edits should update through Metro without another native build. If the task changes native dependencies, native config, or build settings, rebuild Debug before relaunching the dev loop.

Tell the user:

- simulator stream as a short Markdown link, for example `[Open simulator stream](<signedStreamUrl>)`
- uploaded Debug asset name
- that JS/TS changes can now iterate through Metro
- that native changes require a new Debug build

## Final Preview

For a final shareable preview or PR demo, use a Release build so the user does not need Metro running:

```bash
ASSET_NAME="<bundle-id>/<pr-or-session>.zip"
lim xcode build . --configuration Release --upload "$ASSET_NAME"
```

Preview URL:

```text
https://console.limrun.com/preview?asset=${ASSET_NAME}&platform=ios
```

## Gotchas

- `npx expo start --dev-client` requires `expo-dev-client`; without it Expo cannot determine the development-build scheme.
- `No script URL provided` usually means the app is not a dev-client build or was launched without a dev-client URL.
- After a fresh native rebuild/install, a stale Metro/runtime error like `Cannot find native module` may come from the old app process. Relaunch the dev-client URL and verify with `element-tree` before assuming the rebuild failed.
- If a Debug build after adding a native dependency still behaves like the old native graph, that is unexpected Limrun behavior. Retry the build; creating a fresh iOS/Xcode target is only a troubleshooting fallback.
- Expo tunnel startup can be flaky. Retry before changing the workflow.
- Do not reuse uploaded Debug assets after native dependency or native config changes.
