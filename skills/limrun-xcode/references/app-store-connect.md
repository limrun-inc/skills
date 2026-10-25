# Upload to App Store Connect

To upload the signed IPA to App Store Connect for TestFlight or App Store
distribution, pass `--upload-to-appstore` with the App Store Connect API key
flags on a signed device build:

```bash
lim xcode build . --sdk iphoneos --configuration Release \
  --certificate-p12 dist.p12 --certificate-password "$P12_PASSWORD" \
  --provisioning-profile app.mobileprovision \
  --upload-to-appstore --asc-key-id "$ASC_KEY_ID" --asc-issuer-id "$ASC_ISSUER_ID" \
  --asc-key AuthKey.p8
```

Cloud signing can sign and upload with the same API key:

```bash
lim xcode build . --sdk iphoneos --configuration Release \
  --signing-method app-store-connect --team-id "$APPLE_TEAM_ID" \
  --asc-key-id "$ASC_KEY_ID" --asc-issuer-id "$ASC_ISSUER_ID" \
  --asc-key AuthKey.p8 \
  --upload-to-appstore --auto-build-number
```

`--upload-to-appstore` requires either cloud signing or the manual signing
flags, plus `--asc-key-id` and `--asc-key`. Combine it with `--upload
<asset-name>` when the user also wants the IPA in Asset Storage.

Device IPAs carry the app's symbols (`Symbols/` next to `Payload/`), so App
Store Connect symbolicates crash reports without a separate dSYM upload. This
needs the build to produce dSYMs: `--configuration Release` does by default;
Debug does not, and the IPA then simply ships without symbols.

The user provides these on their own machine, as flags or environment variables
the CLI reads locally; they are not pasted into the conversation. All three live
in App Store Connect under Users and Access, Integrations tab, App Store Connect
API:

- `--asc-key-id`: the Key ID next to their API key. If they don't have one,
  point them at Team Keys with the **Developer** role: the least-privileged
  role that can upload builds. Creating team keys needs an Admin account.
- `--asc-issuer-id`: the Issuer ID at the TOP of the Integrations page (a
  team value, not per-key). Cloud signing requires a team key and this flag.
  For manual signing plus upload, omit it for individual API keys.
- `--asc-key`: path to the downloaded `.p8` file. Apple keeps no copy and
  the download link disappears after leaving the page; if the user lost it,
  they must generate a new key. Never commit the `.p8` or paste its content
  into files; pass a filesystem path.

By default the build returns as soon as the upload commits and leaves Apple's
processing verdict to App Store Connect (processing routinely takes many
minutes). Pass `--asc-wait-timeout <seconds>` (max 1800) to watch for the
verdict before returning. Read the outcome from the final lines:

- `App Store Connect: upload accepted.`: done; the build appears in
  TestFlight once Apple finishes.
- `App Store Connect: uploaded, still processing on Apple's side (upload
  <id>).`: the exit code is 0 and the upload succeeded; Apple is still
  processing. Do NOT retry the build.
- `App Store Connect upload failed; the build and signing succeeded.`: exit
  code 1 with Apple's error text earlier in the log. Only the delivery
  failed.

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
