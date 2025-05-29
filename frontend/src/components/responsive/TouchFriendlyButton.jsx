import { Button } from "@mui/material";
import PropTypes from "prop-types";

/**
 * A touch-friendly button component with appropriate sizing for mobile devices
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content
 * @param {Object} props.sx - Additional styles to apply to the Button
 * @param {Object} props.rest - Additional props to pass to the Button component
 */
const TouchFriendlyButton = ({ children, sx = {}, ...rest }) => {
  return (
    <Button
      {...rest}
      sx={{
        minHeight: "44px",
        minWidth: "44px",
        padding: "12px 24px",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        ...sx,
      }}
    >
      {children}
    </Button>
  );
};

TouchFriendlyButton.propTypes = {
  children: PropTypes.node.isRequired,
  sx: PropTypes.object,
};

export default TouchFriendlyButton;
