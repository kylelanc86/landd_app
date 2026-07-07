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
import furnaceCalibrationService from "../../../services/furnaceCalibrationService";
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
} from "./furnaceCalibrationUtils";
import {
  CALIBRATION_TABS,
} from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const FurnaceCalibrationPage = () => {
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
  const [furnaces, setFurnaces] = useState([]);
  const [furnacesLoading] = useState(false);

  const [formData, setFormData] = useState({
    furnaceReference: "",
    furnaceEquipmentId: "",
    date: formatDateForInput(new Date()),
    calibrationCompany: "",
    uncertaintyOfMeasurement: "",
    notes: "",
    certificates: [],
    newCertificateFiles: [],
  });

  const fetchFurnaces = useCallback(async () => {
    const response = await equipmentService.getAll();
    const allEquipment = response.equipment || [];
    return allEquipment
      .filter((equipment) => equipment.equipmentType === "Furnace")
      .sort((a, b) =>
        a.equipmentReference.localeCompare(b.equipmentReference)
      );
  }, []);

  useEffect(() => {
    const loadPage = async () => {
      try {
        setPageLoading(true);
        setError(null);

        const furnaceList = await fetchFurnaces();
        setFurnaces(furnaceList);

        if (isEditRoute) {
          const calibration = await furnaceCalibrationService.getById(calibrationId);

          const furnaceEquipment = furnaceList.find(
            (item) => item.equipmentReference === calibration.furnaceReference
          );

          setFormData({
            furnaceReference: calibration.furnaceReference,
            furnaceEquipmentId: furnaceEquipment?._id || "",
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
          const selectedFurnace = furnaceList.find(
            (item) => String(item._id) === String(equipmentIdParam)
          );

          if (selectedFurnace) {
            setFormData((prev) => ({
              ...prev,
              furnaceEquipmentId: selectedFurnace._id,
              furnaceReference: selectedFurnace.equipmentReference,
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
  }, [calibrationId, equipmentIdParam, fetchFurnaces, isEditRoute]);

  const lookupViewMode = Boolean(isEditRoute && !isEditMode);

  const handleFurnaceChange = (furnaceEquipmentId) => {
    const selectedFurnace = furnaces.find(
      (item) => item._id === furnaceEquipmentId
    );

    setFormData((prev) => ({
      ...prev,
      furnaceEquipmentId,
      furnaceReference: selectedFurnace
        ? selectedFurnace.equipmentReference
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
        !formData.furnaceEquipmentId ||
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
        furnaceReference: formData.furnaceReference,
        date: formData.date,
        calibrationCompany: formData.calibrationCompany,
        uncertaintyOfMeasurement: Math.abs(uncertaintyValue),
        certificates,
        notes: formData.notes || "",
        calibratedBy: currentUser._id,
      };

      if (isEditRoute) {
        await furnaceCalibrationService.update(calibrationId, backendData);
      } else {
        await furnaceCalibrationService.create(backendData);
      }

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData.furnaceEquipmentId },
        })
      );

      clearCachedCalibrationData("furnace");

      navigate("/records/laboratory/calibrations/furnace");
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/records/laboratory/calibrations/furnace");
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
      ? "View Furnace Calibration"
      : "Edit Furnace Calibration"
    : "Add Furnace Calibration";
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
        parents={[{ label: "Furnace Calibrations", onClick: handleCancel }]}
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
                  label="Furnace"
                  required
                  value={formData.furnaceEquipmentId}
                  displayLabel={
                    formData.furnaceReference ||
                    buildEquipmentDisplayLabel(
                      furnaces.find(
                        (fm) =>
                          String(fm._id) === String(formData.furnaceEquipmentId)
                      )
                    )
                  }
                  options={equipmentOptionsFromList(furnaces)}
                  onChange={(e) => handleFurnaceChange(e.target.value)}
                  disabled={furnacesLoading || isEditRoute}
                  loading={furnacesLoading}
                  emptyOptionsText="No furnaces found"
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
                  : "Enter the value in °C (e.g. 2.5). Displayed as ± 2.5 °C."
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
                    !formData.furnaceEquipmentId ||
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

export default FurnaceCalibrationPage;
