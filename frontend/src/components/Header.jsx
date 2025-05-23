import { Box, Typography, useTheme } from "@mui/material";
import { tokens } from "../theme";

const Header = ({ title, subtitle }) => {
  const theme = useTheme();
  const colors = tokens;

  return (
    <Box mb="30px">
      <Typography
        variant="h2"
        color={
          theme.palette.mode === "dark" ? colors.grey[100] : colors.grey[900]
        }
        fontWeight="bold"
        sx={{ mb: "5px" }}
      >
        {title}
      </Typography>
      <Typography
        variant="h5"
        color={
          theme.palette.mode === "dark"
            ? colors.secondary[500]
            : colors.secondary[700]
        }
      >
        {subtitle}
      </Typography>
    </Box>
  );
};

export default Header;
