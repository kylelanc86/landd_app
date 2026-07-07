import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
} from "@mui/material";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { formatDateForInput } from "../../../utils/dateFormat";
import { equipmentService } from "../../../services/equipmentService";
import pneumaticTesterCalibrationService from "../../../services/pneumaticTesterCalibrationService";
import { useAuth } from "../../../context/AuthContext";
import { clearCachedCalibrationData } from "../../../utils/calibrationCache";
import LookupField from "../../../components/LookupField";
import {
  equipmentOptionsFromList,
  buildEquipmentDisplayLabel,
} from "../../../utils/lookupOptions";
import {
  UNCERTAINTY_LABEL,
  readFileAsBase64,
  openCertificateData,
  formatDate,
  formatUncertaintyOfMeasurement,
} from "./pneumaticTesterCalibrationUtils";
import {
  CALIBRATION_TABS,
} from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const PneumaticTesterCalibrationPage = () => {
  const navigate = useNavigate();
  const { calibrationId } = useParams();
  const [searchParams] = useSearchParams();
  const equipmentIdParam = searchParams.get("equipmentId");
  const { currentUser } = useAuth();

  const isEditRoute = Boolean(calibrationId);
  const [isEditMode, setIsEditMode] = useState(!isEditRoute);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [pneumaticTesters, setPneumaticTesters] = useState([]);
  const [pneumaticTestersLoading] = useState(false);

  const [formData, setFormData] = useState({
    pneumaticTesterReference: "",
    pneumaticTesterEquipmentId: "",
    date: formatDateForInput(new Date()),
    calibrationCompany: "",
    uncertaintyOfMeasurement: "",
    notes: "",
    certificates: [],
    newCertificateFiles: [],
  });

  const fetchPneumaticTesters = useCallback(async () => {
    const response = await equipmentService.getAll();
    const allEquipment = response.equipment || [];
    return allEquipment
      .filter((equipment) => equipment.equipmentType === "Pneumatic tester")
      .sort((a, b) =>
        a.equipmentReference.localeCompare(b.equipmentReference)
      );
  }, []);

  useEffect(() => {
    const loadPage = async () => {
      try {
        setPageLoading(true);
        setError(null);

        const pneumaticTesterList = await fetchPneumaticTesters();
        setPneumaticTesters(pneumaticTesterList);

        if (isEditRoute) {
          const calibration = await pneumaticTesterCalibrationService.getById(calibrationId);

          const pneumaticTesterEquipment = pneumaticTesterList.find(
            (item) => item.equipmentReference === calibration.pneumaticTesterReference
          );

          setFormData({
            pneumaticTesterReference: calibration.pneumaticTesterReference,
            pneumaticTesterEquipmentId: pneumaticTesterEquipment?._id || "",
            date: formatDateForInput(new Date(calibration.date)),
            calibrationCompany: calibration.calibrationCompany,
            uncertaintyOfMeasurement: (() => {
              const raw =
                calibration.uncertaintyOfMeasurement ?? calibration.error;
              if (raw === null || raw === undefined || raw === "") return "";
              const parsed = parseFloat(raw);
              return Number.isNaN(parsed) ? "" : String(parsed);
            })(),
            notes: calibration.notes || "",
            certificates: calibration.certificates || [],
            newCertificateFiles: [],
          });
        } else if (equipmentIdParam) {
          const selectedPneumaticTester = pneumaticTesterList.find(
            (item) => String(item._id) === String(equipmentIdParam)
          );

          if (selectedPneumaticTester) {
            setFormData((prev) => ({
              ...prev,
              pneumaticTesterEquipmentId: selectedPneumaticTester._id,
              pneumaticTesterReference: selectedPneumaticTester.equipmentReference,
            }));
          }
        }
      } catch (err) {
        console.error("Error loading calibration page:", err);
        setError(err.message || "Failed to load calibration");
      } finally {
        setPageLoading(false);
      }
    };

    loadPage();
  }, [calibrationId, equipmentIdParam, fetchPneumaticTesters, isEditRoute]);

  const lookupViewMode = Boolean(isEditRoute && !isEditMode);

  const handlePneumaticTesterChange = (pneumaticTesterEquipmentId) => {
    const selectedPneumaticTester = pneumaticTesters.find(
      (item) => item._id === pneumaticTesterEquipmentId
    );

    setFormData((prev) => ({
      ...prev,
      pneumaticTesterEquipmentId,
      pneumaticTesterReference: selectedPneumaticTester
        ? selectedPneumaticTester.equipmentReference
        : "",
    }));
    setError(null);
  };

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (files.length === 0) return;

    const invalidFile = files.find(
      (file) => file.type !== "application/pdf" && !file.name.endsWith(".pdf")
    );
    if (invalidFile) {
      setError("Please upload PDF certificate files only");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      newCertificateFiles: [...prev.newCertificateFiles, ...files],
    }));
  };

  const handleRemoveExistingCertificate = (index) => {
    setFormData((prev) => ({
      ...prev,
      certificates: prev.certificates.filter((_, i) => i !== index),
    }));
  };

  const handleRemoveNewCertificate = (index) => {
    setFormData((prev) => ({
      ...prev,
      newCertificateFiles: prev.newCertificateFiles.filter((_, i) => i !== index),
    }));
  };

  const buildCertificatesPayload = async () => {
    const existingCertificates = formData.certificates.map((cert) => ({
      fileName: cert.fileName,
      fileType: cert.fileType,
      uploadedAt: cert.uploadedAt || new Date().toISOString(),
      data: cert.data,
    }));

    const newCertificates = await Promise.all(
      formData.newCertificateFiles.map(async (file) => ({
        fileName: file.name,
        fileType: file.type || "application/pdf",
        uploadedAt: new Date().toISOString(),
        data: await readFileAsBase64(file),
      }))
    );

    return [...existingCertificates, ...newCertificates];
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setError(null);

      if (!currentUser || !currentUser._id) {
        throw new Error("User not authenticated");
      }

      if (
        !formData.pneumaticTesterEquipmentId ||
        !formData.date ||
        !formData.calibrationCompany ||
        formData.uncertaintyOfMeasurement === ""
      ) {
        setError("Please fill in all required fields");
        return;
      }

      const uncertaintyValue = parseFloat(formData.uncertaintyOfMeasurement);
      if (Number.isNaN(uncertaintyValue)) {
        setError("Uncertainty of Measurement must be a valid number");
        return;
      }

      const certificates = await buildCertificatesPayload();

      const backendData = {
        pneumaticTesterReference: formData.pneumaticTesterReference,
        date: formData.date,
        calibrationCompany: formData.calibrationCompany,
        uncertaintyOfMeasurement: Math.abs(uncertaintyValue),
        certificates,
        notes: formData.notes || "",
        calibratedBy: currentUser._id,
      };

      if (isEditRoute) {
        await pneumaticTesterCalibrationService.update(calibrationId, backendData);
      } else {
        await pneumaticTesterCalibrationService.create(backendData);
      }

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.pneumaticTesterEquipmentId },
        })
      );

      clearCachedCalibrationData("pneumatic-tester");

      navigate("/records/laboratory/calibrations/pneumatic-tester");
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/records/laboratory/calibrations/pneumatic-tester");
  };

  if (pageLoading) {
    return (
      <Box
        sx={{ p: { xs: 2, sm: 3, md: 4 } }}
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  const pageTitle = isEditRoute
    ? lookupViewMode
      ? "View Pneumatic Tester Calibration"
      : "Edit Pneumatic Tester Calibration"
    : "Add Pneumatic Tester Calibration";
  const breadcrumbCurrent = isEditRoute
    ? lookupViewMode
      ? "View Calibration"
      : "Edit Calibration"
    : "Add Calibration";

  return (
    <Box sx={{ p: CALIBRATION_PAGE_PADDING }}>
      <CalibrationPageHeader
        title={pageTitle}
        breadcrumbCurrent={breadcrumbCurrent}
        calibrationTab={CALIBRATION_TABS.EXTERNAL}
        parents={[{ label: "Pneumatic Tester Calibrations", onClick: handleCancel }]}
        action={
          lookupViewMode ? (
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              onClick={() => setIsEditMode(true)}
            >
              Edit Record
            </Button>
          ) : null
        }
      />

      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Stack spacing={3}>
            <Box display="flex" gap={2} flexWrap="wrap">
              <Box sx={{ flex: 1, minWidth: 240 }}>
                <LookupField
                  mode={lookupViewMode ? "view" : "edit"}
                  label="Pneumatic Tester"
                  required
                  value={formData.pneumaticTesterEquipmentId}
                  displayLabel={
                    formData.pneumaticTesterReference ||
                    buildEquipmentDisplayLabel(
                      pneumaticTesters.find(
                        (fm) =>
                          String(fm._id) === String(formData.pneumaticTesterEquipmentId)
                      )
                    )
                  }
                  options={equipmentOptionsFromList(pneumaticTesters)}
                  onChange={(e) => handlePneumaticTesterChange(e.target.value)}
                  disabled={pneumaticTestersLoading || isEditRoute}
                  loading={pneumaticTestersLoading}
                  emptyOptionsText="No pneumatic testers found"
                />
              </Box>
              <TextField
                sx={{ flex: 1, minWidth: 240 }}
                label="Calibration Date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
                required
                disabled={lookupViewMode}
              />
            </Box>

            <TextField
              fullWidth
              label="Calibration Company"
              value={formData.calibrationCompany}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  calibrationCompany: e.target.value,
                })
              }
              required
              disabled={lookupViewMode}
            />

            <TextField
              fullWidth
              label={UNCERTAINTY_LABEL}
              type={lookupViewMode ? "text" : "number"}
              value={
                lookupViewMode
                  ? formatUncertaintyOfMeasurement(
                      formData.uncertaintyOfMeasurement
                    )
                  : formData.uncertaintyOfMeasurement
              }
              onChange={(e) =>
                setFormData({
                  ...formData,
                  uncertaintyOfMeasurement: e.target.value,
                })
              }
              inputProps={lookupViewMode ? undefined : { step: "0.01" }}
              required
              disabled={lookupViewMode}
              helperText={
                lookupViewMode
                  ? undefined
                  : "Enter the value in H20 @ 4°C (e.g. 2.5). Displayed as ± 2.5 H20 @ 4°C."
              }
            />

            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              disabled={lookupViewMode}
            />

            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Certificates
              </Typography>
              {(formData.certificates.length > 0 ||
                formData.newCertificateFiles.length > 0) && (
                <List dense>
                  {formData.certificates.map((cert, index) => (
                    <ListItem key={`existing-${index}`}>
                      <ListItemText
                        primary={cert.fileName}
                        secondary={
                          cert.uploadedAt
                            ? `Uploaded ${formatDate(cert.uploadedAt)}`
                            : "Existing certificate"
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() =>
                            openCertificateData(cert.data, cert.fileType)
                          }
                          title="View certificate"
                        >
                          <PictureAsPdfIcon />
                        </IconButton>
                        {!lookupViewMode && (
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() =>
                              handleRemoveExistingCertificate(index)
                            }
                            title="Remove certificate"
                          >
                            <DeleteIcon />
                          </IconButton>
                        )}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                  {formData.newCertificateFiles.map((file, index) => (
                    <ListItem key={`new-${index}`}>
                      <ListItemText
                        primary={file.name}
                        secondary="Pending upload"
                      />
                      {!lookupViewMode && (
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            size="small"
                            onClick={() => handleRemoveNewCertificate(index)}
                            title="Remove file"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                </List>
              )}
              {!lookupViewMode && (
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<AttachFileIcon />}
                  fullWidth
                >
                  Attach Certificate(s)
                  <input
                    type="file"
                    hidden
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleFileChange}
                  />
                </Button>
              )}
            </Box>

            <Box display="flex" justifyContent="flex-end" gap={2}>
              <Button onClick={handleCancel}>
                {lookupViewMode ? "Back" : "Cancel"}
              </Button>
              {!lookupViewMode && (
                <Button
                  type="submit"
                  variant="contained"
                  disabled={
                    submitting ||
                    !formData.pneumaticTesterEquipmentId ||
                    !formData.date ||
                    !formData.calibrationCompany ||
                    formData.uncertaintyOfMeasurement === ""
                  }
                >
                  {submitting ? <CircularProgress size={24} /> : "Save"}
                </Button>
              )}
            </Box>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
};

export default PneumaticTesterCalibrationPage;
