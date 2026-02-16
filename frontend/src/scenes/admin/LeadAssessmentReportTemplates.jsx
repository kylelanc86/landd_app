import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Breadcrumbs,
  Link,
  Alert,
  Card,
  CardContent,
  Grid,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  ListItemText,
  OutlinedInput,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from "@mui/icons-material";
import PermissionGate from "../../components/PermissionGate";
import reportTemplateService from "../../services/reportTemplateService";
import customDataFieldService from "../../services/customDataFieldService";

const TEMPLATE_TYPES = {
  assessment: "leadAssessment",
  clearance: "leadClearance",
};

const TAB_LABELS = {
  [TEMPLATE_TYPES.assessment]: "Lead Assessment",
  [TEMPLATE_TYPES.clearance]: "Lead Clearance",
};

// Template sections for Lead Assessment
const leadAssessmentSections = [
  { key: "introductionContent", label: "Introduction" },
  { key: "surveyFindingsContent", label: "Summary of Lead Findings" },
  { key: "discussionContent", label: "Discussion & Conclusions" },
  {
    key: "recommendedControlMeasuresContent",
    label: "Recommended Control Measures",
  },
  { key: "signOffContent", label: "Sign-off" },
  { key: "assessmentMethodologyContent", label: "Assessment Methodology" },
  { key: "riskAssessmentContent", label: "Risk Assessment" },
  { key: "legislationContent", label: "Legislation" },
  {
    key: "assessmentLimitationsContent",
    label: "Assessment Limitations/Caveats",
  },
];

// Template sections for Lead Clearance
const leadClearanceSections = [
  { key: "introductionContent", label: "Introduction" },
  { key: "scopeContent", label: "Scope of Clearance" },
  { key: "resultsContent", label: "Clearance Results" },
  { key: "signOffContent", label: "Sign-off" },
  { key: "methodologyContent", label: "Methodology" },
  { key: "legislationContent", label: "Legislation" },
];

