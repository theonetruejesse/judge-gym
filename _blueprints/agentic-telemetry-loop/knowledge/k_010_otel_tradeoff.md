# OpenTelemetry Tradeoff for This Architecture

**Confidence:** 0.90

**Sources:**
- https://opentelemetry.io/docs/concepts/signals/
- https://opentelemetry.io/docs/collector/
- https://opentelemetry.io/docs/specs/otel/logs/data-model/
- https://docs.convex.dev/functions/actions
- https://docs.convex.dev/functions/runtimes

**Summary:**
OTel gives standardized multi-signal observability and backend portability, but adopting it immediately adds integration complexity. A phased approach (internal telemetry first, OTel bridge later) aligns with current repo constraints.
