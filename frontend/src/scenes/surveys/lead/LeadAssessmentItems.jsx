import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import { asbestosAssessmentService } from "../../../services/api";

const LeadAssessmentItems = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchAssessment = async () => {
      if (!id) {
        setLoading(false);
        return;
      }
      try {
        const response = await asbestosAssessmentService.getAsbestosAssessmentById(id);
        const data = response?.data || response;
        if (cancelled) return;
        setAssessment(data);
        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (err) {
        if (!cancelled) {
          setAssessment(null);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAssessment();
    return () => { cancelled = true; };
  }, [id]);

  const projectID = assessment?.projectId?.projectID ?? null;
  const projectName = assessment?.projectId?.name ?? null;

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/surveys/lead")}
        sx={{ mb: 2 }}
      >
        Back to Lead Assessment
      </Button>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Lead Assessment Items
          </Typography>
          {loading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body1" color="text.secondary">
                Loading…
              </Typography>
            </Box>
          ) : (
            <Typography variant="body1" color="text.secondary">
              {projectID != null || projectName != null ? (
                <>
                  {projectID != null && (
                    <Typography component="span" variant="body1" fontWeight="medium">
                      {projectID}
                      {projectName != null ? " – " : ""}
                    </Typography>
                  )}
                  {projectName != null && projectName}
                </>
              ) : (
                "Project details unavailable"
              )}
            </Typography>
          )}
        </Box>
        {!loading && assessment?.jobType === "lead-assessment" && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate(`/surveys/lead/${id}/items/new`)}
            sx={{
              backgroundColor: "#9c27b0",
              color: "white",
              "&:hover": { backgroundColor: "#7b1fa2" },
            }}
          >
            Add Assessment Item
          </Button>
        )}
      </Box>

      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="40vh"
        sx={{ mt: 4 }}
      >
        <Typography variant="h6" color="text.secondary">
          {items.length === 0
            ? "No items yet. Click Add Assessment Item to create one."
            : "Item list view coming soon."}
        </Typography>
      </Box>
    </Box>
  );
};

export default LeadAssessmentItems;
