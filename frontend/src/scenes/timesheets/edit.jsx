import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import timesheetService from "../../services/timesheetService";
import api from "../../services/api";

const EditTimesheet = ({ id }) => {
  const navigate = useNavigate();
  const [timesheet, setTimesheet] = useState(null);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    userId: "",
    date: "",
    startTime: "",
    endTime: "",
    projectId: "",
    description: "",
    isAdminWork: false,
    isBreak: false,
    projectInputType: "manual",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [timesheetResponse, projectsResponse, usersResponse] =
          await Promise.all([
            timesheetService.getById(id),
            api.get("/projects"),
            api.get("/users"),
          ]);
        setTimesheet(timesheetResponse.data);
        setProjects(projectsResponse.data);
        setUsers(usersResponse.data);
        setForm({
          userId: timesheetResponse.data.userId,
          date: timesheetResponse.data.date,
          startTime: timesheetResponse.data.startTime,
          endTime: timesheetResponse.data.endTime,
          projectId: timesheetResponse.data.projectId,
          description: timesheetResponse.data.description,
          isAdminWork: timesheetResponse.data.isAdminWork,
          isBreak: timesheetResponse.data.isBreak,
          projectInputType: timesheetResponse.data.projectInputType,
        });
      } catch (error) {
        setError(error.message);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const timesheetData = {
        userId: form.userId,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        projectId: form.projectId,
        description: form.description,
        isAdminWork: form.isAdminWork,
        isBreak: form.isBreak,
        projectInputType: form.projectInputType,
      };

      await timesheetService.update(id, timesheetData);
      navigate(`/timesheets/view/${id}`);
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProjectChange = (event) => {
    const projectId = event.target.value;
    const project = projects.find((p) => p._id === projectId);
    setForm((prev) => ({
      ...prev,
      projectId,
      projectInputType: project?.inputType || "manual",
    }));
  };

  const handleUserChange = (event) => {
    setForm((prev) => ({
      ...prev,
      userId: event.target.value,
    }));
  };

  const handleDateChange = (date) => {
    setForm((prev) => ({
      ...prev,
      date,
    }));
  };

  const handleTimeChange = (field) => (event) => {
    setForm((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleDescriptionChange = (event) => {
    setForm((prev) => ({
      ...prev,
      description: event.target.value,
    }));
  };

  const handleTypeChange = (event) => {
    const type = event.target.value;
    setForm((prev) => ({
      ...prev,
      isAdminWork: type === "admin",
      isBreak: type === "break",
      projectId: type !== "project" ? "" : prev.projectId,
    }));
  };

  return <div>{/* Render your form components here */}</div>;
};

export default EditTimesheet;
