# Disk snapshots

Reuse source files, dependencies, and DerivedData across Xcode instances.

CLI **0.35.1 and earlier** use `--cache-*` instead of `--snapshot-*`, and
`--wait-cache` instead of `--wait-snapshot`. The snapshot rename preserves
the old flags as aliases.

From the project directory, create with a snapshot key, build, then delete:

```bash
XCODE_ID=$(lim xcode create --snapshot-key myapp-main --quiet)
lim xcode build . --id "$XCODE_ID" --scheme MyApp
lim xcode delete "$XCODE_ID" --wait-snapshot
```

The first run starts cold; later runs restore the saved snapshot. Termination
saves it after a successful build with no later sync, replacing the previous
snapshot under that key. `--wait-snapshot` waits for the save and reports its
result. In CI, run deletion in a cleanup step even if the build fails.

Leave `--snapshot-paths` unset to save the whole workspace. Keep the project
folder's name unchanged between runs. Use separate keys per project, Xcode
version, and concurrent CI job.

For branch fallbacks, add `--snapshot-restore-keys "myapp-pr51,myapp-main"`
at creation. Each entry tries an exact match, then the newest matching literal
prefix, before moving to the next entry. Without this flag, the save key is
also the restore key. Pass only restore keys to reuse a snapshot without saving.

Configure snapshots at creation. Restore keys and paths stay fixed.
On an existing instance, `build --snapshot-key` can only bind an unassigned
save key if snapshots were already enabled; it does not restore or enable them.

See the [disk snapshot guide](https://docs.limrun.com/docs/ios/snapshots) for skipped
saves, cold builds, and SDK usage.
