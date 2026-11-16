---
name: limrun-access-tokens
description: "Create and revoke Limrun access tokens through the CLI or TypeScript SDK. Use when delegating temporary instance control, interactive streaming, asset access, device installation, or service access, or choosing permissions and token lifetimes."
---

# Limrun access tokens

Mint an access token to give another client temporary access without sharing an
organization API key. Use the permission and lifetime needed for the requested
task. Creating a token does not create an instance or asset.

## Authentication

Use `lim login` or an existing `LIM_API_KEY`. Install the CLI if needed with
`npm install --global lim`. If a command or flag is unavailable, check
`lim access-token create --help` or `lim access-token revoke --help` and the
installed CLI version.

The caller needs `accesstoken:*:all` and must hold every permission it delegates.
An access token cannot expand the caller's permissions. Permission strings use
`resource:target:action`; the action wildcard is `all`, not `*`.

## Choose permissions

For an existing instance, use its returned ID exactly:

| Instance | Resource and ID prefix | Accepted actions |
| --- | --- | --- |
| iOS simulator | `ios`, `ios_` | `stream`, `control`, `all` |
| Android emulator | `android`, `android_` | `stream`, `control`, `all` |
| Xcode sandbox | `xcode`, `sandbox_` | `control`, `all` |
| Gradle sandbox | `gradle`, `gradle_` | `control`, `all` |

`stream` permits interactive streaming, including touch and typing. Give the
client the token and `status.endpointWebSocketUrl`. It cannot install or
explicitly launch apps, use the device API or ADB, or fetch the instance record.

`control` permits runtime control through the instance's endpoints, including streaming
where supported. Give a device or build client the token and `status.apiUrl`.
Have the backend supply the endpoint URL alongside the token.

Access tokens use the same endpoint permissions as API keys. Instance targets may
be a concrete ID or `*`. Named grants permit operations on that instance; wildcard
`all` also permits listing and lifecycle management. `create` requires a wildcard target. Instance `read`, build `work`, and device
`tunnel` permissions can be delegated when held by the caller. Changing an instance
role additionally requires authority to delegate its permissions. Organization,
billing, membership, and API-key administration still require a member session.
Issuing long-lived private-tunnel credentials requires an API key or member
session with the required tunnel permission; access tokens cannot issue them.

Reusing an instance through `reuseIfExists` requires `control` on the matched instance.
A create-only credential receives `403` when a matching instance exists. Binding
an Xcode cache key after creation requires `xcode:<instance-id>:update`.

Other accepted grants include:

| Permission | Purpose |
| --- | --- |
| `asset:<target>:<action>` | Asset access. Targets can be an asset ID, `name/<name-or-pattern>`, or `*`. Actions are `read`, `create`, `upload`, `update`, `delete`, and `all`; `create` requires a name target or `*`. |
| `device:*:install` | Physical-device installation; also needs `asset:<target>:read` for the asset. |
| `applerelay:*:connect` | Apple Account authentication relay access. |
| `remotecache:*:read` or `remotecache:*:all` | Read the organization's Bazel cache, or read and write it. |
| `remoteexecution:*:all` | Execute actions through the organization's Bazel service. |

