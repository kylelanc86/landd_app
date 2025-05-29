import { Drawer, useMediaQuery, useTheme } from "@mui/material";
import PropTypes from "prop-types";

/**
 * A responsive navigation drawer component that adapts to screen size
 * @param {Object} props - Component props
 * @param {boolean} props.open - Whether the drawer is open
 * @param {Function} props.onClose - Function to call when drawer should close
 * @param {React.ReactNode} props.children - Child components to render
 * @param {number} props.width - Width of the drawer (default: 240)
 * @param {Object} props.sx - Additional styles to apply to the Drawer
 */
const ResponsiveNavigation = ({
  open,
  onClose,
  children,
  width = 240,
  sx = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Drawer
      variant={isMobile ? "temporary" : "permanent"}
      open={isMobile ? open : true}
      onClose={isMobile ? onClose : undefined}
      sx={{
        width: isMobile ? "100%" : width,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: isMobile ? "100%" : width,
          boxSizing: "border-box",
        },
        ...sx,
      }}
    >
      {children}
    </Drawer>
  );
};

ResponsiveNavigation.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  width: PropTypes.number,
  sx: PropTypes.object,
};

export default ResponsiveNavigation;
