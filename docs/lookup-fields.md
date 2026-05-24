# Historical lookup fields — implementation plan

This document describes the problem, agreed direction, and phased rollout for dropdown fields backed by master data (users, equipment, etc.) that can change after a record is saved.

## Problem summary

Historical records store **IDs** (`calibratedBy`, `flowmeterId`, `analysedBy`, etc.). APIs often **populate** those references, so list/table views can show correct names.

Edit/view dialogs build `Select` options from **currently valid** lists only (e.g. active signatories, in-calibration flowmeters). MUI `Select` only displays a label when `value` matches a `MenuItem` value. If the saved ID is not in the option list, the field appears **blank** even though the data exists on the record.

Example: an air pump calibration viewed after the technician was deactivated or the flowmeter went out of calibration.

## Design principles

1. **Display label ≠ option list** — derive a display label from populate, snapshot, or fetch-by-id; never rely on the dropdown list alone.
2. **Union rule for edit (later phase)** — `options = validForContext ∪ { savedValue }` so edit can retain historical values without forcing a change.
3. **Do not overwrite on save** — only send fields the user actually changed.
4. **One shared component (later phase)** — `LookupField` to avoid duplicating logic across 15+ screens.
5. **As-of-date validity (optional later phase)** — filter options by record date when `deactivatedAt` and calibration history support it.

## Agreed UX direction

| Mode | Behaviour |
|------|-----------|
| **View / read-only** | Plain text (`TextField` read-only or typography), not a disabled `Select`. |
| **Edit (future)** | `Select` with current valid options **plus** saved value if missing from list (orphan/historical option). |
| **New record** | Current valid options only (unchanged). |

Reference implementation in the app today: `IAQAnalysis.jsx` — analyst field uses read-only `TextField` when `isReadOnly`.

## Architecture (target state)

### Frontend utilities (`frontend/src/utils/lookupOptions.js`) — planned

- `buildDisplayLabel(value, populatedObject, fallbackName)`
- `mergeLookupOptions(currentOptions, savedOption, { markHistorical: true })`
- `resolveUserLabel(user | id, usersById)`
- `resolveEquipmentLabel(equipment | id, ...)`

### Shared component (`frontend/src/components/LookupField.jsx`) — planned

| Prop | Purpose |
|------|---------|
| `mode` | `'edit' \| 'view'` |
| `value` | ID (or string for legacy name fields) |
| `displayLabel` | Resolved label for view + `renderValue` |
| `options` | Current valid options |
| `savedOption` | Historical union entry for edit mode |
| `onChange` | Edit only |

### Backend (later phases)

- Keep `.populate()` on detail/list endpoints.
- Optional snapshots on save: `calibratedByName`, `flowmeterReference`.
- Optional `User.deactivatedAt` and `?asOf=` query params for date-aware option lists.

## Current data model constraints

| Entity | Relevant fields | Gap for “valid on record date” |
|--------|-----------------|--------------------------------|
| `User` | `isActive`, `labSignatory`, `labApprovals` | No `deactivatedAt` |
| `Equipment` | `status` enum | No status history |
| `AirPumpCalibration` | `calibratedBy`, `flowmeterId` (ObjectId + populate) | Names available via populate |
| `FlowmeterCalibration` | `technician` (string name, not ObjectId) | Different pattern |

## Field taxonomy (rollout inventory)

### Tier A — Calibrations (highest priority)

| Screen | User field | Equipment field | View/edit pattern |
|--------|------------|-----------------|-------------------|
| `AirPumpCalibrationPage` | `labSignatories` (client `isActive` filter) | `activeFlowmeters` | **View + edit** (`isEditMode`) — pilot |
| `FlowmeterPage` | `userService.getAll` + filter | flowmeter picker | Dialog |
| `EFAPage`, `AcetoneVaporiserPage`, `RiLiquidPage` | `userService.getAll` + filter | equipment | Dialog |
| `GraticulePage`, `AirPumpPage` | `activeTechnicians` (`UserListsContext`) | microscopes, etc. | Dialog |
| Microscope pages (PCM/PLM/Stereo/HSE) | varies | equipment | Dialog |

