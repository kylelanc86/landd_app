import React, { forwardRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { TableVirtuoso } from "react-virtuoso";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
} from "@mui/material";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import {
  TABLE_FONT_SIZE,
  getItemRisk,
  getLeadPaintStatus,
  formatRoomAreaWithLevel,
  getDustExceedanceStatus,
  getSoilStatus,
  formatDustLeadConcentrationMgM2,
  riskChipDisplayLabel,
  getRiskBadgeSx,
} from "./leadAssessmentItemsTableUtils";

function createVirtuosoTableComponents(tableCellSx) {
  return {
    Scroller: forwardRef(function VirtuosoScroller(props, ref) {
      return (
        <TableContainer
          component={Paper}
          variant="outlined"
          ref={ref}
          {...props}
          sx={{
            boxShadow: "none",
            border: 0,
            borderRadius: 0,
            overflowY: "visible",
            overflowX: "auto",
            ...(props.sx || {}),
          }}
        />
      );
    }),
    Table: (props) => (
      <Table {...props} size="small" stickyHeader sx={tableCellSx} />
    ),
    TableHead,
    TableRow: ({ item: _item, ...props }) => <TableRow {...props} hover />,
    TableBody: forwardRef(function VirtuosoTableBody(props, ref) {
      return <TableBody {...props} ref={ref} />;
    }),
  };
}

