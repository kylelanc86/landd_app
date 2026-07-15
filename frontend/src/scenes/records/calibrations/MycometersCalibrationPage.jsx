import React from "react";
import { formatDateForInput } from "../../../utils/dateFormat";
import ExternalCalibrationFormPage from "./ExternalCalibrationFormPage";
import mycometerCalibrationService from "../../../services/mycometerCalibrationService";
import {
  MYCOMETER_EQUIPMENT_TYPES,
  REFERENCE_FIELD,
} from "./mycometerCalibrationUtils";

const getInitialFormData = () => ({
  mycometerReference: "",
  mycometerEquipmentId: "",
  equipmentType: "",
  date: formatDateForInput(new Date()),
  calibrationCompany: "",
  notes: "",
  certificates: [],
  newCertificateFiles: [],
});

const mapCalibrationToForm = (calibration, equipmentList) => {
  const equipment = equipmentList.find(
    (item) => item.equipmentReference === calibration.mycometerReference
  );

  return {
    mycometerReference: calibration.mycometerReference,
    mycometerEquipmentId: equipment?._id || "",
    equipmentType: calibration.equipmentType || equipment?.equipmentType || "",
    date: formatDateForInput(new Date(calibration.date)),
    calibrationCompany: calibration.calibrationCompany,
    notes: calibration.notes || "",
    certificates: calibration.certificates || [],
    newCertificateFiles: [],
  };
};

const validateForm = (formData) => {
  if (
    !formData.mycometerEquipmentId ||
    !formData.equipmentType ||
    !formData.date ||
    !formData.calibrationCompany
  ) {
    return "Please fill in all required fields";
  }
  if (!MYCOMETER_EQUIPMENT_TYPES.includes(formData.equipmentType)) {
    return "Invalid Mycometer equipment type";
  }
  return null;
};

const buildPayload = (formData, certificates, calibratedBy) => ({
  mycometerReference: formData.mycometerReference,
  equipmentType: formData.equipmentType,
  date: formData.date,
  calibrationCompany: formData.calibrationCompany,
  certificates,
  notes: formData.notes || "",
  calibratedBy,
});

const MycometersCalibrationPage = () => (
  <ExternalCalibrationFormPage
    title="Mycometer Calibration/Servicing"
    listTitle="Mycometer Calibrations/Servicing"
    equipmentTypes={MYCOMETER_EQUIPMENT_TYPES}
    equipmentLabel="Mycometer"
    routeBase="/records/laboratory/calibrations/mycometers"
    cacheKey="mycometer"
    referenceField={REFERENCE_FIELD}
    equipmentIdField="mycometerEquipmentId"
    equipmentTypeField="equipmentType"
    calibrationService={mycometerCalibrationService}
    emptyEquipmentText="No Mycometer Analysers or Rotameters found"
    getInitialFormData={getInitialFormData}
    mapCalibrationToForm={mapCalibrationToForm}
    validateForm={validateForm}
    buildPayload={buildPayload}
    companyFieldLabel="Calibration/Servicing Company"
    equipmentOptionLabel={(item) => {
      const parts = [item.equipmentReference, item.equipmentType];
      if (item.brandModel) parts.push(item.brandModel);
      return parts.filter(Boolean).join(" — ");
    }}
  />
);

export default MycometersCalibrationPage;
