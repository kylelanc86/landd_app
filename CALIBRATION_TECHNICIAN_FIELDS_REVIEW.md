# Calibration Pages - Technician/CalibratedBy Fields Review

## Summary
This document lists all technician/calibratedBy fields found across all calibration pages, along with their source data and how they're used.

---

## 1. Air Pump Calibration Page
**File:** `frontend/src/scenes/records/calibrations/AirPumpCalibrationPage.jsx`

### Fields:
- **Form Field:** `technicianId` (state: `staticFormData.technicianId`)
- **Display Field:** `technicianName` (state: `staticFormData.technicianName`)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Fetch Method:** `fetchLabSignatories()` (lines 102-117)
- **Service:** `userService.getAll()`
- **Filter:** Users with `isActive` AND (`labSignatory === true` OR `labApprovals?.calibrations === true`)
- **State:** `labSignatories` array

### Usage:
- **Form Input:** Select dropdown (lines 1070-1095) - shows `firstName lastName`
- **Table Display:** Shows `calibration.calibratedBy.firstName` and `calibration.calibratedBy.lastName` (lines 835-839)
- **On Edit:** Extracts `technicianId` from `calibration.calibratedBy` (lines 548-562)
- **On Submit:** Sends `technicianId` in `calibrationData`, but backend expects `calibratedBy` (populated by backend middleware)

### Backend Model:
- **Model:** `AirPumpCalibration.js`
- **Field:** `calibratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`
- **Index:** `airPumpCalibrationSchema.index({ calibratedBy: 1 })`

---

## 2. Air Pump Page (List/Add)
**File:** `frontend/src/scenes/records/calibrations/AirPumpPage.jsx`

### Fields:
- **Form Field:** `technicianId` (state: `staticFormData.technicianId`)
- **Display Field:** `technicianName` (state: `staticFormData.technicianName`)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Fetch Method:** `fetchLabSignatories()` (lines 333-348)
- **Service:** `userService.getAll()`
- **Filter:** Users with `isActive` AND (`labSignatory === true` OR `labApprovals?.calibrations === true`)
- **State:** `labSignatories` array

### Usage:
- **Form Input:** Select dropdown (lines 1210-1235) - shows `firstName lastName`
- **On Submit:** Sends `technicianId` in `backendData`, but backend expects `calibratedBy` (populated by backend middleware)

### Backend Model:
- **Model:** `AirPumpCalibration.js` (same as above)

---

## 3. Acetone Vaporiser Page
**File:** `frontend/src/scenes/records/calibrations/AcetoneVaporiserPage.jsx`

### Fields:
- **Form Field:** `technicianId` (state: `formData.technicianId`)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Fetch Method:** `fetchTechnicians()` (lines 162-192)
- **Service:** `userService.getAll()`
- **Filter:** Users with `isActive` AND (`labSignatory === true` OR `labApprovals?.calibrations === true`)
- **State:** `technicians` array
- **Default:** Sets current user as default when dialog opens (lines 73-89)

### Usage:
- **Form Input:** Select dropdown (lines 481-508) - shows `firstName lastName`
- **On Submit:** Sends `technicianId` in `calibrationData` (line 254), backend expects `calibratedBy`

### Backend Model:
- **Model:** `AcetoneVaporiserCalibration.js`
- **Field:** `calibratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`
- **Index:** `acetoneVaporiserCalibrationSchema.index({ calibratedBy: 1 })`

---

## 4. RI Liquid Page
**File:** `frontend/src/scenes/records/calibrations/RiLiquidPage.jsx`

### Fields:
- **Form Field:** `technicianId` (state: `formData.technicianId`)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Fetch Method:** `fetchTechnicians()` (lines 149-179)
- **Service:** `userService.getAll()`
- **Filter:** Users with `isActive` AND (`labSignatory === true` OR `labApprovals?.calibrations === true`)
- **State:** `technicians` array
- **Default:** Sets current user as default when dialog opens (lines 77-89)

### Usage:
- **Form Input:** Select dropdown (lines 587-614) - shows `firstName lastName`
- **On Edit:** Extracts `technicianId` from `calibration.calibratedBy` (lines 325-333)
- **On Submit:** Sends `technicianId` in `calibrationData` (line 291), backend expects `calibratedBy`

### Backend Model:
- **Model:** `RiLiquidCalibration.js`
- **Field:** `calibratedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`
- **Index:** `riLiquidCalibrationSchema.index({ calibratedBy: 1 })`

---

## 5. EFA (Effective Filter Area) Page
**File:** `frontend/src/scenes/records/calibrations/EFAPage.jsx`

