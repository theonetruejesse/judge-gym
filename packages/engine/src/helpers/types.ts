import type { ModelType, TaskType, ExperimentConfig } from "../../convex/schema";


export type ExperimentSettings = {
    window: {
        // Evidence collection window start (YYYY-MM-DD)
        startDate: string;
        // Evidence collection window end (YYYY-MM-DD)
        endDate: string;
        // Country context for evidence search
        country: string;
        // Concept being evaluated (e.g., "fascism")
        concept: string;
    };
    experiment: {
        // Stable experiment identifier
        experimentTag: string;
        // Judge model to use
        modelId: ModelType;
        // Task family
        taskType: TaskType;
        // Experimental configuration (schema-validated)
        config: ExperimentConfig;
    };
    // Max evidence items to collect per window
    evidenceLimit: number;
    // Number of rubric samples to generate/score
    sampleCount: number;
};