### Tier B — Lab analysis

| Screen | Field |
|--------|-------|
| `IAQAnalysis` | `analysedBy` / `activeCounters` (view mode already OK) |
| `air-monitoring/analysis.jsx` | analyst |
| `BlankAnalysis`, `ClientSuppliedFibreCountAnalysis` | counters |

### Tier C — Operational sampling

| Screen | Fields |
|--------|--------|
| `edit-sample.jsx`, `new-sample.jsx` | pump, flowmeter |
| Lead sample pages, job details | users/equipment as applicable |

### Tier D — Out of scope (unless linked to master data)

Fixed enums (flow rates, pass/fail), project status chips, etc.

## Business rules (to confirm before full rollout)

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Can user change technician to another inactive-on-today user when editing? | **New picks:** current valid list only. **Keep existing:** allow saved value. |
| 2 | User changes record date on edit | Warn if saved selections may be invalid for new date; do not auto-clear without confirmation. |
| 3 | Deleted user/equipment | Show snapshot or `"Unknown (removed)"`; retain ID. |
| 4 | Historical label suffix | e.g. `"Jane Smith (inactive)"` vs plain name — TBD |

## Phased delivery

### Phase 0 — Prep

- [x] This document
- [ ] Agree business rules table
- [ ] Ticket/epic per tier

### Phase 1 — App-wide plain text (where required)

**Goal:** Any master-data lookup that is not meant to be edited shows a **read-only label**, not a disabled `Select` / `RadioGroup`.

**Universal rule:**

```text
if (isLookupFieldReadOnly(screenContext)) {
  render plain text (LookupField mode="view" or LookupRadioGroup)
} else {
  render existing Select / RadioGroup (unchanged for now)
}
```

- [ ] Shared `LookupField` + `LookupRadioGroup` + `lookupOptions.js`
- [ ] Wire all screens in inventory below
- [ ] Standardise calibration dialogs on **view-then-edit** where they lack it (plain text in view; Select only after Edit)
- **Does not** fix editable forms where the user is expected to change a historical value without a read-only state (Phase 2: orphan merge on `edit-sample`, etc.)

### Phase 2 — Foundation + pilot edit mode

- [ ] `lookupOptions.js` + `LookupField` + unit tests
- [ ] `AirPumpCalibrationPage` edit mode: merged options + `renderValue` fallback

### Phase 3 — Calibration suite

- [ ] Apply pattern to Tier A calibration pages

### Phase 4 — Analysis workflows

- [ ] `resolveAnalystName` improvements; IAQ / air monitoring / blanks / client supplied

### Phase 5 — Sampling & jobs

- [ ] `edit-sample.jsx`, `new-sample.jsx`, job assignment fields

### Phase 6 — As-of-date validity (optional)

- [ ] `User.deactivatedAt` on deactivate
- [ ] API `?asOf=` for technicians, flowmeters
- [ ] Backfill script for existing inactive users

## Testing checklist

| Scenario | Expected |
|----------|----------|
| View calibration, inactive technician | Name visible, not blank |
| View calibration, OOC flowmeter | Reference visible or "-" if none |
| Edit calibration, change notes only (later) | Save OK; same IDs |
| New calibration | Inactive users not in list |
| IAQ read-only | Text field (no regression) |

## Ticket breakdown (suggested)

1. **CORE-1** — `lookupOptions.js` + `LookupField` + tests
2. **CAL-1** — Air pump calibration (view text + edit merge)
3. **CAL-2** — Remaining calibration dialogs
4. **LAB-1** — Analysis analyst fields
5. **OPS-1** — Air monitoring edit/new sample equipment
6. **DATA-1** — `deactivatedAt` + as-of API (optional)

## Related code references

- Air pump calibration dialog: `frontend/src/scenes/records/calibrations/AirPumpCalibrationPage.jsx`
- IAQ read-only analyst pattern: `frontend/src/scenes/records/indoor-air-quality/IAQAnalysis.jsx`
- Analyst name resolution: `frontend/src/utils/iaqReference.js` (`resolveAnalystName`)
- User list endpoints: `backend/routes/users.js` (`/technicians`, `/fibre-counters`, etc.)
- Air pump calibration API populate: `backend/routes/airPumpCalibrations.js`

