---
name: limrun-store-auth
description: "Connect Apple and Google Play publishing accounts with lim ios apple-auth and lim android play-auth, saving credentials on the user's computer for later builds. Use for store sign-in, Desktop OAuth client setup, or renewing a saved store login, not simulator account login or ordinary lim login."
---

# Connect store accounts with Limrun

Use these commands to save publishing credentials on the user's computer. They
do not create build instances, store listings, or Android upload keys. An
authentication request alone does not authorize a build or a store upload.

## Choose where to run

Check `lim ios apple-auth --help` or `lim android play-auth --help` when the
installed CLI's capabilities are unclear. Install the CLI with
`npm install --global lim` if needed. Apple authentication and later builds need
`lim login` or an existing `LIM_API_KEY`.

Apple sign-in requires an interactive terminal. Google sign-in requires the
CLI and browser on the same computer because the browser redirects to a local
callback. If the agent runs in a remote sandbox or cannot let the user enter
credentials privately, give the user the command to run on their own computer.
Credentials saved there are available to builds launched from that computer,
not automatically to a remote agent.

Never ask for passwords, verification codes, OAuth client secrets, or tokens
in chat. Use file paths supplied by the user and command completion messages;
do not print credential files to inspect them.

## Apple

The user must be an administrator of the Apple Developer team. Run:

```bash
lim ios apple-auth
# Optionally select the account and team:
lim ios apple-auth --account you@example.com --team-id YOUR_TEAM_ID
```

The user enters the password and verification code in the terminal and chooses
a team if necessary. The CLI creates or reuses an App Store Connect API key;
new keys have the `ADMIN` role. It saves the key in `~/.lim/secrets`, never the
Apple password. Completion reports the team and credential directory.

For a subsequent authorized build, saved credentials support cloud signing
and upload:

```bash
lim xcode build . --sdk iphoneos \
  --signing-method app-store-connect --upload-to-appstore
```

If several teams are saved, pass `--team-id` on the build. Any explicit ASC
credential flag selects explicit credentials as a group: supply `--asc-key`
and `--asc-key-id`, plus `--asc-issuer-id` for a team key. The CLI does not
fill a partial group from the saved login. The App Store Connect app record
must already exist. Use `limrun-xcode` when available for the build workflow.

## Google Play

Require the path to a downloaded Google OAuth **Desktop app** client JSON
file. A web OAuth client or service-account key is not valid for `play-auth`.
The Google Cloud project needs the Google Play Android Developer API enabled
and a configured OAuth consent screen, with the user added as a test user when
applicable. The Google account must have publishing access to the target app
in Play Console. See the [setup guide](https://docs.limrun.com/docs/guides/store-authentication#connect-a-google-account)
if the user still needs to create the client.

```bash
lim android play-auth --client-config /path/to/client_secret.json
```

The user signs in and grants access in the browser. If automatic opening fails,
they can open the URL printed by the command on the same computer. Wait for
the CLI to report saved credentials before treating sign-in as complete.

The CLI saves one Google login, including the client configuration and refresh
token. A new successful login replaces it. Later publishing refreshes an access
token locally; the refresh token stays on the computer. Explicit
`--playstore-service-account` or `--playstore-access-token` credentials take
precedence, including `LIM_PLAYSTORE_ACCESS_TOKEN`.

For a subsequent authorized build:

```bash
lim gradle build . --sign --upload-to-playstore
```

The Play listing must already exist, and the AAB must use the registered upload
key. `--sign` uses the separate upload key stored for the Limrun organization.
Use `limrun-gradle` when available for signing and publishing details. If token
refresh fails, have the user repeat `play-auth`; do not request their token.

## Remove saved access

Credentials are unencrypted JSON under `~/.lim/secrets`. Unix permissions are
`0700` for the directory and `0600` for files. Keep them out of source control.
The Apple API key is sent to the build sandbox when signing or uploading;
Google publishing sends only a refreshed access token.

`lim logout` clears only the Limrun login. When the user requests local removal,
delete the relevant file, preserving other saved accounts:

- Apple: `~/.lim/secrets/appStoreConnectApiKey__YOUR_TEAM_ID%2FAPP_STORE_CONNECT_API_KEY.json`
- Google: `~/.lim/secrets/googlePlayOAuth__default.json`

Local deletion does not revoke access at the provider. For provider revocation,
the user revokes the API key in App Store Connect or removes the OAuth grant in
their Google Account.
