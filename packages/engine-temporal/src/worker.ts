import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { getTemporalRuntimeConfig } from "./runtime";

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

export async function runWorkers() {
  const config = getTemporalRuntimeConfig();
  const connection = await NativeConnection.connect({
    address: config.address,
  });
  const workers: Worker[] = [];
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
    workers.push(
      await createWorker(connection, config.taskQueues.run),
      await createWorker(connection, config.taskQueues.window),
    );

    const runPromises = workers.map((worker) => worker.run());

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
    await connection.close();
  }
}

if (require.main === module) {
  runWorkers().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
