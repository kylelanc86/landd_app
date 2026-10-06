# Historical data retention gaps

Assessment of how the app retains references to inactive/deactivated entities (users, staff, technicians, samplers, analysts, authorisers, equipment) in historical records.

**Date:** 20 July 2026  
**Scope:** Review only — no code changes  
**Domains:** Calibrations, assessments, air monitoring, clearances, related analysis/authorisation flows

---

## Verdict

Historical data is mostly **still stored** (IDs, name snapshots, soft-deactivated users still populate). The main gap is **UI**: edit/create dropdowns are filtered to **active-only**, so inactive people/equipment often show as **blank** on edit screens — even though lists, PDFs, and CSVs usually still have the name.

---

## What’s working well

| Pattern | Where |
|--------|--------|
| Soft deactivate users (`isActive: false`), not delete | Backend users routes |
| Name snapshots on records | Assessment/clearance `LAA`, authoriser/approver strings, many calibration `technician` strings, shift `analysedBy` / `reportApprovedBy` |
| Populate without filtering out inactive users | Sample/shift/calibration GET endpoints |
| `LookupField` + `displayLabel` | Many calibrations, air analysis, blanks — can still show a name when the ID isn’t in the active options |
| Mycometer “inject inactive option” | `MycometerJobReports.jsx` adds a `MenuItem` for the current sampler if they’re missing from the active list — best practice in the app |
| Clients / custom field text / legislation | Client names via populate; freeSolo text values; legislation snapshotted on create |

`UserListsContext` only exposes **active** role lists (`activeLAAs`, `activeTechnicians`, `activeCounters`, `activeIdentifiers`). That’s fine for **new** selection; it becomes a problem when the same lists drive **edit** UIs.

---

## Gaps (by domain)

### 1. Assessments & clearances — LAA / consultant

**Issue:** Edit Selects only map `activeLAAs` / `activeUsers`. Stored value is kept, but MUI Select looks **blank** for inactive people.

- Asbestos assessment & residential asbestos — LAA
- Asbestos clearance — LAA (`AsbestosRemovalJobDetails.jsx`)
- Lead clearance — consultant (`LeadRemovalJobDetails.jsx`)
- Lead assessment — consultant (`LeadAssessment.jsx`, `getAll(false)` → active only)

**Data:** Usually retained as a name string (or ObjectId + populate on lists).  
**Risk:** User sees an empty field and “fixes” it by picking someone else, overwriting history.

### 2. Air monitoring & IAQ — samplers & equipment

**Issue:** Sampler/pickup Selects use `activeLAAs` only — inactive sampler → blank Select on edit (`edit-sample.jsx`, `IAQEditSample.jsx`, same pattern on new-sample).

**Equipment:** Pumps/flowmeters filtered to `calculateStatus === "Active"`. Historical samples with retired gear show blank equipment Selects; flowrate logic can break if the pump isn’t in the active list.

**Data:** Sampler ObjectIds still populate for exports/CSV; authoriser names are snapshotted as strings. List UI often doesn’t show sampler anyway.

### 3. Analysis / authorisers

| Area | Status |
|------|--------|
| Air monitoring analysis (`analysedBy` string + `displayLabel`) | Generally OK |
| Authorisers / report approved by (name strings) | Generally OK |
| Fibre ID analyst (`ClientSuppliedFibreIDAnalysis`, `LDsuppliedAnalysisPage`) | **Gap:** `displayLabel` only resolves via `activeIdentifiers.find(...)` — ignores populated `analysedBy` → can show **N/A** for inactive analysts even in view mode |
| Blank analysis | Better — prefers populated user |

### 4. Calibrations — technicians

**Mostly OK for display:** history tables use stored `technician` strings or populated `calibratedBy`; many pages pass `technicianName` into `LookupField`.

**Gaps:**

- Options are still active-only; unlike Mycometer, inactive techs are rarely injected as options.
- Some edit flows (e.g. Graticule) need a `technicianId` matched from the active list — re-saving an old calibration for a deactivated tech can be awkward or blocked if only a name exists.
- RI liquid / ObjectId-only `calibratedBy`: if populate fails or name isn’t resolved into `technicianName`, LookupField can show N/A.

### 5. Cross-cutting / secondary