### Fields:
- **Form Field:** `technicianId` (state: `formData.technicianId`)
- **Display Field:** `technicianName` (state: `formData.technicianName`)
- **Backend Field:** `technician` (String - stores name, not ObjectId)
- **Backend Field (Alternative):** `calibratedBy` (may exist in model)

### Source Data:
- **Fetch Method:** `fetchLabSignatories()` (lines 127-158)
- **Service:** `userService.getAll()`
- **Filter:** Users with `isActive` AND (`labSignatory === true` OR `labApprovals?.calibrations === true`)
- **State:** `labSignatories` array

### Usage:
- **Form Input:** Select dropdown (lines 1116-1141) - shows `firstName lastName`
- **Table Display:** Shows `item.technicianName || item.technician` (line 695)
- **On Edit:** Matches technician by name (lines 212-217)
- **On Submit:** Sends `technicianName` (not ID) as `technician` field (line 312)

### Backend Model:
- **Model:** `EFACalibration.js` (referenced in grep results)
- **Field:** `technician: String` (stores name)
- **Field (Alternative):** `calibratedBy: ObjectId` (may exist)

---

## 6. Flowmeter Page
**File:** `frontend/src/scenes/records/calibrations/FlowmeterPage.jsx`

### Fields:
- **Form Field:** `technicianId` (state: `formData.technicianId`)
- **Display Field:** `technicianName` (state: `formData.technicianName`)
- **Backend Field:** `technician` (String - stores name, not ObjectId)
- **Backend Field (Alternative):** `calibratedBy` (may exist in model)

### Source Data:
- **Fetch Method:** `fetchLabSignatories()` (lines 217-232)
- **Service:** `userService.getAll()`
- **Filter:** Users with `isActive` AND (`labSignatory === true` OR `labApprovals?.calibrations === true`)
- **State:** `labSignatories` array

### Usage:
- **Form Input:** Select dropdown (lines 969-994) - shows `firstName lastName`
- **Table Display:** Shows `calibration.technicianName || calibration.technician` (lines 1437-1440)
- **On Edit:** Matches technician by name (lines 618-627)
- **On Submit:** Sends `technicianName` (not ID) as `technician` field (line 355)

### Backend Model:
- **Model:** `FlowmeterCalibration.js` (referenced in grep results)
- **Field:** `technician: String` (stores name)
- **Field (Alternative):** `calibratedBy: ObjectId` (may exist, indexed)

---

## 7. Graticule Page
**File:** `frontend/src/scenes/records/calibrations/GraticulePage.jsx`

### Fields:
- **Form Field:** `technicianId` (state: `formData.technicianId`)
- **Display Field:** `technicianName` (state: `formData.technicianName`)
- **Backend Field:** `technician` (String - stores name, not ObjectId)
- **Backend Field (Alternative):** `calibratedBy` (may exist in model)

### Source Data:
- **Fetch Method:** `fetchLabSignatories()` (lines 194-225)
- **Service:** `userService.getAll()`
- **Filter:** Users with `isActive` AND (`labSignatory === true` OR `labApprovals?.calibrations === true`)
- **State:** `labSignatories` array

### Usage:
- **Form Input:** Select dropdown (lines 1232-1257) - shows `firstName lastName`
- **Table Display:** Shows `item.technicianName || item.technician` (line 1036)
- **On Edit:** Matches technician by name (lines 458-463)
- **On Submit:** Sends `technicianName` (not ID) as `technician` field (line 575)

### Backend Model:
- **Model:** `GraticuleCalibration.js` (referenced in grep results)
- **Field:** `technician: String` (stores name, indexed)
- **Field (Alternative):** `calibratedBy: ObjectId` (may exist, indexed)

---

## 8. HSE Test Slide Page
**File:** `frontend/src/scenes/records/calibrations/HSETestSlidePage.jsx`

### Fields:
- **Form Field:** None (uses current user automatically)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Auto-populated:** Uses `currentUser._id` from `useAuth()` context (line 302)

### Usage:
- **No Form Input:** No technician selection field
- **Table Display:** Shows `calibration.calibratedBy.name` or `calibration.calibratedBy.firstName lastName` (lines 882-886)
- **On Submit:** Automatically sets `calibratedBy: currentUser._id` (line 302)

### Backend Model:
- **Model:** `HSETestSlideCalibration.js` (referenced in grep results)
- **Field:** `calibratedBy: ObjectId` (ref: 'User')

---

## 9. PCM Microscope Page
**File:** `frontend/src/scenes/records/calibrations/PCMMicroscopePage.jsx` (Note: File name may be `MicroscopePage.jsx`)

