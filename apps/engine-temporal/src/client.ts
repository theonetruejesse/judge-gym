import { Client, Connection } from "@temporalio/client";
import { nanoid } from "nanoid";
import { getTemporalRuntimeConfig } from "./runtime";
import { runWorkflow, windowWorkflow } from "./workflows";

type ProcessKindArg = "run" | "window";

function parseArgs() {
  const [processKind = "run", processId = `local-${nanoid(8)}`] =
    process.argv.slice(2) as [ProcessKindArg?, string?];
  if (processKind !== "run" && processKind !== "window") {
    throw new Error("Usage: bun run workflow [run|window] [processId]");
  }
  return { processKind, processId };
}

async function run() {
  const { processKind, processId } = parseArgs();
  const config = getTemporalRuntimeConfig();
  const connection = await Connection.connect({
    address: config.address,
    tls: config.tls,
  });
  const client = new Client({
    connection,
    namespace: config.namespace,
  });

  const workflow =
    processKind === "run" ? runWorkflow : windowWorkflow;
  const taskQueue =
    processKind === "run"
      ? config.taskQueues.run
      : config.taskQueues.window;
  const workflowId = `${processKind}:${processId}`;
  const handle =
    processKind === "run"
      ? await client.workflow.start(runWorkflow, {
          taskQueue,
          args: [{ runId: processId }],
          workflowId,
        })
      : await client.workflow.start(windowWorkflow, {
          taskQueue,
          args: [{ windowRunId: processId }],
          workflowId,
        });

  console.log(`Started ${processKind} workflow ${handle.workflowId}`);
  console.log(await handle.result());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
