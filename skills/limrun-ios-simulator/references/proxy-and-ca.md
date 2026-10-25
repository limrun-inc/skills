# Proxies and CA certificates

## Send all device traffic through a proxy

Tunnels carry only declared destinations; there is no catch-all selector. When
the user wants all traffic, Safari included, to leave through their proxy (for
example a recording proxy), point the simulator's system proxy at a proxy the
tunnel reaches. Tunnel inspection passes requests meant for the proxy through as
sent.

```bash
lim ios tunnel --selector localhost:3128 --detach --id <ios-instance-id>
lim ios proxy set localhost:3128 --id <ios-instance-id>
# later, before stopping the tunnel:
lim ios proxy clear --id <ios-instance-id>
```

With a private tunnel whose selector is the proxy, only `lim ios proxy set` is
needed. A proxy elsewhere in the user's network works the same way:
`--selector proxy.example.internal` and `lim ios proxy set
proxy.example.internal:3128`. Requests to `localhost` stay direct. New
connections use the proxy at once; apps keep connections they opened before
until relaunched. `lim ios proxy clear` restores the previous settings.

## Trust a CA certificate

Add a PEM CA certificate to the simulator's trusted roots, for example the CA
of the user's recording proxy, so the proxy can read HTTPS traffic:

```bash
lim ios ca add ./proxy-ca.pem --id <ios-instance-id>
```

Safari and apps trust it on their next connection, with no restart, for the
life of the instance. Only one CA certificate per file; leaf certificates are
rejected. Apps that pin certificates, and the simulator's Apple services,
still reject it. To look at the app's traffic without a proxy of the user's
own, use tunnel inspection (above) instead.
