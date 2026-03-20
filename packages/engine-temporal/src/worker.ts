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

export async function runWorkers() {
  const config = getTemporalRuntimeConfig();
  const connection = await NativeConnection.connect({
    address: config.address,
  });

  try {
    const workers = await Promise.all([
      createWorker(connection, config.taskQueues.run),
      createWorker(connection, config.taskQueues.window),
    ]);

    await Promise.all(workers.map((worker) => worker.run()));
  } finally {
    await connection.close();
  }
}

if (require.main === module) {
  runWorkers().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
