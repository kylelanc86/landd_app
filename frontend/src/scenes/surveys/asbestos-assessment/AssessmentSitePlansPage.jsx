import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  Typography,
  Alert,
} from "@mui/material";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import MapIcon from "@mui/icons-material/Map";
import UploadIcon from "@mui/icons-material/Upload";
import AddIcon from "@mui/icons-material/Add";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import asbestosAssessmentService from "../../../services/asbestosAssessmentService";
import { useSnackbar } from "../../../context/SnackbarContext";
import {
  buildAssessmentUpdatePayload,
  DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE,
  getAsbestosSitePlanAppendices,
  getAssessmentItemsPath,
  getAssessmentSitePlanEditPath,
  stripPlanForApi,
} from "../../../utils/asbestosSitePlanAppendices";

export default function AssessmentSitePlansPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { showSnackbar } = useSnackbar();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [plans, setPlans] = useState([]);
  const [deleteIndex, setDeleteIndex] = useState(null);

  const isReportLocked = (() => {
    const v = assessment?.reportAuthorisedBy;
    if (v == null) return false;
    return typeof v === "string" ? v.trim() !== "" : !!v;
  })();

  const itemsPath = getAssessmentItemsPath(location.pathname, id);

  const loadAssessment = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await asbestosAssessmentService.getById(id, {
        omitPhotoData: true,
      });
      setAssessment(data);
      setPlans(getAsbestosSitePlanAppendices(data));
    } catch (err) {
      console.error("Error loading assessment:", err);
      showSnackbar(
        err.response?.data?.message || err.message || "Failed to load assessment",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }, [id, showSnackbar]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  const persistPlans = async (nextPlans, successMessage) => {
    if (!assessment || isReportLocked) return false;
    try {
      setSaving(true);
      const payload = nextPlans.map(stripPlanForApi);
      await asbestosAssessmentService.update(
        id,
        buildAssessmentUpdatePayload(assessment, {
          sitePlanAppendices: payload,
        }),
      );
      setPlans(nextPlans);
      showSnackbar(successMessage, "success");
      return true;
    } catch (err) {
      console.error("Error saving site plans:", err);
      showSnackbar(
        err.response?.data?.message || err.message || "Failed to save site plans",
        "error",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination || isReportLocked || saving) return;
    const next = Array.from(plans);
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    await persistPlans(next, "Site plan order updated.");
  };

  const readFileAsDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleUploadFiles = async (fileList) => {
    if (!fileList?.length || isReportLocked || saving) return;
    try {
      setSaving(true);
      const uploaded = [];
      for (const file of Array.from(fileList)) {
        const dataUrl = await readFileAsDataUrl(file);
        uploaded.push({
          sitePlan: true,
          sitePlanFile: dataUrl,
          sitePlanLegend: [],
          sitePlanLegendTitle: "Key",
          sitePlanFigureTitle: DEFAULT_ASBESTOS_SITE_PLAN_FIGURE_TITLE,
          sitePlanSource: "uploaded",
        });
      }
      const next = [...plans, ...uploaded];
      const ok = await persistPlans(
        next,
        uploaded.length === 1
          ? "Site plan uploaded."
          : `${uploaded.length} site plans uploaded.`,
      );
      if (ok) await loadAssessment();
    } catch (err) {
      console.error("Error uploading site plan:", err);
      showSnackbar("Failed to read uploaded file", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteIndex == null || isReportLocked) return;
    const next = plans.filter((_, i) => i !== deleteIndex);
    setDeleteIndex(null);
    const ok = await persistPlans(
      next,
      next.length ? "Site plan removed." : "All site plans removed.",
    );
    if (ok) await loadAssessment();
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box m="8px">
      <Box display="flex" alignItems="center" gap={2} mt={2} mb ={2}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(itemsPath, { state: location.state })}
          sx={{ textTransform: "none" }}
        >
          Back to items
        </Button>
      </Box>
      <Box display="flex" alignItems="center" gap={2} mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 600, flex: 1 }}>
          Site plans
        </Typography>
      </Box>

      {isReportLocked && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This report is view only. Site plans can be opened but not changed.
        </Alert>
      )}

      <Box display="flex" gap={2} flexWrap="wrap" mb={3}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={isReportLocked || saving}
          onClick={() =>
            navigate(getAssessmentSitePlanEditPath(location.pathname, id, "new"), {
              state: location.state,
            })
          }
          sx={{ textTransform: "none" }}
        >
          Draw new plan
        </Button>
        <Button
          variant="outlined"
          startIcon={<UploadIcon />}
          disabled={isReportLocked || saving}
          onClick={() => fileInputRef.current?.click()}
          sx={{ textTransform: "none" }}
        >
          Upload plan
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(e) => {
            handleUploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </Box>

      {plans.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="assessment-site-plans">
            {(provided) => (
              <List
                dense
                disablePadding
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {plans.map((plan, index) => (
                  <Draggable
                    key={`plan-${index}-${plan.sitePlanSource}`}
                    draggableId={`plan-${index}`}
                    index={index}
                    isDragDisabled={isReportLocked || saving}
                  >
                    {(dragProvided, snapshot) => (
                      <ListItem
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        secondaryAction={
                          <Box>
                            <IconButton
                              edge="end"
                              aria-label={
                                isReportLocked ? "View site plan" : "Edit site plan"
                              }
                              onClick={() =>
                                navigate(
                                  getAssessmentSitePlanEditPath(
                                    location.pathname,
                                    id,
                                    String(index),
                                  ),
                                  { state: location.state },
                                )
                              }
                              size="small"
                              sx={{ mr: isReportLocked ? 0 : 0.5 }}
                            >
                              {isReportLocked ? (
                                <VisibilityIcon fontSize="small" />
                              ) : (
                                <EditIcon fontSize="small" />
                              )}
                            </IconButton>
                            {!isReportLocked && (
                              <IconButton
                                edge="end"
                                aria-label="Delete site plan"
                                onClick={() => setDeleteIndex(index)}
                                size="small"
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Box>
                        }
                        sx={{
                          bgcolor: snapshot.isDragging
                            ? "action.selected"
                            : "background.paper",
                          borderBottom:
                            index < plans.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                          py: 1.5,
                        }}
                      >
                        <Box
                          {...dragProvided.dragHandleProps}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            color:
                              isReportLocked || saving
                                ? "action.disabled"
                                : "text.secondary",
                            mr: 1,
                            cursor:
                              isReportLocked || saving ? "default" : "grab",
                          }}
                        >
                          <DragIndicatorIcon fontSize="small" />
                        </Box>
                        <MapIcon
                          fontSize="small"
                          color="secondary"
                          sx={{ mr: 1, flexShrink: 0 }}
                        />
                        <Typography
                          variant="body2"
                          noWrap
                          title={plan.sitePlanFigureTitle}
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          {index + 1}. {plan.sitePlanFigureTitle}
                        </Typography>
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No site plans yet. Draw a new plan or upload an existing file.
        </Typography>
      )}

      {saving && (
        <Box display="flex" alignItems="center" gap={1} mt={2}>
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Saving…
          </Typography>
        </Box>
      )}

      <Dialog
        open={deleteIndex != null}
        onClose={() => setDeleteIndex(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete site plan</DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Are you sure you want to remove this site plan? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setDeleteIndex(null)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmDelete} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
