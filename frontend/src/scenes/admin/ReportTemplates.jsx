import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
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
import { tokens } from "../../theme/tokens";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";
import reportTemplateService from "../../services/reportTemplateService";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";

const ReportTemplates = () => {
  const theme = useTheme();
  const colors = tokens;
  const { user } = useAuth();

  const [selectedTemplate, setSelectedTemplate] = useState(
    "asbestosClearanceNonFriable"
  );
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

  const [previewData, setPreviewData] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const reportTypes = [
    {
      id: "asbestosClearanceNonFriable",
      name: "Non-Friable Asbestos Clearance Report",
      color: "#FF6B6B",
    },
    {
      id: "asbestosClearanceFriable",
      name: "Friable Asbestos Clearance Report",
      color: "#FF6B6B",
    },
    {
      id: "asbestosAssessment",
      name: "Asbestos Assessment Report",
      color: "#FF6B6B",
    },
    // {
    //   id: "leadAssessment",
    //   name: "Lead Assessment Report",
    //   color: "#4ECDC4",
    // },
    // {
    //   id: "mouldAssessment",
    //   name: "Mould Assessment Report",
    //   color: "#45B7D1",
    // },
    // {
    //   id: "airMonitoringReport",
    //   name: "Air Monitoring Report",
    //   color: "#6C5CE7",
    // },
    // {
    //   id: "fibreIdentificationReport",
    //   name: "Fibre Identification Report",
    //   color: "#00B894",
    // },
    // {
    //   id: "inspectionReport",
    //   name: "Inspection Report",
    //   color: "#E17055",
    // },
    // {
    //   id: "complianceReport",
    //   name: "Compliance Report",
    //   color: "#74B9FF",
    // },
    // {
    //   id: "riskAssessmentReport",
    //   name: "Risk Assessment Report",
    //   color: "#A29BFE",
    // },
    // {
    //   id: "managementPlanReport",
    //   name: "Management Plan Report",
    //   color: "#FD79A8",
    // },
  ];

  // Template sections organized by page for detailed editing
  const getTemplateSections = (templateType) => {
    // Asbestos clearance templates (both non-friable and friable)
    if (
      templateType === "asbestosClearanceNonFriable" ||
      templateType === "asbestosClearanceFriable"
    ) {
      const baseSections = {
        "Background Information": [
          "backgroundInformationTitle",
          "backgroundInformationContent",
        ],
        "Legislative Requirements": [
          "legislativeRequirementsTitle",
          "legislativeRequirementsContent",
        ],
        "Inspection Details": [
          "inspectionDetailsTitle",
          "inspectionDetailsContent",
        ],
        "Inspection Exclusions": [
          "inspectionExclusionsTitle",
          "inspectionExclusionsContent",
        ],
        "Clearance Certification": [
          "clearanceCertificationTitle",
          "clearanceCertificationContent",
        ],
        "Sign-off": ["signOffContent"],
        Footer: ["footerText"],
      };

      // Add template-specific limitations sections
      if (templateType === "asbestosClearanceNonFriable") {
        baseSections["Non-Friable Clearance Certificate Limitations"] = [
          "nonFriableClearanceCertificateLimitationsTitle",
          "nonFriableClearanceCertificateLimitationsContent",
        ];
      } else if (templateType === "asbestosClearanceFriable") {
        baseSections["Friable Clearance Certificate Limitations"] = [
          "friableClearanceCertificateLimitationsTitle",
          "friableClearanceCertificateLimitationsContent",
        ];
      }

      return baseSections;
    }

    // Lead assessment template
    if (templateType === "leadAssessment") {
      return {
        "Executive Summary": [
          "executiveSummaryTitle",
          "executiveSummaryContent",
        ],
        "Site Description": ["siteDescriptionTitle", "siteDescriptionContent"],
        "Assessment Methodology": [
          "assessmentMethodologyTitle",
          "assessmentMethodologyContent",
        ],
        "Sampling Results": ["samplingResultsTitle", "samplingResultsContent"],
        "Risk Assessment": ["riskAssessmentTitle", "riskAssessmentContent"],
        Recommendations: ["recommendationsTitle", "recommendationsContent"],
        Conclusion: ["conclusionTitle", "conclusionContent"],
        Footer: ["footerText"],
      };
    }

    // Asbestos assessment template
    if (templateType === "asbestosAssessment") {
      return {
        Introduction: ["introductionTitle", "introductionContent"],
        "Survey Findings": ["surveyFindingsTitle", "surveyFindingsContent"],
        "Discussion and Conclusions": ["discussionTitle", "discussionContent"],
        "Risk Assessment": ["riskAssessmentTitle", "riskAssessmentContent"],
        "Determining Suitable Control Measures": [
          "controlMeasuresTitle",
          "controlMeasuresContent",
        ],
        "Requirements for Remediation/Removal Works Involving ACM": [
          "remediationRequirementsTitle",
          "remediationRequirementsContent",
        ],
        Legislation: ["legislationTitle", "legislationContent"],
        "Assessment Limitations/Caveats": [
          "assessmentLimitationsTitle",
          "assessmentLimitationsContent",
        ],
        "Sign-off": ["signOffContent"],
        Signature: ["signaturePlaceholder"],
        Footer: ["footerText"],
      };
    }

    // Default empty sections for unknown template types
    return {};
  };

  // State for template sections
  const [templateSections, setTemplateSections] = useState({});

  // Load templates on component mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setLoading(true);

        // Load all templates
        const allTemplates = await reportTemplateService.getAllTemplates();
        console.log("Loaded templates:", allTemplates);
        console.log(
          "Template types found:",
          allTemplates.map((t) => t.templateType)
        );

        // Convert array to object with templateType as key
        const templatesObj = {};
        allTemplates.forEach((template) => {
          templatesObj[template.templateType] = template;
        });

        console.log("Templates object:", templatesObj);
        console.log("Available template types:", Object.keys(templatesObj));
        setTemplates(templatesObj);

        // Set initial preview data (empty for template content)
        setPreviewData({});
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

  // Update template sections when selected template changes
  useEffect(() => {
    const sections = getTemplateSections(selectedTemplate);
    console.log("Setting template sections for:", selectedTemplate, sections);
    setTemplateSections(sections);
  }, [selectedTemplate]);

  const handleTemplateChange = (event) => {
    const newTemplateType = event.target.value;
    setSelectedTemplate(newTemplateType);
    setPreviewData({});
  };

  const handleEdit = (section, data) => {
    setEditingSection(section);
    setEditData(data);
    setOpenDialog(true);
  };

  const handleSave = async () => {
    try {
      const currentTemplate = selectedTemplate;

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
      const currentTemplate = selectedTemplate;
      const template = templates[currentTemplate];

      // Determine which section key to use based on template type
      const sectionKey = template.standardSections
        ? "standardSections"
        : "leadAssessmentSections";

      // Update template via API
      await reportTemplateService.updateTemplate(currentTemplate, {
        [sectionKey]: {
          [editingSection]: editData,
        },
      });

      // Update local state
      setTemplates((prev) => ({
        ...prev,
        [currentTemplate]: {
          ...prev[currentTemplate],
          [sectionKey]: {
            ...prev[currentTemplate]?.[sectionKey],
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
    const currentTemplate = selectedTemplate;
    const template = templates[currentTemplate];
    if (!template) return;

    setGeneratingPDF(true);
    try {
      // Use the utility function to generate PDF
      const fileName = await generateHTMLTemplatePDF(
        selectedTemplate,
        previewData
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

  const handleGeneratePDF = async () => {
    try {
      setGeneratingPDF(true);
      const template = templates[selectedTemplate];
      if (!template) {
        throw new Error("Template not found");
      }

      await generateHTMLTemplatePDF(selectedTemplate, previewData);
      setSaveStatus({
        show: true,
        message: "PDF generated successfully!",
        severity: "success",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      setSaveStatus({
        show: true,
        message: "Error generating PDF",
        severity: "error",
      });
    } finally {
      setGeneratingPDF(false);
    }
  };

  const renderSectionEditor = () => {
    if (!editingSection || !editData) return null;

    const currentTemplate = templates[selectedTemplate];
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
    const currentTemplate = selectedTemplate;
    const template = templates[currentTemplate];
    console.log("renderDetailedTemplateSection called with:", {
      sectionName,
      fields,
      currentTemplate,
      template: !!template,
    });
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
                <Grid item xs={12} key={field}>
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
                    <Typography
                      variant="body2"
                      color="black"
                      sx={{ whiteSpace: "pre-line" }}
                    >
                      {template.standardSections[field] || ""}
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

    // Available placeholders for reference
    const availablePlaceholders = [
      "CLIENT_NAME",
      "ASBESTOS_TYPE",
      "SITE_NAME",
      "ASBESTOS_REMOVALIST",
      "LAA_NAME",
      "LAA_LICENSE",
      "INSPECTION_TIME",
      "INSPECTION_DATE",
      "REPORT_TYPE",
      "PROJECT_NAME",
      "PROJECT_NUMBER",
      "SITE_ADDRESS",
      "REMOVAL_CONTRACTOR",
      "REMOVAL_LICENSE",
      "INSPECTOR_NAME",
      "INSPECTOR_LICENSE",
      "INSPECTION_DATETIME",
      "CLEARANCE_DATE",
      "CLEARANCE_TIME",
      "SIGNATURE_IMAGE",
    ];

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
          rows={8}
          variant="outlined"
          helperText="Use {PLACEHOLDER_NAME} for dynamic content. Available placeholders will be replaced with actual data when generating reports."
        />

        {/* Available Placeholders */}
        <Box sx={{ p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Available Placeholders:
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
            {availablePlaceholders.map((placeholder) => (
              <Chip
                key={placeholder}
                label={`{${placeholder}}`}
                size="small"
                variant="outlined"
                sx={{ fontSize: "0.7rem", cursor: "pointer" }}
                onClick={() => {
                  const textField = document.querySelector(
                    'textarea[aria-label*="' +
                      editingSection.charAt(0).toUpperCase() +
                      editingSection.slice(1).replace(/([A-Z])/g, " $1") +
                      '"]'
                  );
                  if (textField) {
                    const start = textField.selectionStart;
                    const end = textField.selectionEnd;
                    const newValue =
                      editData.substring(0, start) +
                      `{${placeholder}}` +
                      editData.substring(end);
                    setEditData(newValue);
                    // Focus back to text field
                    setTimeout(() => textField.focus(), 0);
                  }
                }}
              />
            ))}
          </Box>
        </Box>
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
    const currentTemplate = selectedTemplate;
    const template = templates[currentTemplate];
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
                {replacePlaceholders(
                  template.standardSections.backgroundInformationTitle
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 3, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.backgroundInformationContent
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.legislativeRequirementsTitle
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.legislativeRequirementsContent
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections
                    .nonFriableClearanceCertificateLimitationsTitle
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections
                    .nonFriableClearanceCertificateLimitationsContent
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.inspectionDetailsTitle
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.inspectionDetailsContent
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.inspectionExclusionsTitle
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.inspectionExclusionsContent
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.clearanceCertificationTitle
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.clearanceCertificationContent
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(template.standardSections.signOffContent)}
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

  const renderAvailablePlaceholders = () => {
    // Available placeholders for reference
    const basePlaceholders = ["CLIENT_NAME", "SITE_NAME", "SITE_ADDRESS"];

    const asbestosPlaceholders = [
      "ASBESTOS_TYPE",
      "ASBESTOS_REMOVALIST",
      "LAA_NAME",
      "LAA_LICENSE",
      "INSPECTION_TIME",
      "INSPECTION_DATE",
      "REPORT_TYPE",
      "PROJECT_NAME",
      "PROJECT_NUMBER",
      "CLEARANCE_DATE",
      "CLEARANCE_TIME",
      "SIGNATURE_IMAGE",
    ];

    const leadPlaceholders = [
      "BUILDING_DESCRIPTION",
      "CONSTRUCTION_YEAR",
      "NUMBER_OF_SAMPLES",
      "NUMBER_OF_ISSUES",
      "REPORT_DATE",
      "ASSESSOR_NAME",
      "ASSESSOR_LICENSE",
    ];

    const asbestosAssessmentPlaceholders = [
      "LAA_NAME",
      "LAA_LICENSE",
      "ASSESSMENT_DATE",
      "ASSESSMENT_SCOPE_BULLETS",
      "IDENTIFIED_ASBESTOS_ITEMS",
      "PROJECT_NAME",
      "PROJECT_NUMBER",
    ];

    // Determine which placeholders to show based on selected template
    let availablePlaceholders = basePlaceholders;

    if (
      selectedTemplate === "asbestosClearanceNonFriable" ||
      selectedTemplate === "asbestosClearanceFriable"
    ) {
      availablePlaceholders = [...basePlaceholders, ...asbestosPlaceholders];
    } else if (selectedTemplate === "leadAssessment") {
      availablePlaceholders = [...basePlaceholders, ...leadPlaceholders];
    } else if (selectedTemplate === "asbestosAssessment") {
      availablePlaceholders = [
        ...basePlaceholders,
        ...asbestosAssessmentPlaceholders,
      ];
    }

    return (
      <Grid item xs={12}>
        <Card>
          <CardContent>
            <Typography variant="h6" color="black" sx={{ mb: 2 }}>
              Available Placeholders
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Use these placeholders in your template content. They will be
              automatically replaced with actual data when generating reports.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {availablePlaceholders.map((placeholder) => (
                <Chip
                  key={placeholder}
                  label={`{${placeholder}}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: "0.8rem" }}
                />
              ))}
            </Box>
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

        {/* Template Sections */}
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
                  Template Sections
                </Typography>
                <IconButton
                  onClick={() => {
                    const sections =
                      template.standardSections ||
                      template.leadAssessmentSections ||
                      {};
                    const sectionKey = template.standardSections
                      ? "standardSections"
                      : "leadAssessmentSections";
                    handleEdit(sectionKey, sections);
                  }}
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </Box>
              <Grid container spacing={2}>
                {(template.standardSections ||
                  template.leadAssessmentSections) &&
                  Object.entries(
                    template.standardSections || template.leadAssessmentSections
                  ).map(([key, value]) => (
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
                          {value && value.length > 150
                            ? `${value.substring(0, 150)}...`
                            : value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
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
          <Box sx={{ display: "flex", gap: 2 }}>
            <Button
              onClick={handlePreviewToggle}
              startIcon={<PreviewIcon />}
              variant="outlined"
            >
              {showPreview ? "Hide Preview" : "Show Preview"}
            </Button>
          </Box>
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

        {/* Available Placeholders - Beneath company details */}
        <Box sx={{ mt: 3 }}>
          {!loading && (
            <Grid container spacing={3}>
              {renderAvailablePlaceholders()}
            </Grid>
          )}
        </Box>

        {/* Report Template Selection Dropdown */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel id="template-select-label">
              Select Report Template
            </InputLabel>
            <Select
              labelId="template-select-label"
              value={selectedTemplate}
              label="Select Report Template"
              onChange={handleTemplateChange}
              sx={{
                "& .MuiSelect-select": {
                  color: "black",
                },
              }}
            >
              {reportTypes.map((type) => (
                <MenuItem key={type.id} value={type.id}>
                  {type.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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
          ) : (
            <Grid container spacing={3}>
              {/* Preview Section */}
              {showPreview && renderPreview()}

              {/* Detailed Template Sections */}
              {console.log(
                "Rendering template sections:",
                Object.entries(templateSections)
              )}
              {Object.entries(templateSections).map(([sectionName, fields]) => {
                console.log(
                  "Rendering section:",
                  sectionName,
                  "with fields:",
                  fields
                );
                return renderDetailedTemplateSection(sectionName, fields);
              })}
            </Grid>
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
        {editingSection && (
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
