import React, { useCallback, useRef, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  Typography,
} from "@mui/material";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { appendPdfFiles } from "./analysisReportFiles";

/**
 * @param {{
 *   items: import('./analysisReportFiles').AnalysisReportListItem[],
 *   onChange: (items: import('./analysisReportFiles').AnalysisReportListItem[]) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function AnalysisReportFileList({ items, onChange, disabled = false }) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDragEnd = useCallback(
    (result) => {
      if (!result.destination || disabled) return;
      const next = Array.from(items);
      const [moved] = next.splice(result.source.index, 1);
      next.splice(result.destination.index, 0, moved);
      onChange(next);
    },
    [items, onChange, disabled],
  );

  const handleAddFiles = useCallback(
    (fileList) => {
      const next = appendPdfFiles(items, fileList);
      if (next.length === items.length) return;
      onChange(next);
    },
    [items, onChange],
  );

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      if (disabled) return;
      handleAddFiles(e.dataTransfer?.files);
    },
    [disabled, handleAddFiles],
  );

  return (
    <Box >
      <Box
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget.contains(e.relatedTarget)) return;
          setDragOver(false);
        }}
        onDrop={handleDrop}
        sx={{
          border: "1px dashed",
          borderColor: dragOver ? "primary.main" : "divider",
          borderRadius: 2,
          p: 2,
          mb: 1.5,
          bgcolor: dragOver ? "action.hover" : "background.paper",
          transition: "border-color 0.15s, background-color 0.15s",
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag and drop PDF files here, or choose files below. Reorder reports
          by dragging — this order is used in the shift report appendix.
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          sx={{ textTransform: "none" }}
        >
          Choose PDF files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          multiple
          accept=".pdf,application/pdf"
          onChange={(e) => {
            handleAddFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </Box>

      {items.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="analysis-reports">
            {(provided) => (
              <List
                dense
                disablePadding
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                {items.map((item, index) => (
                  <Draggable
                    key={item.id}
                    draggableId={item.id}
                    index={index}
                    isDragDisabled={disabled}
                  >
                    {(dragProvided, snapshot) => (
                      <ListItem
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        secondaryAction={
                          !disabled ? (
                            <IconButton
                              edge="end"
                              aria-label={`Remove ${item.name}`}
                              onClick={() =>
                                onChange(items.filter((i) => i.id !== item.id))
                              }
                              size="small"
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          ) : null
                        }
                        sx={{
                          bgcolor: snapshot.isDragging
                            ? "action.selected"
                            : "background.paper",
                          borderBottom:
                            index < items.length - 1 ? "1px solid" : "none",
                          borderColor: "divider",
                          py: 1,
                        }}
                      >
                        <Box
                          {...dragProvided.dragHandleProps}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            color: disabled ? "action.disabled" : "text.secondary",
                            mr: 1,
                            cursor: disabled ? "default" : "grab",
                          }}
                        >
                          <DragIndicatorIcon fontSize="small" />
                        </Box>
                        <PictureAsPdfIcon
                          fontSize="small"
                          color="error"
                          sx={{ mr: 1, flexShrink: 0 }}
                        />
                        <Typography
                          variant="body2"
                          noWrap
                          title={item.name}
                          sx={{ flex: 1, minWidth: 0 }}
                        >
                          {index + 1}. {item.name}
                        </Typography>
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No analysis reports added yet.
        </Typography>
      )}
    </Box>
  );
}
