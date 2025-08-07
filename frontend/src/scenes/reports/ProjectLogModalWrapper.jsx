import React, { useState, useEffect } from "react";
import { CircularProgress, Box } from "@mui/material";

const ProjectLogModalWrapper = ({ open, onClose, project }) => {
  const [ModalComponent, setModalComponent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadModal = async () => {
      try {
        setLoading(true);
        const { default: Component } = await import("./ProjectLogModal");
        if (isMounted) {
          setModalComponent(() => Component);
        }
      } catch (error) {
        console.error("Error loading ProjectLogModal:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (open) {
      loadModal();
    }

    return () => {
      isMounted = false;
    };
  }, [open]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!ModalComponent) {
    return null;
  }

  return <ModalComponent open={open} onClose={onClose} project={project} />;
};

export default ProjectLogModalWrapper;
