import React from "react";
import { TextField } from "@mui/material";
import { formatDateForInput } from "../../../utils/dateFormat";
import ExternalCalibrationFormPage from "./ExternalCalibrationFormPage";
import caliperCalibrationService from "../../../services/caliperCalibrationService";
import {
  formatUncertaintyAt30mm,
  REFERENCE_FIELD,
} from "./caliperCalibrationUtils";

const getInitialFormData = () => ({
  caliperReference: "",
  caliperEquipmentId: "",
  date: formatDateForInput(new Date()),
  calibrationCompany: "",
  uncertaintyAt30mm: "",
  notes: "",
  certificates: [],
  newCertificateFiles: [],
});

const mapCalibrationToForm = (calibration, equipmentList) => {
  const equipment = equipmentList.find(
    (item) => item.equipmentReference === calibration.caliperReference
  );
  const raw = calibration.uncertaintyAt30mm;
  const parsed = raw === null || raw === undefined || raw === "" ? "" : parseFloat(raw);

  return {
    caliperReference: calibration.caliperReference,
    caliperEquipmentId: equipment?._id || "",
    date: formatDateForInput(new Date(calibration.date)),
    calibrationCompany: calibration.calibrationCompany,
    uncertaintyAt30mm:
      parsed === "" || Number.isNaN(parsed) ? "" : String(parsed),
    notes: calibration.notes || "",
    certificates: calibration.certificates || [],
    newCertificateFiles: [],
  };
};

const validateForm = (formData) => {
  if (
    !formData.caliperEquipmentId ||
    !formData.date ||
    !formData.calibrationCompany ||
    formData.uncertaintyAt30mm === ""
  ) {
    return "Please fill in all required fields";
  }
  const value = parseFloat(formData.uncertaintyAt30mm);
  if (Number.isNaN(value)) {
    return "Uncertainty at 30mm must be a valid number";
  }
  return null;
};

const buildPayload = (formData, certificates, calibratedBy) => ({
  caliperReference: formData.caliperReference,
  date: formData.date,
  calibrationCompany: formData.calibrationCompany,
  uncertaintyAt30mm: Math.abs(parseFloat(formData.uncertaintyAt30mm)),
  certificates,
  notes: formData.notes || "",
  calibratedBy,
});

const CalipersCalibrationPage = () => (
  <ExternalCalibrationFormPage
    title="Caliper Calibration"
    listTitle="Caliper Calibrations"
    equipmentType="Caliper"
    equipmentLabel="Caliper"
    routeBase="/records/laboratory/calibrations/calipers"
    cacheKey="caliper"
    referenceField={REFERENCE_FIELD}
    equipmentIdField="caliperEquipmentId"
    calibrationService={caliperCalibrationService}
    emptyEquipmentText="No calipers found"
    getInitialFormData={getInitialFormData}
    mapCalibrationToForm={mapCalibrationToForm}
    validateForm={validateForm}
    buildPayload={buildPayload}
    renderExtraFields={({ formData, setFormData, lookupViewMode }) => (
      <TextField
        fullWidth
        label="Uncertainty at 30mm (μm)"
        type={lookupViewMode ? "text" : "number"}
        value={
          lookupViewMode
            ? formatUncertaintyAt30mm(formData.uncertaintyAt30mm)
            : formData.uncertaintyAt30mm
        }
        onChange={(e) =>
          setFormData({ ...formData, uncertaintyAt30mm: e.target.value })
        }
        inputProps={lookupViewMode ? undefined : { step: "0.1" }}
        required
        disabled={lookupViewMode}
        helperText={
          lookupViewMode
            ? undefined
            : "Enter the value in μm (e.g. 5). Displayed as ± 5 μm."
        }
      />
    )}
  />
);

export default CalipersCalibrationPage;