function LeadSampleRowCells({
  row,
  isPaintTable,
  isDustTable,
  isSoilTable,
  columnWidths,
  leadContentDrafts,
  leadAssessmentPhotosLocked,
  assessmentId,
  onLeadContentChange,
  onLeadContentSave,
  onLeadContentCancel,
  onOpenLeadPhotoGallery,
  onOpenReferredPhotoDialog,
  onDeleteItem,
}) {
  const navigate = useNavigate();
  const isReferred = row.kind === "referred";
  const current = isReferred ? row.referred : row.item;
  const effectiveLeadContent = isReferred
    ? row.item?.leadContent
    : leadContentDrafts[row.item._id] ?? row.item?.leadContent;
  const risk = getItemRisk(current);
  const leadStatus = getLeadPaintStatus(effectiveLeadContent);
  const isLeadContentDirty =
    String(leadContentDrafts[row.item._id] ?? "") !==
    String(row.item.leadContent ?? "");
  const dustStatus = isDustTable
    ? getDustExceedanceStatus(
        current?.locationRating,
        leadContentDrafts[row.item._id] ?? row.item.leadContent,
        row.item.leadSampleArea,
      )
    : null;
  const soilStatus = isSoilTable
    ? getSoilStatus(
        leadContentDrafts[row.item._id] ?? row.item.leadContent,
        row.item.paintColour,
      )
    : null;

  return (
    <>
      <TableCell>
        {isReferred
          ? `Refer to ${row.item.sampleReference ?? "—"}`
          : row.item.sampleReference ?? "—"}
      </TableCell>
      {!isDustTable && <TableCell>{row.item.paintColour ?? "—"}</TableCell>}
      <TableCell>
        {isSoilTable ? (
          <Typography component="span" sx={{ lineHeight: 1.2, fontSize: TABLE_FONT_SIZE }}>
            {isReferred ? current?.surfaceDescription ?? "—" : row.item.locationDescription ?? "—"}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <Typography component="span" sx={{ lineHeight: 1.2, fontSize: TABLE_FONT_SIZE }}>
              {formatRoomAreaWithLevel(current?.levelFloor, current?.roomArea)}
            </Typography>
            <Typography component="span" sx={{ lineHeight: 1.2, fontSize: TABLE_FONT_SIZE }}>
              {isReferred ? current?.surfaceDescription ?? "—" : row.item.locationDescription ?? "—"}
            </Typography>
          </Box>
        )}
      </TableCell>
      {isDustTable && (
        <>
          <TableCell>
            {isReferred ? (
              row.item.leadContent ?? "—"
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TextField
                  size="small"
                  value={leadContentDrafts[row.item._id] ?? ""}
                  autoComplete="off"
                  onChange={(e) => onLeadContentChange(row.item._id, e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment
                        position="end"
                        sx={{
                          ml: 0.25,
                          "& .MuiTypography-root": {
                            fontSize: "0.8rem",
                            lineHeight: 1,
                          },
                        }}
                      >
                        μg
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ style: { fontSize: TABLE_FONT_SIZE, padding: "6px 8px" } }}
                  sx={{ width: 80 }}
                />
                {isLeadContentDirty && (
                  <>
                    <IconButton
                      size="small"
                      color="success"
                      aria-label="Save lead content"
                      onClick={() => onLeadContentSave(row.item)}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="inherit"
                      aria-label="Cancel lead content"
                      onClick={() => onLeadContentCancel(row.item)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            )}
          </TableCell>
          <TableCell>
            {formatDustLeadConcentrationMgM2(
              leadContentDrafts[row.item._id] ?? row.item.leadContent,
              row.item.leadSampleArea,
            )}
          </TableCell>
          <TableCell>
            {!dustStatus ? (
              "—"
            ) : (
              <Box
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  display: "inline-block",
                  bgcolor: dustStatus.exceeds ? "error.main" : "success.main",
                  color: dustStatus.exceeds ? "error.contrastText" : "success.contrastText",
                  fontWeight: 600,
                  fontSize: TABLE_FONT_SIZE,
                }}
              >
                {dustStatus.label}
              </Box>
            )}
          </TableCell>
        </>
      )}
      {isPaintTable && (
        <>
          <TableCell>
            {isReferred ? (
              row.item.leadContent ?? "—"
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TextField
                  size="small"
                  value={leadContentDrafts[row.item._id] ?? ""}
                  onChange={(e) => onLeadContentChange(row.item._id, e.target.value)}
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  inputProps={{ style: { fontSize: TABLE_FONT_SIZE, padding: "6px 8px" } }}
                  sx={{ width: 75 }}
                />
                {isLeadContentDirty && (
                  <>
                    <IconButton
                      size="small"
                      color="success"
                      aria-label="Save lead content"
                      onClick={() => onLeadContentSave(row.item)}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="inherit"
                      aria-label="Cancel lead content"
                      onClick={() => onLeadContentCancel(row.item)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            )}
          </TableCell>
          <TableCell>
            {leadStatus == null ? (
              "—"
            ) : leadStatus.isLeadPaint ? (
              <Box
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  display: "inline-block",
                  bgcolor: "error.main",
                  color: "error.contrastText",
                  fontWeight: 600,
                  fontSize: TABLE_FONT_SIZE,
                }}
              >
                {leadStatus.label}
              </Box>
            ) : (
              leadStatus.label
            )}
          </TableCell>
        </>
      )}
      {isSoilTable && (
        <>
          <TableCell>
            {isReferred ? (
              row.item.leadContent ?? "—"
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <TextField
                  size="small"
                  value={leadContentDrafts[row.item._id] ?? ""}
                  onChange={(e) => onLeadContentChange(row.item._id, e.target.value)}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment
                        position="end"
                        sx={{
                          ml: 0.25,
                          "& .MuiTypography-root": {
                            fontSize: "0.8rem",
                            lineHeight: 1,
                          },
                        }}
                      >
                        mg/kg
                      </InputAdornment>
                    ),
                  }}
                  inputProps={{ style: { fontSize: TABLE_FONT_SIZE, padding: "6px 8px" } }}
                  sx={{ width: 124 }}
                />
                {isLeadContentDirty && (
                  <>
                    <IconButton
                      size="small"
                      color="success"
                      aria-label="Save lead content"
                      onClick={() => onLeadContentSave(row.item)}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="inherit"
                      aria-label="Cancel lead content"
                      onClick={() => onLeadContentCancel(row.item)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </>
                )}
              </Box>
            )}
          </TableCell>
          <TableCell>
            {!soilStatus ? (
              "—"
            ) : (
              <Box
                sx={{
                  px: 1.25,
                  py: 0.5,
                  borderRadius: 1,
                  display: "inline-block",
                  bgcolor: soilStatus.exceeds ? "error.main" : "success.main",
                  color: soilStatus.exceeds ? "error.contrastText" : "success.contrastText",
                  fontWeight: 600,
                  fontSize: TABLE_FONT_SIZE,
                }}
              >
                {soilStatus.label}
              </Box>
            )}
          </TableCell>
        </>
      )}
      {!isSoilTable && (
        <TableCell>
          {(isPaintTable && leadStatus && !leadStatus.isLeadPaint) ||
          (isDustTable && dustStatus && !dustStatus.exceeds) ? (
            "None"
          ) : risk ? (
            <Box sx={{ ...getRiskBadgeSx(risk.label), fontSize: TABLE_FONT_SIZE }}>
              {riskChipDisplayLabel(risk.label)}
            </Box>
          ) : (
            "—"
          )}
        </TableCell>
      )}
      <TableCell
        sx={{
          width: columnWidths.actions,
          minWidth: columnWidths.actions,
          maxWidth: columnWidths.actions,
          px: 1,
        }}
      >
        {isReferred ? (
          <IconButton
            size="small"
            aria-label="Manage referred location photos"
            disabled={leadAssessmentPhotosLocked}
            onClick={() => onOpenReferredPhotoDialog(row)}
            title="Manage referred location photos"
          >
            <PhotoCameraIcon
              sx={{
                color:
                  (Array.isArray(row.referred?.photographs)
                    ? row.referred.photographs.length
                    : 0) > 0
                  ? "success.main"
                  : "error.main",
              }}
            />
          </IconButton>
        ) : (
          <>
            <IconButton
              size="small"
              aria-label="Manage photos"
              disabled={leadAssessmentPhotosLocked}
              onClick={() => onOpenLeadPhotoGallery(row.item)}
              title="Manage photos"
            >
              <PhotoCameraIcon
                sx={{
                  color:
                    (Array.isArray(row.item?.photographs) ? row.item.photographs.length : 0) > 0
                      ? "success.main"
                      : "error.main",
                }}
              />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Edit item"
              onClick={() =>
                navigate(`/surveys/lead/${assessmentId}/items/${row.item._id}/edit`)
              }
            >
              <EditIcon />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              aria-label="Delete item"
              onClick={() => onDeleteItem(row.item)}
            >
              <DeleteIcon />
            </IconButton>
          </>
        )}
      </TableCell>
    </>
  );
}

