import React from "react";
import { FormControl, InputLabel, MenuItem, Select, TextField } from "@mui/material";
import { formatDateForInput } from "../../../utils/dateFormat";
import ExternalCalibrationFormPage from "./ExternalCalibrationFormPage";
import fumeHoodCalibrationService from "../../../services/fumeHoodCalibrationService";
import { formatPassFail, REFERENCE_FIELD } from "./fumeHoodCalibrationUtils";

const getInitialFormData = () => ({
  fumeHoodReference: "",
  fumeHoodEquipmentId: "",
  date: formatDateForInput(new Date()),
  calibrationCompany: "",
  faceVelocity: "",
  airChanges: "",
  notes: "",
  certificates: [],
  newCertificateFiles: [],
});

const mapCalibrationToForm = (calibration, equipmentList) => {
  const equipment = equipmentList.find(
    (item) => item.equipmentReference === calibration.fumeHoodReference
  );

  return {
    fumeHoodReference: calibration.fumeHoodReference,
    fumeHoodEquipmentId: equipment?._id || "",
    date: formatDateForInput(new Date(calibration.date)),
    calibrationCompany: calibration.calibrationCompany,
    faceVelocity: calibration.faceVelocity || "",
    airChanges: calibration.airChanges || "",
    notes: calibration.notes || "",
    certificates: calibration.certificates || [],
    newCertificateFiles: [],
  };
};

const validateForm = (formData) => {
  if (
    !formData.fumeHoodEquipmentId ||
    !formData.date ||
    !formData.calibrationCompany ||
    !formData.faceVelocity ||
    !formData.airChanges
  ) {
    return "Please fill in all required fields";
  }
  return null;
};

const buildPayload = (formData, certificates, calibratedBy) => ({
  fumeHoodReference: formData.fumeHoodReference,
  date: formData.date,
  calibrationCompany: formData.calibrationCompany,
  faceVelocity: formData.faceVelocity,
  airChanges: formData.airChanges,
  certificates,
  notes: formData.notes || "",
  calibratedBy,
});

const PassFailField = ({ label, value, onChange, lookupViewMode }) => {
  if (lookupViewMode) {
    return (
      <TextField
        fullWidth
        label={label}
        value={formatPassFail(value)}
        disabled
      />
    );
  }

  return (
    <FormControl fullWidth required>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={onChange}>
        <MenuItem value="pass">Pass</MenuItem>
        <MenuItem value="fail">Fail</MenuItem>
      </Select>
    </FormControl>
  );
};

const FumeHoodsCalibrationPage = () => (
  <ExternalCalibrationFormPage
    title="Fume Hood Calibration"
    listTitle="Fume Hood Calibrations"
    equipmentType="Fume Hood"
    equipmentLabel="Fume Hood"
    routeBase="/records/laboratory/calibrations/fume-hoods"
    cacheKey="fume-hood"
    referenceField={REFERENCE_FIELD}
    equipmentIdField="fumeHoodEquipmentId"
    calibrationService={fumeHoodCalibrationService}
    emptyEquipmentText="No fume hoods found"
    getInitialFormData={getInitialFormData}
    mapCalibrationToForm={mapCalibrationToForm}
    validateForm={validateForm}
    buildPayload={buildPayload}
    renderExtraFields={({ formData, setFormData, lookupViewMode }) => (
      <>
        <PassFailField
          label="Face Velocity"
          value={formData.faceVelocity}
          lookupViewMode={lookupViewMode}
          onChange={(e) =>
            setFormData({ ...formData, faceVelocity: e.target.value })
          }
        />
        <PassFailField
          label="Air Changes"
          value={formData.airChanges}
          lookupViewMode={lookupViewMode}
          onChange={(e) =>
            setFormData({ ...formData, airChanges: e.target.value })
          }
        />
      </>
    )}
  />
);

export default FumeHoodsCalibrationPage;
