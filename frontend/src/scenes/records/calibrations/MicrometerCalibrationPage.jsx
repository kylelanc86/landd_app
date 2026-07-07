import React from "react";
import { TextField } from "@mui/material";
import { formatDateForInput } from "../../../utils/dateFormat";
import ExternalCalibrationFormPage from "./ExternalCalibrationFormPage";
import micrometerCalibrationService from "../../../services/micrometerCalibrationService";
import {
  formatUncertaintyOfMeasurement,
  REFERENCE_FIELD,
} from "./micrometerCalibrationUtils";

const getInitialFormData = () => ({
  micrometerReference: "",
  micrometerEquipmentId: "",
  date: formatDateForInput(new Date()),
  calibrationCompany: "",
  uncertaintyOfMeasurement: "",
  notes: "",
  certificates: [],
  newCertificateFiles: [],
});

const mapCalibrationToForm = (calibration, equipmentList) => {
  const equipment = equipmentList.find(
    (item) => item.equipmentReference === calibration.micrometerReference
  );
  const raw = calibration.uncertaintyOfMeasurement;
  const parsed = raw === null || raw === undefined || raw === "" ? "" : parseFloat(raw);

  return {
    micrometerReference: calibration.micrometerReference,
    micrometerEquipmentId: equipment?._id || "",
    date: formatDateForInput(new Date(calibration.date)),
    calibrationCompany: calibration.calibrationCompany,
    uncertaintyOfMeasurement:
      parsed === "" || Number.isNaN(parsed) ? "" : String(parsed),
    notes: calibration.notes || "",
    certificates: calibration.certificates || [],
    newCertificateFiles: [],
  };
};

const validateForm = (formData) => {
  if (
    !formData.micrometerEquipmentId ||
    !formData.date ||
    !formData.calibrationCompany ||
    formData.uncertaintyOfMeasurement === ""
  ) {
    return "Please fill in all required fields";
  }
  const value = parseFloat(formData.uncertaintyOfMeasurement);
  if (Number.isNaN(value)) {
    return "Uncertainty must be a valid number";
  }
  return null;
};

const buildPayload = (formData, certificates, calibratedBy) => ({
  micrometerReference: formData.micrometerReference,
  date: formData.date,
  calibrationCompany: formData.calibrationCompany,
  uncertaintyOfMeasurement: Math.abs(parseFloat(formData.uncertaintyOfMeasurement)),
  certificates,
  notes: formData.notes || "",
  calibratedBy,
});

const MicrometerCalibrationPage = () => (
  <ExternalCalibrationFormPage
    title="Micrometer Calibration"
    listTitle="Micrometer Calibrations"
    equipmentType="Micrometer"
    equipmentLabel="Micrometer"
    routeBase="/records/laboratory/calibrations/micrometer"
    cacheKey="micrometer"
    referenceField={REFERENCE_FIELD}
    equipmentIdField="micrometerEquipmentId"
    calibrationService={micrometerCalibrationService}
    emptyEquipmentText="No micrometers found"
    getInitialFormData={getInitialFormData}
    mapCalibrationToForm={mapCalibrationToForm}
    validateForm={validateForm}
    buildPayload={buildPayload}
    renderExtraFields={({ formData, setFormData, lookupViewMode }) => (
      <TextField
        fullWidth
        label="Uncertainty (mm)"
        type={lookupViewMode ? "text" : "number"}
        value={
          lookupViewMode
            ? formatUncertaintyOfMeasurement(formData.uncertaintyOfMeasurement)
            : formData.uncertaintyOfMeasurement
        }
        onChange={(e) =>
          setFormData({ ...formData, uncertaintyOfMeasurement: e.target.value })
        }
        inputProps={lookupViewMode ? undefined : { step: "0.01" }}
        required
        disabled={lookupViewMode}
        helperText={
          lookupViewMode
            ? undefined
            : "Enter the value in mm (e.g. 0.01). Displayed as ± 0.01 mm."
        }
      />
    )}
  />
);

export default MicrometerCalibrationPage;
