# Store resource actions

`lim ios apple auth` and `lim android play auth` are login actions. Resource
actions are siblings, for example `lim ios apple list-bundle-ids` and
`lim android play create-app`. Use the action's `--help` for required flags.
Results are JSON. Never print credential files into the conversation.

## Apple sessions and IDs

Every portal or App Store Connect action uses a fresh interactive Apple login
and closes the session on completion. A saved API key cannot authorize these
session-only operations. Reuse `--account` and `--team-id` to select the intended
account and team; the user still enters their password and verification code.
Read-only actions do not mint API keys. Local signing and profile inspection do
not require login.

Use opaque record IDs returned by list/create actions for `--id` and assignments.
A bundle string such as `com.example.app` belongs in `--bundle-id`, not `--id`.
Supported portal actions accept `--platform ios|mac`. This chooses Apple's portal
namespace, not a simulator platform. App Store Connect actions select the chosen
team's provider before operating.

| Resource | Actions after `lim ios apple` |
|---|---|
| Teams and agreements | `list-teams`, `list-pending-agreements` |
| Bundle IDs | `list-bundle-ids`, `create-bundle-id`, `get-bundle-id`, `rename-bundle-id`, `delete-bundle-id`, `update-app-service` |
| App Groups | `list-app-groups`, `create-app-group`, `ensure-app-group`, `delete-app-group`, `assign-app-groups` |
| iCloud containers | `list-cloud-containers`, `create-cloud-container`, `assign-cloud-containers` |
| Merchant IDs | `list-merchant-ids`, `create-merchant-id`, `delete-merchant-id`, `assign-merchant-ids` |
| Merchant domains | `list-merchant-domains`, `register-merchant-domain`, `download-merchant-domain-verification`, `verify-merchant-domain`, `delete-merchant-domain` |
| Wallet pass type IDs | `list-pass-type-ids`, `create-pass-type-id`, `delete-pass-type-id` |
| Website push IDs | `list-website-push-ids`, `create-website-push-id`, `delete-website-push-id` |
| Devices | `list-devices`, `register-device`, `enable-device`, `delete-device` |
| Certificates | `list-certificates`, `create-certificate`, `download-certificate`, `delete-certificate`, `ensure-certificate` |
| Provisioning profiles | `list-profiles`, `create-profile`, `get-profile`, `regenerate-profile`, `download-profile`, `delete-profile`, `save-profile`, `inspect-profile` |
| Developer service keys | `list-developer-keys`, `create-developer-key`, `get-developer-key`, `download-developer-key`, `revoke-developer-key` |
| App Store Connect API keys | `list-api-keys`, `create-api-key`, `download-api-key`, `ensure-api-key` |
| App Store Connect accounts and apps | `get-issuer-id`, `get-provider-id`, `list-vendor-numbers`, `find-app`, `create-app`, `ensure-app` |
| Local signing material | `generate-signing-key`, `export-certificate-p12` |

`ensure-app` and `ensure-app-group` reuse an existing matching resource. The
certificate/API-key ensure actions save secrets locally and return only metadata.
For creation after a timeout or uncertain error, inspect the account before
repeating a mutation. Do not repeat creation merely because a later step failed.

## Capabilities and assignments

Before adding an assignment, read `get-bundle-id` and preserve existing IDs.
`assign-app-groups`, `assign-cloud-containers`, and `assign-merchant-ids` send the
complete desired set through repeated `--resource-id` flags. They require an
explicit `--clear` to remove all assignments. They do not enable capabilities.

`update-app-service --id APP_ID --feature-type APG3427HIY --feature-value true`
enables App Groups; use Apple's `push` feature type for push notifications.
The values `true` and `false` become booleans; other values remain strings.
After changing capabilities or assignments, create or regenerate every affected
profile. For development or ad hoc regeneration, include every device to retain
with repeated `--device-id` flags. These operations do not infer desired devices.

## Signing material

Private downloads require `--output`, create files with mode `0600` on Unix,
and refuse existing destinations. Apple private keys may be downloadable only
once. Keep the resulting file; do not delete it to retry a completed download.
`download-developer-key` and `download-api-key` refer to different Apple key types.

`generate-signing-key` writes a PKCS8 DER key with `--private-key-output` and a
PEM CSR with `--csr-output`. Pass the CSR to `create-certificate --csr`, then use
`download-certificate` for the DER certificate. `export-certificate-p12` combines
those local files and reads the password from `--password-file`. `inspect-profile
--file` reads a local profile. These operations need no Apple session.

## Play resources

API actions refresh the saved Play login, or accept `--access-token-file` as an
explicit override. `refresh-auth --output` writes a short-lived access token to
a new private file when another tool needs one. Never expose that token in chat.

`publish --asset-name NAME --package-name PACKAGE` uploads an already signed AAB
from Limrun Asset Storage. `--asset-id` is an alternative to `--asset-name`.
The app must exist and its registered upload key must match. Publishing replaces
the target track's releases. The default is `internal`; `--track production`
requires an explicit `--release-status draft|completed`. Choose the status that
matches the user's requested rollout; do not infer production release approval
from a request to authenticate or prepare an artifact.

`create-app` and `enroll-signing` use an experimental, undocumented Google API
that has not been verified end to end with an approved client. Google must
approve the OAuth client for either `https://www.googleapis.com/auth/play_console`
or `https://www.googleapis.com/auth/playdeveloperapp`. Request the approved one
with `lim android play auth --client-config PATH --console-scope SCOPE`.
The normal `androidpublisher` scope is not sufficient for these actions.

Creation requires `--developer-id`, `--package-name`, `--title`, `--app-type app|game`,
and `--pricing free|paid`. Obtain the user's actual declarations before passing
`--app-meets-guidelines` and `--us-export-compliant`; do not accept on their behalf
as a default. Creation returns numeric `developerId` and `appId`. Preserve them
and use them for the separate `enroll-signing` action. If enrollment fails after
creation, retry enrollment only. If an outcome is unknown, inspect Play Console
before repeating a mutation. Neither action publishes a release.

`generate-keystore --application-id PACKAGE` saves an upload keystore locally and
refuses to replace an existing one. `export-keystore --application-id PACKAGE
--output upload.p12 --credentials-output credentials.json` exports the PKCS12
and its passwords/alias to new private files. This does not register or reset
Google's upload key, nor does it replace the organization's Limrun signing key.
For an existing app, use its registered upload key. For an authorized build with
the exported key, use the explicit Gradle keystore flags described by
`limrun-gradle` or the [signing guide](https://docs.limrun.com/docs/android/sign-and-publish).
