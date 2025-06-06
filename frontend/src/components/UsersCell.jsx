import React from "react";
import { Box, Chip, Avatar, Typography } from "@mui/material";
import { UserAvatar } from "./JobStatus";

const UsersCell = ({ users, onRemoveUser }) => {
  if (!users || users.length === 0) {
    return <Typography color="text.secondary">No users assigned</Typography>;
  }

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {users.map((user) => (
        <Chip
          key={user._id}
          avatar={<UserAvatar user={user} />}
          label={`${user.firstName} ${user.lastName}`}
          onDelete={onRemoveUser ? () => onRemoveUser(user._id) : undefined}
          size="small"
        />
      ))}
    </Box>
  );
};

export default UsersCell;
