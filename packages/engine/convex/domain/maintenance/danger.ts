import z from "zod";
import { zInternalMutation } from "../../utils/custom_fns";
import { zid } from "convex-helpers/server/zod4";
import type { DataModel, Doc } from "../../_generated/dataModel";

const tableNames = [
    "llm_batches",
    "llm_jobs",
    "llm_requests",
    "process_request_targets",
    "windows",
    "evidences",
    "pools",
    "pool_evidence",
    "experiments",
    "runs",
    "samples",
    "rubrics",
    "rubric_critics",
    "scores",
    "score_critics",
    "sample_evidence_scores",
    "telemetry_events",
    "telemetry_entity_state",
] as const satisfies ReadonlyArray<keyof DataModel>;

type TableName = (typeof tableNames)[number];
const tableNameEnum = z.enum(tableNames);

type TableDeletePlan = {
    name: TableName;
    count: number;
};

export const nukeTables = zInternalMutation({
    args: z.object({
        isDryRun: z.boolean().default(true),
    }),
    returns: z.object({
        isDryRun: z.boolean(),
        tables: z.array(
            z.object({
                name: tableNameEnum,
                count: z.number(),
            }),
        ),
    }),
    handler: async (ctx, args) => {
        const { isDryRun } = args;
        const tables: TableDeletePlan[] = [];

        for (const tableName of tableNames) {
            const docs = await ctx.db.query(tableName).collect();
            tables.push({ name: tableName, count: docs.length });

            if (!isDryRun) {
                for (const doc of docs as Doc<TableName>[]) {
                    await ctx.db.delete(doc._id);
                }
            }
        }

        return { isDryRun, tables };
    },
});

export const nukeTableChunk = zInternalMutation({
    args: z.object({
        table: tableNameEnum,
        limit: z.number().int().min(1).max(10000).default(2000),
        isDryRun: z.boolean().default(true),
    }),
    returns: z.object({
        table: tableNameEnum,
        isDryRun: z.boolean(),
        requested_limit: z.number(),
        deleted_count: z.number(),
        has_more: z.boolean(),
    }),
    handler: async (ctx, args) => {
        const docs = await ctx.db.query(args.table).take(args.limit);
        if (!args.isDryRun) {
            for (const doc of docs as Doc<TableName>[]) {
                await ctx.db.delete(doc._id);
            }
        }
        return {
            table: args.table,
            isDryRun: args.isDryRun,
            requested_limit: args.limit,
            deleted_count: docs.length,
            has_more: docs.length === args.limit,
        };
    },
});

export const nukeTablesPass = zInternalMutation({
    args: z.object({
        limitPerTable: z.number().int().min(1).max(10000).default(2000),
        isDryRun: z.boolean().default(true),
    }),
    returns: z.object({
        isDryRun: z.boolean(),
        limitPerTable: z.number(),
        total_deleted: z.number(),
        tables: z.array(
            z.object({
                name: tableNameEnum,
                deleted_count: z.number(),
                has_more: z.boolean(),
            }),
        ),
    }),
    handler: async (ctx, args) => {
        const tables: Array<{ name: TableName; deleted_count: number; has_more: boolean }> = [];
        let totalDeleted = 0;

        for (const tableName of tableNames) {
            const docs = await ctx.db.query(tableName).take(args.limitPerTable);
            if (!args.isDryRun) {
                for (const doc of docs as Doc<TableName>[]) {
                    await ctx.db.delete(doc._id);
                }
            }
            totalDeleted += docs.length;
            tables.push({
                name: tableName,
                deleted_count: docs.length,
                has_more: docs.length === args.limitPerTable,
            });
        }

        return {
            isDryRun: args.isDryRun,
            limitPerTable: args.limitPerTable,
            total_deleted: totalDeleted,
            tables,
        };
    },
});