For asset pattern delegation, organization roles, or workload-role permissions,
consult [Permissions and access tokens](https://docs.limrun.com/docs/reference/permissions).
Workload roles grant asset access from inside an instance; they do not grant
another client control of it.

## Create and revoke with the CLI

```bash
lim access-token create \
  --permission "ios:$INSTANCE_ID:stream" \
  --ttl-seconds 900 \
  --json
```

Use `control` for instance runtime access. The default `status.token` carries this permission. It cannot create, update, or delete instance records. Grant `create`, `update`, and `delete` separately for lifecycle management; `all` includes every action. Repeat `--permission` to combine grants,
for example an asset read permission and `device:*:install`.

The JSON response includes `id`, `token`, `permissions`, and `expiresAt`.
Save `id` for revocation and pass `token` to the intended client.
`--quiet` prints only the token; `--quiet --json` keeps the JSON response.

```bash
lim access-token revoke "$TOKEN_ID"
# Or pass the token itself:
lim access-token revoke "$ACCESS_TOKEN"
```

CLI revocation accepts the returned ID or the `lim_st_...` token value. It
extracts the token's JWT `jti` and sends only that ID, authenticated with your
API key or login. Tokens without a `jti`, including `status.token` and
`status.streamToken`, cannot be revoked this way. Output contains the resolved
ID, not the supplied token. Repeating a revoke call is safe. A failed request
is not confirmation of revocation.

## TypeScript SDK

```ts
import Limrun from '@limrun/api';

const lim = new Limrun(); // Reads LIM_API_KEY.
const access = await lim.accessTokens.create({
  permissions: [`xcode:${instance.metadata.id}:control`],
  ttlSeconds: 900,
});

// Give the build client instance.status.apiUrl and access.token.
// When the credential is no longer needed:
await lim.accessTokens.revoke(access.id);
```

The SDK revoke method takes an ID. Use `accessTokens` and `permissions` in new integrations. For REST, the matching
routes are `POST /v1/access_tokens` and `DELETE /v1/access_tokens/{id}`;
authenticate with the customer credential in the Authorization Bearer header.

## External workload identities

For SDK code running in CI or another service, an organization admin can configure
[workload identity federation](https://docs.limrun.com/docs/platform/workload-identity-federation).
The admin creates an identity provider with the issuer, JWKS URL, audience and
provider condition, then creates bindings with workload conditions and fixed
permissions. One provider can serve multiple bindings.
The TypeScript, Python, and Go SDKs read `LIMRUN_WORKLOAD_IDENTITY_TOKEN_FILE` and
`LIMRUN_WORKLOAD_IDENTITY_BINDING_ID` when no API key is configured. The file contains the
external JWT. The SDK exchanges it for a Limrun session and re-reads it on renewal.
The runtime must rotate that source file. Federation uses a form-encoded token
exchange at `https://sts.limrun.com/v1/access_tokens`; existing JSON issuance
requests keep their request and response formats.
For transient identity-provider failures, STS returns `503 temporarily_unavailable`.
Honor `Retry-After` before retrying with backoff. Malformed JWKS and provider
configuration errors return `400 invalid_request` with an `error_description`;
ask an administrator to fix the provider instead of retrying automatically.

TypeScript also accepts explicit `workloadTokenFile` and `bindingId` options:

```ts
const lim = new Limrun({
  workloadTokenFile: '/var/run/identity/token',
  bindingId: 'binding_REPLACE_WITH_BINDING_ID',
});
```

Federation bindings accept only `ios`, `android`, `xcode`, `gradle`, `asset`,
`secret`, `tunnel`, `nodepool`, `remotecache`, `remoteexecution`, `analytics`,
`device`, `applerelay`, and `accesstoken` permissions. They reject `organization`,
`member`, `billing`, `apikey`, and wildcard resource types such as `*:*:all`.
Resource ID wildcards such as `xcode:*:all` remain valid.

The binding grants a fixed permission list after verifying issuer, audience,
signature, expiry, and both the provider and binding conditions. Add `accesstoken:*:all` to the
binding only when the workload needs to delegate tokens. Derived tokens cannot
outlive their source credential. The CLI still uses `lim login` or `LIM_API_KEY`.

## Lifetime and revocation

Tokens created with an API key or CLI login default to one hour.
`--ttl-seconds` and `ttlSeconds` accept integers from 1 through 14,400.

The management and registry APIs check revocation after it propagates. Instance
endpoints verify tokens offline and continue accepting them until expiry or
instance termination. Revocation does not close existing connections or
terminate the instance. Revoking a parent does not revoke already-issued children,
but every descendant is capped by its parent's expiry. Repeated delegation cannot
extend the original token's lifetime. Choose the lifetime with these limits in mind.
