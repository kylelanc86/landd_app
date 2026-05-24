import React from "react";
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
} from "@mui/material";
import { formatLookupDisplay } from "../utils/lookupOptions";

/**
 * Master-data lookup: plain text in view mode, Select in edit mode.
 */
export default function LookupField({
  mode = "edit",
  label,
  value = "",
  displayLabel = "",
  options = [],
  onChange,
  required = false,
  disabled = false,
  emptyDisplay,
  fullWidth = true,
  sx,
  placeholder,
  loading = false,
  loadingText = "Loading...",
  emptyOptionsText = "No options found",
  allowEmpty = false,
  emptyOptionLabel,
}) {
  const shown = formatLookupDisplay(displayLabel, {
    required,
    emptyDisplay: emptyDisplay ?? (allowEmpty ? "-" : undefined),
  });

  if (mode === "view") {
    return (
      <TextField
        label={label}
        value={shown}
        InputProps={{ readOnly: true }}
        fullWidth={fullWidth}
        sx={sx}
        required={required}
      />
    );
  }

  return (
    <FormControl
      fullWidth={fullWidth}
      required={required}
      disabled={disabled || loading}
      sx={sx}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        value={value ?? ""}
        label={label}
        onChange={onChange}
        displayEmpty={allowEmpty}
        renderValue={(selected) => {
          if (selected === "" || selected == null) {
            return displayLabel
              ? formatLookupDisplay(displayLabel, { required: false, emptyDisplay: "" })
              : "";
          }
          const opt = options.find((o) => String(o.value) === String(selected));
          if (opt) return opt.label;
          return formatLookupDisplay(displayLabel, { required, emptyDisplay: "" }) || String(selected);
        }}
      >
        {allowEmpty && (
          <MenuItem value="">
            <em>{emptyOptionLabel || placeholder || `Select ${label}`}</em>
          </MenuItem>
        )}
        {loading ? (
          <MenuItem disabled>{loadingText}</MenuItem>
        ) : options.length > 0 ? (
          options.map((opt) => (
            <MenuItem key={String(opt.value)} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>{emptyOptionsText}</MenuItem>
        )}
      </Select>
    </FormControl>
  );
}