export const deleteRunData = zInternalMutation({
    args: z.object({
        run_id: zid("runs"),
        isDryRun: z.boolean().default(true),
        allow_active: z.boolean().default(false),
    }),
    returns: z.object({
        isDryRun: z.boolean(),
        run_id: zid("runs"),
        trace_id: z.string(),
        deleted: z.object({
            runs: z.number(),
            samples: z.number(),
            sample_evidence_scores: z.number(),
            rubrics: z.number(),
            rubric_critics: z.number(),
            scores: z.number(),
            score_critics: z.number(),
            llm_batches: z.number(),
            llm_jobs: z.number(),
            llm_requests: z.number(),
            process_request_targets: z.number(),
            telemetry_events: z.number(),
            telemetry_entity_state: z.number(),
        }),
    }),
    handler: async (ctx, args) => {
        const traceId = `run:${args.run_id}`;
        const isDryRun = args.isDryRun;

        const run = await ctx.db.get(args.run_id);
        if (!run) {
            return {
                isDryRun,
                run_id: args.run_id,
                trace_id: traceId,
                deleted: {
                    runs: 0,
                    samples: 0,
                    sample_evidence_scores: 0,
                    rubrics: 0,
                    rubric_critics: 0,
                    scores: 0,
                    score_critics: 0,
                    llm_batches: 0,
                    llm_jobs: 0,
                    llm_requests: 0,
                    process_request_targets: 0,
                    telemetry_events: 0,
                    telemetry_entity_state: 0,
                },
            };
        }

        const activeStatuses = new Set<Doc<"runs">["status"]>([
            "start",
            "queued",
            "running",
            "paused",
        ]);
        if (activeStatuses.has(run.status) && !args.allow_active) {
            throw new Error(
                `Refusing to delete active run ${args.run_id} with status=${run.status}. ` +
                    "Pass allow_active=true to override.",
            );
        }

        const samples = await ctx.db
            .query("samples")
            .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
            .collect();

        const scoreUnits = await ctx.db
            .query("sample_evidence_scores")
            .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
            .collect();
        const rubrics = await ctx.db
            .query("rubrics")
            .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
            .collect();
        const rubricCritics = await ctx.db
            .query("rubric_critics")
            .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
            .collect();
        const scores = await ctx.db
            .query("scores")
            .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
            .collect();
        const scoreCritics = await ctx.db
            .query("score_critics")
            .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
            .collect();

        const allBatches = await ctx.db.query("llm_batches").collect();
        const runBatches = allBatches.filter((b) => b.custom_key.startsWith(`${traceId}:`));

        const allJobs = await ctx.db.query("llm_jobs").collect();
        const runJobs = allJobs.filter((j) => j.custom_key.startsWith(`${traceId}:`));

        const runRequests = await ctx.db
            .query("llm_requests")
            .withIndex("by_run", (q) => q.eq("run_id", args.run_id))
            .collect();
        const runTargetStateRows = await ctx.db
            .query("process_request_targets")
            .withIndex("by_process", (q) =>
                q.eq("process_type", "run").eq("process_id", String(args.run_id)),
            )
            .collect();

        const runTelemetryEvents = await ctx.db
            .query("telemetry_events")
            .withIndex("by_trace_seq", (q) => q.eq("trace_id", traceId))
            .collect();
        const runTelemetryEntityState = await ctx.db
            .query("telemetry_entity_state")
            .withIndex("by_trace_entity", (q) => q.eq("trace_id", traceId))
            .collect();

        if (!isDryRun) {
            for (const doc of runTelemetryEvents) await ctx.db.delete(doc._id);
            for (const doc of runTelemetryEntityState) await ctx.db.delete(doc._id);
            for (const doc of runRequests) await ctx.db.delete(doc._id);
            for (const doc of runTargetStateRows) await ctx.db.delete(doc._id);
            for (const doc of runBatches) await ctx.db.delete(doc._id);
            for (const doc of runJobs) await ctx.db.delete(doc._id);
            for (const doc of scoreCritics) await ctx.db.delete(doc._id);
            for (const doc of scores) await ctx.db.delete(doc._id);
            for (const doc of rubricCritics) await ctx.db.delete(doc._id);
            for (const doc of rubrics) await ctx.db.delete(doc._id);
            for (const doc of scoreUnits) await ctx.db.delete(doc._id);
            for (const doc of samples) await ctx.db.delete(doc._id);
            await ctx.db.delete(run._id);
        }

        return {
            isDryRun,
            run_id: args.run_id,
            trace_id: traceId,
            deleted: {
                runs: 1,
                samples: samples.length,
                sample_evidence_scores: scoreUnits.length,
                rubrics: rubrics.length,
                rubric_critics: rubricCritics.length,
                scores: scores.length,
                score_critics: scoreCritics.length,
                llm_batches: runBatches.length,
                llm_jobs: runJobs.length,
                llm_requests: runRequests.length,
                process_request_targets: runTargetStateRows.length,
                telemetry_events: runTelemetryEvents.length,
                telemetry_entity_state: runTelemetryEntityState.length,
            },
        };
    },
});

