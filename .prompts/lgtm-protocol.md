# Unified Knowledge Traversal & Implementation Planning Protocol (LGTM)

## **Abstract**

We present LGTM, enforcing explicit effects for enhanced rigor and testability. Leveraging Free Monad patterns (`Pipeline`) within an effectful monad (M) managed by `StateT Worldview M`, the protocol mandates that **all file system interactions (read/write/create dir) and external tool invocations are represented by explicit pipeline primitives** (`ReadFile`, `WriteFile`, `CreateDirectory`, `UseTool`). Internal state updates occur within the `StateT` context during interpretation, not via explicit primitives. The system decomposes an `originalQuestion` into Areas of Analysis (\(A*i\)) and concurrently refines modular micro-hypotheses (\(h_i\)) using `Fork`/`Join`. Knowledge artifacts (`k*_.md`) follow a standard internal structure. `AgentStep`now focuses solely on reasoning, potentially recommending tool use, which is then explicitly invoked via`UseTool`. Persistence of the `Worldview`state is also made explicit using`GetWorldview`and`WriteFile` primitives within the pipeline definitions. A Synthesis Pipeline integrates validated \(\{h^_\_i\}\`, followed by Meta-Planning and Final Plan Generation operating on the synthesized output.

## **0. Run Folder Structure**

Each execution creates a dedicated run folder with the following structure. File names follow the pattern `<type>_<id>_<description>.<ext>`.

```
<runFolderPath>/
├── worldview.json             # Main state file, log, pointers
├── knowledge/                 # Subfolder for raw evidence artifacts
│   ├── k_<EntryID>_evidence.md # Standard internal format
│   └── ...
├── hypotheses/                # Subfolder for micro-hypothesis versions
│   ├── hyp_<h_ID>_v*_*.json    # Standard hypothesis JSON
│   └── ...
├── null_challenges/           # Subfolder for null challenge results per h_i
│   ├── nc_<h_ID>_challenge.json # Standard null challenge JSON (NEW SCHEMA)
│   └── ...
└── plan_synth_<RunID>_final.md # Example final plan document (based on synthesis)
```

**Standardized Knowledge Entry Internal Structure (`k_*.md`):**

```markdown
# [Generated Title]

**Confidence:** [0.0 - 1.0]

**Sources:**

- [URI, File Path, Document ID, etc.]
- [...]

**Summary:**
[Generated multi-sentence summary of the evidence content.]

--- (Optional Separator) ---

[Optional: Raw extracted content snippet, if desired]
```

**Standardized Null Challenge JSON Structure (`nc_*.json`):**

```json
{
  "challengeID": "nc_h_AreaX_001_challenge", // Unique ID for this challenge run
  "microHypothesisID": "h_AreaX_001", // ID of the hypothesis being challenged
  "hypothesisFilePath": "hypotheses/hyp_h_AreaX_001_vN_candidate.json", // Path to the specific hypothesis version challenged

  "falsificationAttempts": [
    // List of attempts targeting specific parts of the hypothesis
    {
      "targetID": "T01", // Unique ID for this target attempt
      "targetDescription": "Assumption: Technology Y integrates with current stack.", // What was targeted (from hypothesis)
      "falsificationQueries": [
        // Queries designed to disprove the target
        "problems integrating Technology Y with [Our Stack Tech]",
        "Technology Y compatibility issues",
        "Technology Y performance degradation examples"
      ],
      "falsificationEvidenceFound": [
        // List of k_*.md file paths found via queries
        "knowledge/k_EVID008_techY_issue.md",
        "knowledge/k_EVID009_perf_report.md"
      ],
      "falsificationAnalysis": "Evidence k_EVID008 details significant integration conflicts reported on forum Z. Evidence k_EVID009 shows performance drops in similar setups.", // Analysis of whether evidence disproves target
      "outcome": "Failed" // "Passed" or "Failed" (Did we find disproving evidence?)
    }
    // ... more attempts ...
  ],

  "overallOutcome": "Failed" // "Passed" or "Failed" (Overall outcome for the hypothesis challenge)
}
```

**Micro-Hypothesis JSON Structure (`hypotheses/hyp_*.json`):**

```json
{
  // --- Core Identification ---
  "microHypothesisID": "h_AreaX_001", // Unique ID for the micro-hypothesis
  "areaOfAnalysisID": "A_DataIngest", // ID linking to the Area of Analysis
  "statement": "Ingest data source S using method M for Area X.", // Scoped assertion
  "confidence": 0.7,
  "gapCharacterization": "Area X currently lacks data from source S.", // Scoped gap

  // --- Tracing ---
  "rationale": "Method M is suitable for S's format (ref: k_...).",
  "refinementHistory": [
    /* ... */
  ], // Tracks evolution of this micro-hypothesis

  // --- Contentions (Scoped to this micro-hypothesis) ---
  "keyAssumptions": [
    /* ... */
  ],
  "validationCriteria": [
    /* ... */
  ],
  "critiquePoints": [
    /* ... */
  ],
  "questions": [
    /* ... */
  ],
  "alternativeApproaches": [
    /* ... */
  ]
}
```

## **I. Mathematical Foundations**

### **A. Categorical Structure**

- **Knowledge Category (𝓚):** Objects are knowledge nodes (standardized internal structure).
- **Hypothesis Category (𝓗):** Objects are micro-hypotheses (\(h_i\)).
- **Implementation Category (𝓘):** Objects are implementation components.
- **Natural Transformation (η: 𝓗\_{synth}→𝓘):** Maps synthesized hypothesis representation to implementation plans.

### **B. Monadic Effects Framework**

- **Effect Monad (M):** Handles side effects during interpretation.
- **Free Monad (`Pipeline a = Free PipelinePrimF a`):** Defines the declarative structure of effects.
- **State Monad Transformer (`StateT Worldview M`):** Used by the interpreter and orchestration logic to manage in-memory state between primitive executions.

### **C. Worldview Structure**

```json
Worldview: {
  "meta": {
    "originalQuestion": String,
    "runFolderPath": String,
    "finalPlanPath": String | null
  },

  "knowledgeBase": {
    "entries": [
      {
        "entryID": EntryID,
        "source": String,
        "filePath": String,
        "contentType": "text/markdown",
        "contentSummary": String,
        "confidence": Float,
      }
      // ... more entries ...
    ]
  },

  "areasOfAnalysis": [
    {
      "areaID": "A_DataIngest",
      "description": "Concerns related to acquiring and processing input data.",
      "status": "Active"
    }
    // ... more areas ...
  ],

  "microHypotheses": [
    {
      "microHypothesisID": "h_AreaX_001",
      "areaOfAnalysisID": "A_DataIngest",
      "version": 1,
      "status": "CandidateRefinement",
      "confidence": 0.7,
      "filePath": "hypotheses/hyp_h_AreaX_001_v1_refined.json",
      "nullChallengeFilePath": null,
      "nullChallengeOutcome": "NotAttempted",
      "derivedFromMicroHypothesisID": "h_AreaX_000" | null,
    }
    // ... more micro-hypotheses ...
  ],

  "hypothesisConflicts": [
    {
      "conflictID": "C_001",
      "involvedHypotheses": ["h_AreaX_001", "h_AreaY_003"],
      "description": "Assumption A01 in h_AreaX_001 contradicts Assumption B02 in h_AreaY_003.",
      "status": "Detected"
    }
    // ... more conflicts ...
  ],

  "synthesisOutput": {
    "synthesizedNarrative": String | null,
    "implementationPrerequisites": [String] | null,
    "keyDependencies": [Object] | null,
    "filePath": String | null
  } | null
}
```

## **II. Enhanced Pipeline Primitives and Effects**

### **A. External Tools (𝓣)**

```haskell
-- Master list of all available tools the system *can* execute via UseTool.
tools :: Map ToolID (Args -> M Result)
tools = fromList [
  ("WebSearch", \args -> ...),
  ("CodebaseGrep", \args -> ...),
  ("FileSearch", \args -> ...),
  ("WriteFile", \args -> ...),
  ("CreateDirectory", \args -> ...),
  ("ReadFile", \args -> ...)
]
```

### **B. Core Pipeline Primitives**

```haskell
data PipelinePrimF next where
  -- Base Primitives:
  GenText :: String -> (String -> next) -> PipelinePrimF next -- LLM text generation
  Analyze :: a -> Criteria -> (Analysis -> next) -> PipelinePrimF next -- Data analysis/transformation
  Validate :: Analysis -> Rules -> (Validation -> next) -> PipelinePrimF next -- Check against rules
  Critique :: a -> CritiqueFramework -> (Critique -> next) -> PipelinePrimF next -- Critical evaluation
  Fork :: ForkType -> [Pipeline a] -> ([a] -> next) -> PipelinePrimF next -- Parallel/Sequential execution
  Join :: AggregationStrategy -> [a] -> (AggregatedResult -> next) -> PipelinePrimF next -- Aggregate results
  Iterate :: Pipeline a -> Pipeline Bool -> IterConfig -> (a -> next) -> PipelinePrimF next -- Loop construct
  Plan :: a -> Pipeline b -> (Pipeline b -> next) -> PipelinePrimF next -- Meta-planning
  AgentStep :: String -> Context -> (Result -> next) -> PipelinePrimF next -- LLM reasoning/action recommendation (NO tools)

  -- Effect Primitives:
  WriteFile :: String -> String -> (() -> next) -> PipelinePrimF next -- Effect: Write content to file path
  ReadFile :: String -> (String -> next) -> PipelinePrimF next -- Effect: Read content from file path
  CreateDirectory :: String -> (() -> next) -> PipelinePrimF next -- Effect: Create directory at path
  UseTool :: ToolID -> Args -> (Result -> next) -> PipelinePrimF next -- Effect: Invoke external tool
  GetWorldview :: (Worldview -> next) -> PipelinePrimF next -- Effect: Retrieve current state object
  LogMessage :: LogLevel -> String -> (() -> next) -> PipelinePrimF next -- Effect: Log a message

type Pipeline a = Free PipelinePrimF a
type LogLevel = String -- e.g., "Info", "Warn", "Error"
```

### **C. State Effect Handler**

- Internal state updates use `StateT` effects during interpretation.
- Helper functions return `Pipeline` values constructing explicit primitives.

```haskell
-- Helper: Generate standardized file names
generateFileName :: String -> String -> String -> String -> String
generateFileName type id description ext =
  type ++ "_" ++ id ++ "_" ++ description ++ "." ++ ext

-- Helper: Returns a Pipeline action
writePipeline :: FilePath -> String -> Pipeline ()
writePipeline path content = liftF $ WriteFile path content id

-- Helper: Returns a Pipeline action
readPipeline :: FilePath -> Pipeline String
readPipeline path = liftF $ ReadFile path id

-- Helper: Returns a Pipeline action
createDirectoryPipeline :: FilePath -> Pipeline ()
createDirectoryPipeline path = liftF $ CreateDirectory path id

-- Helper: Returns a Pipeline action
getWorldviewPipeline :: Pipeline Worldview
getWorldviewPipeline = liftF $ GetWorldview id

-- Helper: Returns a Pipeline action
logMessagePipeline :: LogLevel -> String -> Pipeline ()
logMessagePipeline level msg = liftF $ LogMessage level msg id

-- Helper: Returns a Pipeline action for persisting worldview
persistWorldviewPipeline :: Pipeline ()
persistWorldviewPipeline = do
  wv <- getWorldviewPipeline
  let path = runFolderPath (meta wv) </> "worldview.json"
  let content = encodeJSON wv -- Assumes encodeJSON is available
  writePipeline path content

-- Helper: Returns Pipeline action for writing micro-hypothesis
writeMicroHypothesisPipeline :: MicroHypothesisID -> Int -> String -> MicroHypothesisJson -> Pipeline String -- Returns path
writeMicroHypothesisPipeline hID version description hData = do
  wv <- getWorldviewPipeline
  let filename = generateFileName "hyp" (hID ++ "_v" ++ show version) description "json"
  let path = runFolderPath (meta wv) </> "hypotheses" </> filename
  writePipeline path (encodeJSON hData)
  return path

-- Helper: Returns Pipeline action for reading micro-hypothesis
readMicroHypothesisPipeline :: FilePath -> Pipeline MicroHypothesisJson
readMicroHypothesisPipeline path = do
  content <- readPipeline path
  return (decodeJSON content) -- Assumes decodeJSON is available

-- Placeholder types/functions
type MicroHypothesisJson = Value
-- ... other types ...
```

## **III. Optimized Protocol Pipeline**

### **A. Initialization Phase**

```haskell
-- Orchestration logic (runs within M, calls interpreter)
initialize :: String -> Maybe UserPrior -> M Worldview
initialize originalQuestion userPrior = do
  runFolderPath <- generateUniquePath
  liftIO $ createDirectory runFolderPath
  liftIO $ createDirectory (runFolderPath </> "knowledge")
  liftIO $ createDirectory (runFolderPath </> "hypotheses")
  liftIO $ createDirectory (runFolderPath </> "null_challenges")

  let effectiveQuestion = ...
  let initialWorldview = Worldview { meta = Meta { originalQuestion = effectiveQuestion, runFolderPath = runFolderPath, ... }, ... }

  (_, finalWorldview) <- runStateT (interpret initializationPipeline) initialWorldview
  return finalWorldview

-- Pipeline definition
initializationPipeline :: Pipeline ()
initializationPipeline = do
  logMessagePipeline "Info" "Starting Initialization Pipeline"
  wv <- getWorldviewPipeline

  -- 1. Initial Evidence Gathering
  initialQueries <- GenText (promptForInitialQueries wv)
  agentResult <- AgentStep (promptForSearch initialQueries) (contextFromWorldview wv)
  toolCallRequest <- Analyze agentResult analyzeAgentResultForToolUse
  searchResults <- case toolCallRequest of
                     Just (toolID, args) -> UseTool toolID args
                     Nothing -> return agentResult

  let rawEntryStubs = extractKnowledgeStubs searchResults

  -- 2. Process stubs into standardized Knowledge Entries
  processedEntryPipelines <- mapM assignAndFormatKnowledgeFilePipeline rawEntryStubs
  processedEntries <- sequence processedEntryPipelines
  -- State Update: lift $ interpretState (AddKnowledgeEntries processedEntries)

  -- 3. Decompose into Areas of Analysis
  decompAnalysis <- Analyze (originalQuestion (meta wv), processedEntries) decompCriteria
  let areas = decodeAreasOfAnalysis decompAnalysis
  -- State Update: lift $ interpretState (SetAreasOfAnalysis areas)

  -- 4. Generate Initial Micro-Hypotheses via Fork
  let initialHypoPipelines = map createInitialMicroHypoPipeline areas
  initialHypoResults <- Fork ParallelExecution initialHypoPipelines
  let validEntries = catMaybes initialHypoResults
  -- State Update: lift $ mapM_ (interpretState . AddMicroHypothesis) validEntries

  -- 5. Explicitly persist final state
  logMessagePipeline "Info" "Initialization complete. Persisting Worldview."
  persistWorldviewPipeline

-- Helper: Returns Pipeline action for formatting/writing knowledge
assignAndFormatKnowledgeFilePipeline :: KnowledgeEntryStub -> Pipeline KnowledgeEntry
assignAndFormatKnowledgeFilePipeline stub = do
  entryID <- lift generateEntryID
  wv <- getWorldviewPipeline

  let formatPrompt = "..."
  formattedContent <- GenText formatPrompt

  let filename = generateFileName "k" entryID "evidence" "md"
  let path = runFolderPath (meta wv) </> "knowledge" </> filename
  writePipeline path formattedContent

  let extractedConfidence = parseConfidenceFromMarkdown formattedContent
  let extractedSummary = parseSummaryFromMarkdown formattedContent

  return $ KnowledgeEntry { entryID = entryID, source = primarySource (sources stub), filePath = path, ... }

-- Helper: Returns Pipeline action for initial hypo gen
createInitialMicroHypoPipeline :: AreaOfAnalysis -> Pipeline (Maybe MicroHypothesisLogEntry)
createInitialMicroHypoPipeline area = do
  let prompt = promptForInitialMicroHypothesis area
  hypJsonString <- GenText prompt
  let hypData = decodeJSON hypJsonString
  hID <- lift $ generateMicroHypothesisID (areaID area) 0
  let hypDataWithID = setMicroHypothesisID hID (areaID area) hypData

  hypPath <- writeMicroHypothesisPipeline hID 0 "initial" hypDataWithID

  let entry = createLogEntry hID (areaID area) 0 "Initial" ... hypPath ... "Pending"
  return (Just entry)

-- Helper Placeholders
analyzeAgentResultForToolUse :: Criteria
extractKnowledgeStubs :: Result -> [KnowledgeEntryStub]
assignAndFormatKnowledgeFile :: KnowledgeEntryStub -> StateT Worldview M KnowledgeEntry
generateEntryID :: M String
parseConfidenceFromMarkdown :: String -> Float
parseSummaryFromMarkdown :: String -> String
primarySource :: [String] -> String
decodeAreasOfAnalysis :: Analysis -> [AreaOfAnalysis]
promptForInitialMicroHypothesis :: AreaOfAnalysis -> String
generateMicroHypothesisID :: String -> Int -> M String
setMicroHypothesisID :: String -> String -> MicroHypothesisJson -> MicroHypothesisJson
catMaybes :: [Maybe a] -> [a]
```

### **B. Hypothesis Refinement Loop**

```haskell
-- Pipeline definition run by Iterate primitive
hypothesisRefineLoop :: Pipeline ()
hypothesisRefineLoop = do
  logMessagePipeline "Info" "Starting Hypothesis Refinement Loop"
  let body = refinementIterationPipeline
  let condition = checkGlobalRefinementConditionPipeline
  let config = IterConfig { maxIterations = 5, ... }
  Iterate body condition config (\_ -> return ())

  logMessagePipeline "Info" "Refinement Loop complete. Marking candidates."
  -- Marking candidates happens in StateT context after Iterate finishes

-- Pipeline definition for the body of the Iterate loop
refinementIterationPipeline :: Pipeline ()
refinementIterationPipeline = do
  logMessagePipeline "Info" "Starting refinement iteration."
  wv <- getWorldviewPipeline
  let hypothesesToRefine = getActiveMicroHypothesesForRefinement wv

  let refinementPipelines = map createRefinementSubPipeline hypothesesToRefine
  refinementResults <- Fork ParallelExecution refinementPipelines

  aggregatedInfo <- Join CollectResults refinementResults
  -- State Update: lift $ processRefinementResults aggregatedInfo

  wvAfterRefinement <- getWorldviewPipeline
  let conflictCriteria = "..."
  conflictAnalysis <- Analyze (microHypotheses wvAfterRefinement) conflictCriteria
  let conflicts = decodeConflicts conflictAnalysis
  -- State Update: lift $ interpretState (RecordConflicts conflicts)

  logMessagePipeline "Info" "Refinement iteration complete. Persisting Worldview."
  persistWorldviewPipeline

-- Sub-pipeline for refining a single micro-hypothesis
createRefinementSubPipeline :: MicroHypothesisLogEntry -> Pipeline RefinementResult
createRefinementSubPipeline currentEntry = do
  logMessagePipeline "Info" ("Refining micro-hypothesis: " ++ microHypothesisID currentEntry)
  hypDetails <- readMicroHypothesisPipeline (filePath currentEntry)

  critiques <- Critique hypDetails (scopedCritiqueFramework (areaOfAnalysisID currentEntry))
  tacticalQuestions <- GenText (promptForScopedTacticalQuestions hypDetails critiques)

  toolAnalysisResult <- Analyze tacticalQuestions (toolSelectionCriteria masterToolIDs)
  let requiredToolIDs = decodeToolIDList toolAnalysisResult

  agentResult <- AgentStep (promptForScopedEvidence tacticalQuestions) (scopedContext (areaOfAnalysisID currentEntry))
  toolCallRequest <- Analyze agentResult analyzeAgentResultForToolUse
  evidenceSourceResult <- case toolCallRequest of
                            Just (toolID, args) -> UseTool toolID args
                            Nothing -> return agentResult

  let rawEntryStubs = extractKnowledgeStubs evidenceSourceResult
  processedEntryPipelines <- mapM assignAndFormatKnowledgeFilePipeline rawEntryStubs
  processedEntries <- sequence processedEntryPipelines

  refinedHypJsonString <- GenText (promptForRefinedHypothesis hypDetails processedEntries)
  let newHypDataRaw = decodeJSON refinedHypJsonString

  validationResult <- Validate newHypDataRaw validationRules

  let outcome = if passed validationResult
                then SuccessfulRefinement { /* ... new data ... */, newKnowledgeEntries = processedEntries }
                else FailedRefinement { failedHypID = microHypothesisID currentEntry, reason = "Validation Failed", newKnowledgeEntries = processedEntries }

  case outcome of
    SuccessfulRefinement {..} -> do
      _ <- writeMicroHypothesisPipeline newHypID newVersion "refined" newHypDataWithHistory
      return outcome
    FailedRefinement {..} -> return outcome

-- Pipeline definition for the Iterate condition
checkGlobalRefinementConditionPipeline :: Pipeline Bool
checkGlobalRefinementConditionPipeline = do
  wv <- getWorldviewPipeline
  iterCount <- lift getIterationCounter
  let activeHypotheses = getActiveMicroHypotheses wv
  let allConverged = all (\h -> status h `elem` ["CandidateNullChallenge", ...]) activeHypotheses
  let confidenceMet = calculateOverallConfidence activeHypotheses >= globalConfidenceThreshold
  let conflictsLow = countActiveConflicts (hypothesisConflicts wv) <= conflictThreshold
  return $ iterCount >= maxIterations || (allConverged && confidenceMet && conflictsLow)

-- Helper Placeholders
getActiveMicroHypothesesForRefinement :: Worldview -> [MicroHypothesisLogEntry]
processRefinementResults :: AggregatedResult -> StateT Worldview M ()
decodeConflicts :: Analysis -> [HypothesisConflict]
scopedCritiqueFramework :: AreaID -> CritiqueFramework
promptForScopedTacticalQuestions :: MicroHypothesisJson -> Critique -> String
toolSelectionCriteria :: [ToolID] -> Criteria
scopedContext :: AreaID -> Context
decodeToolIDList :: Analysis -> Set ToolID
promptForRefinedHypothesis :: MicroHypothesisJson -> [KnowledgeEntry] -> String
validationRules :: Rules
type RefinementResult = Value
getIterationCounter :: M Int -- Assuming counter managed outside Worldview state
calculateOverallConfidence :: [MicroHypothesisLogEntry] -> Float
globalConfidenceThreshold :: Float
countActiveConflicts :: [HypothesisConflict] -> Int
conflictThreshold :: Int
findRefinementCandidateIDs :: Worldview -> [MicroHypothesisID]
```

### **C. Parallel Null Hypothesis Challenge**

```haskell
-- Pipeline definition
nullHypothesisChallengePipeline :: Pipeline Bool -- Returns True if all passed
nullHypothesisChallengePipeline = do
  logMessagePipeline "Info" "Starting Null Hypothesis Challenge Phase"
  wv <- getWorldviewPipeline
  let candidates = filter (\h -> status h == "CandidateNullChallenge") (microHypotheses wv)

  if null candidates
    then do logMessagePipeline "Info" "No candidates for Null Challenge."; return True
    else do
      let challengePipelines = map createMicroNullChallengePipeline candidates
      challengeResults <- Fork ParallelExecution challengePipelines

      aggregatedOutcomes <- Join CollectTupleResults challengeResults
      -- State Update: lift $ mapM_ (\(hID, outcome) -> interpretState (SetMicroHypothesisNullChallengeOutcome hID outcome)) aggregatedOutcomes

      persistWorldviewPipeline

      let allPassed = all (\(_, outcome) -> outcome == "Passed") aggregatedOutcomes
      logMessagePipeline "Info" ("Null Challenge Overall Result: " ++ if allPassed then "Passed" else "Failed")
      return allPassed

-- Rewritten pipeline using explicit primitives
createMicroNullChallengePipeline :: MicroHypothesisLogEntry -> Pipeline (MicroHypothesisID, String)
createMicroNullChallengePipeline entry = do
  let hID = microHypothesisID entry
  let hypFilePath = filePath entry
  logMessagePipeline "Info" ("Starting Null Challenge for: " ++ hID)

  hypDetails <- readMicroHypothesisPipeline hypFilePath

  -- 1. Identify Falsification Targets
  targetAnalysis <- Analyze hypDetails targetCriteria
  let targets = decodeFalsificationTargets targetAnalysis

  -- 2. Generate Falsification Queries per Target
  falsificationQueriesJson <- GenText (queryGenPrompt targets)
  let queriesByTarget = decodeQueriesByTarget falsificationQueriesJson

  -- 3. Execute Falsification Searches
  let allQueries = concat (Map.values queriesByTarget)
  agentResult <- if null allQueries then return "No queries generated." else AgentStep (promptForFalsificationSearch allQueries) standardContext
  toolCallRequest <- Analyze agentResult analyzeAgentResultForToolUse
  searchToolResult <- case toolCallRequest of
                        Just ("WebSearch", args) -> UseTool "WebSearch" args
                        Just ("FileSearch", args) -> UseTool "FileSearch" args
                        _ -> return agentResult

  -- 4. Process Found Evidence
  let searchResultStubs = extractKnowledgeStubs searchToolResult
  processedEntryPipelines <- mapM assignAndFormatKnowledgeFilePipeline searchResultStubs
  falsificationEvidenceEntries <- sequence processedEntryPipelines
  let evidencePaths = map filePath falsificationEvidenceEntries

  -- 5. Analyze Evidence per Target & Determine Outcomes
  let analysisPipelines = map (analyzeFalsificationTargetPipeline evidencePaths queriesByTarget) targets
  attemptResults <- sequence analysisPipelines

  -- 6. Determine Overall Outcome
  let overallOutcome = if any (\r -> outcome r == "Failed") attemptResults then "Failed" else "Passed"

  -- 7. Structure and Write nc_*.json File
  let ncData = NullChallengeData { ... overallOutcome = overallOutcome }
  wv <- getWorldviewPipeline
  let ncFileName = generateFileName "nc" hID "challenge" "json"
  let ncFilePath = runFolderPath (meta wv) </> "null_challenges" </> ncFileName
  writePipeline ncFilePath (encodeJSON ncData)
  -- State Update: lift $ interpretState (SetMicroHypothesisNullChallengePath hID ncFilePath)

  logMessagePipeline "Info" ("Null Challenge for " ++ hID ++ " outcome: " ++ overallOutcome)
  return (hID, overallOutcome)

-- Helper pipeline to analyze results for a single target
analyzeFalsificationTargetPipeline :: [FilePath] -> Map TargetID [Query] -> FalsificationTarget -> Pipeline FalsificationAttemptResult
analyzeFalsificationTargetPipeline allEvidencePaths queriesByTarget target = do
  let targetID = targetID target
  let targetDesc = targetDescription target
  let relevantQueries = Map.lookup targetID queriesByTarget ?: []
  let relevantEvidencePaths = filterEvidenceForTarget allEvidencePaths targetDesc

  analysisResult <- Analyze relevantEvidencePaths (analysisCriteria targetDesc relevantEvidencePaths)
  validationOutcome <- Validate analysisResult validationRules

  return FalsificationAttemptResult { ... outcome = if passed validationOutcome then "Passed" else "Failed" }

-- Helper Placeholders
targetCriteria :: Criteria
decodeFalsificationTargets :: Analysis -> [FalsificationTarget]
queryGenPrompt :: [FalsificationTarget] -> String
decodeQueriesByTarget :: String -> Map TargetID [Query]
promptForFalsificationSearch :: [Query] -> String
standardContext :: Context
filterEvidenceForTarget :: [FilePath] -> String -> [FilePath]
analysisCriteria :: String -> [FilePath] -> Criteria
validationRules :: Rules
type FalsificationTarget = Value { targetID :: String, targetDescription :: String }
type FalsificationAttemptResult = Value { targetID :: String, targetDescription :: String, falsificationQueries :: [String], falsificationEvidenceFound :: [FilePath], falsificationAnalysis :: String, outcome :: String }
type NullChallengeData = Value { challengeID :: String, microHypothesisID :: String, hypothesisFilePath :: String, falsificationAttempts :: [FalsificationAttemptResult], overallOutcome :: String }
```

### **D. Synthesis Pipeline**

```haskell
-- Pipeline definition
synthesisPipeline :: Pipeline Bool -- Returns True on success
synthesisPipeline = do
  logMessagePipeline "Info" "Starting Synthesis Pipeline"
  wv <- getWorldviewPipeline
  let validatedEntries = filter (\h -> status h == "Validated") (microHypotheses wv)

  if null validatedEntries
    then do logMessagePipeline "Warn" "Synthesis skipped: No validated micro-hypotheses."; return False
    else do
      let readPipelines = map (readMicroHypothesisPipeline . filePath) validatedEntries
      validatedHypotheses <- sequence readPipelines

      let analysisCriteria = "..."
      synthesisAnalysis <- Analyze validatedHypotheses analysisCriteria
      let synthesisData = decodeSynthesisAnalysis synthesisAnalysis

      let narrativePrompt = "..."
      narrative <- GenText (narrativePrompt validatedHypotheses synthesisData)

      let validationRules = "..."
      validationResult <- Validate (synthesisData { synthesizedNarrative = Just narrative }) validationRules

      if passed validationResult
        then do
          logMessagePipeline "Info" "Synthesis successful."
          -- State Update: lift $ interpretState (SetSynthesisOutput (synthesisData { synthesizedNarrative = Just narrative }))
          persistWorldviewPipeline
          return True
        else do
          logMessagePipeline "Error" "Synthesis validation failed."
          return False

-- Helper Placeholders
decodeSynthesisAnalysis :: Analysis -> SynthesisOutput
```

### **E. Meta-Planning Phase**

```haskell
-- Pipeline definition
metaPlanningPhase :: Pipeline ()
metaPlanningPhase = do
  logMessagePipeline "Info" "Starting Meta-Planning Phase"
  wv <- getWorldviewPipeline
  case synthesisOutput wv of
    Nothing -> logMessagePipeline "Error" "Meta-Planning skipped: Synthesis output not found."
    Just synthOutput -> do
      basePlan <- GenText (promptForBasePlanFromSynthesis synthOutput)
      initialPlanPipelineStr <- GenText (promptForPlanPipeline basePlan)
      let initialPipeline = parsePipeline initialPlanPipelineStr
      optimizedPipeline <- Plan synthOutput initialPipeline

      -- State Update: lift $ interpretState (SetOptimizedPipeline (serializePipeline optimizedPipeline))
      persistWorldviewPipeline

-- Helper Placeholders
promptForBasePlanFromSynthesis :: SynthesisOutput -> String
promptForPlanPipeline :: String -> String
parsePipeline :: String -> Pipeline b -- Assuming it parses into a Pipeline definition
serializePipeline :: Pipeline b -> String
```

### **F. Final Plan Generation Phase**

```haskell
-- Pipeline definition
finalPlanGeneration :: Pipeline ()
finalPlanGeneration = do
  logMessagePipeline "Info" "Starting Final Plan Generation Phase"
  wv <- getWorldviewPipeline
  case synthesisOutput wv of
    Nothing -> logMessagePipeline "Error" "Final Plan Generation skipped: Synthesis output not found."
    Just synthOutput -> do
      let serializedPipeline = optimizedPipeline (meta wv) -- Assuming stored in meta
      let optimizedPipelineDef = deserializePipeline serializedPipeline

      planComponents <- interpretPipelineExecution optimizedPipelineDef

      let analysisCriteria = "..."
      diagramAnalysis <- Analyze synthOutput analysisCriteria
      let relevantDiagramSpecs = diagramsToGenerate (decodeDiagramAnalysis diagramAnalysis)

      let diagramGenPipelines = map (\spec -> GenText (prompt spec)) relevantDiagramSpecs
      diagramContents <- sequence diagramGenPipelines
      let generatedDiagrams = zip (map name relevantDiagramSpecs) diagramContents

      planContent <- lift $ assemblePlanDocumentFromSynthesis synthOutput planComponents generatedDiagrams

      let planFileName = generateFileName "plan" "synth" (runId wv) "final"
      let planPath = runFolderPath (meta wv) </> planFileName
      writePipeline planPath planContent

      -- State Update: lift $ interpretState (SetFinalPlanPath planPath)
      persistWorldviewPipeline

-- Helper Placeholders
deserializePipeline :: String -> PipelineDef -- Assuming definition type
interpretPipelineExecution :: PipelineDef -> Pipeline PlanComponents -- Placeholder
diagramsToGenerate :: Analysis -> [DiagramSpec]
type DiagramSpec = Value { name :: String, prompt :: String }
assemblePlanDocumentFromSynthesis :: SynthesisOutput -> PlanComponents -> [(String, String)] -> M String
runId :: Worldview -> String
type PlanComponents = Value -- Placeholder
```

### **G. Master Pipeline**

```haskell
-- Orchestration logic using StateT and interpret
masterOrchestrator :: String -> Maybe UserPrior -> M Worldview
masterOrchestrator originalQuestion userPrior = do
  worldview_init <- initialize originalQuestion userPrior -- M action

  -- Run initialization pipeline
  ( _, worldview_initialized) <- runStateT (interpret initializationPipeline) worldview_init

  -- Run refinement loop
  ( _, worldview_refined) <- runStateT (interpret hypothesisRefineLoop) worldview_initialized
  worldview_marked <- runStateT (do -- Post-loop state update
                                    lift $ logMessagePipeline "Info" "Marking candidates post-refinement."
                                    candidateIDs <- gets findRefinementCandidateIDs
                                    mapM_ (\id -> modify (updateMicroStatus id "CandidateNullChallenge")) candidateIDs
                                    interpret persistWorldviewPipeline
                                 ) worldview_refined >>= return . snd

  -- Run null challenge pipeline
  (allPassed, worldview_challenged) <- runStateT (interpret nullHypothesisChallengePipeline) worldview_marked
  worldview_outcome_set <- runStateT (do -- Post-challenge state update
                                        lift $ logMessagePipeline "Info" "Setting null challenge outcomes."
                                        -- Logic to update state based on allPassed / results if needed
                                        interpret persistWorldviewPipeline
                                     ) worldview_challenged >>= return . snd

  -- Conditional execution
  if allPassed
    then do
      liftIO $ putStrLn "Overall Null Hypothesis Challenge Passed. Proceeding to Synthesis."
      (synthesisOk, worldview_synthesized) <- runStateT (interpret synthesisPipeline) worldview_outcome_set
      worldview_synthesis_set <- runStateT (do -- Post-synthesis state update
                                             lift $ logMessagePipeline "Info" "Setting synthesis output."
                                             -- Logic based on synthesisOk
                                             interpret persistWorldviewPipeline
                                           ) worldview_synthesized >>= return . snd

      if synthesisOk
        then do
          liftIO $ putStrLn "Synthesis Successful. Proceeding to Planning."
          (_, worldview_planned) <- runStateT (interpret metaPlanningPhase) worldview_synthesis_set
          worldview_meta_set <- runStateT (do -- Post-planning state update
                                            lift $ logMessagePipeline "Info" "Setting meta-planning results."
                                            interpret persistWorldviewPipeline
                                          ) worldview_planned >>= return . snd

          (_, finalWorldview) <- runStateT (interpret finalPlanGeneration) worldview_meta_set
          runStateT (do -- Post-generation state update
                       lift $ logMessagePipeline "Info" "Setting final plan path."
                       -- Logic to set final plan path
                       interpret persistWorldviewPipeline
                    ) finalWorldview >>= return . snd
        else do
          liftIO $ putStrLn "Synthesis Failed. Aborting planning."
          return worldview_synthesis_set
    else do
      liftIO $ putStrLn "Overall Null Hypothesis Challenge Failed. Aborting planning."
      return worldview_outcome_set
```

## **IV. Interpreter Implementation**

```haskell
-- Interpreter function runs within StateT Worldview M
interpret :: Pipeline a -> StateT Worldview M a
interpret = foldFree interpretPrimitive

interpretPrimitive :: PipelinePrimF a -> StateT Worldview M a
interpretPrimitive (GenText prompt next) = lift (callLLMWithPrompt prompt) >>= return . next
interpretPrimitive (AgentStep prompt context next) = lift (callLLMForAgentStep prompt context) >>= return . next
interpretPrimitive (Analyze data criteria next) = lift (performAnalysis data criteria) >>= return . next
interpretPrimitive (Validate analysis rules next) = lift (performValidation analysis rules) >>= return . next
interpretPrimitive (Critique data framework next) = lift (performCritique data framework) >>= return . next
interpretPrimitive (Fork forkType pipelines next) = do
  wv <- get -- Get current state for parallel execution context
  results <- case forkType of
    ParallelExecution -> lift $ parallel (map (evalStateT interpret wv) pipelines) -- Pass current state snapshot
    SequentialExecution -> mapM interpret pipelines -- State flows through mapM
  return (next results)
interpretPrimitive (Join strategy results next) = lift (aggregateResults strategy results) >>= return . next
interpretPrimitive (Iterate body condition config next) = do
  let loop iterCount = do
        continue <- interpret condition
        if continue && iterCount < config.maxIterations
          then interpret body >> loop (iterCount + 1)
          else return () -- Placeholder
  loop 0
  return (next ()) -- Simplified return
interpretPrimitive (Plan input pipeline next) = lift (optimizePipeline input pipeline) >>= return . next
interpretPrimitive (WriteFile path content next) = lift (liftIO $ writeFile path content) >> return (next ())
interpretPrimitive (ReadFile path next) = lift (liftIO $ readFile path) >>= return . next
interpretPrimitive (CreateDirectory path next) = lift (liftIO $ createDirectory path) >> return (next ())
interpretPrimitive (UseTool toolID args next) = do
  toolFuncMaybe <- gets (lookup toolID . masterToolList) -- Access tool map via state
  case toolFuncMaybe of
    Just fn -> lift (fn args) >>= return . next
    Nothing -> error ("Tool not found: " ++ toolID)
interpretPrimitive (GetWorldview next) = get >>= return . next -- Use StateT 'get'
interpretPrimitive (LogMessage level msg next) = lift (logOutput level msg) >> return (next ())

-- Placeholder functions for interpreter details
callLLMWithPrompt :: String -> M String
callLLMForAgentStep :: String -> Context -> M Result
performAnalysis :: a -> Criteria -> M Analysis
performValidation :: Analysis -> Rules -> M Validation
performCritique :: a -> CritiqueFramework -> M Critique
parallel :: [M a] -> M [a]
aggregateResults :: AggregationStrategy -> [a] -> M AggregatedResult
optimizePipeline :: a -> Pipeline b -> M (Pipeline b)
logOutput :: LogLevel -> String -> M ()
masterToolList :: Worldview -> Map ToolID (Args -> M Result) -- Function to get tool map

-- Assumed types
type Result = Value
-- ... other types ...
```

## **V. Final Plan Document Structure**

````markdown
# Implementation Plan: [Title derived from Synthesis Output or Original Question]

**Run ID:** [runFolderPath]
**Based on Synthesis of Validated Micro-Hypotheses:** [List or reference to validated h*_i IDs]
**Null Challenge Summary:** Passed ([Link to relevant nc_*.json files with new schema])
**Synthesis Summary:** [Link to synthesis file or include synthesisOutput.synthesizedNarrative]

## 1. Problem Summary (The Gap)

- [Derived from synthesisOutput or originalQuestion]

## 2. Proposed Solution (Synthesized)

- **Overall Narrative:** [synthesisOutput.synthesizedNarrative]
- **Key Components/Areas Addressed:** [Derived from validated {h*_i} and synthesis analysis]
- **Implementation Prerequisites:** [synthesisOutput.implementationPrerequisites]
- **Key Dependencies:** [Formatted view of synthesisOutput.keyDependencies]

## 3. Implementation Sequence

### Step 1: [Description derived from optimized plan based on synthesis]

- **Rationale/Details:** [...]
- **Related Micro-Hypotheses:** [Link relevant h*_i]
- **Full Proposed Code:**

  ```python
  # Complete implementation code...
  ```

### Step N: [...]

## 4. Key Assumptions & Considerations (Aggregated/Synthesized)

- **Assumption:** [Synthesized or key assumption from {h*_i}] (Supporting Evidence: [Link to k_XYZ_evidence.md])
- ...
- **Potential Critique/Risk:** [Synthesized or key critique from {h*_i}]
- ...

## 5. Relevant Visualizations (Proposed State)

_The following diagrams were identified as most relevant based on analysis of the synthesized solution._

**[Diagram 1 Name from Analysis]:**

```mermaid
# Mermaid diagram generated by GenText primitive based on synthesis output
```

**[Diagram 2 Name from Analysis]:**

```mermaid
# Mermaid diagram generated by GenText primitive based on synthesis output
```

_... (Include all diagrams generated based on the analysis step) ..._
````
