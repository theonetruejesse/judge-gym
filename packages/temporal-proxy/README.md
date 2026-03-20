# temporal-proxy

Separate deployable Railway service for exposing a worker-compatible gRPC endpoint in
front of Railway's `Temporal Frontend` service.

This is not part of `engine-temporal`. It should be deployed as its own Railway
service and pointed at the internal Railway address of `Temporal Frontend`.

## Why it exists

The raw Railway `Temporal Frontend` exposures in this project are reachable, but they
do not currently present a Temporal worker-compatible gRPC transport to the local
Temporal worker. This proxy uses Caddy to forward requests to the internal Temporal
Frontend over `h2c`, which is the shape gRPC expects for this deployment.

## Railway setup

Deploy this package as a new Railway service using the included `Dockerfile`.

Required Railway variables:

- `TEMPORAL_FRONTEND_UPSTREAM`

Recommended value:

- the internal Railway hostname for `Temporal Frontend` plus port `7233`

Example:

```bash
TEMPORAL_FRONTEND_UPSTREAM=temporal-frontend.railway.internal:7233
```

Use the actual private Railway service hostname for your project.

## Public exposure

Expose this service publicly and use that address for:

- local `engine-temporal`
- Convex deployment env (`TEMPORAL_ADDRESS`)

If you expose it on a normal Railway HTTPS domain, point clients at port `443` and
enable TLS in the Temporal client/worker env.

If you expose it through Railway TCP public networking, target port `8080`.

## Health check

The proxy exposes:

- `GET /healthz`

for Railway health checks.
