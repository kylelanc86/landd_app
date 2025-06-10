const express = require("express");
const router = express.Router();
const CalendarEntry = require("../models/calendarEntry");
const auth = require("../middleware/auth");

// Get all calendar entries
router.get("/", auth, async (req, res) => {
  try {
    const entries = await CalendarEntry.find();
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new calendar entry
router.post("/", auth, async (req, res) => {
  try {
    const entry = new CalendarEntry({
      title: req.body.title,
      start: req.body.start,
      end: req.body.end,
      allDay: req.body.allDay,
      projectId: req.body.extendedProps.projectId,
      client: req.body.extendedProps.client,
      userId: req.body.userId,
      userName: req.body.userName,
    });

    const newEntry = await entry.save();
    res.status(201).json(newEntry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a calendar entry
router.put("/:id", auth, async (req, res) => {
  try {
    const entry = await CalendarEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: "Calendar entry not found" });
    }

    entry.title = req.body.title;
    entry.start = req.body.start;
    entry.end = req.body.end;
    entry.allDay = req.body.allDay;
    entry.projectId = req.body.extendedProps.projectId;
    entry.client = req.body.extendedProps.client;
    entry.userId = req.body.userId;
    entry.userName = req.body.userName;

    const updatedEntry = await entry.save();
    res.json(updatedEntry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a calendar entry
router.delete("/:id", auth, async (req, res) => {
  try {
    const entry = await CalendarEntry.findById(req.params.id);
    if (!entry) {
      return res.status(404).json({ message: "Calendar entry not found" });
    }

    await entry.deleteOne();
    res.json({ message: "Calendar entry deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 