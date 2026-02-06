import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config";
import workflow from "@convex-dev/workflow/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

const app = defineApp();
app.use(agent);
app.use(workflow);
app.use(rateLimiter);

export default app;