export const deleteTelemetryAfterEvent = zInternalMutation({
    args: z.object({
        event_id: zid("telemetry_events"),
        isDryRun: z.boolean().default(true),
    }),
    returns: z.object({
        isDryRun: z.boolean(),
        anchor: z.object({
            event_id: zid("telemetry_events"),
            creation_time: z.number(),
            trace_id: z.string(),
            seq: z.number(),
            event_name: z.string(),
        }),
        deleted_event_count: z.number(),
        affected_traces: z.array(
            z.object({
                trace_id: z.string(),
                deleted_events: z.number(),
            }),
        ),
    }),
    handler: async (ctx, args) => {
        const anchor = await ctx.db.get(args.event_id);
        if (!anchor) {
            throw new Error(`Telemetry event not found: ${args.event_id}`);
        }

        const allEvents = await ctx.db.query("telemetry_events").collect();
        const eventsToDelete = allEvents.filter((row) => row._creationTime > anchor._creationTime);

        const eventsByTrace = new Map<string, Doc<"telemetry_events">[]>();
        for (const row of eventsToDelete) {
            const existing = eventsByTrace.get(row.trace_id) ?? [];
            existing.push(row);
            eventsByTrace.set(row.trace_id, existing);
        }

        const affected: Array<{
            trace_id: string;
            deleted_events: number;
        }> = [];

        for (const [trace_id, traceEvents] of eventsByTrace.entries()) {
            affected.push({
                trace_id,
                deleted_events: traceEvents.length,
            });
        }

        if (!args.isDryRun) {
            for (const row of eventsToDelete) {
                await ctx.db.delete(row._id);
            }
            for (const [trace_id] of eventsByTrace.entries()) {
                const entityStateRows = await ctx.db
                    .query("telemetry_entity_state")
                    .withIndex("by_trace_entity", (q) => q.eq("trace_id", trace_id))
                    .collect();
                for (const row of entityStateRows) {
                    await ctx.db.delete(row._id);
                }

                const remainingTraceEvents = allEvents.filter(
                    (row) => row.trace_id === trace_id && row._creationTime <= anchor._creationTime,
                );
                const latestByEntity = new Map<string, Doc<"telemetry_events">>();
                for (const event of remainingTraceEvents) {
                    const key = `${event.entity_type}:${event.entity_id}`;
                    const current = latestByEntity.get(key);
                    if (!current || event.seq > current.seq) {
                        latestByEntity.set(key, event);
                    }
                }

                for (const event of latestByEntity.values()) {
                    await ctx.db.insert("telemetry_entity_state", {
                        entity_type: event.entity_type,
                        entity_id: event.entity_id,
                        trace_id: event.trace_id,
                        last_seq: event.seq,
                        last_event_name: event.event_name,
                        last_stage: event.stage ?? null,
                        last_status: event.status ?? null,
                        last_custom_key: event.custom_key ?? null,
                        last_attempt: event.attempt ?? null,
                        last_ts_ms: event.ts_ms,
                        last_payload_json: event.payload_json ?? null,
                    });
                }
            }
        }

        affected.sort((a, b) => a.trace_id.localeCompare(b.trace_id));

        return {
            isDryRun: args.isDryRun,
            anchor: {
                event_id: anchor._id,
                creation_time: anchor._creationTime,
                trace_id: anchor.trace_id,
                seq: anchor.seq,
                event_name: anchor.event_name,
            },
            deleted_event_count: eventsToDelete.length,
            affected_traces: affected,
        };
    },
});
