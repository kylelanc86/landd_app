import React from "react";
import { TextField } from "@mui/material";
import { formatDateForInput } from "../../../utils/dateFormat";
import ExternalCalibrationFormPage from "./ExternalCalibrationFormPage";
import massBalanceCalibrationService from "../../../services/massBalanceCalibrationService";
import {
  formatUncertaintyAt1000g,
  REFERENCE_FIELD,
} from "./massBalanceCalibrationUtils";

const getInitialFormData = () => ({
  massBalanceReference: "",
  massBalanceEquipmentId: "",
  date: formatDateForInput(new Date()),
  calibrationCompany: "",
  uncertaintyAt1000g: "",
  notes: "",
  certificates: [],
  newCertificateFiles: [],
});

const mapCalibrationToForm = (calibration, equipmentList) => {
  const equipment = equipmentList.find(
    (item) => item.equipmentReference === calibration.massBalanceReference
  );
  const raw = calibration.uncertaintyAt1000g;
  const parsed = raw === null || raw === undefined || raw === "" ? "" : parseFloat(raw);

  return {
    massBalanceReference: calibration.massBalanceReference,
    massBalanceEquipmentId: equipment?._id || "",
    date: formatDateForInput(new Date(calibration.date)),
    calibrationCompany: calibration.calibrationCompany,
    uncertaintyAt1000g:
      parsed === "" || Number.isNaN(parsed) ? "" : String(parsed),
    notes: calibration.notes || "",
    certificates: calibration.certificates || [],
    newCertificateFiles: [],
  };
};

const validateForm = (formData) => {
  if (
    !formData.massBalanceEquipmentId ||
    !formData.date ||
    !formData.calibrationCompany ||
    formData.uncertaintyAt1000g === ""
  ) {
    return "Please fill in all required fields";
  }
  const value = parseFloat(formData.uncertaintyAt1000g);
  if (Number.isNaN(value)) {
    return "Uncertainty at 1000g must be a valid number";
  }
  return null;
};

const buildPayload = (formData, certificates, calibratedBy) => ({
  massBalanceReference: formData.massBalanceReference,
  date: formData.date,
  calibrationCompany: formData.calibrationCompany,
  uncertaintyAt1000g: Math.abs(parseFloat(formData.uncertaintyAt1000g)),
  certificates,
  notes: formData.notes || "",
  calibratedBy,
});

const MassBalancesCalibrationPage = () => (
  <ExternalCalibrationFormPage
    title="Mass Balance Calibration"
    listTitle="Mass Balance Calibrations"
    equipmentType="Mass Balance"
    equipmentLabel="Mass Balance"
    routeBase="/records/laboratory/calibrations/mass-balances"
    cacheKey="mass-balance"
    referenceField={REFERENCE_FIELD}
    equipmentIdField="massBalanceEquipmentId"
    calibrationService={massBalanceCalibrationService}
    emptyEquipmentText="No mass balances found"
    getInitialFormData={getInitialFormData}
    mapCalibrationToForm={mapCalibrationToForm}
    validateForm={validateForm}
    buildPayload={buildPayload}
    renderExtraFields={({ formData, setFormData, lookupViewMode }) => (
      <TextField
        fullWidth
        label="Uncertainty at 1000g (g)"
        type={lookupViewMode ? "text" : "number"}
        value={
          lookupViewMode
            ? formatUncertaintyAt1000g(formData.uncertaintyAt1000g)
            : formData.uncertaintyAt1000g
        }
        onChange={(e) =>
          setFormData({ ...formData, uncertaintyAt1000g: e.target.value })
        }
        inputProps={lookupViewMode ? undefined : { step: "0.01" }}
        required
        disabled={lookupViewMode}
        helperText={
          lookupViewMode
            ? undefined
            : "Enter the value in g (e.g. 0.5). Displayed as ± 0.5 g."
        }
      />
    )}
  />
);

export default MassBalancesCalibrationPage;
