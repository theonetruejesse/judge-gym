# Config Durability and Versioning Patterns

**Confidence:** 0.63

**Sources:**
- https://assets.temporal.io/w/ensuring-deterministic-execution.pdf
- https://web.temporal.io/blog/workers-in-production
- https://docs.prefect.io/v3/deploy/deployment-versioning
- https://www.prefect.io/blog/how-to-roll-back-deployments-in-prefect-with-deployment-versioning
- https://legacy-versioned-docs.dagster.dagster-docs.io/concepts/configuration/config-schema
- https://airflow.apache.org/docs/apache-airflow/stable/administration-and-deployment/pools.html
- https://airflow.apache.org/docs/apache-airflow/1.10.8/best-practices.html
- https://docs.prefect.io/v3/api-ref/python/prefect-cli-concurrency_limit

**Summary:**
Workflow engines emphasize immutability and reproducibility: Temporal requires deterministic workflows and provides version-aware branching; Prefect versions deployments on each update and encourages immutable code references (git SHA or image digest) with captured SCM metadata; Dagster validates run config against a schema before execution. Airflow encourages idempotent tasks and provides pools to rate-limit concurrency, while Prefect supports tag-based concurrency limits. These patterns align with storing a validated, versioned run-config snapshot as the durable source of truth and enforcing rate/constraint policies centrally.
