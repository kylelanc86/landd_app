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

  // Load shift and samples data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch shift details
        const shiftResponse = await shiftService.getById(shiftId);
        setShift(shiftResponse.data);

        // Fetch samples for this shift
        const samplesResponse = await sampleService.getByShift(shiftId);
        setSamples(samplesResponse.data);
        setIsCompleteDisabled(!validateSamplesComplete(samplesResponse.data));
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
    const aValue = a[sortField];
    const bValue = b[sortField];
    if (aValue < bValue) return sortAsc ? -1 : 1;
    if (aValue > bValue) return sortAsc ? 1 : -1;
    return 0;
  });

  // Add validation function
  const validateSamplesComplete = (samples) => {
    return samples.every((sample) => {
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
      await shiftService.update(shiftId, { status: "sampling_complete" });
      // Navigate to shifts page with project ID
      if (shift?.job?.project?.projectID) {
        navigate(
          `/air-monitoring/project/${shift.job.project.projectID}/shifts`
        );
      } else {
        navigate("/air-monitoring/shifts");
      }
    } catch (error) {
      console.error("Error updating shift status:", error);
      setError("Failed to update shift status. Please try again.");
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
        onClick={() => navigate(-1)}
        sx={{ mb: 4 }}
      >
        Back to Shifts
      </Button>

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
          onClick={() =>
            navigate(`/air-monitoring/shift/${shiftId}/samples/new`)
          }
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
                <TableCell>{sample.sampleNumber}</TableCell>
                <TableCell>{sample.type}</TableCell>
                <TableCell>{sample.location}</TableCell>
                <TableCell>{formatTime(sample.startTime)}</TableCell>
                <TableCell>
                  {sample.endTime ? formatTime(sample.endTime) : "-"}
                </TableCell>
                <TableCell>{sample.averageFlowrate}</TableCell>
                <TableCell>
                  <IconButton
                    onClick={() =>
                      navigate(
                        `/air-monitoring/shift/${shiftId}/samples/edit/${sample._id}`
                      )
                    }
                  >
                    <EditIcon />
                  </IconButton>
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
        <Button
          variant="contained"
          color="primary"
          onClick={handleSampleComplete}
          disabled={isCompleteDisabled}
          sx={{
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
            "&.Mui-disabled": {
              backgroundColor: theme.palette.grey[700],
              color: theme.palette.grey[500],
            },
          }}
        >
          Sampling Complete
        </Button>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
        <Button
          variant="contained"
          onClick={() => navigate(`/air-monitoring/shift/${shiftId}/analysis`)}
          sx={{
            backgroundColor: theme.palette.primary.main,
            "&:hover": {
              backgroundColor: theme.palette.primary.dark,
            },
          }}
        >
          Analysis
        </Button>
      </Box>
    </Box>
  );
};

export default SampleList;
