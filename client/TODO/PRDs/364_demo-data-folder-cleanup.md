# PRD 364: Demo Data Folder Cleanup

## Status: COMPLETED
## Priority: LOW
## Category: Cleanup

## Problem
The demo fixture folder at `client/src/variables/demo/` still has two avoidable inconsistencies:

1. `demoPolisData_77.json` uses a legacy mixed-case filename while the rest of the JSON fixtures follow `snake_case`.
2. Debate fixtures are split across `debates_part1.json` and `debates_part2.json` even though they share the same structure and are consumed as one logical dataset.

These inconsistencies add needless file churn, make the folder harder to scan, and create avoidable import surface area.

## Solution

### Slice 1: Rename `demoPolisData_77.json`
- Rename `demoPolisData_77.json` to `demo_polis_data_77.json` without changing contents.
- Update `client/src/variables/demo/README.md` to reference the new filename.
- Search `client/src/` and related tests for imports or references to the old filename and update them if present.

### Slice 2: Merge debate fixture files
- Inspect `debates_part1.json` and `debates_part2.json` to confirm their structure.
- Merge both files into a single `debates.json` fixture that preserves all records in order.
- Update any imports or references to the old split files so consumers read from `debates.json`.
- Delete the obsolete split files.
- Update `client/src/variables/demo/README.md` to document `debates.json`.

### Slice 3: Add regression coverage
- Add a focused test near the demo fixtures that asserts:
  - `debates.json` exports the expected merged dataset shape and count.
  - `demo_polis_data_77.json` remains readable at the renamed path.
- Run the smallest relevant Jest command first, then broaden verification if needed.

## Acceptance Criteria
- `client/src/variables/demo/demoPolisData_77.json` no longer exists.
- `client/src/variables/demo/demo_polis_data_77.json` exists with identical content.
- `client/src/variables/demo/debates_part1.json` and `client/src/variables/demo/debates_part2.json` no longer exist.
- `client/src/variables/demo/debates.json` exists and contains the merged debate records.
- `client/src/variables/demo/README.md` references the new filenames only.
- No source files or tests still reference the removed filenames.
- Relevant tests pass.

## Out of Scope
- Changing the contents of the Polis or debate fixtures beyond filename cleanup and file consolidation.
- Refactoring unrelated demo data exports or consumers.
