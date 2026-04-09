# Build iOS Apps Plugin

This plugin packages iOS and Swift workflows in `plugins/build-ios-apps`.

It currently includes these skills:

- `limrun-skill` — build, run, and test iOS apps on Limrun cloud simulators
- `ios-app-intents`
- `swiftui-liquid-glass`
- `swiftui-performance-audit`
- `swiftui-ui-patterns`
- `swiftui-view-refactor`

## What It Covers

- building, running, and testing iOS apps on Limrun cloud simulators
- designing App Intents, app entities, and App Shortcuts for system surfaces
- building and refactoring SwiftUI UI using current platform patterns
- reviewing or adopting iOS 26+ Liquid Glass APIs
- auditing SwiftUI performance and guiding profiling workflows
- restructuring large SwiftUI views toward smaller, more stable compositions

All iOS builds and simulator operations run on **Limrun cloud infrastructure** — no local Xcode or simulator required.

## Plugin Structure

The plugin now lives at:

- `plugins/build-ios-apps/`

with this shape:

- `.codex-plugin/plugin.json`
  - required plugin manifest
  - defines plugin metadata and points Codex at the plugin contents

- `agents/`
  - plugin-level agent metadata
  - currently includes `agents/openai.yaml` for the agent surface

- `skills/`
  - the actual skill payload
  - each skill keeps the normal skill structure (`SKILL.md`, optional
    `agents/`, `references/`, `assets/`, `scripts/`)
