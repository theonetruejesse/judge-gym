# LGTM Protocol File Structure and Artifacts

**Confidence:** 0.95

**Sources:**

- .prompts/lgtm-protocol.md (lines 7-78)
- diagrams/lgtm-diagram.md (lines 10-16)

**Summary:**

Each LGTM protocol execution creates a dedicated run folder with standardized structure and file naming patterns. The folder contains worldview.json as the main state file, plus subfolders for knowledge artifacts (k*\*.md), hypotheses (hyp*_.json), null challenges (nc\__.json), and the final implementation plan. File names follow the pattern <type>_<id>_<description>.<ext> for systematic organization.

---

**Standard Structure:**

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
│   ├── nc_<h_ID>_challenge.json # Standard null challenge JSON
│   └── ...
└── plan_synth_<RunID>_final.md # Final plan document
```

Knowledge entries follow standardized markdown format with confidence scores, sources, summaries, and optional raw content. Micro-hypotheses use JSON structure with core identification, tracing, and contentions sections.