- One assessment PDF path reportedly prefers `assessorId` (creator) over snapshotted `LAA` in places — possible wrong/missing name on that path (`pdf-docraptor-v2.js`), while most templates use `data.LAA`.
- True data loss is unlikely on soft-deactivate; higher risk is **accidental overwrite** when saving a blank-looking edit form, or hard-delete of a User on FK-only fields with no name snapshot.

---

## Severity summary

| Severity | Nature |
|----------|--------|
| **High (UI)** | Blank edit Selects: assessment/clearance LAA, lead consultant, air/IAQ sampler; Fibre ID analyst showing N/A |
| **Medium (UI)** | Inactive equipment on sample edit; calibration edit without injecting inactive technician |
| **Low / rare** | Hard-delete of users; one PDF LAA vs assessor mismatch |
| **Data layer** | Generally sound — soft deactivate + snapshots + populate |

---

## How the app handles this (detail)

### Soft deactivation

- Deactivate sets `isActive = false` (does not delete).
- Role-option endpoints filter active only for **new selection** (`/users/asbestos-assessors`, `/technicians`, `/fibre-counters`, `/fibre-identifiers`, `/mycometer-certified`).
- `GET /users/:id` and `.populate('…', 'firstName lastName')` do **not** filter `isActive`, so inactive users still hydrate for display/PDFs.

### Name / certification snapshots

| Domain | Snapshot fields |
|--------|-----------------|
| Assessments / clearances | `LAA` (string name) |
| Authorisation | `reportAuthorisedBy`, `reportApprovedBy` (strings) |
| Air monitoring analysis | `Shift.analysedBy` (string name) |
| Many calibrations | `technician` string (graticule, EFA, flowmeter, etc.) |
| Mycometer | `sampledByName`, `analystName`, cert snapshot |
| Legislation | job-level legislation snapshot |

### Frontend display helpers

- `frontend/src/utils/lookupOptions.js` — `buildUserDisplayLabel` / `displayLabel` independent of active option lists.
- `frontend/src/components/LookupField.jsx` — view mode uses `displayLabel`; edit `renderValue` falls back to `displayLabel` when value ∉ options.
- `frontend/src/utils/airMonitoringSamplerDisplay.js` — names from populated User refs (works for inactive if populated).

### Best-in-class pattern

`frontend/src/scenes/laboratory-services/MycometerJobReports.jsx`: if current `sampledBy` is not in the active certified list, it still adds a `MenuItem` using the snapshotted name.

---

## Confirmed-good areas

1. **Mycometer** — snapshots + retain-on-missing-user + inactive MenuItem inject.
2. **Authorisation / approval names** — stored as strings at sign-off time.
3. **Assessment/clearance `LAA`** (and lead consultant string on clearance) — snapshots for reports/lists.
4. **Calibration history tables** — show stored technician string or populated `calibratedBy`.
5. **LookupField + `displayLabel` / `technicianName`** on many calibration and analysis screens.
6. **BlankAnalysis** analyst display hydrate from populated user.
7. **Soft user deactivation** so ObjectId refs remain populatable.
8. **Legislation snapshots** on assessments/clearances.
9. **Clients** — display via populate even if search lists are active-only.
10. **Custom fields** — values stored as text; Autocomplete `freeSolo` keeps historical strings.

---

## Bottom line

Retention is **mostly a presentation/edit-hydration problem**, not missing DB records. The app already has the right building blocks (`LookupField`/`displayLabel`, name snapshots, Mycometer’s inject-inactive option); they’re just **not applied consistently** on assessment/clearance LAA Selects, air/IAQ sampler/equipment Selects, and Fibre ID analyst labels.

### Suggested fix direction (for later)

1. Standard pattern: for edit Selects, if current value ∉ active options, append a MenuItem (Mycometer) **or** always pass a populated/`displayLabel` and keep value stable.
2. Prefer **name snapshot + ObjectId** (Mycometer) for anything that must survive rename/deactivate/delete.
3. Fibre ID analyst `displayLabel` should use populated `analysedBy` (BlankAnalysis style), not only `activeIdentifiers.find`.
4. Air monitoring **edit sample** should include currently selected pump/flowmeter/sampler even when no longer “Active”.
