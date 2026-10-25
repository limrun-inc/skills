# Pick the Xcode version

A sandbox builds with its node's default Xcode (26.4 today). The fleet carries
one released (GA) Xcode per major plus one beta while Apple seeds one: today
26.4 GA, 27.0 GA and 27.1 beta. Two selectors cover them:

- A bare major (`27`) binds the newest GA release of that major, never a beta,
  and follows Apple's point releases on its own. Use it for App Store builds.
- A major.minor (`27.1`) pins that exact version. This is how you pick a beta.

Set a preference once for the workspace; every later build, test, RBE session
and new sandbox follows it, and the flag overrides it for one command:

```bash
lim xcode version list      # Select is the value to type, Channel is ga or beta; * marks the one in use
lim xcode use xcode@27      # prefer the Xcode 27 GA for this workspace; switches the remembered sandbox now
lim xcode build .           # builds with 27
lim xcode version           # "27.0 (27A266a)" shows the sandbox's current Xcode
lim xcode version set 27.1  # pin the 27.1 beta instead
lim xcode build . --xcode-version 26   # one-off override, not remembered
lim xcode version unset     # forget the preference; the sandbox goes back to the node default
```

Combine Xcode and mise selections with `lim xcode use xcode@27 node@24`.

For scripting, `lim xcode version list --quiet` prints one selector per line
(`26`, `27`, `27.1`) and `--json` returns `{ installed, bound, preferred }`
(`installed[].channel` is `ga` or `beta`). The table marks the Xcode in use
with `*`. `lim xcode version set` does not record a version the node lacks (the
error lists the available ones) but keeps it when the sandbox is merely busy.

When the sandbox is on another Xcode than the workspace prefers, the next
build says so and switches it first. Switching invalidates the build cache made
with the other version (the next build starts cold) and is refused while a build,
sync or `lim xcode rbe` stack is running. With persistent disk snapshots
(`--snapshot-key`), use a separate key per Xcode lane, for example `myapp-27` and
`myapp-27.1`: archives are stored per key and a restore under a different Xcode
is wiped.

A major.minor pin lasts until the fleet retires that version; then
`lim xcode build` fails with the daemon's message and a hint to run
`lim xcode version set 27` or `lim xcode version unset`. When a beta becomes GA
it replaces the beta under the same major.minor selector (one cold build); the
bare major follows the newest released Xcode of its major, so it moves to 27.1
as soon as 27.1 is GA on the node.

App Store uploads from a beta Xcode are rejected by Apple, so keep
`--upload-to-appstore` on a bare-major pin (`27`, not `27.1`). Gate on
`channel`, not `betaSeed`: Apple's 27.1 seed ships without a seed number.
