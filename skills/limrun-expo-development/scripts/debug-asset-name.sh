#!/usr/bin/env bash
#
# Prints the fingerprint-keyed Debug asset name for the Expo app in the
# current directory, e.g. "com.acme.app/native-<hash>-debug.zip".
#
# The name is derived from the app's current native inputs via
# @expo/fingerprint (the same computation expo-updates uses for its
# "fingerprint" runtime version policy), so the caller's reuse decision is
# simply whether an asset with this exact name already exists. Native
# dependency or config changes produce a new name; pure JS/TS edits do not.
#
# Prints the asset name on stdout and nothing else. Exits nonzero with a
# reason on stderr when the name cannot be derived safely; never proceed
# with a guessed name in that case.
#
# Takes no arguments: every component of the name is derived from the
# project's current state at call time, so a cached value can never leak
# into the name after the project changed.

set -euo pipefail

fail() {
  echo "debug-asset-name: $*" >&2
  exit 1
}

[ -f app.json ] || compgen -G "app.config.*" > /dev/null \
  || fail "run this from the Expo app directory (where app.json or app.config.* lives)"

# Without installed dependencies, @expo/fingerprint still exits 0 but
# silently omits every dependency source, producing a plausible hash that
# would not change on native dependency changes. Gate on actual resolution
# rather than a node_modules directory: an empty directory must fail, and a
# monorepo with hoisted dependencies must pass.
node -e 'require.resolve("expo/package.json", { paths: [process.cwd()] })' 2>/dev/null \
  || fail "dependencies not installed (cannot resolve expo from here); run npm/yarn/bun install first"

bundle_id="$(npx expo config --type introspect --json 2>/dev/null \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const b=JSON.parse(d).ios?.bundleIdentifier;if(!b)process.exit(1);console.log(b)})')" \
  || fail "could not derive ios.bundleIdentifier from expo config"

# Pinned to major 0: hashes only need to agree across our own sessions, and
# a floating major could change output format under every agent at once.
# The parser accepts only a 40-hex hash, so "undefined"/"null"/other shapes
# fail here instead of leaking into the asset name.
fprint="$(npx -y @expo/fingerprint@0 . \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{const h=JSON.parse(d).hash;if(typeof h!=="string"||!/^[0-9a-f]{40}$/.test(h))process.exit(1);console.log(h)})')" \
  || fail "@expo/fingerprint did not produce a valid hash"

# da39a3... is the hash of an empty source list: nothing was scanned at all.
case "$fprint" in
  "" | da39a3ee5e6b4b0d3255bfef95601890afd80709)
    fail "fingerprint came back empty; project state is incomplete"
    ;;
esac

echo "${bundle_id}/native-${fprint}-debug.zip"