/**
 * Virtualized sample table for the active lead assessment tab (large lists stay responsive).
 */
export default function LeadAssessmentLeadSamplesTable({
  typeKey,
  typeRows,
  isPaintTable,
  isDustTable,
  isSoilTable,
  columnWidths,
  leadContentDrafts,
  leadAssessmentPhotosLocked,
  assessmentId,
  onLeadContentChange,
  onLeadContentSave,
  onLeadContentCancel,
  onOpenLeadPhotoGallery,
  onOpenReferredPhotoDialog,
  onDeleteItem,
}) {
  const tableCellSx = useMemo(
    () => ({
      "& .MuiTableCell-root": {
        fontSize: TABLE_FONT_SIZE,
      },
    }),
    [],
  );

  const components = useMemo(
    () => createVirtuosoTableComponents(tableCellSx),
    [tableCellSx],
  );

  const rowCtx = useMemo(
    () => ({
      isPaintTable,
      isDustTable,
      isSoilTable,
      columnWidths,
      leadContentDrafts,
      leadAssessmentPhotosLocked,
      assessmentId,
      onLeadContentChange,
      onLeadContentSave,
      onLeadContentCancel,
      onOpenLeadPhotoGallery,
      onOpenReferredPhotoDialog,
      onDeleteItem,
    }),
    [
      isPaintTable,
      isDustTable,
      isSoilTable,
      columnWidths,
      leadContentDrafts,
      leadAssessmentPhotosLocked,
      assessmentId,
      onLeadContentChange,
      onLeadContentSave,
      onLeadContentCancel,
      onOpenLeadPhotoGallery,
      onOpenReferredPhotoDialog,
      onDeleteItem,
    ],
  );

  const renderRow = useCallback(
    (_index, row) => <LeadSampleRowCells row={row} {...rowCtx} />,
    [rowCtx],
  );

  if (typeRows.length === 0) {
    return (
      <TableContainer
        component={Paper}
        variant="outlined"
        sx={{
          boxShadow: "none",
          border: 0,
          borderRadius: 0,
        }}
      >
        <Table size="small" sx={tableCellSx}>
          <TableBody>
            <TableRow>
              <TableCell
                colSpan={isPaintTable || isDustTable ? 7 : 6}
                align="center"
                sx={{ color: "text.secondary", py: 2 }}
              >
                No samples in assessment.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <TableVirtuoso
      key={typeKey}
      useWindowScroll
      data={typeRows}
      components={components}
      fixedHeaderContent={() => (
        <TableRow sx={{ "&:hover": { backgroundColor: "transparent" } }}>
          <TableCell
            sx={{ fontWeight: "bold", width: columnWidths.sampleReference, fontSize: TABLE_FONT_SIZE }}
          >
            Sample reference
          </TableCell>
          {!isDustTable && (
            <TableCell
              sx={{ fontWeight: "bold", width: columnWidths.paintColour, fontSize: TABLE_FONT_SIZE }}
            >
              {isSoilTable ? "Assessment Criteria" : "Paint colour"}
            </TableCell>
          )}
          <TableCell sx={{ fontWeight: "bold", width: columnWidths.description, fontSize: TABLE_FONT_SIZE }}>
            Description
          </TableCell>
          {isPaintTable && (
            <>
              <TableCell sx={{ fontWeight: "bold", width: columnWidths.leadContent, fontSize: TABLE_FONT_SIZE }}>
                Lead content
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", width: columnWidths.status, fontSize: TABLE_FONT_SIZE }}>
                Status
              </TableCell>
            </>
          )}
          {isDustTable && (
            <>
              <TableCell sx={{ fontWeight: "bold", width: columnWidths.leadContent, fontSize: TABLE_FONT_SIZE }}>
                Lead content
              </TableCell>
              <TableCell
                sx={{ fontWeight: "bold", width: columnWidths.leadConcentration, fontSize: TABLE_FONT_SIZE }}
              >
                Concentration <br />
                (mg/m²)
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", width: columnWidths.status, fontSize: TABLE_FONT_SIZE }}>
                Status
              </TableCell>
            </>
          )}
          {isSoilTable && (
            <>
              <TableCell sx={{ fontWeight: "bold", width: columnWidths.leadContent, fontSize: TABLE_FONT_SIZE }}>
                Lead content
              </TableCell>
              <TableCell sx={{ fontWeight: "bold", width: columnWidths.status, fontSize: TABLE_FONT_SIZE }}>
                Status
              </TableCell>
            </>
          )}
          {!isSoilTable && (
            <TableCell sx={{ fontWeight: "bold", width: columnWidths.risk, fontSize: TABLE_FONT_SIZE }}>
              Risk
            </TableCell>
          )}
          <TableCell
            sx={{
              fontWeight: "bold",
              width: columnWidths.actions,
              minWidth: columnWidths.actions,
              maxWidth: columnWidths.actions,
              px: 1,
              fontSize: TABLE_FONT_SIZE,
            }}
          >
            Actions
          </TableCell>
        </TableRow>
      )}
      itemContent={renderRow}
    />
  );
}
