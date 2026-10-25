# Reach local and private-network services

## Reaching services on the local machine

Destination tunnels let an iPhone simulator app keep calling its normal
destinations while the CLI dials them from the machine running `lim`. Select
exact `localhost:port` or literal `IP:port` destinations, or domains that only
your machine or VPN can reach:

```bash
lim ios tunnel \
  --id <ios-instance-id> \
  --selector localhost:3000 \
  --selector localhost:8081 \
  --selector "*.staging.example" \
  --detach
```

Use the app's normal URLs, such as `http://localhost:3000`. Declaring
`localhost:3000` also captures loopback forms such as `127.0.0.1:3000` and
`[::1]:3000`, plus `[::ffff:127.0.0.1]:3000`. Domain selectors (exact
`api.corp.example` or label-bound wildcard `"*.staging.example"`) are
intercepted on the simulator and dialed from your machine whether or not the
name resolves on public DNS, so your DNS and VPN apply. Apps that resolve DNS
themselves over HTTPS bypass domain interception.
A tunnel carries TCP only: up to ten exact selectors and 64 domain selectors,
ports 1-65535 except 53; CIDRs and UDP are not supported. Start the tunnel
before launching the app or opening the page: connections opened earlier keep
their original route, so relaunch the app if it connected first.

One instance accepts one active destination tunnel, and its selector set is
immutable. To add or remove a destination, stop the tunnel and start it again
with the complete selector list:

```bash
lim ios tunnel status --id <ios-instance-id> --json
lim ios tunnel stop --id <ios-instance-id>
```

If the simulator attempts a route while its local service is stopped, the
tunnel remains active and reports `connection_refused`; restart the service
without recreating the simulator or tunnel.

### Inspect HTTP traffic, capture HAR, persist a network log

Inspection is on by default: every HTTP and HTTPS request through the tunnel
is decoded, printed as one summary line per request (in the tunnel log file
when detached), and shown live in the console's network panel.

```bash
lim ios tunnel --selector "*.api.example" --har ./traffic.har --detach   # write HAR 1.2 with bodies
lim ios tunnel --selector "*.api.example" --persist --detach             # network log survives the instance
```

`--persist` uploads a body-inclusive network log as a session artifact when
the tunnel stops or the instance terminates; it appears on the instance's
session page in the console with a HAR download (default lifetime 3 days,
`--ttl <seconds>` up to 30 days). HTTPS is decoded with a simulator-trusted
CA, so **apps with certificate pinning fail through inspected selectors**:
leave the pinned host out of the selectors or pass `--no-inspect` to keep TLS
end to end (no summaries, HAR, or persistence).

## Reaching services in a private network through a private tunnel

An organization can run a private tunnel: a connector inside its network,
created by an admin with `lim tunnel create` or in the console (Network) and
run with `lim tunnel run`, that serves every instance naming it. When the user names one, pass it at
create time instead of starting a tunnel yourself:

```bash
lim ios create --tunnel <tunnel-name>
```

The app reaches the tunnel's selectors, such as `localhost:3000` or
`*.internal.example`, at those addresses. They resolve on the connector's
machine, not on yours. The tunnel takes the instance's one destination
tunnel, so do not start or stop `lim ios tunnel` on it.

Creation checks the tunnel and fails when it is not usable:

- `tunnel <name> does not exist`: the name is wrong or the tunnel was not
  created. Ask the user for the right name.
- `tunnel <name> is offline`: no connector is running. Ask the user to
  start it.
- `did not attach within 30s`: the connector cannot attach the instance.
  Ask the user to check the connector's output.

Retrying the create in a loop does not help in any of these cases.

The tunnel's token belongs on the connector's machine. Never ask the user to
paste it into the conversation.
