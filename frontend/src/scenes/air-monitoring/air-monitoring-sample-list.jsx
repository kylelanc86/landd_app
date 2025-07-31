import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  TextField,
  Stack,
  InputAdornment,
  useTheme,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import DeleteIcon from "@mui/icons-material/Delete";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { sampleService, shiftService } from "../../services/api";
import { formatDate, formatTime } from "../../utils/dateUtils";

const SampleList = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("sampleNumber");
  const [sortAsc, setSortAsc] = useState(true);
  const [shift, setShift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCompleteDisabled, setIsCompleteDisabled] = useState(true);
  const [nextSampleNumber, setNextSampleNumber] = useState(null);
  const [descriptionOfWorks, setDescriptionOfWorks] = useState("");
  const [descSaveStatus, setDescSaveStatus] = useState("");

  // Function to extract the numeric part from a sample number
  const extractSampleNumber = (sampleNumber) => {
    const match = sampleNumber?.match(/-(\d+)$/);
    return match ? parseInt(match[1]) : 0;
  };

  // Function to generate the next sample number
  const generateNextSampleNumber = async (samples, projectID) => {
    if (!projectID) return 1;

    try {
      // Get all samples for the project
      const allSamplesResponse = await sampleService.getByProject(projectID);
      const allSamples = allSamplesResponse.data;
      console.log("All samples for project:", allSamples);

      // Get the highest sample number from all samples in the project
      const highestNumber = Math.max(
        ...allSamples.map((sample) => {
          const number = extractSampleNumber(sample.fullSampleID);
          console.log(`Sample ${sample.fullSampleID} has number ${number}`);
          return number;
        })
      );
      console.log("Highest sample number found:", highestNumber);

      const nextNumber = highestNumber + 1;
      console.log("Next sample number will be:", nextNumber);
      return nextNumber;
    } catch (err) {
      console.error("Error generating next sample number:", err);
      return 1;
    }
  };

  // Load shift and samples data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const shiftResponse = await shiftService.getById(shiftId);
        setShift(shiftResponse.data);

        const samplesResponse = await sampleService.getByShift(shiftId);
        setSamples(samplesResponse.data || []);

        // Get project ID from shift data
        const projectId = shiftResponse.data?.job?.projectId?.projectID;
        if (projectId) {
          // Fetch all samples for the project to determine next sample number
          const projectSamplesResponse = await sampleService.getByProject(
            projectId
          );
          const allProjectSamples = projectSamplesResponse.data || [];

          // Find the highest sample number
          const highestNumber = allProjectSamples.reduce((max, sample) => {
            const match = sample.fullSampleID?.match(/-(\d+)$/);
            const number = match ? parseInt(match[1]) : 0;
            return Math.max(max, number);
          }, 0);

          // Set next sample number
          setNextSampleNumber(highestNumber + 1);
        }

        if (shiftResponse.data?.descriptionOfWorks) {
          setDescriptionOfWorks(shiftResponse.data.descriptionOfWorks);
        }

        setIsCompleteDisabled(!validateSamplesComplete(samples));
        setError(null);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [shiftId]);

  const handleSearch = (event) => {
    setSearch(event.target.value);
  };

  const handleSort = (field) => {
    if (field === sortField) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDelete = async (sampleId) => {
    if (window.confirm("Are you sure you want to delete this sample?")) {
      try {
        await sampleService.delete(sampleId);
        setSamples(samples.filter((sample) => sample._id !== sampleId));
      } catch (err) {
        console.error("Error deleting sample:", err);
        setError("Failed to delete sample. Please try again.");
      }
    }
  };

  const filteredSamples = samples.filter((sample) =>
    Object.values(sample).some(
      (value) =>
        value && value.toString().toLowerCase().includes(search.toLowerCase())
    )
  );

  const sortedSamples = [...filteredSamples].sort((a, b) => {
    if (sortField === "sampleNumber" || sortField === "fullSampleID") {
      const aMatch = a.fullSampleID?.match(/-(\d+)$/);
      const bMatch = b.fullSampleID?.match(/-(\d+)$/);
      const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
      return sortAsc ? aNum - bNum : bNum - aNum;
    } else {
      const aValue = a[sortField];
      const bValue = b[sortField];
      if (aValue < bValue) return sortAsc ? -1 : 1;
      if (aValue > bValue) return sortAsc ? 1 : -1;
      return 0;
    }
  });

  // Add validation function
  const validateSamplesComplete = (samples) => {
    return samples.every((sample) => {
      // If it's a field blank sample, skip validation
      if (sample.location === "Field blank") {
        return true;
      }

      // For non-field blank samples, validate all required fields
      return (
        sample.sampleNumber &&
        sample.type &&
        sample.location &&
        sample.startTime &&
        sample.endTime &&
        sample.initialFlowrate &&
        sample.finalFlowrate &&
        sample.averageFlowrate
      );
    });
  };

  // Add handleSampleComplete function
  const handleSampleComplete = async () => {
    try {
      // Update shift status
      await shiftService.update(shiftId, { status: "sampling_complete" });
      // Refetch shift to update UI
      const shiftResponse = await shiftService.getById(shiftId);
      setShift(shiftResponse.data);
    } catch (error) {
      console.error("Error updating shift status:", error);
      setError("Failed to update shift status. Please try again.");
    }
  };

  // Add handler for Samples Submitted to Lab
  const handleSamplesSubmittedToLab = async () => {
    try {
      const currentDate = new Date().toISOString();
      await shiftService.update(shiftId, {
        status: "samples_submitted_to_lab",
        samplesReceivedDate: currentDate,
      });
      // Refetch shift to update UI
      const shiftResponse = await shiftService.getById(shiftId);
      setShift(shiftResponse.data);
    } catch (error) {
      setError("Failed to update shift status to 'Samples Submitted to Lab'.");
    }
  };

  const handleAddSample = () => {
    // Reset shift status to ongoing when adding a new sample
    shiftService.update(shiftId, { status: "ongoing" });
    navigate(`/air-monitoring/shift/${shiftId}/samples/new`, {
      state: { nextSampleNumber },
    });
  };

  const handleDescriptionChange = (e) => {
    setDescriptionOfWorks(e.target.value);
    setDescSaveStatus("");
  };

  const saveDescriptionOfWorks = async () => {
    try {
      await shiftService.update(shiftId, { descriptionOfWorks });
      setDescSaveStatus("Saved");
    } catch (err) {
      setDescSaveStatus("Error");
    }
  };

  if (loading) {
    return <Typography>Loading...</Typography>;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() =>
          navigate(`/air-monitoring/jobs/${shift?.job?._id}/shifts`)
        }
        sx={{ mb: 4 }}
      >
        Back to Shifts
      </Button>

      {/* Description of Works Field */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          Description of Works
        </Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          maxRows={6}
          value={descriptionOfWorks}
          onChange={handleDescriptionChange}
          placeholder="Enter a description of works for this shift..."
          required
          error={!descriptionOfWorks}
          helperText={
            !descriptionOfWorks ? "Description of works is required" : ""
          }
        />
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            variant="contained"
            onClick={saveDescriptionOfWorks}
            disabled={!descriptionOfWorks.trim()}
            sx={{
              backgroundColor: theme.palette.primary.main,
              "&:hover": {
                backgroundColor: theme.palette.primary.dark,
              },
            }}
          >
            Save Description
          </Button>
          {descSaveStatus === "Saved" && (
            <Typography variant="caption" color="success.main">
              Description saved successfully
            </Typography>
          )}
          {descSaveStatus === "Error" && (
            <Typography variant="caption" color="error.main">
              Error saving description
            </Typography>
          )}
        </Box>
      </Box>

      <Typography
        variant="h4"
        sx={{
          color:
            theme.palette.mode === "dark"
              ? "#fff"
              : theme.palette.secondary[200],
          mb: 4,
        }}
      >
        Samples for{" "}
        {shift?.name ? `Shift ${formatDate(shift.date)}` : "Loading..."}
      </Typography>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 4 }}
        justifyContent="space-between"
        alignItems="center"
      >
        <TextField
          label="Search"
          variant="outlined"
          value={search}
          onChange={handleSearch}
          sx={{ width: { xs: "100%", sm: "300px" } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddSample}
          sx={{
            backgroundColor: theme.palette.primary.main,
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Add Sample
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell onClick={() => handleSort("sampleNumber")}>
                Sample Number
              </TableCell>
              <TableCell onClick={() => handleSort("type")}>Type</TableCell>
              <TableCell onClick={() => handleSort("location")}>
                Location
              </TableCell>
              <TableCell onClick={() => handleSort("startTime")}>
                Start Time
              </TableCell>
              <TableCell onClick={() => handleSort("endTime")}>
                End Time
              </TableCell>
              <TableCell onClick={() => handleSort("averageFlowrate")}>
                Flow Rate (L/min)
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSamples.map((sample) => (
              <TableRow key={sample._id}>
                <TableCell>{sample.fullSampleID}</TableCell>
                <TableCell>{sample.type}</TableCell>
                <TableCell>{sample.location}</TableCell>
                <TableCell>{formatTime(sample.startTime)}</TableCell>
                <TableCell>
                  {sample.endTime ? formatTime(sample.endTime) : "-"}
                </TableCell>
                <TableCell>{sample.averageFlowrate}</TableCell>
                <TableCell>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      navigate(
                        `/air-monitoring/shift/${shiftId}/samples/edit/${sample._id}`
                      )
                    }
                    sx={{ mr: 1 }}
                  >
                    Edit Sample
                  </Button>
                  <IconButton onClick={() => handleDelete(sample._id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          mt: 2,
          gap: 2,
        }}
      >
        {![
          "sampling_complete",
          "samples_submitted_to_lab",
          "analysis_complete",
          "shift_complete",
        ].includes(shift?.status) && (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSampleComplete}
            disabled={isCompleteDisabled || shift?.status !== "ongoing"}
            sx={{
              backgroundColor: theme.palette.info.main,
              color: theme.palette.info.contrastText,
              "&:hover": {
                backgroundColor: theme.palette.info.dark,
              },
              "&.Mui-disabled": {
                backgroundColor: theme.palette.grey[700],
                color: theme.palette.grey[500],
              },
            }}
          >
            Sampling Complete
          </Button>
        )}
        {![
          "samples_submitted_to_lab",
          "analysis_complete",
          "shift_complete",
        ].includes(shift?.status) &&
          shift?.status === "sampling_complete" && (
            <Button
              variant="contained"
              color="secondary"
              onClick={handleSamplesSubmittedToLab}
              sx={{
                backgroundColor: theme.palette.warning.main,
                color: theme.palette.warning.contrastText,
                "&:hover": {
                  backgroundColor: theme.palette.warning.dark,
                },
              }}
            >
              Samples Submitted to Lab
            </Button>
          )}
      </Box>

      {["samples_submitted_to_lab", "analysis_complete"].includes(
        shift?.status
      ) && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
          <Button
            variant="contained"
            onClick={() =>
              navigate(`/air-monitoring/shift/${shiftId}/analysis`)
            }
            sx={{
              backgroundColor: theme.palette.success.main,
              color: theme.palette.success.contrastText,
              "&:hover": {
                backgroundColor: theme.palette.success.dark,
              },
            }}
          >
            COMPLETE ANALYSIS
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default SampleList;