const LeadAssessmentReportTemplates = () => {
  const navigate = useNavigate();

  const [activeTemplateType, setActiveTemplateType] = useState(
    TEMPLATE_TYPES.assessment,
  );
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState(null);
  const [editData, setEditData] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState({
    show: false,
    message: "",
    severity: "success",
  });

  const [legislationItems, setLegislationItems] = useState([]);
  const [selectedACTLegislation, setSelectedACTLegislation] = useState([]);
  const [selectedNSWLegislation, setSelectedNSWLegislation] = useState([]);
  const [legislationLoading, setLegislationLoading] = useState(false);

  const templateSections =
    activeTemplateType === TEMPLATE_TYPES.clearance
      ? leadClearanceSections
      : leadAssessmentSections;

  const loadLegislationItems = async () => {
    try {
      setLegislationLoading(true);
      const items = await customDataFieldService.getByType("legislation");
      setLegislationItems(items);
    } catch (error) {
      console.error("Error loading legislation items:", error);
      setSaveStatus({
        show: true,
        message: `Error loading legislation items: ${
          error.response?.data?.message || error.message
        }`,
        severity: "error",
      });
    } finally {
      setLegislationLoading(false);
    }
  };

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setLoading(true);
        let templateData;
        try {
          templateData =
            await reportTemplateService.getTemplateByType(activeTemplateType);
        } catch (error) {
          if (error.response?.status === 404) {
            const defaultSections = {};
            templateSections.forEach((section) => {
              defaultSections[section.key] = "";
            });
            templateData = await reportTemplateService.createTemplate({
              templateType: activeTemplateType,
              reportHeaders: {
                title:
                  activeTemplateType === TEMPLATE_TYPES.assessment
                    ? "Lead Assessment Report"
                    : "Lead Clearance Report",
                subtitle: "",
              },
              standardSections: defaultSections,
              selectedLegislation: [],
            });
          } else {
            throw error;
          }
        }

        setTemplate(templateData);

        if (templateData?.selectedLegislation) {
          const actLegislation = templateData.selectedLegislation.filter(
            (item) => item.jurisdiction === "ACT",
          );
          const nswLegislation = templateData.selectedLegislation.filter(
            (item) => item.jurisdiction === "NSW",
          );
          setSelectedACTLegislation(actLegislation);
          setSelectedNSWLegislation(nswLegislation);
        } else {
          setSelectedACTLegislation([]);
          setSelectedNSWLegislation([]);
        }
      } catch (error) {
        console.error("Error loading template:", error);
        setSaveStatus({
          show: true,
          message: "Error loading template. Please refresh the page.",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
    if (legislationItems.length === 0) {
      loadLegislationItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplateType]);

  const handleEdit = (sectionKey, content) => {
    setEditingSection(sectionKey);
    setEditData({ content: content || "" });
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      const updatedSections = {
        ...template.standardSections,
        [editingSection]: editData.content,
      };

      await reportTemplateService.updateTemplate(activeTemplateType, {
        standardSections: updatedSections,
      });

      setTemplate((prev) => ({
        ...prev,
        standardSections: updatedSections,
      }));

      setOpenDialog(false);
      setEditingSection(null);
      setEditData({});
      setSaveStatus({
        show: true,
        message: "Section updated successfully!",
        severity: "success",
      });

      setTimeout(() => {
        setSaveStatus({ show: false, message: "", severity: "success" });
      }, 3000);
    } catch (error) {
      console.error("Error saving template:", error);
      setSaveStatus({
        show: true,
        message: "Error saving changes. Please try again.",
        severity: "error",
      });
    }
  };

  const handleCancel = () => {
    setOpenDialog(false);
    setEditingSection(null);
    setEditData({});
  };

  const placeholderDescriptions = [
    { name: "CLIENT_NAME", description: "The name of the client for the project" },
    { name: "SITE_NAME", description: "The name or address of the site" },
    { name: "SITE_ADDRESS", description: "Full address of the site" },
    { name: "PROJECT_NAME", description: "Name of the project" },
    { name: "PROJECT_NUMBER", description: "Project reference number" },
    {
      name: "ASSESSOR_NAME",
      description: "Name of the lead assessor or clearance practitioner",
    },
    {
      name: "ASSESSOR_LICENSE",
      description: "License or registration number of the assessor",
    },
    {
      name: "ASSESSMENT_DATE",
      description: "Date when the assessment or clearance was conducted",
    },
    {
      name: "ASSESSMENT_SCOPE_BULLETS",
      description: "List of assessment/clearance scope items (formatted as bullet points)",
    },
    {
      name: "LEGISLATION",
      description: "Selected legislation items (formatted as bullet points)",
    },
  ];

  const formattingOptions = [
    { code: "[BR]", description: "Full line break" },
    { code: "[HALF_BR]", description: "Half-height line break" },
    {
      code: "[BULLET]",
      description: "Bullet point (use at start of line to create a bullet list)",
    },
    { code: "**text**", description: "Bold text (wrap text with **)" },
    { code: "[UNDERLINE]text[/UNDERLINE]", description: "Underlined text" },
  ];

  const handleACTLegislationChange = async (event) => {
    const selectedIds = event.target.value;
    const selectedItems = legislationItems.filter(
      (item) => selectedIds.includes(item._id) && item.jurisdiction === "ACT",
    );

    setSelectedACTLegislation(selectedItems);

    try {
      const allSelectedLegislation = [
        ...selectedItems,
        ...selectedNSWLegislation,
      ];

      await reportTemplateService.updateTemplate(activeTemplateType, {
        selectedLegislation: allSelectedLegislation,
      });

      setTemplate((prev) => ({
        ...prev,
        selectedLegislation: allSelectedLegislation,
      }));

      setSaveStatus({
        show: true,
        message: "ACT Legislation selection updated successfully!",
        severity: "success",
      });

      setTimeout(() => {
        setSaveStatus({ show: false, message: "", severity: "success" });
      }, 3000);
    } catch (error) {
      setSaveStatus({
        show: true,
        message: "Error updating ACT legislation selection. Please try again.",
        severity: "error",
      });
    }
  };

  const handleNSWLegislationChange = async (event) => {
    const selectedIds = event.target.value;
    const selectedItems = legislationItems.filter(
      (item) => selectedIds.includes(item._id) && item.jurisdiction === "NSW",
    );

    setSelectedNSWLegislation(selectedItems);

    try {
      const allSelectedLegislation = [
        ...selectedACTLegislation,
        ...selectedItems,
      ];

      await reportTemplateService.updateTemplate(activeTemplateType, {
        selectedLegislation: allSelectedLegislation,
      });

      setTemplate((prev) => ({
        ...prev,
        selectedLegislation: allSelectedLegislation,
      }));

      setSaveStatus({
        show: true,
        message: "NSW Legislation selection updated successfully!",
        severity: "success",
      });

      setTimeout(() => {
        setSaveStatus({ show: false, message: "", severity: "success" });
      }, 3000);
    } catch (error) {
      setSaveStatus({
        show: true,
        message: "Error updating NSW legislation selection. Please try again.",
        severity: "error",
      });
    }
  };

  return (
    <PermissionGate requiredPermissions={["admin.view"]}>
      <Box m="20px">
        <Typography variant="h4" component="h1" gutterBottom marginBottom={3}>
          Lead Assessment and Clearances Report Templates
        </Typography>

        <Breadcrumbs sx={{ marginBottom: 3 }}>
          <Link
            component="button"
            variant="body1"
            onClick={() => navigate("/admin/report-templates")}
            sx={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <ArrowBackIcon sx={{ mr: 1 }} />
            Report Templates
          </Link>
          <Typography color="text.primary">
            Lead Assessment and Clearances
          </Typography>
        </Breadcrumbs>

        <Tabs
          value={activeTemplateType}
          onChange={(_, value) => setActiveTemplateType(value)}
          sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}
        >
          <Tab
            label={TAB_LABELS[TEMPLATE_TYPES.assessment]}
            value={TEMPLATE_TYPES.assessment}
          />
          <Tab
            label={TAB_LABELS[TEMPLATE_TYPES.clearance]}
            value={TEMPLATE_TYPES.clearance}
          />
        </Tabs>

        {saveStatus.show && (
          <Alert severity={saveStatus.severity} sx={{ mt: 2, mb: 2 }}>
            {saveStatus.message}
          </Alert>
        )}

        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "200px",
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Typography variant="h6" color="text.primary">
                      Selected Legislation
                    </Typography>
                  </Box>

                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Selected ACT Legislation</InputLabel>
                    <Select
                      multiple
                      value={selectedACTLegislation.map((item) => item._id)}
                      onChange={handleACTLegislationChange}
                      input={<OutlinedInput label="Selected ACT Legislation" />}
                      renderValue={(selected) => (
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.5,
                          }}
                        >
                          {selected.map((value) => {
                            const item = legislationItems.find(
                              (i) => i._id === value,
                            );
                            return (
                              <Chip
                                key={value}
                                label={
                                  item
                                    ? item.legislationTitle || item.text
                                    : value
                                }
                                size="small"
                                sx={{ backgroundColor: "#e3f2fd" }}
                              />
                            );
                          })}
                        </Box>
                      )}
                      disabled={legislationLoading}
                    >
                      {legislationItems.filter(
                        (item) => item.jurisdiction === "ACT",
                      ).length > 0 ? (
                        legislationItems
                          .filter((item) => item.jurisdiction === "ACT")
                          .map((item) => (
                            <MenuItem key={item._id} value={item._id}>
                              <Checkbox
                                checked={selectedACTLegislation.some(
                                  (selected) => selected._id === item._id,
                                )}
                              />
                              <ListItemText
                                primary={item.legislationTitle || item.text}
                                secondary="ACT"
                              />
                            </MenuItem>
                          ))
                      ) : (
                        <MenuItem disabled>
                          <ListItemText primary="No ACT legislation items found" />
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth>
                    <InputLabel>Selected NSW Legislation</InputLabel>
                    <Select
                      multiple
                      value={selectedNSWLegislation.map((item) => item._id)}
                      onChange={handleNSWLegislationChange}
                      input={<OutlinedInput label="Selected NSW Legislation" />}
                      renderValue={(selected) => (
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.5,
                          }}
                        >
                          {selected.map((value) => {
                            const item = legislationItems.find(
                              (i) => i._id === value,
                            );
                            return (
                              <Chip
                                key={value}
                                label={
                                  item
                                    ? item.legislationTitle || item.text
                                    : value
                                }
                                size="small"
                                sx={{ backgroundColor: "#f3e5f5" }}
                              />
                            );
                          })}
                        </Box>
                      )}
                      disabled={legislationLoading}
                    >
                      {legislationItems.filter(
                        (item) => item.jurisdiction === "NSW",
                      ).length > 0 ? (
                        legislationItems
                          .filter((item) => item.jurisdiction === "NSW")
                          .map((item) => (
                            <MenuItem key={item._id} value={item._id}>
                              <Checkbox
                                checked={selectedNSWLegislation.some(
                                  (selected) => selected._id === item._id,
                                )}
                              />
                              <ListItemText
                                primary={item.legislationTitle || item.text}
                                secondary="NSW"
                              />
                            </MenuItem>
                          ))
                      ) : (
                        <MenuItem disabled>
                          <ListItemText primary="No NSW legislation items found" />
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>

                  {legislationLoading && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 1 }}
                    >
                      Loading legislation items...
                    </Typography>
                  )}
                  {!legislationLoading && legislationItems.length === 0 && (
                    <Box
                      sx={{
                        mt: 2,
                        p: 2,
                        bgcolor: "grey.50",
                        borderRadius: 1,
                      }}
                    >
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        No legislation items found in the database.
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        component="div"
                        sx={{ mt: 1, fontWeight: "medium" }}
                      >
                        To use this feature, create legislation items in Admin →
                        Custom Data Fields, then return here to select them.
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={loadLegislationItems}
                        sx={{ mt: 1 }}
                      >
                        Retry Loading
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {templateSections.map((section) => (
              <Grid item xs={12} key={section.key}>
                <Card>
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 2,
                      }}
                    >
                      <Typography variant="h6" color="text.primary">
                        {section.label}
                      </Typography>
                      <IconButton
                        onClick={() =>
                          handleEdit(
                            section.key,
                            template?.standardSections?.[section.key] || "",
                          )
                        }
                        size="small"
                        color="primary"
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ whiteSpace: "pre-line" }}
                    >
                      {template?.standardSections?.[section.key] ||
                        "No content - click edit to add content"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        <Dialog
          open={openDialog}
          onClose={handleCancel}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Edit{" "}
            {templateSections.find((s) => s.key === editingSection)?.label ||
              "Section"}
          </DialogTitle>
          <DialogContent>
            <Box
              sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2 }}
            >
              <TextField
                label="Content"
                value={editData.content || ""}
                onChange={(e) =>
                  setEditData({ ...editData, content: e.target.value })
                }
                fullWidth
                multiline
                rows={10}
                variant="outlined"
                helperText="Use {PLACEHOLDER_NAME} for dynamic content. Available placeholders will be replaced with actual data when generating reports."
              />

              <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
                <Box sx={{ maxHeight: "400px", overflowY: "auto" }}>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 2, fontWeight: 600 }}
                  >
                    Available Placeholders:
                  </Typography>
                  {placeholderDescriptions.map((item) => (
                    <Box
                      key={item.name}
                      onClick={() => {
                        const textField = document.querySelector(
                          'textarea[aria-label*="Content"]',
                        );
                        if (textField) {
                          const start = textField.selectionStart;
                          const end = textField.selectionEnd;
                          const newValue =
                            (editData.content || "").substring(0, start) +
                            `{${item.name}}` +
                            (editData.content || "").substring(end);
                          setEditData({ ...editData, content: newValue });
                          setTimeout(() => textField.focus(), 0);
                        }
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1,
                        p: 1,
                        mb: 0.5,
                        cursor: "pointer",
                        borderRadius: 1,
                        "&:hover": {
                          backgroundColor: "#e8e8e8",
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: "#1976d2",
                          minWidth: "180px",
                          flexShrink: 0,
                        }}
                      >
                        {`{${item.name}}`}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.85rem",
                        }}
                      >
                        {item.description}
                      </Typography>
                    </Box>
                  ))}

                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 2, mt: 3, fontWeight: 600 }}
                  >
                    Available Formatting:
                  </Typography>
                  {formattingOptions.map((format) => (
                    <Box
                      key={format.code}
                      onClick={() => {
                        const textField = document.querySelector(
                          'textarea[aria-label*="Content"]',
                        );
                        if (textField) {
                          const start = textField.selectionStart;
                          const end = textField.selectionEnd;
                          const newValue =
                            (editData.content || "").substring(0, start) +
                            format.code +
                            (editData.content || "").substring(end);
                          setEditData({ ...editData, content: newValue });
                          setTimeout(() => textField.focus(), 0);
                        }
                      }}
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1,
                        p: 1,
                        mb: 0.5,
                        cursor: "pointer",
                        borderRadius: 1,
                        "&:hover": {
                          backgroundColor: "#e8e8e8",
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: "monospace",
                          fontWeight: 600,
                          color: "#1976d2",
                          minWidth: "200px",
                          flexShrink: 0,
                        }}
                      >
                        {format.code}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.85rem",
                        }}
                      >
                        {format.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel} startIcon={<CancelIcon />}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              startIcon={<SaveIcon />}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </PermissionGate>
  );
};

export default LeadAssessmentReportTemplates;
