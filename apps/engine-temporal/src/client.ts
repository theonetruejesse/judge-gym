import { Client, Connection } from "@temporalio/client";
import { nanoid } from "nanoid";
import { getTemporalRuntimeConfig } from "./runtime";
import { runWorkflow } from "./workflows";

function parseArgs() {
  const [processId = `local-${nanoid(8)}`] =
    process.argv.slice(2) as [string?];
  return { processId };
}

async function run() {
  const { processId } = parseArgs();
  const config = getTemporalRuntimeConfig();
  const connection = await Connection.connect({
    address: config.address,
    tls: config.tls,
  });
  const client = new Client({
    connection,
    namespace: config.namespace,
  });

  const workflowId = `run:${processId}`;
  const handle = await client.workflow.start(runWorkflow, {
    taskQueue: config.taskQueues.run,
    args: [{ runId: processId }],
    workflowId,
  });

  console.log(`Started run workflow ${handle.workflowId}`);
  console.log(await handle.result());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
