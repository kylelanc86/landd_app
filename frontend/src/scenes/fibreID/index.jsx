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

  const fibreIdModules = [
    {
      id: "client-supplied",
      title: "Client Supplied Samples",
      description: "View Client Supplied Jobs",
      icon: <ScienceIcon />,
      path: "/fibre-id/client-supplied",
      color: "#1976d2",
      isAvailable: true,
    },
    {
      id: "asbestos-assessment",
      title: "Asbestos Assessment Jobs",
      description: "View Assessment Jobs",
      icon: <AssignmentIcon />,
      path: "/fibre-id/ldjobs",
      color: "#2e7d32",
      isAvailable: false,
    },
  ];

  const handleModuleClick = (module) => {
    if (module.isAvailable) {
      navigate(module.path);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Fibre Identification
        </Typography>

        <Grid container spacing={4}>
          {fibreIdModules.map((module) => (
            <Grid item xs={12} md={6} key={module.id}>
              <Card
                sx={{
                  height: "100%",
                  transition: "all 0.3s ease-in-out",
                  "&:hover": module.isAvailable
                    ? {
                        transform: "translateY(-4px)",
                        boxShadow: 4,
                      }
                    : {},
                  position: "relative",
                  opacity: module.isAvailable ? 1 : 0.7,
                }}
              >
                <CardActionArea
                  onClick={() => handleModuleClick(module)}
                  disabled={!module.isAvailable}
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    cursor: module.isAvailable ? "pointer" : "default",
                  }}
                >
                  <CardMedia
                    component="div"
                    sx={{
                      height: 200,
                      backgroundColor: module.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      position: "relative",
                    }}
                  >
                    {React.cloneElement(module.icon, {
                      sx: { fontSize: 80, color: "white" },
                    })}

                    {/* Coming Soon Overlay */}
                    {!module.isAvailable && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          backgroundColor: "rgba(0, 0, 0, 0.7)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "column",
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{
                            color: "white",
                            fontWeight: "bold",
                            textAlign: "center",
                            mb: 1,
                          }}
                        >
                          Coming Soon
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "white",
                            textAlign: "center",
                            opacity: 0.9,
                          }}
                        >
                          This feature is under development
                        </Typography>
                      </Box>
                    )}
                  </CardMedia>
                  <CardContent
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Typography variant="h5" component="h2" gutterBottom>
                      {module.title}
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: "auto",
                      }}
                    >
                      <Typography
                        variant="body2"
                        color={
                          module.isAvailable ? "primary" : "text.secondary"
                        }
                        sx={{ fontWeight: "bold" }}
                      >
                        {module.isAvailable
                          ? module.description
                          : "Coming Soon"}
                      </Typography>
                      {module.isAvailable && (
                        <ArrowForwardIcon color="primary" />
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
};

export default FibreIdIndex;
