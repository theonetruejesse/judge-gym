import { setTimeout as sleep } from 'node:timers/promises';
import { runWorker } from './worker';

const RETRY_DELAY_MS = Number(process.env.TEMPORAL_RETRY_DELAY_MS ?? 5000);

async function run() {
  for (;;) {
    try {
      await runWorker();
      return;
    } catch (error) {
      console.error(
        `Temporal worker failed to start. Retrying in ${RETRY_DELAY_MS}ms.`,
        error,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
