import React from "react";
import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { formatLookupDisplay } from "../utils/lookupOptions";

/**
 * Equipment reference chosen via radios in edit; plain text in view.
 */
export default function LookupRadioGroup({
  mode = "edit",
  label,
  value = "",
  displayValue,
  options = [],
  name,
  onChange,
  disabled = false,
  row = true,
  emptyMessage = "No options available",
}) {
  const shown = formatLookupDisplay(displayValue ?? value, { required: true });

  if (mode === "view") {
    return (
      <Box>
        <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
          {label}
        </Typography>
        <Typography variant="body1">{shown}</Typography>
      </Box>
    );
  }

  return (
    <FormControl component="fieldset" disabled={disabled}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {label}
      </Typography>
      <RadioGroup row={row} name={name} value={value} onChange={onChange}>
        {options.length > 0 ? (
          options.map((opt) => (
            <FormControlLabel
              key={opt.value}
              value={opt.value}
              control={<Radio />}
              label={opt.label}
            />
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">
            {emptyMessage}
          </Typography>
        )}
      </RadioGroup>
    </FormControl>
  );
}
