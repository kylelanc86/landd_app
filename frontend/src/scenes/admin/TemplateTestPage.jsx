import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  Paper,
  Divider,
  useTheme,
  Alert,
} from "@mui/material";
import { tokens } from "../../theme";
import { useAuth } from "../../context/AuthContext";
import PermissionGate from "../../components/PermissionGate";
import {
  integrateTemplateWithPDF,
  getSpecificSectionExample,
} from "../../utils/templateIntegrationExample";

const TemplateTestPage = () => {
  const theme = useTheme();
  const colors = tokens;
  const { user } = useAuth();

  const [templateData, setTemplateData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sample clearance data for testing
  const sampleClearance = {
    _id: "test-clearance-123",
    clearanceType: "Non-friable",
    clearanceDate: "2024-07-25",
    asbestosRemovalist: "Professional Asbestos Removal Pty Ltd",
    LAA: "Patrick Cerone",
    projectId: {
      name: "123 Sample Street, Canberra ACT",
      address: "123 Sample Street, Canberra ACT 2600",
      projectID: "PROJ-2024-001",
      client: {
        name: "Sample Client Pty Ltd",
      },
    },
  };

  const testTemplateIntegration = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await integrateTemplateWithPDF(sampleClearance, setError);
      setTemplateData(result);
      console.log("Template integration successful:", result);
    } catch (err) {
      console.error("Template integration failed:", err);
      setError("Failed to load template data");
    } finally {
      setLoading(false);
    }
  };

  const testSpecificSection = async (sectionKey) => {
    try {
      const content = await getSpecificSectionExample(
        sampleClearance,
        sectionKey
      );
      console.log(`Section ${sectionKey}:`, content);
      alert(`${sectionKey}: ${content}`);
    } catch (err) {
      console.error("Error getting section:", err);
      setError("Failed to get section content");
    }
  };

  useEffect(() => {
    // Auto-load template data on component mount
    testTemplateIntegration();
  }, []);

  const renderTemplatePreview = () => {
    if (!templateData) return null;

    return (
      <Grid container spacing={3}>
        {/* Front Cover Preview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="black" sx={{ mb: 2 }}>
                Front Cover Preview
              </Typography>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: "white",
                  color: "black",
                  minHeight: "300px",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                <Typography
                  variant="h4"
                  sx={{ mb: 2, color: "#009900", fontWeight: "bold" }}
                >
                  {templateData.standardSections.frontCoverTitle}
                </Typography>
                <Typography variant="h6" sx={{ mb: 3 }}>
                  {templateData.standardSections.frontCoverSubtitle}
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Site:</strong> {templateData.jobData.SITE_NAME}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Client:</strong> {templateData.jobData.CLIENT_NAME}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>Date:</strong> {templateData.jobData.CLEARANCE_DATE}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Inspection Details Preview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="black" sx={{ mb: 2 }}>
                Inspection Details Preview
              </Typography>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: "white",
                  color: "black",
                  minHeight: "300px",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
                  {templateData.standardSections.inspectionDetailsTitle}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.inspectionIntroduction}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.inspectionSpecifics}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.tableIntroduction}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Clearance Certification Preview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="black" sx={{ mb: 2 }}>
                Clearance Certification Preview
              </Typography>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: "white",
                  color: "black",
                  minHeight: "300px",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
                  {templateData.standardSections.clearanceCertificationTitle}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.clearanceCertificationText}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.riskAssessmentText}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.contactText}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.behalfText}
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: "bold" }}>
                  {templateData.standardSections.signatureTitle}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Background Information Preview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="black" sx={{ mb: 2 }}>
                Background Information Preview
              </Typography>
              <Paper
                sx={{
                  p: 3,
                  backgroundColor: "white",
                  color: "black",
                  minHeight: "300px",
                  fontFamily: "Arial, sans-serif",
                }}
              >
                <Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
                  {templateData.standardSections.backgroundTitle}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.backgroundIntroduction}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  • {templateData.standardSections.bulletPoint1}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  • {templateData.standardSections.bulletPoint2}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{ mb: 2, textAlign: "justify" }}
                >
                  {templateData.standardSections.requirementsText}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  • {templateData.standardSections.bulletPoint3}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  • {templateData.standardSections.bulletPoint4}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  • {templateData.standardSections.bulletPoint5}
                </Typography>
              </Paper>
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
            Template System Test
          </Typography>
          <Button
            onClick={testTemplateIntegration}
            variant="contained"
            disabled={loading}
          >
            {loading ? "Loading..." : "Reload Template Data"}
          </Button>
        </Box>
        <Typography variant="h5" color="black">
          Test the template system with sample data
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Test Buttons */}
        <Box sx={{ mt: 3, mb: 3 }}>
          <Typography variant="h6" color="black" sx={{ mb: 2 }}>
            Test Individual Sections
          </Typography>
          <Grid container spacing={2}>
            {[
              "frontCoverTitle",
              "inspectionDetailsTitle",
              "clearanceCertificationTitle",
              "backgroundTitle",
              "legislativeTitle",
              "limitationsTitle",
            ].map((section) => (
              <Grid item key={section}>
                <Button
                  variant="outlined"
                  onClick={() => testSpecificSection(section)}
                  size="small"
                >
                  Test {section}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Template Previews */}
        {templateData && renderTemplatePreview()}

        {/* Job Data Display */}
        {templateData && (
          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" color="black" sx={{ mb: 2 }}>
                Job Data Used for Template Population
              </Typography>
              <Grid container spacing={2}>
                {Object.entries(templateData.jobData).map(([key, value]) => (
                  <Grid item xs={12} md={6} key={key}>
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" color="black">
                        {key}:
                      </Typography>
                      <Typography variant="body2" color="black">
                        {value}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}
      </Box>
    </PermissionGate>
  );
};

export default TemplateTestPage;
