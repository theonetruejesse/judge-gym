import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import workflow from "@convex-dev/workflow/convex.config";

const app = defineApp();
app.use(rateLimiter);
app.use(workflow);

export default app;
