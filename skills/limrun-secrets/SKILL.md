---
name: limrun-secrets
description: Store, read, update, or delete Limrun secrets through direct Google grants, and delegate secret access to Limrun workloads. Use for shared signing credentials or publishing tokens; local Apple and Play login commands remain separate.
---

# Limrun secrets

Use the [secret API guide](https://docs.limrun.com/docs/platform/secrets) for
request examples. This feature requires an environment with secret storage
enabled. Use REST unless the installed CLI or SDK exposes these operations;
do not invent a `lim secret` command.

## Targets and permissions

Every secret has a `secret_…` TID and an organization-unique name. Permissions
are `secret:<target>:<action>`. Targets are a TID, `name/<name-or-pattern>`, or
`*`. Actions are `read`, `write`, `delete`, and `all`. Read permits enabled
versions, write creates the container or adds versions, and delete removes the
container and all versions. Any matching action exposes metadata.

Use the returned TID when a grant must stop matching after deletion and
recreation. Use `name/signing/ios` when the grant should follow that name.
Permission patterns support `*` and `?`; API operation targets are exact.
Delegating a pattern requires `secret:*:<action>` or a broader grant. Holding
a pattern permits delegation of matching concrete names, not another pattern.
API keys use wildcard targets. Signed access tokens and workload roles can
carry concrete targets.

## Console workflow

For users working in a browser, open
[Secrets](https://console.limrun.com/secrets). The page is available to all
organizations, with actions controlled by secret permissions. Use **New secret**
for generic text values up to 64 KiB. Click the masked value or eye icon to
reveal it inline. Use the pencil icon and **Save** for a new version, or
**Cancel** to discard edits. Reveal first to edit existing text, or enter a
replacement without reading it. The trash icon opens a deletion confirmation. The browser
transfers values directly to Google. Do not copy revealed values into chat.
Use REST for binary payloads.

Storage location is in **Settings → Organization → Secret storage**. Admins can choose
**US · US East** or **EU · Europe Central** and select **Save location** before
creating secrets. US is the default. A ready container
may have no saved value after an upload failure; use the pencil icon and **Save** to retry the
write. A timeout may have created a version, so do not report it as definitely
failed or retry without considering duplicate versions.

## Storage location

Organizations default to `us`. For EU payload storage, an organization
administrator must set `secretStorageLocation` to `eu` with
`PATCH /organizations/{organizationId}` before creating secrets. This endpoint
uses the organization's UUID and a user session with organization-management
permission; secret-scoped API keys and workload identities cannot change it.
`GET /organizations/{organizationId}` returns the current setting.

Both values, `eu` and `us`, apply to payload storage, not caller location or
account metadata. Check the returned secret's `storageLocation` when the user
has a residency requirement. A location change returns `409` while any secret
exists, including pending or deleting containers. Do not delete secrets merely
to change residency without an explicit instruction to discard their values.

## Transfer a value

1. Resolve the intended organization and configured API URLs. For a user or CI
   client, use an existing Limrun API credential in the Authorization header.
2. Ensure metadata with `PUT /v1/organizations/{org}/secrets`, body
   `{"name":"signing/ios","type":"signing-key"}`. This operation never accepts
   a payload. Save the returned `id` and require `state: "ready"`.
3. Request `POST /v1/secrets/access_tokens` at the regional API URL with
   `{"target":"name/signing/ios","action":"write"}`. A TID can replace the name.
4. Send the base64-encoded bytes directly to
   `https://secretmanager.googleapis.com/v1/{resource}:addVersion`, using the
   returned Google `accessToken` and `{"payload":{"data":"<base64>"}}`.
5. For reads, request an action `read` grant, then GET
   `https://secretmanager.googleapis.com/v1/{resource}/versions/latest:access`.
   A returned version number can replace `latest`. Decode `payload.data`.

Keep the value and both kinds of bearer credential out of chat, logs, command
arguments, and source control. Consume responses in-process or through private
files. Never send a Limrun credential to Google. A local credential file created
by Apple or Play auth is not automatically uploaded; transfer only the values
the user intends to share.

Honor `expiresAt`. Read grants cover all enabled versions of one secret; write
grants can add multiple versions until expiry. On an ambiguous write timeout,
report that a version may have been created before retrying. Bound propagation
retries and surface persistent 403 or 503 responses.

## Workloads

Delegate `secret:name/signing/ios:read` in `spec.role.permissions` when creating
or conditionally updating an instance. The caller must cover the complete
permission list it delegates.

Inside the instance, reread `LIMRUN_WORKLOAD_IDENTITY_TOKEN_FILE` and use its
contents as the bearer token for `DIRECTOR_URL + "/v1/secrets/access_tokens"`.
The exchange checks the current assignment and role. Ordinary workload
`/v1/access_tokens` exchanges carry asset grants only; a cached SDK token cannot
substitute for the original identity here. Shared build workers cannot request
instance secret grants.

Role changes prevent future grants, but already-issued Google tokens remain
usable until expiry. User and API-key revocation also depend on regional
replication. Do not promise immediate revocation of existing Google tokens.

## Metadata and deletion

List with `GET /v1/organizations/{org}/secrets`; `nameFilter` is an exact name,
and `limit`/`offset` paginate visible metadata. Get one record or delete it at
`/v1/organizations/{org}/secrets/{secretTID}`. Deletion removes every version.
Confirm the user intends that deletion when their request is ambiguous.
An operation failure may leave `pending` or `deleting` metadata while it
retries; do not claim success from the initial request alone.

## Issuer diagnostics

Audit actions `secret.metadata.create`, `secret.metadata.reuse`, and
`secret.metadata.read` describe container metadata. Reuse returns the existing
container without writing a value. A failed create-or-reuse request is
`secret.metadata.ensure`. `secret.access_token.create` records the grant request;
check its outcome and permissions. It does not prove a value transfer.
`secret.read` and `secret.write` are reserved for actual value access and are
not currently emitted in Limrun's Audit Logs. New events capture the API-key
name or signed-in user's email at the time of the action, so renaming or
deleting that identity does not change the recorded name. Signed tokens appear
as `Access token`; workloads appear as `Instance`.

Production uses one public issuer across regions:
`https://api.limrun.com/identity`. Its discovery document is at
`/identity/.well-known/openid-configuration` and public keys at `/identity/jwks`
on `api.limrun.com`; these GET requests need no credential. Do not look for
regional `/secret-issuer` endpoints. The secret API returns a Google access
token, not a token to verify against Limrun's public JWKS.

## Console store connections

The Secrets page offers **Connect App Store Connect** and **Connect Play Console**
for every organization, subject to secret permissions. Apple sign-in creates or
reuses an App Manager API key at `<team-id>/APP_STORE_CONNECT_API_KEY`; it requires
read and write permission. Play can use a short-lived Google sign-in token with
`cloud-platform` scope to list a project's service accounts and create a key, or
accept an existing service-account JSON file. It requires write permission for
the selected secret name. Google IAM permissions and the organization's key
creation policy still apply, and Play Console permissions must be granted to the
service account separately. Key values travel from the browser directly to
Google secret storage. A failed save can be retried while the dialog remains
open without creating another provider key. Deleting a secret does not revoke
its provider key.
