import { NativeConnection, Worker } from "@temporalio/worker";
import { setTimeout as sleep } from "node:timers/promises";
import * as activities from "./activities";
import { getTemporalRuntimeConfig } from "./runtime";

const CONNECTION_CLOSE_RETRY_MS = 250;
const CONNECTION_CLOSE_ATTEMPTS = 5;

async function createWorker(
  connection: NativeConnection,
  taskQueue: string,
) {
  return Worker.create({
    connection,
    namespace: getTemporalRuntimeConfig().namespace,
    taskQueue,
    workflowsPath: require.resolve("./workflows"),
    activities,
  });
}

async function shutdownWorkers(workers: Worker[]) {
  await Promise.allSettled(
    workers.map(async (worker) => {
      await worker.shutdown();
    }),
  );
}

async function closeConnectionSafely(connection: NativeConnection) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= CONNECTION_CLOSE_ATTEMPTS; attempt += 1) {
    try {
      await connection.close();
      return;
    } catch (error) {
      lastError = error;
      const message =
        error instanceof Error ? error.message : String(error);
      if (
        !message.includes("Workers hold a reference to it") ||
        attempt >= CONNECTION_CLOSE_ATTEMPTS
      ) {
        throw error;
      }
      await sleep(CONNECTION_CLOSE_RETRY_MS * attempt);
    }
  }

  if (lastError) {
    throw lastError;
  }
}

export async function runWorkers() {
  const config = getTemporalRuntimeConfig();
  const connection = await NativeConnection.connect({
    address: config.address,
  });
  const workers: Worker[] = [];
  const runPromises: Promise<void>[] = [];
  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await shutdownWorkers(workers);
  };

  const handleSignal = (signal: NodeJS.Signals) => {
    console.log(`Received ${signal}. Shutting down Temporal workers...`);
    void shutdown();
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  process.once("SIGUSR2", handleSignal);

  try {
    for (const taskQueue of [
      config.taskQueues.run,
      config.taskQueues.window,
    ]) {
      const worker = await createWorker(connection, taskQueue);
      workers.push(worker);
      runPromises.push(worker.run());
    }

    try {
      await Promise.all(runPromises);
    } catch (error) {
      await shutdown();
      await Promise.allSettled(runPromises);
      throw error;
    }
  } finally {
    process.removeListener("SIGINT", handleSignal);
    process.removeListener("SIGTERM", handleSignal);
    process.removeListener("SIGUSR2", handleSignal);
    await shutdown();
    await Promise.allSettled(runPromises);
    await closeConnectionSafely(connection);
  }
}

if (require.main === module) {
  runWorkers().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
