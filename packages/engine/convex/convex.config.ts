import { defineApp } from "convex/server";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import workflows from "@convex-dev/workflow/convex.config";

const app = defineApp();
app.use(rateLimiter);
app.use(workflows);

export default app;