## App-wide screen inventory (2026-05-19)

### Phase 1 — Plain text when field is not editable

Replace disabled `Select` / `RadioGroup` with read-only text when the screen is in a locked state.

| Screen | Read-only trigger | Affected lookup fields | Current state |
|--------|-------------------|------------------------|---------------|
| `AirPumpCalibrationPage.jsx` | `editingCalibration && !isEditMode` | Technician, Flowmeter | Blank disabled `Select` |
| `IAQAnalysis.jsx` | `isReadOnly` | Analyst | Plain text (OK) |
| `IAQAnalysis.jsx` | `isReadOnly` | Microscope, Test slide | Disabled `RadioGroup` (can appear unselected) |
| `air-monitoring/analysis.jsx` | `shiftStatus === "analysis_complete"` | Analyst, Microscope, Test slide | Disabled `Select` / `RadioGroup` |
| `BlankAnalysis.jsx` | `status === "Pass" \| "Fail"` | Analyst, Microscope, Test slide | Disabled `Select` / `RadioGroup` |
| `ClientSuppliedFibreCountAnalysis.jsx` | `jobStatus === "Completed"` (partial) | Analyst | `Select` still editable — should lock |
| `ClientSuppliedFibreCountAnalysis.jsx` | `jobStatus === "Completed"` | Microscope section | Uses `isReadOnly={false}` hardcoded in places |

### Phase 1b — Existing-record dialogs (editable but blank)

Calibration dialogs open in **edit** mode with enabled `Select`s; saved IDs not in active lists still render blank.

| Screen | Fields | Notes |
|--------|--------|-------|
| `FlowmeterPage.jsx` | Flowmeter, Technician | No separate view mode |
| `EFAPage.jsx` | EFA equipment, Technician | |
| `AcetoneVaporiserPage.jsx` | Vaporiser, Technician | |
| `RiLiquidPage.jsx` | Bottle, Technician | |
| `GraticulePage.jsx` | Graticule, Technician, PCM microscope | |
| `AirPumpPage.jsx` | Pump calibrations, Technician | |
| `PCMMicroscopePage.jsx`, `PLMMicroscopePage.jsx`, `StereomicroscopePage.jsx`, `HSETestSlidePage.jsx` | Equipment | |

**Phase 1 plain text alone does not fix these** unless we add view mode (like air pump) or Phase 2 orphan merge.

### Phase 2 — Operational edit forms (always editable)

| Screen | Fields | Risk |
|--------|--------|------|
| `edit-sample.jsx` | LAA, Pump, Flowmeter | High — old samples |
| `IAQEditSample.jsx` | LAA, Pump, Flowmeter | High |
| `LeadEditSample.jsx` | Pump, Flowmeter, etc. | High |
| `new-sample.jsx`, `IAQNewSample.jsx`, `LeadNewSample.jsx` | Same | Low (create only) |

### Phase 2 — Analysis / identification (editable until finalized)

| Screen | Fields | Read-only trigger |
|--------|--------|-------------------|
| `ClientSuppliedFibreIDAnalysis.jsx` | Analyst | Job finalized (needs audit) |
| `LDsuppliedAnalysisPage.jsx` | Analyst | Same pattern |
| `ClientSuppliedFibreCountAnalysis.jsx` | Analyst | Should use `jobStatus === "Completed"` |

### Phase 3 — Surveys / clearances / jobs

| Screen | Fields | Notes |
|--------|--------|-------|
| `asbestos-assessment/index.jsx` | LAA assessor | Create/edit forms |
| `residential-asbestos/index.jsx` | LAA assessor | Same |
| `AsbestosRemovalJobDetails.jsx` | Clearance LAA | Has pending-edit merge logic |
| `LeadRemovalJobDetails.jsx` | Clearance fields | Multiple `Select`s |
| `EnclosureInspection.jsx` | LAA | **Already merges saved orphan** `(saved)` MenuItem |
| `surveys/lead/LeadAssessment.jsx` | Users/equipment | Review if filtered |

### Lower priority / different control type

