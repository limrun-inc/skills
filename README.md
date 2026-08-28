# Enable cloud agents to build mobile apps

These skills let your coding agent use remote services like XCode, iOS Simulator and Android Emulator
without any change in its own environment. The repo also packages them, together with the
[Limrun MCP server](https://docs.limrun.com/docs/agents/remote-mcp), as a plugin for every major
agent platform.

Sign up at [Limrun](https://lim.run) to get a `LIM_API_KEY`.

Then get started!

## Install

| Agent | Command |
|---|---|
| skills CLI (any agent) | `npx skills add limrun-inc/skills` |
| Claude Code | `/plugin marketplace add limrun-inc/skills` then `/plugin install limrun@limrun` |
| Codex CLI | `codex plugin marketplace add limrun-inc/skills` then `codex plugin install limrun` |
| Gemini CLI | `gemini extensions install https://github.com/limrun-inc/skills` |
| Cursor | Cursor Marketplace, or copy this repo to `~/.cursor/plugins/local/limrun` |
| lim CLI | `lim skills install` |

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

CI fails if a manifest is stale. Bump `distribution.json`'s `version` when skills or
metadata change.
