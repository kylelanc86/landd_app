import React from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import GestureOutlinedIcon from "@mui/icons-material/GestureOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

export const PHOTO_ARROW_COLORS = [
  { name: "Yellow", hex: "#ffeb3b" },
  { name: "Red", hex: "#f44336" },
  { name: "White", hex: "#ffffff" },
  { name: "Black", hex: "#212121" },
  { name: "Orange", hex: "#ff9800" },
  { name: "Green", hex: "#4caf50" },
];

/**
 * Draw / delete / colour toolbar for the full-size photo arrow editor.
 * Light panel + solid MUI buttons — readable on the dark photo dialog.
 */
export default function PhotoArrowToolbar({
  drawMode = false,
  onDrawModeChange,
  selectedArrowId = null,
  onDeleteSelected,
  selectedColor,
  onColorChange,
  colors = PHOTO_ARROW_COLORS,
  disabled = false,
}) {
  const hint = drawMode
    ? "Drag on the photo to draw an arrow (tail → tip)"
    : "Select an arrow to change colour or delete · drag to move";

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 0.75,
        mb: 2,
        width: "100%",
        maxWidth: 520,
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 1.25,
          borderRadius: 2,
          bgcolor: "#fff",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: 2,
          flexWrap: "wrap",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Tooltip title={drawMode ? "Cancel drawing" : "Draw arrow"}>
            <span>
              <Button
                size="small"
                variant="contained"
                color="primary"
                disableElevation
                disabled={disabled}
                onClick={() => onDrawModeChange?.(!drawMode)}
                startIcon={<GestureOutlinedIcon />}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  minWidth: 0,
                  px: 1.5,
                  ...(!drawMode && {
                    bgcolor: "grey.700",
                    color: "#fff",
                    "&:hover": { bgcolor: "grey.800" },
                  }),
                }}
              >
                {drawMode ? "Drawing" : "Draw"}
              </Button>
            </span>
          </Tooltip>

          <Tooltip
            title={
              selectedArrowId
                ? "Delete selected arrow"
                : "Select an arrow to delete"
            }
          >
            <span>
              <IconButton
                size="small"
                disabled={disabled || !selectedArrowId}
                onClick={() => onDeleteSelected?.()}
                sx={{
                  bgcolor: selectedArrowId ? "error.main" : "grey.200",
                  color: selectedArrowId ? "#fff" : "grey.500",
                  borderRadius: 1.5,
                  "&:hover": {
                    bgcolor: selectedArrowId ? "error.dark" : "grey.300",
                  },
                  "&.Mui-disabled": {
                    bgcolor: "grey.100",
                    color: "grey.400",
                  },
                }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Divider
            orientation="vertical"
            flexItem
            sx={{ display: { xs: "none", sm: "block" }, mx: 0.25 }}
          />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontWeight: 600,
              display: { xs: "none", sm: "block" },
              userSelect: "none",
            }}
          >
            Colour
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            {colors.map(({ name, hex }) => {
              const isSelected = selectedColor === hex;
              const needsDarkRing =
                hex.toLowerCase() === "#ffffff" ||
                hex.toLowerCase() === "#ffeb3b";
              return (
                <Tooltip key={hex} title={name}>
                  <Box
                    component="button"
                    type="button"
                    disabled={disabled}
                    onClick={() => onColorChange?.(hex)}
                    aria-label={`${name} arrow colour`}
                    aria-pressed={isSelected}
                    sx={{
                      width: 22,
                      height: 22,
                      p: 0,
                      border: "none",
                      borderRadius: "50%",
                      bgcolor: hex,
                      cursor: disabled ? "default" : "pointer",
                      flexShrink: 0,
                      boxShadow: isSelected
                        ? "0 0 0 2px #fff, 0 0 0 4px #2196f3"
                        : needsDarkRing
                          ? "inset 0 0 0 1px rgba(0,0,0,0.35)"
                          : "inset 0 0 0 1px rgba(0,0,0,0.15)",
                      opacity: disabled ? 0.45 : 1,
                      transition: "transform 0.12s, box-shadow 0.12s",
                      "&:hover:not(:disabled)": { transform: "scale(1.12)" },
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textAlign: "center", lineHeight: 1.35 }}
        >
          {hint}
        </Typography>
      </Box>
    </Box>
  );
}
