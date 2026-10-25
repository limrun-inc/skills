# Fold an iPhone Duo

Create a Duo instance in a region that offers it:

```bash
lim ios create --model iphone-duo
lim ios fold --json --id <instance-ID>
lim ios fold 90 --orientation landscape-left --id <instance-ID>
lim ios fold 90 --id <instance-ID>
lim ios fold 180 --id <instance-ID>
lim ios screenshot ./inner.png --display inner --id <instance-ID>
lim ios tap 300 200 --display inner --id <instance-ID>
```

The hinge accepts fractional angles from **0° (closed)** to **180° (flat)**.
Omit the angle to read fold state. `--orientation` accepts `portrait`, `pud`
(portrait upside down), `landscape-left`, or `landscape-right`; it can change
independently of the hinge angle.
This changes the native simulator hinge, so apps receive Apple's hinge and
layout updates. The browser stream starts in 2D and offers a lazy-loaded 3D
frame. Both modes provide hinge and rotation controls, with touch input on the
cover and inner display. The frame's
Sleep/Wake and volume buttons accept clicks and holds even when position is locked.
For automation, pair `buttonDown` and `buttonUp` actions with `button` set to
`side`, `volumeUp`, or `volumeDown` in `client.performActions`.

With an already connected TypeScript device client:

```ts
const fold = await client.getFoldState(); // null on an ordinary simulator
await client.setHingeAngle(110);
await client.setDuoOrientation('landscape-left');
const inner = await client.screenshotDisplay('inner');
await client.tapDisplay('inner', inner.width / 2, inner.height / 2);
```

`setDuoOrientation` accepts `portrait`, `landscape-left`, `landscape-right`,
and `pud` (upside down). Display screenshots are upright and report dimensions
in points; `tapDisplay` uses those coordinates. Use `outer` for the cover or
`inner` for the unfolding display. A display that iOS has turned off returns a
black image.

Use these display-specific methods for Duo automation. Existing screenshot,
recording, and accessibility commands do not automatically follow the inner
display. The 3D viewer supports single-finger touch and drag. Rotating the view
changes the camera; **Rotate device** changes native orientation. **Laptop view**
sets the hinge and orientation; it does not enable Apple's separate Table Mode.
