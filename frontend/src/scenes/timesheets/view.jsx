import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import timesheetService from "../../services/timesheetService";
import userService from "../../services/userService";

const TimesheetView = ({ id }) => {
  const navigate = useNavigate();
  const [timesheet, setTimesheet] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [timesheetResponse, userResponse] = await Promise.all([
          timesheetService.getById(id),
          userService.getById(timesheetResponse.data.userId),
        ]);
        setTimesheet(timesheetResponse.data);
        setUser(userResponse.data);
      } catch (error) {
        setError(error.message);
      }
    };
    fetchData();
  }, [id]);

  const handleStatusUpdate = async (status) => {
    try {
      await timesheetService.updateStatus(id, status);
      setTimesheet((prev) => ({ ...prev, status }));
    } catch (error) {
      setError(error.message);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this timesheet?")) {
      try {
        await timesheetService.delete(id);
        navigate("/timesheets");
      } catch (error) {
        setError(error.message);
      }
    }
  };

  const handleEdit = () => {
    navigate(`/timesheets/edit/${id}`);
  };

  const formatDuration = (startTime, endTime) => {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diff = end - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return <div>{/* Render your component content here */}</div>;
};

export default TimesheetView;
