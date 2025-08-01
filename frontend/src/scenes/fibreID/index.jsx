import React from "react";
import {
  Box,
  Typography,
  Container,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  CardMedia,
  } from "@mui/material";
import {
  Science as ScienceIcon,
  Assignment as AssignmentIcon,
  ArrowForward as ArrowForwardIcon,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";

const FibreIdIndex = () => {
  const navigate = useNavigate();

  const handleClientSuppliedClick = () => {
    navigate("/fibre-id/client-supplied");
  };

  const handleAsbestosAssessmentClick = () => {
    navigate("/fibre-id/ldjobs");
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Fibre Identification
        </Typography>

        <Grid container spacing={4}>
          {/* Client Supplied Jobs Widget */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: "100%",
                transition: "all 0.3s ease-in-out",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 4,
                },
              }}
            >
              <CardActionArea
                onClick={handleClientSuppliedClick}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                }}
              >
                <CardMedia
                  component="div"
                  sx={{
                    height: 200,
                    backgroundColor: "#1976d2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <ScienceIcon sx={{ fontSize: 80, color: "white" }} />

                </CardMedia>
                <CardContent
                  sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
                >
                  <Typography variant="h5" component="h2" gutterBottom>
                    Client Supplied Samples
                  </Typography>

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="primary"
                      sx={{ fontWeight: "bold" }}
                    >
                      View Client Supplied Jobs
                    </Typography>
                    <ArrowForwardIcon color="primary" />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>

          {/* Asbestos Assessment Jobs Widget */}
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: "100%",
                transition: "all 0.3s ease-in-out",
                "&:hover": {
                  transform: "translateY(-4px)",
                  boxShadow: 4,
                },
              }}
            >
              <CardActionArea
                onClick={handleAsbestosAssessmentClick}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                }}
              >
                <CardMedia
                  component="div"
                  sx={{
                    height: 200,
                    backgroundColor: "#2e7d32",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <AssignmentIcon sx={{ fontSize: 80, color: "white" }} />
 
                </CardMedia>
                <CardContent
                  sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}
                >
                  <Typography variant="h5" component="h2" gutterBottom>
                    Asbestos Assessment Jobs
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography
                      variant="body2"
                      color="primary"
                      sx={{ fontWeight: "bold" }}
                    >
                      View Assessment Jobs
                    </Typography>
                    <ArrowForwardIcon color="primary" />
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Container>
  );
};

export default FibreIdIndex;
