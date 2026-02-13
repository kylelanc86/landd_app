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
  Checkbox,
  ListItemText,
  OutlinedInput,
  Tabs,
  Tab,
  Breadcrumbs,
  Link,
} from "@mui/material";
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Preview as PreviewIcon,
  Download as DownloadIcon,
  ArrowBack as ArrowBackIcon,
} from "@mui/icons-material";
import { tokens } from "../../theme/tokens";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import PermissionGate from "../../components/PermissionGate";
import reportTemplateService from "../../services/reportTemplateService";
import customDataFieldService from "../../services/customDataFieldService";
import { generateHTMLTemplatePDF } from "../../utils/templatePDFGenerator";

const ClearanceReportTemplates = () => {
  const theme = useTheme();
  const colors = tokens;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [selectedTemplate, setSelectedTemplate] = useState(
    "asbestosClearanceNonFriable",
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

  // Legislation selection state
  const [legislationItems, setLegislationItems] = useState([]);
  const [selectedACTLegislation, setSelectedACTLegislation] = useState([]);
  const [selectedNSWLegislation, setSelectedNSWLegislation] = useState([]);
  const [legislationLoading, setLegislationLoading] = useState(false);

  const reportTypes = [
    {
      id: "asbestosClearanceNonFriable",
      name: "Non-Friable Asbestos Clearance",
      color: "#FF6B6B",
    },
    {
      id: "asbestosClearanceFriable",
      name: "Friable Asbestos Clearance",
      color: "#FF6B6B",
    },
    {
      id: "asbestosClearanceFriableNonFriableConditions",
      name: "Friable (Non-Friable Conditions)",
      color: "#FF6B6B",
    },
    {
      id: "asbestosClearanceVehicle",
      name: "Vehicle/Equipment",
      color: "#FF6B6B",
    },
    // {
    //   id: "asbestosAssessment",
    //   name: "Asbestos Assessment Report",
    //   color: "#FF6B6B",
    // },
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
    // Asbestos clearance templates (non-friable, friable, friable non-friable conditions, vehicle)
    if (
      templateType === "asbestosClearanceNonFriable" ||
      templateType === "asbestosClearanceFriable" ||
      templateType === "asbestosClearanceFriableNonFriableConditions" ||
      templateType === "asbestosClearanceVehicle"
    ) {
      const baseSections = {
        "Background Information": ["backgroundInformationContent"],
        "Legislative Requirements": ["legislativeRequirementsContent"],
        "Inspection Details": ["inspectionDetailsContent"],
        "Inspection Exclusions": ["inspectionExclusionsContent"],
        "Clearance Certification": ["clearanceCertificationContent"],
        "Sign-off": ["signOffContent"],
      };

      // Add template-specific limitations sections
      if (templateType === "asbestosClearanceNonFriable") {
        baseSections["Non-Friable Clearance Certificate Limitations"] = [
          "nonFriableClearanceCertificateLimitationsContent",
        ];
      } else if (templateType === "asbestosClearanceFriable") {
        baseSections["Friable Clearance Certificate Limitations"] = [
          "friableClearanceCertificateLimitationsContent",
        ];
      } else if (
        templateType === "asbestosClearanceFriableNonFriableConditions"
      ) {
        baseSections[
          "Friable (Non-Friable Conditions) Clearance Certificate Limitations"
        ] = ["friableNonFriableConditionsCertificateLimitationsContent"];
      } else if (templateType === "asbestosClearanceVehicle") {
        baseSections["Vehicle/Equipment Certificate Limitations"] = [
          "vehicleCertificateLimitationsContent",
        ];
      }

      return baseSections;
    }

    // Lead assessment template
    if (templateType === "leadAssessment") {
      return {
        "Executive Summary": ["executiveSummaryContent"],
        "Site Description": ["siteDescriptionContent"],
        "Assessment Methodology": ["assessmentMethodologyContent"],
        "Sampling Results": ["samplingResultsContent"],
        "Risk Assessment": ["riskAssessmentContent"],
        Recommendations: ["recommendationsContent"],
        Conclusion: ["conclusionContent"],
      };
    }

    // Asbestos assessment template
    if (templateType === "asbestosAssessment") {
      return {
        Introduction: ["introductionContent"],
        "Survey Findings": ["surveyFindingsContent"],
        "Discussion and Conclusions": ["discussionContent"],
        "Risk Assessment": ["riskAssessmentContent"],
        "Determining Suitable Control Measures": ["controlMeasuresContent"],
        "Requirements for Remediation/Removal Works Involving ACM": [
          "remediationRequirementsContent",
        ],
        Legislation: ["legislationContent"],
        "Assessment Limitations/Caveats": ["assessmentLimitationsContent"],
        "Sign-off": ["signOffContent"],
        Signature: ["signaturePlaceholder"],
      };
    }

    // Default empty sections for unknown template types
    return {};
  };

  // State for template sections
  const [templateSections, setTemplateSections] = useState({});

  // Load legislation items
  const loadLegislationItems = async () => {
    try {
      setLegislationLoading(true);
      const items = await customDataFieldService.getByType("legislation");
      console.log("DEBUG: Loaded legislation items:", items);
      console.log("DEBUG: First item structure:", items[0]);
      setLegislationItems(items);
    } catch (error) {
      console.error("Error loading legislation items:", error);
      // Show user-friendly error message
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
          allTemplates.map((t) => t.templateType),
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
    loadLegislationItems();
  }, []);

  // Update template sections when selected template changes
  useEffect(() => {
    const sections = getTemplateSections(selectedTemplate);
    setTemplateSections(sections);

    // Load selected legislation for the current template
    const currentTemplate = templates[selectedTemplate];
    if (currentTemplate && currentTemplate.selectedLegislation) {
      // Separate ACT and NSW legislation
      const actLegislation = currentTemplate.selectedLegislation.filter(
        (item) => item.jurisdiction === "ACT",
      );
      const nswLegislation = currentTemplate.selectedLegislation.filter(
        (item) => item.jurisdiction === "NSW",
      );

      setSelectedACTLegislation(actLegislation);
      setSelectedNSWLegislation(nswLegislation);

      // Update preview data with selected legislation
      const actText =
        actLegislation.length > 0
          ? actLegislation
              .map((item) => {
                const title =
                  item.legislationTitle || item.text || "Unknown Legislation";
                return `• ${title}`;
              })
              .join("\n")
          : "";

      const nswText =
        nswLegislation.length > 0
          ? nswLegislation
              .map((item) => {
                const title =
                  item.legislationTitle || item.text || "Unknown Legislation";
                return `• ${title}`;
              })
              .join("\n")
          : "";

      const legislationText =
        [actText, nswText].filter((text) => text.length > 0).join("\n") ||
        "• No legislation items selected";

      setPreviewData((prev) => ({
        ...prev,
        LEGISLATION: legislationText,
      }));
    } else {
      setSelectedACTLegislation([]);
      setSelectedNSWLegislation([]);
      setPreviewData((prev) => ({
        ...prev,
        LEGISLATION: "• No legislation items selected",
      }));
    }
  }, [selectedTemplate, templates]);

  const handleTabChange = async (event, newValue) => {
    const newTemplateType = newValue;
    setSelectedTemplate(newTemplateType);
    setPreviewData({});

    // Check if the selected template exists in our current state
    if (!templates[newTemplateType]) {
      try {
        console.log(
          `Template ${newTemplateType} not found in state, fetching from backend...`,
        );
        setLoading(true);

        // Fetch the specific template from the backend
        const templateData =
          await reportTemplateService.getTemplateByType(newTemplateType);

        // Update the templates state with the new template
        setTemplates((prev) => ({
          ...prev,
          [newTemplateType]: templateData,
        }));

        console.log(
          `Template ${newTemplateType} loaded successfully:`,
          templateData,
        );
      } catch (error) {
        console.error(`Error fetching template ${newTemplateType}:`, error);
        setSaveStatus({
          show: true,
          message: `Error loading template. Please refresh the page.`,
          severity: "error",
        });
      } finally {
        setLoading(false);
      }
    }
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
    console.log("handleDetailedEdit called with:", {
      field,
      data,
      dataType: typeof data,
    });
    setEditingSection(field);
    // Ensure we always have a string value, even if data is undefined, null, or empty
    setEditData(data || "");
    console.log(
      "Set editingSection to:",
      field,
      "and editData to:",
      data || "",
    );
  };

  const handleDetailedSave = async () => {
    try {
      const currentTemplate = selectedTemplate;
      const template = templates[currentTemplate];

      // Check if this is a section title edit
      if (editingSection.endsWith("SectionTitle")) {
        // Handle section title updates
        const updateData = {
          sectionTitles: {
            ...template.sectionTitles,
            [editingSection]: editData,
          },
        };

        // Update template via API
        await reportTemplateService.updateTemplate(currentTemplate, updateData);

        // Update local state
        setTemplates((prev) => ({
          ...prev,
          [currentTemplate]: {
            ...prev[currentTemplate],
            sectionTitles: {
              ...prev[currentTemplate]?.sectionTitles,
              [editingSection]: editData,
            },
          },
        }));
      } else {
        // Handle regular field updates
        // Determine which section key to use based on template type
        const sectionKey = template.standardSections
          ? "standardSections"
          : "leadAssessmentSections";

        // Update template via API
        const updatePayload = {
          [sectionKey]: {
            [editingSection]: editData,
          },
        };
        console.log("Sending update payload:", updatePayload);
        const updatedTemplate = await reportTemplateService.updateTemplate(
          currentTemplate,
          updatePayload,
        );
        console.log("Updated template received:", updatedTemplate);

        // Update local state with the updated template from server
        setTemplates((prev) => ({
          ...prev,
          [currentTemplate]: updatedTemplate,
        }));
      }

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

  // Handle ACT legislation selection
  const handleACTLegislationChange = async (event) => {
    const selectedIds = event.target.value;
    console.log("DEBUG: Selected ACT IDs:", selectedIds);

    // Convert selected IDs to full legislation objects (ACT only)
    const selectedItems = legislationItems.filter(
      (item) => selectedIds.includes(item._id) && item.jurisdiction === "ACT",
    );
    console.log("DEBUG: Selected ACT items:", selectedItems);

    setSelectedACTLegislation(selectedItems);

    // Update preview data with all selected legislation
    updateLegislationPreview();

    try {
      // Combine all selected legislation for saving
      const allSelectedLegislation = [
        ...selectedItems,
        ...selectedNSWLegislation,
      ];

      // Update the template with selected legislation
      await reportTemplateService.updateTemplate(selectedTemplate, {
        selectedLegislation: allSelectedLegislation,
      });

      // Update local state
      setTemplates((prev) => ({
        ...prev,
        [selectedTemplate]: {
          ...prev[selectedTemplate],
          selectedLegislation: allSelectedLegislation,
        },
      }));

      setSaveStatus({
        show: true,
        message: "ACT Legislation selection updated successfully!",
        severity: "success",
      });

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ show: false, message: "", severity: "success" });
      }, 3000);
    } catch (error) {
      console.error("Error updating ACT legislation selection:", error);
      setSaveStatus({
        show: true,
        message: "Error updating ACT legislation selection. Please try again.",
        severity: "error",
      });
    }
  };

  // Handle NSW legislation selection
  const handleNSWLegislationChange = async (event) => {
    const selectedIds = event.target.value;
    console.log("DEBUG: Selected NSW IDs:", selectedIds);

    // Convert selected IDs to full legislation objects (NSW only)
    const selectedItems = legislationItems.filter(
      (item) => selectedIds.includes(item._id) && item.jurisdiction === "NSW",
    );
    console.log("DEBUG: Selected NSW items:", selectedItems);

    setSelectedNSWLegislation(selectedItems);

    // Update preview data with all selected legislation
    updateLegislationPreview();

    try {
      // Combine all selected legislation for saving
      const allSelectedLegislation = [
        ...selectedACTLegislation,
        ...selectedItems,
      ];

      // Update the template with selected legislation
      await reportTemplateService.updateTemplate(selectedTemplate, {
        selectedLegislation: allSelectedLegislation,
      });

      // Update local state
      setTemplates((prev) => ({
        ...prev,
        [selectedTemplate]: {
          ...prev[selectedTemplate],
          selectedLegislation: allSelectedLegislation,
        },
      }));

      setSaveStatus({
        show: true,
        message: "NSW Legislation selection updated successfully!",
        severity: "success",
      });

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveStatus({ show: false, message: "", severity: "success" });
      }, 3000);
    } catch (error) {
      console.error("Error updating NSW legislation selection:", error);
      setSaveStatus({
        show: true,
        message: "Error updating NSW legislation selection. Please try again.",
        severity: "error",
      });
    }
  };

  // Update legislation preview text
  const updateLegislationPreview = () => {
    const actText =
      selectedACTLegislation.length > 0
        ? selectedACTLegislation
            .map((item) => {
              const title =
                item.legislationTitle || item.text || "Unknown Legislation";
              return `• ${title}`;
            })
            .join("\n")
        : "";

    const nswText =
      selectedNSWLegislation.length > 0
        ? selectedNSWLegislation
            .map((item) => {
              const title =
                item.legislationTitle || item.text || "Unknown Legislation";
              return `• ${title}`;
            })
            .join("\n")
        : "";

    const legislationText =
      [actText, nswText].filter((text) => text.length > 0).join("\n") ||
      "• No legislation items selected";

    setPreviewData((prev) => ({
      ...prev,
      LEGISLATION: legislationText,
    }));
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
        previewData,
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
      // Default header fields if none exist
      const defaultHeaders = {
        reportTitle: "",
        reportSubtitle: "",
        reportNumber: "",
        reportDate: "",
        clientName: "",
        projectName: "",
        siteAddress: "",
        inspectorName: "",
        inspectorLicense: "",
      };

      // Use existing headers or default headers
      const headersToEdit =
        Object.keys(sectionData).length > 0 ? sectionData : defaultHeaders;

      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Object.keys(headersToEdit).map((key) => (
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

  // TabPanel component for better tab content organization
  const TabPanel = ({ children, value, index, ...other }) => {
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`template-tabpanel-${index}`}
        aria-labelledby={`template-tab-${index}`}
        {...other}
      >
        {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
      </div>
    );
  };

  const renderDetailedTemplateSection = (sectionName, fields) => {
    const currentTemplate = selectedTemplate;
    const template = templates[currentTemplate];
    console.log("renderDetailedTemplateSection called with:", {
      sectionName,
      fields,
      currentTemplate,
      template: !!template,
      standardSections: template?.standardSections,
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
              <IconButton
                onClick={() =>
                  handleDetailedEdit(
                    fields[0],
                    template.standardSections?.[fields[0]] || "",
                  )
                }
                size="small"
                sx={{ color: "#4caf50" }}
              >
                <EditIcon />
              </IconButton>
            </Box>
            <Grid container spacing={2}>
              {fields.map((field) => (
                <Grid item xs={12} key={field}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 1,
                      position: "relative",
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="black"
                      sx={{ whiteSpace: "pre-line" }}
                    >
                      {template.standardSections?.[field] ||
                        "No content - click edit to add content"}
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
    if (!editingSection) return null;

    // Available placeholders with descriptions
    const placeholderDescriptions = [
      {
        name: "CLIENT_NAME",
        description: "The name of the client for the project",
      },
      {
        name: "ASBESTOS_TYPE",
        description: "Type of asbestos (e.g., Friable, Non-friable)",
      },
      { name: "SITE_NAME", description: "The name or address of the site" },
      {
        name: "ASBESTOS_REMOVALIST",
        description: "Name of the asbestos removal contractor",
      },
      {
        name: "LAA_NAME",
        description: "Name of the Licensed Asbestos Assessor",
      },
      {
        name: "LAA_LICENSE",
        description: "License number of the Licensed Asbestos Assessor",
      },
      {
        name: "LAA_LICENCE_STATE",
        description: "State where the LAA license was issued",
      },
      {
        name: "INSPECTION_TIME",
        description: "Time when the inspection was conducted",
      },
      {
        name: "INSPECTION_DATE",
        description: "Date when the inspection was conducted",
      },
      {
        name: "REPORT_TYPE",
        description: "Type of clearance report (e.g., Non-Friable, Friable)",
      },
      { name: "PROJECT_NAME", description: "Name of the project" },
      { name: "PROJECT_NUMBER", description: "Project reference number" },
      { name: "SITE_ADDRESS", description: "Full address of the site" },
      { name: "CLEARANCE_DATE", description: "Date when clearance was issued" },
      { name: "CLEARANCE_TIME", description: "Time when clearance was issued" },
      {
        name: "SIGNATURE_IMAGE",
        description: "Digital signature image of the LAA",
      },
      {
        name: "LEGISLATION",
        description: "Selected legislation items (formatted as bullet points)",
      },
    ];

    // Available formatting placeholders
    const formattingOptions = [
      { code: "[BR]", description: "Full line break" },
      { code: "[HALF_BR]", description: "Half-height line break" },
      {
        code: "[BULLET]",
        description:
          "Bullet point (use at start of line to create a bullet list)",
      },
      { code: "**text**", description: "Bold text (wrap text with **)" },
      { code: "[UNDERLINE]text[/UNDERLINE]", description: "Underlined text" },
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

        {/* Available Placeholders and Formatting */}
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
                    'textarea[aria-label*="' +
                      editingSection.charAt(0).toUpperCase() +
                      editingSection.slice(1).replace(/([A-Z])/g, " $1") +
                      '"]',
                  );
                  if (textField) {
                    const start = textField.selectionStart;
                    const end = textField.selectionEnd;
                    const newValue =
                      editData.substring(0, start) +
                      `{${item.name}}` +
                      editData.substring(end);
                    setEditData(newValue);
                    // Focus back to text field
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
                    'textarea[aria-label*="' +
                      editingSection.charAt(0).toUpperCase() +
                      editingSection.slice(1).replace(/([A-Z])/g, " $1") +
                      '"]',
                  );
                  if (textField) {
                    const start = textField.selectionStart;
                    const end = textField.selectionEnd;
                    const newValue =
                      editData.substring(0, start) +
                      format.code +
                      editData.substring(end);
                    setEditData(newValue);
                    // Focus back to text field
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
                fontFamily: "Roboto, sans-serif",
              }}
            >
              <Typography variant="h4" sx={{ mb: 2, color: "#009900" }}>
                {replacePlaceholders(
                  template.standardSections.backgroundInformationTitle,
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 3, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.backgroundInformationContent,
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.legislativeRequirementsTitle,
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.legislativeRequirementsContent,
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              {/* Dynamic Limitations Section */}
              {(() => {
                let limitationsTitle = "";
                let limitationsContent = "";

                if (selectedTemplate === "asbestosClearanceNonFriable") {
                  limitationsTitle =
                    template.standardSections
                      .nonFriableClearanceCertificateLimitationsTitle;
                  limitationsContent =
                    template.standardSections
                      .nonFriableClearanceCertificateLimitationsContent;
                } else if (selectedTemplate === "asbestosClearanceFriable") {
                  limitationsTitle =
                    template.standardSections
                      .friableClearanceCertificateLimitationsTitle;
                  limitationsContent =
                    template.standardSections
                      .friableClearanceCertificateLimitationsContent;
                } else if (
                  selectedTemplate ===
                  "asbestosClearanceFriableNonFriableConditions"
                ) {
                  limitationsTitle =
                    template.standardSections
                      .friableNonFriableConditionsCertificateLimitationsTitle;
                  limitationsContent =
                    template.standardSections
                      .friableNonFriableConditionsCertificateLimitationsContent;
                } else if (selectedTemplate === "asbestosClearanceVehicle") {
                  limitationsTitle =
                    template.standardSections
                      .vehicleCertificateLimitationsTitle;
                  limitationsContent =
                    template.standardSections
                      .vehicleCertificateLimitationsContent;
                }

                if (limitationsTitle && limitationsContent) {
                  return (
                    <>
                      <Typography variant="h5" sx={{ mb: 2 }}>
                        {replacePlaceholders(limitationsTitle)}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ mb: 2, whiteSpace: "pre-line" }}
                      >
                        {replacePlaceholders(limitationsContent)}
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                    </>
                  );
                }
                return null;
              })()}

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.inspectionDetailsTitle,
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.inspectionDetailsContent,
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.inspectionExclusionsTitle,
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.inspectionExclusionsContent,
                )}
              </Typography>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h5" sx={{ mb: 2 }}>
                {replacePlaceholders(
                  template.standardSections.clearanceCertificationTitle,
                )}
              </Typography>
              <Typography
                variant="body1"
                sx={{ mb: 2, whiteSpace: "pre-line" }}
              >
                {replacePlaceholders(
                  template.standardSections.clearanceCertificationContent,
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

  const renderAvailablePlaceholders = () => {
    // Available placeholders for reference
    const basePlaceholders = ["CLIENT_NAME", "SITE_NAME", "SITE_ADDRESS"];

    // Available formatting options
    const availableFormatting = [
      "[BR] - Full line break",
      "[HALF_BR] - Half-height line break",
      "{HALF_BR} - Half-height line break (alternative)",
      "**text** - Bold text",
      "[UNDERLINE]text[/UNDERLINE] - Underlined text",
    ];

    const asbestosPlaceholders = [
      "ASBESTOS_TYPE",
      "ASBESTOS_REMOVALIST",
      "LAA_NAME",
      "LAA_LICENSE",
      "LAA_LICENCE_STATE",
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
      "LAA_LICENCE_STATE",
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
      selectedTemplate === "asbestosClearanceFriable" ||
      selectedTemplate === "asbestosClearanceFriableNonFriableConditions" ||
      selectedTemplate === "asbestosClearanceVehicle"
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

            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              Data Placeholders:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
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

            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: 1 }}
            >
              Formatting Options:
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {availableFormatting.map((format) => (
                <Chip
                  key={format}
                  label={format}
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
                  onClick={() => {
                    // Default header fields if none exist
                    const defaultHeaders = {
                      reportTitle: "",
                      reportSubtitle: "",
                      reportNumber: "",
                      reportDate: "",
                      clientName: "",
                      projectName: "",
                      siteAddress: "",
                      inspectorName: "",
                      inspectorLicense: "",
                    };
                    const headersToEdit =
                      template.reportHeaders &&
                      Object.keys(template.reportHeaders).length > 0
                        ? template.reportHeaders
                        : defaultHeaders;
                    handleEdit("reportHeaders", headersToEdit);
                  }}
                  size="small"
                >
                  <EditIcon />
                </IconButton>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {console.log("Template reportHeaders:", template.reportHeaders)}
                {template.reportHeaders &&
                Object.keys(template.reportHeaders).length > 0 ? (
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
                        {value || "No content - click edit to add"}
                      </Typography>
                    </Box>
                  ))
                ) : (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: "italic" }}
                  >
                    No headers configured - click edit to add report headers
                  </Typography>
                )}
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
                    template.standardSections ||
                      template.leadAssessmentSections,
                  ).map(([key, value]) => (
                    <Grid item xs={12} md={6} key={key}>
                      <Box
                        sx={{
                          p: 2,
                          borderRadius: 1,
                        }}
                      >
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
        {/* Breadcrumbs */}
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
          <Typography color="text.primary">Asbestos Clearances</Typography>
        </Breadcrumbs>

        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h2"
            color="black"
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Asbestos Clearance Report Templates
          </Typography>
        </Box>
        <Typography variant="h5" color="black">
          Manage standardised content for clearance reports
        </Typography>

        {saveStatus.show && (
          <Alert severity={saveStatus.severity} sx={{ mt: 2, mb: 2 }}>
            {saveStatus.message}
          </Alert>
        )}

        {/* Report Template Selection Tabs */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Tabs
            value={selectedTemplate}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              "& .MuiTab-root": {
                color: colors.grey[600],
                fontWeight: 500,
                textTransform: "none",
                fontSize: "0.95rem",
                minHeight: 48,
                "&.Mui-selected": {
                  color: colors.primary[500],
                  fontWeight: 600,
                },
              },
              "& .MuiTabs-indicator": {
                backgroundColor: colors.primary[500],
                height: 3,
              },
            }}
          >
            {reportTypes.map((type) => (
              <Tab
                key={type.id}
                value={type.id}
                label={type.name}
                sx={{
                  minWidth: { xs: "auto", sm: 200 },
                  maxWidth: { xs: 200, sm: 300 },
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
          ) : (
            <>
              {reportTypes.map((type) => (
                <TabPanel
                  key={type.id}
                  value={selectedTemplate}
                  index={type.id}
                >
                  <Grid container spacing={3}>
                    {/* Preview Section */}
                    {showPreview && renderPreview()}

                    {/* Legislation Selection */}
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
                              Selected Legislation
                            </Typography>
                          </Box>

                          {/* ACT Legislation Selection */}
                          <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Selected ACT Legislation</InputLabel>
                            <Select
                              multiple
                              value={selectedACTLegislation.map(
                                (item) => item._id,
                              )}
                              onChange={handleACTLegislationChange}
                              input={
                                <OutlinedInput label="Selected ACT Legislation" />
                              }
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
                                      (item) => item._id === value,
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
                                          (selected) =>
                                            selected._id === item._id,
                                        )}
                                      />
                                      <ListItemText
                                        primary={
                                          item.legislationTitle || item.text
                                        }
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

                          {/* NSW Legislation Selection */}
                          <FormControl fullWidth>
                            <InputLabel>Selected NSW Legislation</InputLabel>
                            <Select
                              multiple
                              value={selectedNSWLegislation.map(
                                (item) => item._id,
                              )}
                              onChange={handleNSWLegislationChange}
                              input={
                                <OutlinedInput label="Selected NSW Legislation" />
                              }
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
                                      (item) => item._id === value,
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
                                          (selected) =>
                                            selected._id === item._id,
                                        )}
                                      />
                                      <ListItemText
                                        primary={
                                          item.legislationTitle || item.text
                                        }
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
                          {!legislationLoading &&
                            legislationItems.length === 0 && (
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
                                >
                                  To use this feature, you need to create
                                  legislation items first:
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  component="div"
                                  sx={{ mt: 1, fontWeight: "medium" }}
                                >
                                  1. Go to Admin → Custom Data Fields
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  component="div"
                                >
                                  2. Create new legislation items with Title and
                                  Jurisdiction (ACT or NSW)
                                </Typography>
                                <Typography
                                  variant="body2"
                                  color="text.secondary"
                                  component="div"
                                >
                                  3. Return here to select them for your
                                  templates
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

                    {/* Detailed Template Sections */}
                    {Object.entries(templateSections).map(
                      ([sectionName, fields]) => {
                        return renderDetailedTemplateSection(
                          sectionName,
                          fields,
                        );
                      },
                    )}
                  </Grid>
                </TabPanel>
              ))}
            </>
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

export default ClearanceReportTemplates;
