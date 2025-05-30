import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';

const TruncatedCell = ({ value, tooltip = true }) => {
  if (!value) return null;

  const content = (
    <Box
      sx={{
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      <Typography variant="body2" noWrap>
        {value}
      </Typography>
    </Box>
  );

  if (tooltip) {
    return (
      <Tooltip title={value} placement="top">
        {content}
      </Tooltip>
    );
  }

  return content;
};

export default TruncatedCell; 