| Screen | Notes |
|--------|-------|
| `ProjectInformation.jsx` | Assigned users `Autocomplete` — values are full user objects from API; usually displays OK |
| `projects/index.jsx` | Filters active users only — not historical record view |
| `timesheets/review.jsx` | Active users for admin — not historical |
| Static enums | Status, department, flow rate — out of scope |

### Existing partial fix

`EnclosureInspection.jsx` injects a `(saved)` `MenuItem` when LAA name is not in `activeLAAs` — Phase 2 pattern, not plain text.

---

## App-wide implementation plan (plain text where required)

### Step 0 — Shared foundation (do once)

| Deliverable | Description |
|-------------|-------------|
| `frontend/src/utils/lookupOptions.js` | `resolveUserLabel`, `resolveEquipmentLabel`, `formatLookupDisplay`, fallbacks (`N/A`, `-`) |
| `frontend/src/components/LookupField.jsx` | `mode="view"` → MUI `TextField` read-only; `mode="edit"` → `Select` (unchanged behaviour) |
| `frontend/src/components/LookupRadioGroup.jsx` | `mode="view"` → typography / read-only text for stored reference; `mode="edit"` → existing `RadioGroup` |
| `docs/lookup-fields.md` | This file — keep inventory updated |

**Display label priority:** populated object → snapshot on record → stored string → fetch-by-id (optional) → fallback.

### Step 1 — Batch A: Completed / read-only analysis (6 files)

These screens already have a lock flag; wire `LookupField` / `LookupRadioGroup` when locked.

| # | File | Read-only trigger | Fields → plain text |
|---|------|-------------------|---------------------|
| 1 | `records/indoor-air-quality/IAQAnalysis.jsx` | `isReadOnly` | Analyst (done); Microscope; Test slide; Test slide lines |
| 2 | `air-monitoring/analysis.jsx` | `shiftStatus === "analysis_complete"` | Analyst; Microscope; Test slide; Test slide lines |
| 3 | `records/blanks/BlankAnalysis.jsx` | `status === "Pass" \| "Fail"` | Analysed by; Microscope; Test slide; Test slide lines |
| 4 | `fibreID/ClientSuppliedFibreCountAnalysis.jsx` | `jobStatus === "Completed"` | Analyst; Microscope calibration block (fix hardcoded `isReadOnly={false}`) |
| 5 | `fibreID/ClientSuppliedFibreIDAnalysis.jsx` | `isSampleAnalysed()` | Analyst |
| 6 | `fibreID/LDsuppliedAnalysisPage.jsx` | `assessmentItem?.analysisData?.isAnalysed` | Analyst |

### Step 2 — Batch B: Calibration records (11 files)

**Problem:** Dialogs open on existing records with enabled `Select`s; blank when ID ∉ active list.

**Approach:** Standardise **view-then-edit** on every calibration dialog (match `AirPumpCalibrationPage`):

- Open existing record → **view mode** → lookup fields = plain text.
- User clicks **Edit** → lookup fields = `Select` (Phase 2 will add orphan merge so Edit is not blank).

| # | File | Lookup fields (view → plain text) |
|---|------|-----------------------------------|
| 7 | `records/calibrations/AirPumpCalibrationPage.jsx` | Technician, Flowmeter (pilot — partial today) |
| 8 | `records/calibrations/FlowmeterPage.jsx` | Flowmeter, Technician |
| 9 | `records/calibrations/EFAPage.jsx` | EFA equipment, Technician |
| 10 | `records/calibrations/AcetoneVaporiserPage.jsx` | Vaporiser, Technician |
| 11 | `records/calibrations/RiLiquidPage.jsx` | RI bottle, Technician |
| 12 | `records/calibrations/GraticulePage.jsx` | Graticule, Technician, PCM microscope |
| 13 | `records/calibrations/AirPumpPage.jsx` | Technician (pump calibration dialog) |
| 14 | `records/calibrations/PCMMicroscopePage.jsx` | PCM microscope |
| 15 | `records/calibrations/PLMMicroscopePage.jsx` | PLM microscope |
| 16 | `records/calibrations/StereomicroscopePage.jsx` | Stereomicroscope |
| 17 | `records/calibrations/HSETestSlidePage.jsx` | HSE test slide |

