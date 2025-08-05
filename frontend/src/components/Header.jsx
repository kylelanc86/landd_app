import { Box, Typography, useTheme } from "@mui/material";
import { tokens } from "../theme/tokens";

const Header = ({ title, subtitle, secondarySubtitle }) => {
  const theme = useTheme();

  return (
    <Box mb="30px">
      <Typography
        variant="h2"
        color={"#000000"}
        fontWeight="bold"
        sx={{ mb: "5px" }}
      >
        {title}
      </Typography>
      <Typography
        variant="h5"
        color={
          theme.palette.mode === "dark"
            ? theme.palette.secondary.main
            : theme.palette.secondary.dark
        }
        sx={{ mb: secondarySubtitle ? "2px" : 0 }}
      >
        {subtitle}
      </Typography>
      {secondarySubtitle && (
        <Typography variant="h6" color="white">
          {secondarySubtitle}
        </Typography>
      )}
    </Box>
  );
};

export default Header;
