# Standing Questions

This file tracks questions that could NOT be answered and require human input or future research.

---

## [Q-001] Where is workflow-config.yaml and artifact structure for change_id tracking?
- **Asked by**: human_user
- **Date**: 2025-02-15
- **Context**: User referenced change_id 001, impl_report.yaml, and evaluator fix E1 for UOW-01, but these artifacts don't exist in expected locations
- **Exploration attempted**: 
  - Searched for workflow-config.yaml (not found)
  - Searched for impl_report.yaml (not found)
  - Searched for evaluator feedback files (not found)
  - Found only reference_librarian logs in agent-reference/artifacts/UOW-01/
- **Expected paths referenced in user query**:
  - {{knowledge_root}} (expected to be resolved from workflow-config.yaml)
  - {{artifact_root}} (expected to be resolved from workflow-config.yaml)
  - {{obsidian_vault_root}} (expected to be resolved from workflow-config.yaml)
- **Status**: UNANSWERED - needs human clarification on:
  1. Is workflow-config.yaml supposed to exist? If so, where?
  2. Where should impl_report.yaml be created/located?
  3. Where is evaluator feedback for E1 stored?
  4. What is the full artifact directory structure for change_id 001?

---

## [Q-002] Where is UOW-03 planning documentation for change_id 001?
- **Asked by**: user
- **Date**: 2026-02-15
- **Context**: User requested information to implement UOW-03 for change_id 001, including fusion store patterns and requirements
- **Exploration attempted**: 
  - Searched entire codebase for UOW-03 references (not found)
  - Searched for planning documents (PRD, micro-level plan, etc.) - none found
  - Searched agent-reference/workflow-artifacts/001/ - only logs directory exists
  - Only UOW-01 and UOW-02 implementation artifacts documented in knowledge base
- **What's needed for UOW-03**:
  1. Planning document describing fusion store requirements
  2. Acceptance criteria for UOW-03
  3. Architecture decisions for state management approach
  4. Requirements for "store guards for representation updates based on fusion mode"
- **Status**: UNANSWERED - needs human input:
  1. Where is the UOW-03 planning documentation?
  2. What is the official specification for the fusion store?
  3. Should state management use Angular Signals, RxJS Observables, or a library like NgRx?
  4. What are the exact requirements for store guards and representation updates?

---

## [Q-003] Where is UOW-04 planning documentation for change_id 001?
- **Asked by**: human_user
- **Date**: 2026-02-15
- **Context**: User requested information to implement UOW-04, specifically about scene asset service, asset error classes, related specs, timeout/retry behavior, LoadEvent valid types, and error taxonomy mapping (fetch/parse/budget)
- **Exploration attempted**: 
  - Searched entire codebase for UOW-04 references (not found)
  - Searched for SceneAssetService (not found)
  - Searched for LoadEvent (not found)
  - Searched for AssetError (not found)
  - Searched for planning documents (PRD, micro-level plan, meso-level plan) - none found in standard locations
  - Checked accumulated-knowledge.md and learnings.json - no prior knowledge of UOW-04 implementation
- **What's needed for UOW-04**:
  1. Planning document describing scene asset service requirements and architecture
  2. Acceptance criteria for UOW-04
  3. Specification for asset error class hierarchy (fetch/parse/budget taxonomy)
  4. LoadEvent valid types and structure
  5. Timeout/retry behavior requirements
  6. Test specification patterns for this service
- **Status**: UNANSWERED - needs human input:
  1. Where is the UOW-04 planning documentation (PRD, micro-level plan)?
  2. What is the official specification for SceneAssetService?
  3. What are the LoadEvent valid types?
  4. What is the error taxonomy mapping (fetch/parse/budget)?
  5. What are the timeout and retry behavior requirements?
  6. Are there existing asset loading patterns in the codebase to follow?
