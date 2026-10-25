# App files, camera, clipboard, user defaults, and notifications

## App container files

List an app's data container before pulling a file so you use the exact path the
app created. Keep the same `--bundle-id` and `--container-type` flags for list,
pull, push, and delete:

```bash
lim ios ls Documents --bundle-id com.example.app --container-type data
lim ios pull-file Documents/recording.mov ./recording.mov \
  --bundle-id com.example.app --container-type data
lim ios push-file ./fixture.json Documents/fixture.json \
  --bundle-id com.example.app --container-type data
lim ios delete-file Documents/fixture.json \
  --bundle-id com.example.app --container-type data
```

`lim ios ls` defaults to the staging-folder root. With `--bundle-id`, it
defaults to the app bundle (`--container-type app`); use `data` for the app's
writable `Documents`, `Library`, and `tmp` directories. Paths in `ls` output are
relative to the selected root and can be copied directly into the other file
commands.

## Simulate the camera with a video

For camera-driven flows (QR-code scanning, document capture, video calls),
play a local video file as the simulator's camera. The app sees the frames
through its normal capture pipeline:

```bash
lim ios camera play ./fixtures/qr-scan.mp4            # loops by default
lim ios camera play ./fixtures/intro.mp4 --no-loop    # play once, freeze on last frame
lim ios camera clear                                  # restore the default camera
```

Any AVFoundation-decodable file works (H.264/HEVC in `.mp4`/`.mov`). Use
`--no-loop` when the app must observe the end of the clip exactly once (the
feed freezes on the last frame rather than stalling).

## Clipboard

Set or read the simulator clipboard. Apps paste it like text copied inside the
simulator, so the edit menu's Paste shows no permission prompt. For example, to
paste a one-time code into a login form:

```bash
lim ios clipboard set "123456"                  # or pipe it: echo 123456 | lim ios clipboard set
lim ios clipboard get
```

`lim ios simctl -- pbcopy booted` and `pbpaste booted` do the same.

## User defaults

Read, write, or delete the simulator's user defaults with its `defaults` tool.
Pass the arguments after `--`. Apps read defaults at launch, so relaunch the app
under test after a change. For example, to switch the device language and
region without UI automation:

```bash
lim ios defaults -- write -g AppleLanguages -array fr-FR
lim ios defaults -- write -g AppleLocale -string fr_FR
lim ios defaults -- read -g AppleLanguages
```

`lim ios simctl -- spawn booted defaults ...` does the same. Only `read`,
`write`, and `delete` are available.

## Darwin notifications

Post a notification, or set and read a notification's state, inside the
simulator with its `notifyutil` tool:

```bash
lim ios notify post <name>
lim ios notify set <name> <state>
lim ios notify get <name>
```

For example, the simulator drives Face ID through these notifications. Enroll
once, then answer each Face ID prompt with a match or a non-match (Touch ID
devices use `fingerTouch` in place of `pearl`):

```bash
lim ios notify set com.apple.BiometricKit.enrollmentChanged 1
lim ios notify post com.apple.BiometricKit.enrollmentChanged
lim ios notify post com.apple.BiometricKit_Sim.pearl.match      # the next scan succeeds
lim ios notify post com.apple.BiometricKit_Sim.pearl.nomatch    # the next scan fails
```

`lim ios simctl -- spawn booted notifyutil -p|-s|-g ...` does the same.
