import { Chip } from "@mui/material";
import { useTheme } from "@mui/material";

const StatusCell = ({ status, params }) => {
  const theme = useTheme();
  const statusValue = status || params?.row?.status;

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active":
      case "assigned":
      case "in progress":
      case "samples submitted":
      case "lab analysis complete":
      case "report sent for review":
      case "ready for invoicing":
      case "invoice sent":
        return "success";
      case "inactive":
      case "on hold":
      case "quote sent":
      case "cancelled":
        return "error";
      case "pending":
        return "warning";
      case "completed":
      case "job complete":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <Chip
      label={statusValue}
      color={getStatusColor(statusValue)}
      size="small"
      sx={{
        fontWeight: "bold",
        minWidth: "80px",
      }}
    />
  );
};

export default StatusCell;
