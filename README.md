# Enable cloud agents to build mobile apps

These skills let your coding agent use remote services like XCode, iOS Simulator and Android Emulator
without any change in its own environment. The repo also packages them, together with the
[Limrun MCP server](https://docs.limrun.com/docs/agents/remote-mcp), as a plugin for every major
agent platform.

Sign up at [Limrun](https://lim.run) to get a `LIM_API_KEY`.

If your work email domain has SSO configured and verified, use **Continue with SSO** in the console, including for your first signup. Other sign-in methods are blocked for that domain. See the [SSO setup guide](https://docs.limrun.com/docs/reference/single-sign-on).

## Install

The `lim` CLI installs the skills into whichever agent you use and keeps them updated:

```bash
lim skills install
```

### Alternatives

If you prefer your agent's own plugin or skills mechanism:

| Agent | Command |
|---|---|
| skills CLI (any agent) | `npx skills add limrun-inc/skills` |
| Claude Code | `/plugin marketplace add limrun-inc/skills` then `/plugin install limrun@limrun` |
| Codex CLI | `codex plugin marketplace add limrun-inc/skills` then `codex plugin install limrun` |
| Gemini CLI | `gemini extensions install https://github.com/limrun-inc/skills` |
| Cursor | Cursor Marketplace, or copy this repo to `~/.cursor/plugins/local/limrun` |

The plugin bundles all skills plus the remote MCP server at `https://mcp.limrun.com/mcp`
(OAuth sign-in on first use, or set an org API key as a bearer token).

## Maintaining

`distribution.json` is the single source of truth for publishing metadata. Every manifest
(`plugin.json`, `mcp.json`, `.claude-plugin/`, `.codex-plugin/`, `.agents/`,
`gemini-extension.json`, `.mcp.json`) is generated:

```bash
npm run generate   # regenerate manifests after editing distribution.json or skills
npm run validate   # skills + catalog validation
```

CI fails if a manifest is stale, and PRs that change skills or manifests must bump the
version: `npm run bump` (patch) or `npm run bump minor`. Merges to main tag and release
the new version automatically.

## Instance webhooks

Use [instance webhooks](https://docs.limrun.com/docs/reference/webhooks) to receive `instance.created`, `instance.ready`, and `instance.terminated` notifications for iOS, Android, Xcode, and Gradle instances. The payload's `product` is `ios`, `android`, `xcode`, or `gradle`; Xcode instance IDs keep the `sandbox_` prefix. An organization admin configures one URL in **Console → Settings → Webhooks** before creating instances. The optional Authorization field supplies the full header value required by the receiver, such as `Bearer your-token`. Saved values are never returned; a blank field keeps the value only when the URL is unchanged. Changing the URL clears it unless a replacement is supplied. API keys, members, viewers, and instance tokens cannot manage webhook settings. Use HTTPS on port 443 with a public ASCII DNS hostname and a valid TLS certificate. Embedded credentials, URL fragments, and private or special-use destinations are rejected. Redirects are not followed. Save the returned signing secret, verify each request's HMAC signature, and deduplicate by event ID. Every save rotates the secret. Delivery is best effort with up to five attempts and exponential backoff. Retries keep the same event ID and payload and do not survive service restarts. Notifications can be lost or arrive out of order; use the instance API when you need to confirm its current state. There is no replay API.