**Note:** `FlowmeterCalibration` stores technician as **string** — view shows string; edit may stay text or autocomplete later.

**History-only pages** (`GraticuleHistoryPage`, `AcetoneVaporiserHistoryPage`, `RiLiquidHistoryPage`): table columns only — verify labels in table; no dialog change unless edit-from-history opens Batch B dialog.

### Step 3 — Batch C: Clearance / survey LAA (optional plain text vs merge)

| # | File | When plain text? | Fields |
|---|------|------------------|--------|
| 18 | `clearances/EnclosureInspection.jsx` | If inspection saved & form locked | LAA — today uses orphan `MenuItem`; can switch to `LookupField` for consistency |
| 19 | `asbestos-removal/AsbestosRemovalJobDetails.jsx` | View clearance (non-edit) | LAA — add view mode or plain text when dialog read-only |
| 20 | `lead-removal/LeadRemovalJobDetails.jsx` | View clearance | LAA / related selects |
| 21 | `surveys/asbestos-assessment/index.jsx` | Assessment complete / locked | LAA assessor selects |
| 22 | `surveys/residential-asbestos/index.jsx` | Same | LAA assessor selects |

**If clearance dialogs are always editable:** use Phase 2 orphan merge instead of plain text (same as `EnclosureInspection` today).

### Step 4 — Explicitly deferred (Phase 2 — not plain text)

Editable forms where users must still change other fields but keep historical pump/LAA/flowmeter without re-picking:

| File | Why deferred |
|------|----------------|
| `air-monitoring/edit-sample.jsx` | Always editable; needs orphan merge, not view-only text |
| `air-monitoring/new-sample.jsx` | Create-only — low risk |
| `records/indoor-air-quality/IAQEditSample.jsx` | Same as edit-sample |
| `lead-removal/LeadEditSample.jsx` | Same |
| `lead-removal/LeadNewSample.jsx` | Create-only |
| `records/indoor-air-quality/IAQNewSample.jsx` | Create-only |

### Out of scope (no change)

| Area | Reason |
|------|--------|
| `ProjectInformation.jsx` assigned users | `Autocomplete` with full user objects from project API |
| Static enums (status, department, flow rate, pass/fail) | Not master-data lookups |
| `timesheets`, `users` admin, `invoices` | Admin/create flows, not historical record view |
| `incidents.jsx`, `feedback.jsx` | `getAll(true)` active users; edit/create only |
| `EquipmentList`, `CalibrationFrequency` admin | Equipment management, not historical field view |
| Admin templates (`ClearanceReportTemplates`, etc.) | Configuration, not record snapshots |

### Effort estimate

| Step | Files | Days (approx.) |
|------|-------|----------------|
| 0 Foundation | 3 new files | 0.5–1 |
| 1 Batch A | 6 | 2–3 |
| 2 Batch B | 11 | 3–5 |
| 3 Batch C | 5 | 1–2 (depends on view/edit UX per dialog) |
| **Total Phase 1** | **~22 files** | **~7–11 days** |

### Testing matrix (per batch)

- Inactive user on completed analysis → name visible
- OOC flowmeter on viewed calibration → reference visible
- Completed IAQ / shift / blank → microscope & test slide show stored reference
- View calibration → Edit → fields become dropdowns (may be blank until Phase 2)
- New record / new calibration → dropdowns unchanged

## Decisions log

| Date | Decision | Notes |
|------|----------|-------|
| 2026-05-19 | View mode → plain text; edit merge + as-of-date deferred | Initial plan agreed in discussion |
| 2026-05-19 | App-wide scope review | Phase 1 = locked/read-only states; Phase 1b/2 = editable historical |
| 2026-05-19 | Phase 1 implemented | LookupField, Batch A analysis screens, Batch B calibrations view-then-edit |
| 2026-05-19 | Fallbacks | `N/A` missing required; `-` optional empty |
| 2026-05-19 | Batch C deferred | Custom-text LAA fields keep dropdown; edit-sample → Phase 2 |
