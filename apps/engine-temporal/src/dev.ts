import { setTimeout as sleep } from "node:timers/promises";
import { getTemporalRuntimeConfig } from "./runtime";
import { runWorkers } from "./worker";

async function run() {
  const config = getTemporalRuntimeConfig();
  for (;;) {
    try {
      await runWorkers();
      return;
    } catch (error) {
      console.error(
        `Temporal workers failed to start. Retrying in ${config.retryDelayMs}ms.`,
        error,
      );
      await sleep(config.retryDelayMs);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
