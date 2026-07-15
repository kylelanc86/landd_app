import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { useAuth } from "../../../context/AuthContext";
import { clearCachedCalibrationData } from "../../../utils/calibrationCache";
import LookupField from "../../../components/LookupField";
import {
  equipmentOptionsFromList,
  buildEquipmentDisplayLabel,
} from "../../../utils/lookupOptions";
import {
  readFileAsBase64,
  openCertificateData,
  formatDate,
} from "./externalEquipmentCalibrationUtils";
import {
  CALIBRATION_TABS,
} from "./calibrationsNavigationUtils";
import CalibrationPageHeader, {
  CALIBRATION_PAGE_PADDING,
} from "./CalibrationPageHeader";

const ExternalCalibrationFormPage = ({
  title,
  listTitle,
  equipmentType,
  equipmentTypes,
  equipmentLabel,
  routeBase,
  cacheKey,
  referenceField,
  equipmentIdField,
  equipmentTypeField,
  calibrationService,
  emptyEquipmentText,
  getInitialFormData,
  mapCalibrationToForm,
  validateForm,
  buildPayload,
  renderExtraFields,
  equipmentOptionLabel,
  companyFieldLabel = "Calibration Company",
}) => {
  const navigate = useNavigate();
  const { calibrationId } = useParams();
  const [searchParams] = useSearchParams();
  const equipmentIdParam = searchParams.get("equipmentId");
  const { currentUser } = useAuth();
  const resolvedEquipmentTypes = useMemo(
    () =>
      equipmentTypes?.length
        ? equipmentTypes
        : equipmentType
          ? [equipmentType]
          : [],
    [equipmentType, equipmentTypes]
  );

  const isEditRoute = Boolean(calibrationId);
  const [isEditMode, setIsEditMode] = useState(!isEditRoute);
  const [pageLoading, setPageLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [equipmentList, setEquipmentList] = useState([]);
  const [formData, setFormData] = useState(getInitialFormData);

  const fetchEquipment = useCallback(async () => {
    const responses = await Promise.all(
      resolvedEquipmentTypes.map((type) =>
        equipmentService.getAll({ equipmentType: type, limit: 1000 })
      )
    );
    return responses
      .flatMap((response) => response.equipment || [])
      .sort((a, b) =>
        a.equipmentReference.localeCompare(b.equipmentReference)
      );
  }, [resolvedEquipmentTypes]);

  useEffect(() => {
    const loadPage = async () => {
      try {
        setPageLoading(true);
        setError(null);

        const list = await fetchEquipment();
        setEquipmentList(list);

        if (isEditRoute) {
          const calibration = await calibrationService.getById(calibrationId);
          setFormData(mapCalibrationToForm(calibration, list));
        } else if (equipmentIdParam) {
          const selected = list.find(
            (item) => String(item._id) === String(equipmentIdParam)
          );
          if (selected) {
            setFormData((prev) => ({
              ...prev,
              [equipmentIdField]: selected._id,
              [referenceField]: selected.equipmentReference,
              ...(equipmentTypeField
                ? { [equipmentTypeField]: selected.equipmentType }
                : {}),
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
  }, [
    calibrationId,
    calibrationService,
    equipmentIdField,
    equipmentIdParam,
    equipmentTypeField,
    fetchEquipment,
    isEditRoute,
    mapCalibrationToForm,
    referenceField,
  ]);

  const lookupViewMode = Boolean(isEditRoute && !isEditMode);

  const handleEquipmentChange = (equipmentId) => {
    const selected = equipmentList.find((item) => item._id === equipmentId);
    setFormData((prev) => ({
      ...prev,
      [equipmentIdField]: equipmentId,
      [referenceField]: selected ? selected.equipmentReference : "",
      ...(equipmentTypeField
        ? { [equipmentTypeField]: selected ? selected.equipmentType : "" }
        : {}),
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

      const validationError = validateForm(formData);
      if (validationError) {
        setError(validationError);
        return;
      }

      const certificates = await buildCertificatesPayload();
      const backendData = buildPayload(formData, certificates, currentUser._id);

      if (isEditRoute) {
        await calibrationService.update(calibrationId, backendData);
      } else {
        await calibrationService.create(backendData);
      }

      window.dispatchEvent(
        new CustomEvent("equipmentDataUpdated", {
          detail: { equipmentId: formData[equipmentIdField] },
        })
      );

      clearCachedCalibrationData(cacheKey);
      navigate(routeBase);
    } catch (err) {
      setError(err.message || "Failed to save calibration");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => navigate(routeBase);

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

  const canSubmit = !validateForm(formData);
  const pageTitle = isEditRoute
    ? lookupViewMode
      ? `View ${title}`
      : `Edit ${title}`
    : `Add ${title}`;
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
        parents={[{ label: listTitle, onClick: handleCancel }]}
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
                  label={equipmentLabel}
                  required
                  value={formData[equipmentIdField]}
                  displayLabel={
                    formData[referenceField] ||
                    buildEquipmentDisplayLabel(
                      equipmentList.find(
                        (item) =>
                          String(item._id) === String(formData[equipmentIdField])
                      )
                    )
                  }
                  options={
                    equipmentOptionLabel
                      ? equipmentList.map((item) => ({
                          value: String(item._id),
                          label: equipmentOptionLabel(item),
                        }))
                      : equipmentOptionsFromList(equipmentList)
                  }
                  onChange={(e) => handleEquipmentChange(e.target.value)}
                  disabled={isEditRoute}
                  emptyOptionsText={emptyEquipmentText}
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
              label={companyFieldLabel}
              value={formData.calibrationCompany}
              onChange={(e) =>
                setFormData({ ...formData, calibrationCompany: e.target.value })
              }
              required
              disabled={lookupViewMode}
            />

            {renderExtraFields?.({ formData, setFormData, lookupViewMode })}

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
                <Button type="submit" variant="contained" disabled={submitting || !canSubmit}>
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

export default ExternalCalibrationFormPage;
