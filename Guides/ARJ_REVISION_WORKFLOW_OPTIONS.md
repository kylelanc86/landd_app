# ARJ Revision Workflow Options

## Context

Current behavior couples report revision with broad job-level effects:

- Revising a clearance clears clearance authorisation and forces re-authorisation.
- ARJ completion checks require strict status values, especially `shift_complete`.
- Some legacy data may still use shift status `complete`.
- Revising one artifact can effectively reopen wider job workflows than needed.

The goal is to support targeted revision of a single report artifact (shift or clearance) without unnecessary whole-job reopening side effects.

## Objectives

- Allow revision of one report artifact at a time.
- Preserve audit trail (who changed what, why, and when).
- Avoid risky mass data migration of historical records.
- Keep forward behavior canonical (`shift_complete` for modern records).
- Prevent regressions in ARJ completion, report visibility, and shift reopen logic.

## Option 1 - Targeted Compatibility Layer (Low Risk, Fastest)

### Concept

Keep current data model and ARJ flow mostly intact, but add compatibility rules so legacy shift status `complete` is treated as equivalent to `shift_complete` in all read/check paths that determine readiness, reopen, and report availability.

### Implementation Outline

1. Define shared status helper(s) in frontend and backend:
   - `isShiftReadyForAuthorisedReport(status)`
   - `isShiftCompletableForJob(status)` where `shift_complete` and legacy `complete` both pass.
   - `canShiftBeReopened(status)` including legacy `complete`.
2. Replace hard-coded string checks in:
   - ARJ complete button gating.
   - ARJ completion validation routes.
   - shift reopen eligibility checks.
   - report/project filters using shift completion states.
3. Keep write paths canonical:
   - New/updated shifts continue to write `shift_complete`.
4. Add lightweight diagnostics (optional):
   - Log/count when legacy `complete` is encountered.

### Pros

- Minimal schema/API changes.
- Avoids bulk historical data updates.
- Fastest path to eliminate current blocker and similar legacy issues.

### Cons

- Does not fully decouple ARJ state from artifact revision semantics.
- Legacy compatibility logic remains permanently (likely required for dormant jobs).

### Best Use

Immediate stabilization and compatibility.

---

## Option 2 - Partial Reopen by Artifact (Recommended Mid-Term)

### Concept

Keep ARJ completion as a milestone, but track revision state at artifact level (shift/clearance). A single revised artifact becomes "pending re-authorisation" without requiring full ARJ reopen behavior.

### Implementation Outline

1. Add artifact-level revision workflow fields (where missing), such as:
   - `revisionPending` (boolean)
   - `revisionRequestedAt`
   - `revisionRequestedBy`
   - `revisionReason`
2. On artifact revision:
   - Clear only that artifact's authorisation fields.
   - Set its revision pending fields.
   - Do not force broad ARJ rollback semantics.
3. ARJ display state:
   - Keep `completed` as base status.
   - Show derived indicator: `completed_with_pending_revision` (derived in API/UI, not necessarily stored initially).
4. Completion/export logic:
   - Distinguish "job completed" from "all current artifacts approved".
   - Expose clear UI messaging for pending revised artifacts.
5. Permissions/UX:
   - Permit editing only the artifact in revision scope.
   - Preserve other artifact states unchanged.

### Pros

- Better operational fit: revise one report without broad collateral effects.
- Clear audit and responsibility boundaries.
- Better user trust and lower accidental edits.

### Cons

- Moderate effort across backend + frontend + UI state messaging.
- Requires careful definition of ARJ "done" vs "done but pending revised artifact approval".

### Best Use

Preferred long-term behavior with controlled complexity.

---

## Option 3 - Immutable Report Versions (Most Robust, Largest Lift)

### Concept

Move to explicit versioned report documents. Each revision creates a new version while prior versions remain immutable. "Current approved version" is used operationally.

### Implementation Outline

1. Introduce version entities or embedded version history with immutable snapshots.
2. Revision creates new version record (v2, v3, etc.) with reason/actor/timestamp.
3. Authorisation applies to a specific version.
4. ARJ uses latest approved version per artifact for readiness/export.

### Pros

- Strongest audit and compliance model.
- Clean separation of historic vs current outputs.

### Cons

- Significant architecture and migration effort.
- Highest testing and rollout cost.

### Best Use

If long-term regulatory traceability and revision governance justify larger refactor.

---

## Recommended Plan (Phased)

### Phase 0 - Immediate Safety

- Implement Option 1 compatibility checks everywhere status-driven decisions are made.
- No mass data migration.
- Keep canonical writes as `shift_complete`.

### Phase 1 - Workflow Improvement

- Implement Option 2 artifact-level revision state for clearances first, then shifts.
- Keep ARJ status stable while surfacing pending revision indicators.

### Phase 2 - Decide on Versioning

- Reassess if Option 3 is needed after observing operations under Phase 1.

## Affected Areas to Review During Implementation

- Backend:
  - `backend/routes/asbestosRemovalJobs.js` (ARJ completion validation)
  - `backend/routes/shifts.js` (reopen/status-dependent logic)
  - `backend/routes/reports.js` and `backend/routes/projects.js` (status filters)
  - `backend/routes/asbestosClearances.js` (revision + re-authorisation behavior)
- Frontend:
  - `frontend/src/scenes/asbestos-removal/AsbestosRemovalJobDetails.jsx` (gating, reopen visibility, status checks)
  - any report listings using strict status checks for shift completion

## Test Plan (For Future Implementation)

- Legacy shift with `status: complete` + authorised:
  - ARJ complete button enabled when other conditions pass.
  - Backend ARJ completion accepted.
  - Shift reopen permitted for admin where intended.
- Modern shift with `status: shift_complete` remains unchanged.
- Revision of one clearance:
  - Only that clearance loses authorisation and requires re-authorisation.
  - Other artifacts remain untouched.
  - ARJ state messaging accurately reflects pending revised artifact.
- Report and project filters include legacy + modern complete-like states as intended.

## Decision Checklist

- Do we treat ARJ as a milestone (`completed`) or a live aggregate state?
- Should "pending revision" be stored or derived?
- Should compatibility for legacy status be permanent (recommended) vs temporary?
- Which screens should show `Completed with pending revision` messaging?

