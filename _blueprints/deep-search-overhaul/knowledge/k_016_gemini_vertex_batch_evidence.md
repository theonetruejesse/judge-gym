# Gemini Batch Prediction on Vertex AI (Job-Based)

**Confidence:** 0.72

**Sources:**
- https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/batch-prediction-api

**Summary:**
Gemini batch prediction on Vertex AI uses a `BatchPredictionJob` resource. Inputs are provided via `inputConfig` from Cloud Storage JSONL or BigQuery, and outputs are written to Cloud Storage or BigQuery via `outputConfig`. Completion is determined by job state, and results are retrieved from the configured output destination rather than a synchronous API response.
