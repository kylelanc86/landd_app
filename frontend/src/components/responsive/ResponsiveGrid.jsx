import { Grid } from "@mui/material";
import PropTypes from "prop-types";

/**
 * A responsive grid component that adjusts column layout based on screen size
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Child components to render
 * @param {number} props.spacing - Grid spacing (default: 2)
 * @param {Object} props.sx - Additional styles to apply to the Grid container
 * @param {Object} props.itemProps - Additional props to apply to the Grid item
 */
const ResponsiveGrid = ({ children, spacing = 2, sx = {}, itemProps = {} }) => {
  return (
    <Grid container spacing={spacing} sx={sx}>
      <Grid item xs={12} sm={6} md={4} {...itemProps}>
        {children}
      </Grid>
    </Grid>
  );
};

ResponsiveGrid.propTypes = {
  children: PropTypes.node.isRequired,
  spacing: PropTypes.number,
  sx: PropTypes.object,
  itemProps: PropTypes.object,
};

export default ResponsiveGrid;
