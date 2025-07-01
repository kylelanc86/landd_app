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
} from "@mui/icons-material";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";
import reportTemplateService from "../../services/reportTemplateService";

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
              <Typography variant="h6" color={colors.grey[100]}>
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
                      <Typography variant="body2" color={colors.grey[300]}>
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography variant="body2" color={colors.grey[100]}>
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
                      <Typography variant="body2" color={colors.grey[300]}>
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography variant="body2" color={colors.grey[100]}>
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
          <Typography variant="h6" color={colors.grey[300]}>
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
                <Typography variant="h6" color={colors.grey[100]}>
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
                      <Typography variant="body2" color={colors.grey[300]}>
                        {key.charAt(0).toUpperCase() +
                          key.slice(1).replace(/([A-Z])/g, " $1")}
                        :
                      </Typography>
                      <Typography variant="body2" color={colors.grey[100]}>
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
                <Typography variant="h6" color={colors.grey[100]}>
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
                            color={colors.grey[300]}
                            sx={{ mb: 1 }}
                          >
                            {key.charAt(0).toUpperCase() +
                              key.slice(1).replace(/([A-Z])/g, " $1")}
                          </Typography>
                          <Typography variant="body2" color={colors.grey[100]}>
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
            color={colors.grey[100]}
            fontWeight="bold"
            sx={{ mb: "5px" }}
          >
            Report Templates
          </Typography>
        </Box>
        <Typography variant="h5" color={colors.secondary[500]}>
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
              <Typography variant="h6" color={colors.grey[300]}>
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
                color: colors.grey[300],
                "&.Mui-selected": {
                  color: colors.secondary[500],
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
              <Typography variant="h6" color={colors.grey[300]}>
                Loading templates...
              </Typography>
            </Box>
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
      </Box>
    </PermissionGate>
  );
};

export default ReportTemplates;
