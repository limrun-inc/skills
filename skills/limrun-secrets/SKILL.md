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
