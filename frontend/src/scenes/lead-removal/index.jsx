import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Container,
  useMediaQuery,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import { tokens } from "../../theme/tokens";
import { useTheme } from "@mui/material/styles";
import { usePermissions } from "../../hooks/usePermissions";
import { Navigate } from "react-router-dom";

const LeadRemoval = () => {
  const theme = useTheme();
  const colors = tokens;
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermissions();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const showPortraitColumnsOnly = isMobile && isPortrait;

  const [leadRemovalJobs] = useState([]);

  // Restrict to super admin only
  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <Container maxWidth="xl">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1" gutterBottom>
            Lead Removal Jobs
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {}}
            sx={{
              minWidth: "220px",
              backgroundColor: colors.primary[700],
              color: colors.grey[100],
              "&:hover": {
                backgroundColor: colors.primary[800],
              },
            }}
          >
            New Lead Removal Job
          </Button>
        </Box>

        <Paper sx={{ width: "100%", overflow: "hidden" }}>
          {leadRemovalJobs.length === 0 ? (
            <Box sx={{ p: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No active lead removal jobs
              </Typography>
            </Box>
          ) : (
            <TableContainer
              sx={{
                "& thead": {
                  background:
                    "linear-gradient(to right, #045E1F, #96CC78) !important",
                },
                "& thead .MuiTableCell-root": {
                  backgroundColor: "transparent !important",
                  color: "#FFFFFF !important",
                  borderBottom:
                    "2px solid rgba(255,255,255,0.4) !important",
                },
              }}
            >
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        minWidth: showPortraitColumnsOnly ? "80px" : "120px",
                      }}
                    >
                      Project ID
                    </TableCell>
                    <TableCell
                      sx={{
                        fontWeight: "bold",
                        minWidth: showPortraitColumnsOnly ? "140px" : "240px",
                      }}
                    >
                      Site Name (Project)
                    </TableCell>
                    {!showPortraitColumnsOnly && (
                      <>
                        <TableCell
                          sx={{ fontWeight: "bold", minWidth: "120px" }}
                        >
                          Lead Removalist
                        </TableCell>
                        <TableCell
                          sx={{ fontWeight: "bold", minWidth: "140px" }}
                        >
                          Status
                        </TableCell>
                      </>
                    )}
                    {!isMobile && (
                      <TableCell
                        sx={{ fontWeight: "bold", minWidth: "100px" }}
                      >
                        Job Type
                      </TableCell>
                    )}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {leadRemovalJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      onClick={() => navigate(`/lead-removal/jobs/${job.id}/details`)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: "medium" }}
                        >
                          {job.projectID}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {job.projectName}
                        </Typography>
                      </TableCell>
                      {!showPortraitColumnsOnly && (
                        <>
                          <TableCell>
                            <Typography variant="body2">
                              {job.leadRemovalist}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {job.status}
                            </Typography>
                          </TableCell>
                        </>
                      )}
                      {!isMobile && (
                        <TableCell>
                          <Typography variant="body2">
                            {job.jobTypeLabel}
                          </Typography>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    </Container>
  );
};

export default LeadRemoval;
