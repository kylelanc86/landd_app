import { Box, useMediaQuery, useTheme } from "@mui/material";
import PropTypes from "prop-types";

/**
 * A responsive layout wrapper component that adjusts padding and width based on screen size
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {Object} props.sx - Additional styles to apply to the Box component
 */
const ResponsiveLayout = ({ children, sx = {} }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box
      sx={{
        width: "100%",
        padding: isMobile ? 2 : 3,
        maxWidth: "100vw",
        overflowX: "hidden",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};

ResponsiveLayout.propTypes = {
  children: PropTypes.node.isRequired,
  sx: PropTypes.object,
};

export default ResponsiveLayout;
