import { useState, useCallback } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  Box,
} from '@mui/material';
import {
  JOB_STATUS,
  ACTIVE_STATUSES,
  INACTIVE_STATUSES,
  StatusChip,
} from '../components/JobStatus';

export const useJobStatus = () => {
  const [selectedStatus, setSelectedStatus] = useState(ACTIVE_STATUSES[0]);

  const handleStatusChange = useCallback((newStatus) => {
    setSelectedStatus(newStatus);
  }, []);

  const renderStatusSelect = (value, onChange, label = "Status") => {
    return (
      <FormControl fullWidth required>
        <InputLabel>{label}</InputLabel>
        <Select
          name="status"
          value={value}
          onChange={onChange}
          label={label}
        >
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Active Jobs
            </Typography>
          </MenuItem>
          {ACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              <StatusChip status={status} />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Inactive Jobs
            </Typography>
          </MenuItem>
          {INACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              <StatusChip status={status} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

  const renderStatusCell = (params) => {
    return <StatusChip status={params.value} />;
  };

  const renderEditStatusCell = (params) => {
    return (
      <Box sx={{ width: '100%' }}>
        <Select
          value={params.value}
          onChange={(e) => {
            console.log("Status change in cell:", e.target.value);
            params.api.setEditCellValue({ 
              id: params.id, 
              field: params.field, 
              value: e.target.value 
            }, true); // Add true to commit the change immediately
          }}
          sx={{ width: '100%' }}
          size="small"
        >
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Active Jobs
            </Typography>
          </MenuItem>
          {ACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              <StatusChip status={status} />
            </MenuItem>
          ))}
          <Divider />
          <MenuItem disabled>
            <Typography variant="subtitle2" color="text.secondary">
              Inactive Jobs
            </Typography>
          </MenuItem>
          {INACTIVE_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>
              <StatusChip status={status} />
            </MenuItem>
          ))}
        </Select>
      </Box>
    );
  };

  return {
    JOB_STATUS,
    ACTIVE_STATUSES,
    INACTIVE_STATUSES,
    selectedStatus,
    handleStatusChange,
    renderStatusSelect,
    renderStatusCell,
    renderEditStatusCell,
  };
}; 