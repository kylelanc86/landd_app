import React, { useEffect, useState } from "react";
import api from "../../services/api";
import timesheetService from "../../services/timesheet";

const NewEntry = () => {
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
  const [editingEntry, setEditingEntry] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsResponse, usersResponse] = await Promise.all([
          api.get("/projects"),
          api.get("/users"),
        ]);
        setProjects(projectsResponse.data);
        setUsers(usersResponse.data);
      } catch (error) {
        setError(error.message);
      }
    };
    fetchData();
  }, []);

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

      if (editingEntry) {
        await timesheetService.update(editingEntry._id, timesheetData);
      } else {
        await timesheetService.create(timesheetData);
      }

      onSuccess();
      onClose();
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

export default NewEntry;
