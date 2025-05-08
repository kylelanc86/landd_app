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

const SAMPLES_KEY = "ldc_samples";

const SampleList = () => {
  const theme = useTheme();
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const [samples, setSamples] = useState([]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("sampleNo");
  const [sortAsc, setSortAsc] = useState(true);
  const [shift, setShift] = useState(null);
  const [allSamplesComplete, setAllSamplesComplete] = useState(false);

  // Load shift and samples data
  useEffect(() => {
    // Load shift data
    const storedShifts = localStorage.getItem("ldc_shifts");
    if (storedShifts) {
      const shifts = JSON.parse(storedShifts);
      const foundShift = shifts.find((s) => s.id === parseInt(shiftId));
      if (foundShift) {
        setShift(foundShift);
      }
    }

    // Load samples data
    const storedSamples = localStorage.getItem(SAMPLES_KEY);
    if (storedSamples) {
      const allSamples = JSON.parse(storedSamples);
      const shiftSamples = allSamples.filter(
        (s) => s.shiftId === parseInt(shiftId)
      );
      setSamples(shiftSamples);
    }
  }, [shiftId]);

  // Check if all samples are complete
  useEffect(() => {
    const isSampleComplete = (sample) => {
      return (
        sample.type &&
        sample.location &&
        sample.pumpNo &&
        sample.cowlNo &&
        sample.filterSize &&
        sample.startTime &&
        sample.endTime &&
        sample.initialFlowrate &&
        sample.finalFlowrate
      );
    };

    const allComplete = samples.length > 0 && samples.every(isSampleComplete);
    setAllSamplesComplete(allComplete);
  }, [samples]);

  // Filtering and sorting
  const filteredSamples = samples.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.sampleNo.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q)
    );
  });

  const sortedSamples = [...filteredSamples].sort((a, b) => {
    if (a[sortField] < b[sortField]) return sortAsc ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortAsc ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleDeleteSample = (sampleId) => {
    const updatedSamples = samples.filter((s) => s.id !== sampleId);
    setSamples(updatedSamples);
    localStorage.setItem(SAMPLES_KEY, JSON.stringify(updatedSamples));
  };

  // PDF generation placeholder
  const handlePrintPDF = () => {
    // TODO: Implement PDF generation logic
    alert("PDF generation coming soon!");
  };

  if (!shift) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>Shift not found</Typography>
        <Button onClick={() => navigate(-1)}>Back to Shifts</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
      {/* Analysis Complete Banner and Print Button */}
      {shift?.status === "Analysis Complete" && (
        <Box sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}>
          <Typography
            sx={{ color: "success.main", fontWeight: "bold", fontSize: 20 }}
          >
            Analysis complete
          </Typography>
          <Button variant="contained" color="success" onClick={handlePrintPDF}>
            Print Report PDF
          </Button>
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ mb: 2 }}
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
              fontSize: { xs: "1.5rem", sm: "2rem", md: "2.5rem" },
            }}
          >
            Shift Date: {shift.date}
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              color:
                theme.palette.mode === "dark"
                  ? theme.palette.grey[300]
                  : theme.palette.secondary[300],
            }}
          >
            Supervisor: {shift.supervisor}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          {allSamplesComplete && (
            <Button
              variant="contained"
              startIcon={<AssessmentIcon />}
              onClick={() =>
                navigate(`/air-monitoring/shift/${shiftId}/analysis`)
              }
              sx={{
                backgroundColor: theme.palette.success[500],
                "&:hover": {
                  backgroundColor: theme.palette.success[600],
                },
              }}
            >
              Complete Analysis
            </Button>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() =>
              navigate(`/air-monitoring/shift/${shiftId}/samples/new`)
            }
            sx={{
              backgroundColor: theme.palette.primary[500],
              "&:hover": {
                backgroundColor: theme.palette.primary[600],
              },
            }}
          >
            Add Sample
          </Button>
        </Stack>
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <SearchIcon
                  sx={{
                    color:
                      theme.palette.mode === "dark"
                        ? "#fff"
                        : theme.palette.secondary[200],
                  }}
                />
              </InputAdornment>
            ),
          }}
          sx={{
            width: 300,
            "& .MuiInputLabel-root": {
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
            },
            "& .MuiOutlinedInput-root": {
              color:
                theme.palette.mode === "dark"
                  ? "#fff"
                  : theme.palette.secondary[200],
              "& fieldset": {
                borderColor:
                  theme.palette.mode === "dark"
                    ? "#fff"
                    : theme.palette.secondary[200],
              },
            },
          }}
        />
      </Box>

      <TableContainer component={Paper} sx={{ borderRadius: "8px" }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell
                onClick={() => handleSort("sampleNo")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Sample No{" "}
                {sortField === "sampleNo" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("type")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Type {sortField === "type" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                onClick={() => handleSort("location")}
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                  cursor: "pointer",
                }}
              >
                Location {sortField === "location" ? (sortAsc ? "▲" : "▼") : ""}
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Time
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Minutes
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Average Flowrate
              </TableCell>
              <TableCell
                sx={{
                  fontWeight: "bold",
                  color:
                    theme.palette.mode === "dark"
                      ? "#fff"
                      : theme.palette.secondary[200],
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedSamples.map((sample) => (
              <TableRow key={sample.id}>
                <TableCell>{sample.sampleNo}</TableCell>
                <TableCell>{sample.type}</TableCell>
                <TableCell>{sample.location}</TableCell>
                <TableCell>{`${sample.startTime} - ${sample.endTime}`}</TableCell>
                <TableCell>{sample.minutes}</TableCell>
                <TableCell>{sample.averageFlowrate}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <IconButton
                      onClick={() =>
                        navigate(
                          `/air-monitoring/shift/${shiftId}/samples/edit/${sample.id}`
                        )
                      }
                      size="small"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDeleteSample(sample.id)}
                      size="small"
                      sx={{ color: theme.palette.error.main }}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default SampleList;
