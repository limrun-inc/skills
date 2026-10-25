# Signed device builds (IPA)

Contents:

- Apple cloud signing
- Entitlements with cloud signing
- Manual signing with a p12
- Apps with extensions or a watch app
- Failure strings

## Apple cloud signing

Prefer Apple cloud signing when the user has an App Store Connect team API key.
Apple creates or reuses a cloud-managed certificate and provisioning profile,
so the user does not need to supply a p12 or `.mobileprovision`. The key ID,
issuer ID and `.p8` file are configured by the user on their own machine as
flags or environment variables; never ask for their values in the conversation:

```bash
lim xcode build . --sdk iphoneos --configuration Release \
  --signing-method release-testing --team-id "$APPLE_TEAM_ID" \
  --asc-key-id "$ASC_KEY_ID" --asc-issuer-id "$ASC_ISSUER_ID" \
  --asc-key AuthKey.p8 \
  --upload myapp.ipa
```

Signing methods:

- `debugging`: development-signed IPA for registered development devices.
- `release-testing`: distribution-signed IPA for registered test devices.
- `app-store-connect`: distribution-signed IPA for App Store Connect.

Cloud signing requires a device SDK (`--sdk iphoneos` or `--sdk watchos`), a
team API key with an issuer ID, and `--team-id` matching that key's Apple
Developer team. For distribution methods,
the API key must be an Admin key or have **Access to cloud-managed distribution
certificates** enabled. A `Cloud signing permission error` means that permission
is missing. `No Account for Team` means the team ID and API key do not match.
`Failed Registering Bundle Identifier` means the bundle ID belongs to another
team and cannot be registered automatically.

## Entitlements with cloud signing

Cloud signing takes entitlements only from `--entitlements`, never from the
project's `.entitlements` file: the archive is unsigned and the export
preserves entitlements only from an existing code signature. Any app using
capabilities (HealthKit, CloudKit, app groups, push) MUST pass the flag or
the capability is silently stripped from the IPA. A bare path targets the
app; `<bundleId>=<path>` targets an embedded bundle (widget, watch app);
repeat per bundle:

```bash
lim xcode build . --sdk iphoneos --configuration Release \
  --signing-method release-testing --team-id VMBY3VYW4U \
  --asc-key-id 2X9R4HXF34 --asc-issuer-id "$ASC_ISSUER_ID" \
  --asc-key AuthKey.p8 \
  --entitlements ./MyApp/MyApp.entitlements \
  --entitlements com.example.myapp.widgets=./Widgets/Widgets.entitlements \
  --upload myapp.ipa
```

The plist values must be fully expanded (no `$(AppIdentifierPrefix)`; write
the concrete prefix), must omit export-managed keys (`application-identifier`,
`com.apple.developer.team-identifier`, `get-task-allow`,
`beta-reports-active`), and every capability must be enabled on the App ID in
the developer portal or the export fails naming it.

## Manual signing with a p12

Manual signing remains available when the user already has a p12 and profiles:

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

## Apps with extensions or a watch app

If the app embeds extensions (WidgetKit widgets, share sheets, intents) or a
watch app, App Store signing needs one provisioning profile per bundle id, all
issued for the same distribution certificate. Repeat `--provisioning-profile`
once per bundle; each profile is matched to its bundle by the
application-identifier inside it, so order doesn't matter:

```bash
lim xcode build . --sdk iphoneos --configuration Release \
  --certificate-p12 dist.p12 --certificate-password "$P12_PASSWORD" \
  --provisioning-profile app.mobileprovision \
  --provisioning-profile widgets.mobileprovision \
  --upload myapp.ipa
```

With multiple profiles, every profile must carry an explicit (non-wildcard)
bundle id. A `signing preflight failed: no provisioning profile covers ...`
error names the embedded bundle that lacks a profile; ask the user for a
profile with exactly that bundle id.

Use a p12 that includes its full CA chain, not just the leaf certificate. If
needed, re-export it with the chain:

```bash
openssl pkcs12 -export -inkey dist.key -in dist.pem -certfile wwdr.pem -out dist-chain.p12
```

## Failure strings

Failure strings to recognize in the build output:

- `Unknown issuer hash`: the p12 lacks its CA chain; re-export it with the
  chain as above.
- `code signature verification failed`: the platform's post-sign check rejected
  the artifact. Not a problem in the user's code; retry, and report it if it
  persists.
- p12 password errors: `--certificate-password` doesn't match the file; the
  user corrects the value on their machine.
