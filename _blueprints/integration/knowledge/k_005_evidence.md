# Refactor-everything integration tests exercise lab facade

**Confidence:** 0.67

**Sources:**
- refactor-everything:packages/engine/tests/integration_lab_facade.test.ts

**Summary:**
The integration tests use ConvexHttpClient against `api.lab` endpoints to validate evidence insertion, collection, experiment init, and basic run start behavior; they also show how env gating is handled via presence of `CONVEX_URL` and provider keys.