### Fields:
- **Form Field:** None (uses current user automatically)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Auto-populated:** Uses `currentUser._id` from `useAuth()` context (line 375)

### Usage:
- **No Form Input:** No technician selection field
- **Table Display:** Shows `calibration.calibratedBy.name` or `calibration.calibratedBy.firstName lastName` (lines 991-995)
- **On Submit:** Automatically sets `calibratedBy: currentUser._id` (line 375)

### Backend Model:
- **Model:** `PCMMicroscopeCalibration.js` (referenced in grep results)
- **Field:** `calibratedBy: ObjectId` (ref: 'User')

---

## 10. PLM Microscope Page
**File:** `frontend/src/scenes/records/calibrations/PLMMicroscopePage.jsx`

### Fields:
- **Form Field:** None (uses current user automatically)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Auto-populated:** Uses `currentUser._id` from `useAuth()` context (line 376)

### Usage:
- **No Form Input:** No technician selection field
- **Table Display:** Shows `calibration.calibratedBy.name` or `calibration.calibratedBy.firstName lastName` (lines 992-996)
- **On Submit:** Automatically sets `calibratedBy: currentUser._id` (line 376)

### Backend Model:
- **Model:** `PLMMicroscopeCalibration.js` (referenced in grep results)
- **Field:** `calibratedBy: ObjectId` (ref: 'User')

---

## 11. Stereomicroscope Page
**File:** `frontend/src/scenes/records/calibrations/StereomicroscopePage.jsx`

### Fields:
- **Form Field:** None (uses current user automatically)
- **Backend Field:** `calibratedBy` (ObjectId reference to User)

### Source Data:
- **Auto-populated:** Uses `currentUser._id` from `useAuth()` context (line 373)

### Usage:
- **No Form Input:** No technician selection field
- **Table Display:** Shows `calibration.calibratedBy.name` or `calibration.calibratedBy.firstName lastName` (lines 992-996)
- **On Submit:** Automatically sets `calibratedBy: currentUser._id` (line 373)

### Backend Model:
- **Model:** `StereomicroscopeCalibration.js` (referenced in grep results)
- **Field:** `calibratedBy: ObjectId` (ref: 'User')

---

## 12. Primary Flowmeter Page
**File:** `frontend/src/scenes/records/calibrations/PrimaryFlowmeterPage.jsx`

### Fields:
- **Form Field:** `technician` (hardcoded mock data)
- **Backend Field:** Unknown (page appears to be a stub/placeholder)

### Source Data:
- **Mock Data:** Hardcoded in component state (lines 30-49)
- **No actual backend integration**

### Usage:
- **Table Display:** Shows `calibration.technician` from mock data (line 117)
- **No form input or backend submission**

### Backend Model:
- **Unknown** - Page appears to be incomplete/stub

---

## Summary of Patterns

### Field Naming Conventions:
1. **ObjectId Reference (Modern):** `calibratedBy` - References User model
   - Used in: Air Pump, Acetone Vaporiser, RI Liquid, HSE Test Slide, PCM/PLM/Stereomicroscope
   
2. **String Name (Legacy):** `technician` - Stores full name as string
   - Used in: EFA, Flowmeter, Graticule

### Data Source Patterns:
1. **Standard Filter (all technician dropdowns):** Users with `isActive && (labSignatory === true || labApprovals?.calibrations === true)`
   - Used in: Air Pump, Air Pump Calibration, Acetone Vaporiser, RI Liquid, EFA, Flowmeter, Graticule
   
2. **Auto-populated:** Uses current logged-in user (no dropdown)
   - Used in: HSE Test Slide, PCM/PLM/Stereomicroscope

### Submission Patterns:
1. **Sends ID, Backend Populates:** Frontend sends `technicianId`, backend middleware populates `calibratedBy`
   - Used in: Air Pump, Acetone Vaporiser, RI Liquid
   
2. **Sends Name String:** Frontend sends `technicianName` as `technician` field
   - Used in: EFA, Flowmeter, Graticule
   
3. **Auto-sets Current User:** No form field, automatically uses `currentUser._id`
   - Used in: HSE Test Slide, PCM/PLM/Stereomicroscope

---

## Recommendations

1. **Standardize Field Names:** Consider migrating all to use `calibratedBy` (ObjectId) instead of `technician` (String)
2. **Data Source (implemented):** All technician dropdowns use `isActive && (labSignatory === true || labApprovals?.calibrations === true)`
3. **Standardize Submission:** All pages should send `technicianId` and let backend populate `calibratedBy`
4. **Complete Primary Flowmeter:** Implement actual backend integration for Primary Flowmeter page
