import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Tabs,
  Tab,
  Paper,
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
  Alert,
  Divider,
  useTheme,
} from "@mui/material";
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";
import reportTemplateService from "../../services/reportTemplateService";
import { generateTemplatePDF } from "../../utils/templatePDFGenerator";

const ReportTemplates = () => {
  const theme = useTheme();
  const colors = tokens;
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(0);
  const [templates, setTemplates] = useState({});
  const [loading, setLoading] = useState(true);

  const [editingSection, setEditingSection] = useState(null);
  const [editData, setEditData] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [saveStatus, setSaveStatus] = useState({
    show: false,
    message: "",
    severity: "success",
  });
  const [detailedEditMode, setDetailedEditMode] = useState(false);
  const [previewData, setPreviewData] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const reportTypes = [
    {
      id: "asbestosClearance",
      name: "Asbestos Clearance Report",
      color: "#FF6B6B",
    },
    { id: "leadAssessment", name: "Lead Assessment Report", color: "#4ECDC4" },
    {
      id: "mouldAssessment",
      name: "Mould Assessment Report",
      color: "#45B7D1",
    },
  ];

  // Sample data for preview
  const sampleData = {
    CLIENT_NAME: "Sample Client Pty Ltd",
    ASBESTOS_TYPE: "non-friable",
    SITE_NAME: "123 Sample Street, Canberra ACT",
    ASBESTOS_REMOVALIST: "Professional Asbestos Removal",
    LAA_NAME: "Patrick Cerone",
    LAA_LICENSE: "AA00031",
    INSPECTION_TIME: "09:00 AM",
    INSPECTION_DATE: "25 July 2024",
    REPORT_TYPE: "Non-friable",
    PROJECT_NAME: "Sample Asbestos Removal Project",
    PROJECT_NUMBER: "PRJ-2024-001",
    SITE_ADDRESS: "123 Sample Street, Canberra ACT 2600",
    REMOVAL_CONTRACTOR: "Professional Asbestos Removal Pty Ltd",
    REMOVAL_LICENSE: "AR000123",
    INSPECTOR_NAME: "John Smith",
    INSPECTOR_LICENSE: "AI000456",
    INSPECTION_DATETIME: "25 July 2024 at 09:00 AM",
    CLEARANCE_DATE: "25 July 2024",
    CLEARANCE_TIME: "09:00 AM",
  };

  // Template sections organized by page for detailed editing
  const templateSections = {
    "Front Cover": ["frontCoverTitle", "frontCoverSubtitle"],
    "Version Control": [
      "versionControlTitle",
      "preparedForLabel",
      "preparedByLabel",
      "documentDetailsLabel",
      "revisionHistoryLabel",
    ],
    "Inspection Details": [
      "inspectionDetailsTitle",
      "inspectionIntroduction",
      "inspectionSpecifics",
      "tableIntroduction",
      "removalTableTitle",
      "inspectionExclusions",
    ],
    "Clearance Certification": [
      "clearanceCertificationTitle",
      "clearanceCertificationText",
      "riskAssessmentText",
      "contactText",
      "behalfText",
      "signatureTitle",
    ],
    "Background Information": [
      "backgroundTitle",
      "backgroundIntroduction",
      "bulletPoint1",
      "bulletPoint2",
      "requirementsText",
      "bulletPoint3",
      "bulletPoint4",
      "bulletPoint5",
    ],
    "Legislative Requirements": [
      "legislativeTitle",
      "legislativeIntroduction",
      "legislativePoint1",
      "legislativePoint2",
      "legislativePoint3",
    ],
    Limitations: ["limitationsTitle", "limitationsText"],
    Footer: ["footerText"],
  };

  // Load templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);
        // Initialize default templates if they don't exist
        await reportTemplateService.initializeDefaultTemplates();

        // Load all templates
        const allTemplates = await reportTemplateService.getAllTemplates();

        // Convert array to object with templateType as key
        const templatesObj = {};
        allTemplates.forEach((template) => {
          templatesObj[template.templateType] = template;
        });

        setTemplates(templatesObj);

        // Set initial preview data
        setPreviewData(sampleData);
      } catch (error) {
        console.error("Error loading templates:", error);
        setSaveStatus({
          show: true,
          message: "Error loading templates. Please refresh the page.",
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, []);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleEdit = (section, data) => {
    setEditingSection(section);
    setEditData(data);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      const currentTemplate = reportTypes[activeTab].id;

      // Update template via API
      await reportTemplateService.updateTemplate(currentTemplate, {
        [editingSection]: editData,
      });

      // Update local state
      setTemplates((prev) => ({
        ...prev,
        [currentTemplate]: {
          ...prev[currentTemplate],
          [editingSection]: editData,
        },
      }));

      setSaveStatus({
        show: true,
        message: `${editingSection} updated successfully!`,
        severity: "success",
      });

      setOpenDialog(false);
      setEditingSection(null);
      setEditData({});

      // Hide success message after 3 seconds
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

  const handlePreviewToggle = () => {
    setShowPreview(!showPreview);
  };

  const replacePlaceholders = (text) => {
    if (!text) return "";
    let result = text;
    Object.entries(previewData).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{${key}}`, "g"), value);
    });
    return result;
  };

  const handleDetailedEdit = (field, data) => {
    setEditingSection(field);
    setEditData(data);
  };

  const handleDetailedSave = async () => {
    try {
      // Update template via API
      await reportTemplateService.updateTemplate("asbestosClearance", {
        standardSections: {
          [editingSection]: editData,
        },
      });

      // Update local state
      setTemplates((prev) => ({
        ...prev,
        asbestosClearance: {
          ...prev.asbestosClearance,
          standardSections: {
            ...prev.asbestosClearance?.standardSections,
            [editingSection]: editData,
          },
        },
      }));

      setSaveStatus({
        show: true,
        message: `${editingSection} updated successfully!`,
        severity: "success",
      });

      setEditingSection(null);
      setEditData({});

      // Hide success message after 3 seconds
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

  const generatePDFPreview = async () => {
    const template = templates.asbestosClearance;
    if (!template) return;

    setGeneratingPDF(true);
    try {
      // Use the utility function to generate PDF
      const fileName = await generateTemplatePDF(
        template,
        previewData,
        replacePlaceholders
      );

      setSaveStatus({
        show: true,
        message: "PDF preview generated successfully!",
        severity: "success",
      });

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ show: false, message: "", severity: "success" });
      }, 3000);
    } catch (error) {
      console.error("Error generating PDF:", error);
      setSaveStatus({
        show: true,
        message: "Error generating PDF. Please try again.",
        severity: "error",
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const renderSectionEditor = () => {
    if (!editingSection || !editData) return null;

    const currentTemplate = templates[reportTypes[activeTab].id];
    const sectionData = currentTemplate[editingSection];

    if (editingSection === "companyDetails") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Object.keys(sectionData).map((key) => (
            <TextField
              key={key}
              label={
                key.charAt(0).toUpperCase() +
                key.slice(1).replace(/([A-Z])/g, " $1")
              }
              value={editData[key] || ""}
              onChange={(e) =>
                setEditData((prev) => ({ ...prev, [key]: e.target.value }))
              }
              fullWidth
              variant="outlined"
            />
          ))}
        </Box>
      );
    }

    if (editingSection === "standardSections") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Object.keys(sectionData).map((key) => (
            <TextField
              key={key}
              label={
                key.charAt(0).toUpperCase() +
                key.slice(1).replace(/([A-Z])/g, " $1")
              }
              value={editData[key] || ""}
              onChange={(e) =>
                setEditData((prev) => ({ ...prev, [key]: e.target.value }))
              }
              fullWidth
              multiline
              rows={4}
              variant="outlined"
            />
          ))}
        </Box>
      );
    }

    if (editingSection === "reportHeaders") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Object.keys(sectionData).map((key) => (
            <TextField
              key={key}
              label={
                key.charAt(0).toUpperCase() +
                key.slice(1).replace(/([A-Z])/g, " $1")
              }
              value={editData[key] || ""}
              onChange={(e) =>
                setEditData((prev) => ({ ...prev, [key]: e.target.value }))
              }
              fullWidth
              variant="outlined"
            />
          ))}
        </Box>
      );
    }

    return null;
  };

  const renderDetailedTemplateSection = (sectionName, fields) => {
    const template = templates.asbestosClearance;
    if (!template) return null;

    return (
      <Grid item xs={12} key={sectionName}>
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
              <Typography variant="h6" color="black">
                {sectionName}
              </Typography>
            </Box>
            <Grid container spacing={2}>
              {fields.map((field) => (
                <Grid item xs={12} md={6} key={field}>
                  <Box
                    sx={{
                      p: 2,
                      border: `1px solid ${colors.grey[700]}`,
                      borderRadius: 1,
                      position: "relative",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        mb: 1,
                      }}
                    >
                      <Typography variant="subtitle2" color="black">
                        {field.charAt(0).toUpperCase() +
                          field.slice(1).replace(/([A-Z])/g, " $1")}
                      </Typography>
                      <IconButton
                        onClick={() =>
                          handleDetailedEdit(
                            field,
                            template.standardSections[field] || ""
                          )
                        }
                        size="small"
                      >
                        <EditIcon />
                      </IconButton>
                    </Box>
                    <Typography variant="body2" color="black">
                      {replacePlaceholders(
                        template.standardSections[field] || ""
                      )}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderDetailedEditor = () => {
    if (!editingSection || !editData) return null;

    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label={
            editingSection.charAt(0).toUpperCase() +
            editingSection.slice(1).replace(/([A-Z])/g, " $1")
          }
          value={editData}
          onChange={(e) => setEditData(e.target.value)}
          fullWidth
          multiline
          rows={4}
          variant="outlined"
          helperText="Use {PLACEHOLDER_NAME} for dynamic content"
        />
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={handleCancel} startIcon={<CancelIcon />}>
            Cancel
          </Button>
          <Button
            onClick={handleDetailedSave}
            variant="contained"
            startIcon={<SaveIcon />}
          >
            Save
          </Button>
        </Box>
      </Box>
    );
  };

  const renderPreview = () => {
    const template = templates.asbestosClearance;
    if (!template || !showPreview) return null;

    return (
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
              <Typography variant="h6" color="black">
                Live Preview
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  onClick={generatePDFPreview}
                  startIcon={<DownloadIcon />}
                  variant="contained"
                  size="small"
                  disabled={generatingPDF}
                  sx={{
                    backgroundColor: "#2e7d32",
                    "&:hover": { backgroundColor: "#1b5e20" },
                  }}
                >
                  {generatingPDF ? "Generating..." : "Generate PDF"}
                </Button>
                <Button
                  onClick={handlePreviewToggle}
                  startIcon={<PreviewIcon />}
                  variant="outlined"
                  size="small"
                >
                  Hide Preview
                </Button>
              </Box>
            </Box>
            <Paper
              sx={{
                p: 3,
                backgroundColor: "white",
                color: "black",
                maxHeight: "600px",
                overflow: "auto",
                fontFamily: "Arial, sans-serif",
              }}
            >
              <Typography variant="h4" sx={{ mb: 2, color: "#009900" }}>
                {replacePlaceholders(template.standardSections.frontCoverTitle)}
              </Typography>
              <Typography variant="h6" sx={{ mb: 3 }}>
                {replacePlaceholders(
                  template.standardSections.frontCoverSubtitle
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.inspectionDetailsTitle
                )}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.inspectionIntroduction
                )}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.inspectionSpecifics
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.clearanceCertificationTitle
                )}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.clearanceCertificationText
                )}
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.riskAssessmentText
                )}
              </Typography>
            </Paper>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderCompanyDetails = () => {
    // Use the first template's company details since they're constant
    const firstTemplate = Object.values(templates)[0];
    if (!firstTemplate?.companyDetails) {
      return null;
    }

    const companyDetails = firstTemplate.companyDetails;
    const entries = Object.entries(companyDetails);
    const leftColumn = entries.slice(0, 3);
    const rightColumn = entries.slice(3);

    return (
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
              <Typography variant="h6" color="black">
                Company Details
              </Typography>
              <IconButton
                onClick={() => handleEdit("companyDetails", companyDetails)}
                size="small"
              >
                <EditIcon />
              </IconButton>
            </Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {leftColumn.map(([key, value]) => (
                    <Box
                      key={key}
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="black">
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography variant="body2" color="black">
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {rightColumn.map(([key, value]) => (
                    <Box
                      key={key}
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="black">
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography variant="body2" color="black">
                        {value}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    );
  };

  const renderTemplateContent = (templateId) => {
    const template = templates[templateId];

    // Return loading state if template doesn't exist yet
    if (!template) {
      return (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "200px",
          }}
        >
          <Typography variant="h6" color="black">
            Loading template...
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {/* Report Headers */}
        <Grid item xs={12} md={6}>
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
                <Typography variant="h6" color="black">
                  Report Headers
                </Typography>
                <IconButton
                  onClick={() =>
                    handleEdit("reportHeaders", template.reportHeaders || {})
                  }
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {template.reportHeaders &&
                  Object.entries(template.reportHeaders).map(([key, value]) => (
                    <Box
                      key={key}
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="black">
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography variant="body2" color="black">
                        {value}
                      </Typography>
                    </Box>
                  ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Standard Sections */}
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
                <Typography variant="h6" color="black">
                  Standard Sections
                </Typography>
                <IconButton
                  onClick={() =>
                    handleEdit(
                      "standardSections",
                      template.standardSections || {}
                    )
                  }
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </Box>
              <Grid container spacing={2}>
                {template.standardSections &&
                  Object.entries(template.standardSections).map(
                    ([key, value]) => (
                      <Grid item xs={12} md={6} key={key}>
                        <Box
                          sx={{
                            p: 2,
                            border: `1px solid ${colors.grey[700]}`,
                            borderRadius: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            color="black"
                            sx={{ mb: 1 }}
                          >
                            {key.charAt(0).toUpperCase() +
                              key.slice(1).replace(/([A-Z])/g, " $1")}
                          </Typography>
                          <Typography variant="body2" color="black">
                            {value.length > 150
                              ? `${value.substring(0, 150)}...`
                              : value}
                          </Typography>
                        </Box>
                      </Grid>
                    )
                  )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    );
  };

  return (
    <PermissionGate requiredPermissions={["admin.view"]}>
      <Box m="20px">
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h2"
            color="black"
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Report Templates
          </Typography>
          {activeTab === 0 && (
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button
                onClick={() => setDetailedEditMode(!detailedEditMode)}
                variant="outlined"
                color={detailedEditMode ? "primary" : "inherit"}
              >
                {detailedEditMode ? "Simple Mode" : "Detailed Mode"}
              </Button>
              <Button
                onClick={handlePreviewToggle}
                startIcon={<PreviewIcon />}
                variant="outlined"
              >
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </Box>
          )}
        </Box>
        <Typography variant="h5" color="black">
          Manage standardized content for different report types
        </Typography>

        {saveStatus.show && (
          <Alert severity={saveStatus.severity} sx={{ mt: 2, mb: 2 }}>
            {saveStatus.message}
          </Alert>
        )}

        {/* Company Details - Full width at top */}
        <Box sx={{ mt: 3 }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "200px",
              }}
            >
              <Typography variant="h6" color="black">
                Loading templates...
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {renderCompanyDetails()}
            </Grid>
          )}
        </Box>

        {/* Report Template Selection Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 3 }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            sx={{
              "& .MuiTab-root": {
                color: "black",
                "&.Mui-selected": {
                  color: "green",
                },
              },
            }}
          >
            {reportTypes.map((type, index) => (
              <Tab
                key={type.id}
                label={type.name}
                sx={{
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    backgroundColor: type.color,
                    borderRadius: "3px 3px 0 0",
                  },
                }}
              />
            ))}
          </Tabs>
        </Box>

        {/* Template Content */}
        <Box sx={{ mt: 3 }}>
          {loading ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "200px",
              }}
            >
              <Typography variant="h6" color="black">
                Loading templates...
              </Typography>
            </Box>
          ) : activeTab === 0 && detailedEditMode ? (
            <Grid container spacing={3}>
              {/* Preview Section */}
              {showPreview && renderPreview()}

              {/* Detailed Template Sections */}
              {Object.entries(templateSections).map(([sectionName, fields]) =>
                renderDetailedTemplateSection(sectionName, fields)
              )}
            </Grid>
          ) : (
            renderTemplateContent(reportTypes[activeTab].id)
          )}
        </Box>

        {/* Edit Dialog */}
        <Dialog
          open={openDialog}
          onClose={handleCancel}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Edit{" "}
            {editingSection?.charAt(0).toUpperCase() +
              editingSection?.slice(1).replace(/([A-Z])/g, " $1")}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ mt: 2 }}>{renderSectionEditor()}</Box>
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
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>

        {/* Detailed Edit Dialog */}
        {editingSection && detailedEditMode && (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.8)",
              zIndex: 1300,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 2,
            }}
          >
            <Paper
              sx={{
                p: 3,
                maxWidth: "800px",
                width: "100%",
                maxHeight: "80vh",
                overflow: "auto",
              }}
            >
              <Typography variant="h6" sx={{ mb: 2 }}>
                Edit{" "}
                {editingSection.charAt(0).toUpperCase() +
                  editingSection.slice(1).replace(/([A-Z])/g, " $1")}
              </Typography>
              {renderDetailedEditor()}
            </Paper>
          </Box>
        )}
      </Box>
    </PermissionGate>
  );
};

export default ReportTemplates;
