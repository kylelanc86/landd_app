const express = require("express");
const { performance } = require("perf_hooks");
const router = express.Router();
const mongoose = require("mongoose");
const AsbestosRemovalJob = require("../models/AsbestosRemovalJob");
const Project = require("../models/Project");
const Shift = require("../models/Shift");
const Sample = require("../models/Sample");
const AsbestosClearance = require("../models/clearanceTemplates/asbestos/AsbestosClearance");
const auth = require("../middleware/auth");
const checkPermission = require("../middleware/checkPermission");

const escapeCsvCell = (value) => {
  if (value === null || value === undefined) return "";
  return `"${String(value).replace(/"/g, '""')}"`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU");
};

const formatPersonName = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const { firstName, lastName } = value;
    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(" ").trim();
    }
  }
  return "";
};

const formatTime = (timeStr) => {
  if (!timeStr) return "";
  return timeStr.split(":").slice(0, 2).join(":");
};

// Get all asbestos removal jobs with filtering and pagination
router.get("/", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const routeStart = performance.now();
    const { page = 1, limit = 1000, status, excludeStatus, projectId, sortBy = "createdAt", sortOrder = "desc", minimal } = req.query;

    const filter = {};
    
    // Support excluding statuses (e.g., excludeStatus=completed,cancelled)
    // This takes precedence if both status and excludeStatus are provided
    if (excludeStatus) {
      const excludedStatuses = excludeStatus.includes(',') 
        ? excludeStatus.split(',').map(s => s.trim())
        : [excludeStatus];
      filter.status = { $nin: excludedStatuses };
    } else if (status) {
      // Support single status or comma-separated statuses
      if (status.includes(',')) {
        filter.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        filter.status = status;
      }
    }
    
    if (projectId) {
      filter.projectId = projectId;
    }

    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === "desc" ? -1 : 1;

    const metrics = {
      filter,
      sortBy,
      minimal: minimal === "true" || minimal === true,
      timings: {},
    };

    // If minimal=true, only fetch fields needed for table display
    if (minimal === "true" || minimal === true) {
      const queryStart = performance.now();
      const jobs = await AsbestosRemovalJob.find(filter)
        .select(
          "_id projectId projectName client asbestosRemovalist status airMonitoring clearance jobType"
        )
        .populate({
          path: "projectId",
          select: "projectID name",
        })
        .sort(sortOptions)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .lean()
        .exec();
      metrics.timings.find = `${(performance.now() - queryStart).toFixed(2)}ms`;

      const countStart = performance.now();
      const count = await AsbestosRemovalJob.countDocuments(filter);
      metrics.timings.count = `${(performance.now() - countStart).toFixed(2)}ms`;

      metrics.timings.total = `${(performance.now() - routeStart).toFixed(
        2
      )}ms`;

      console.log("[AsbestosRemovalJobs] Minimal fetch metrics:", {
        ...metrics,
        count,
        resultSize: jobs.length,
      });

      return res.json({
        jobs,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
        totalCount: count,
      });
    }

    // Full data for detailed views
    const jobs = await AsbestosRemovalJob.find(filter)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName")
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await AsbestosRemovalJob.countDocuments(filter);

    metrics.timings.total = `${(performance.now() - routeStart).toFixed(2)}ms`;
    console.log("[AsbestosRemovalJobs] Full fetch metrics:", {
      ...metrics,
      resultSize: jobs.length,
      count,
    });

    res.json({
      jobs,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching asbestos removal jobs:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Get archived data as flat list (shifts and clearances from archived jobs + legacy clearances)
router.get(
  "/archived-data",
  auth,
  checkPermission("asbestos.view"),
  async (req, res) => {
    try {
      const { projectId: filterProjectId } = req.query;

      const archivedQuery = { status: "archived" };
      if (filterProjectId) {
        archivedQuery.projectId = filterProjectId;
      }

      const archivedJobs = await AsbestosRemovalJob.find(archivedQuery)
        .select("_id projectId projectName")
        .populate({
          path: "projectId",
          select: "projectID name client",
          populate: { path: "client", select: "name" },
        })
        .lean();

      const archivedJobIds = archivedJobs.map((j) => j._id.toString());
      const jobToProject = new Map();
      archivedJobs.forEach((job) => {
        const pid = job.projectId?._id?.toString() || job.projectId?.toString();
        if (pid) jobToProject.set(job._id.toString(), job.projectId);
      });

      const items = [];

      if (archivedJobIds.length > 0) {
        const shifts = await Shift.find({
          job: { $in: archivedJobIds },
          $or: [
            { jobModel: "AsbestosRemovalJob" },
            { jobModel: { $exists: false } },
            { jobModel: null },
          ],
        })
          .select("_id job name date status")
          .lean();

        shifts.forEach((shift) => {
          const jobId = shift.job?.toString();
          const project = jobId ? jobToProject.get(jobId) : null;
          const clientName = project?.client && typeof project.client === "object" ? project.client.name : "—";
          items.push({
            _id: shift._id.toString(),
            reportType: "Air Monitoring Shift",
            date: shift.date,
            client: clientName || "—",
            LAA: "—",
            itemType: "shift",
            name: shift.name,
          });
        });
      }

      const clearancesFromArchived = await AsbestosClearance.find({
        asbestosRemovalJobId: { $in: archivedJobIds },
      })
        .select("_id projectId clearanceDate clearanceType status asbestosRemovalist LAA")
        .populate({
          path: "projectId",
          select: "projectID name client",
          populate: { path: "client", select: "name" },
        })
        .lean();

      const legacyClearanceQuery = {
        $or: [
          { asbestosRemovalJobId: null },
          { asbestosRemovalJobId: { $exists: false } },
        ],
      };
      if (filterProjectId) {
        legacyClearanceQuery.projectId = filterProjectId;
      }
      const legacyClearances = await AsbestosClearance.find(legacyClearanceQuery)
        .select("_id projectId clearanceDate clearanceType status asbestosRemovalist LAA")
        .populate({
          path: "projectId",
          select: "projectID name client",
          populate: { path: "client", select: "name" },
        })
        .lean();

      const allClearances = [...clearancesFromArchived, ...legacyClearances];
      allClearances.forEach((c) => {
        const clientName = c.projectId?.client && typeof c.projectId.client === "object" ? c.projectId.client.name : "—";
        items.push({
          _id: c._id.toString(),
          reportType: c.clearanceType || "Clearance",
          date: c.clearanceDate,
          client: clientName || "—",
          LAA: c.LAA || "—",
          itemType: "clearance",
        });
      });

      // Sort by date descending
      items.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

      res.json({ items });
    } catch (error) {
      console.error("Error fetching archived data:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Export archived shift as comprehensive CSV (project + job + shift + samples + analysis)
router.get(
  "/archived-data/shift/:shiftId/export-csv",
  auth,
  checkPermission("asbestos.view"),
  async (req, res) => {
    try {
      const { shiftId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(shiftId)) {
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      const shift = await Shift.findById(shiftId)
        .populate({
          path: "job",
          populate: {
            path: "projectId",
            populate: { path: "client", select: "name" },
          },
        })
        .populate("supervisor", "firstName lastName")
        .populate("defaultSampler", "firstName lastName")
        .lean();

      if (!shift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      const samples = await Sample.find({ shift: shiftId })
        .populate("collectedBy", "firstName lastName")
        .populate("sampler", "firstName lastName")
        .populate("analysedBy", "firstName lastName")
        .lean();

      const job = shift.job;
      const project = job?.projectId;
      const clientName = project?.client && typeof project.client === "object" ? project.client.name : "";

      const projectCols = [
        "Project ID",
        "Project Name",
        "Client",
        "Work Order",
        "Department",
        "Address",
        "Project Status",
      ];
      const jobCols = [
        "Job ID",
        "Job Name",
        "Asbestos Removalist",
        "Job Status",
        "Air Monitoring",
        "Clearance",
      ];
      const shiftCols = [
        "Shift Name",
        "Shift Date",
        "Start Time",
        "End Time",
        "Supervisor",
        "Default Sampler",
        "Shift Status",
        "Description of Works",
        "Analysed By",
        "Analysis Date",
        "Report Approved By",
        "Report Issue Date",
        "Notes",
      ];
      const sampleCols = [
        "L&D Sample Ref",
        "Sample Location",
        "Sample Type",
        "Time On",
        "Time Off",
        "Ave Flow (L/min)",
        "Initial Flow",
        "Final Flow",
        "Pump No",
        "Flowmeter",
        "Filter Size",
        "Field Count",
        "Fibre Count",
        "Reported Conc. (fibres/ml)",
        "Microscope",
        "Test Slide",
        "Edges Distribution",
        "Background Dust",
        "Uncountable Due to Dust",
        "Sampler",
        "Analyst",
        "Sample Status",
      ];

      const headers = [...projectCols, ...jobCols, ...shiftCols, ...sampleCols];

      const projectVals = [
        project?.projectID || "",
        project?.name || "",
        clientName || "",
        project?.workOrder || "",
        project?.department || "",
        project?.address || "",
        project?.status || "",
      ];
      const jobVals = [
        job?._id?.toString() || "",
        job?.projectName || "",
        job?.asbestosRemovalist || "",
        job?.status || "",
        job?.airMonitoring ? "Yes" : "No",
        job?.clearance ? "Yes" : "No",
      ];
      const shiftVals = [
        shift?.name || "",
        formatDate(shift?.date) || "",
        formatTime(shift?.startTime) || "",
        formatTime(shift?.endTime) || "",
        formatPersonName(shift?.supervisor) || "",
        formatPersonName(shift?.defaultSampler) || "",
        shift?.status || "",
        shift?.descriptionOfWorks || "",
        shift?.analysedBy || "",
        formatDate(shift?.analysisDate) || "",
        shift?.reportApprovedBy || "",
        formatDate(shift?.reportIssueDate) || "",
        shift?.notes || "",
      ];

      const csvRows = [headers.map(escapeCsvCell).join(",")];

      samples.forEach((sample) => {
        let location = sample.location || "N/A";
        if (sample.type) {
          if (sample.type.toLowerCase() === "exposure") {
            location = `${location} (E)`;
          } else if (sample.type.toLowerCase() === "clearance") {
            location = `${location} (C)`;
          }
        }

        let reportedConc = "";
        if (sample.analysis) {
          if (
            sample.analysis.uncountableDueToDust === true ||
            sample.analysis.uncountableDueToDust === "true"
          ) {
            reportedConc = "UDD";
          } else if (
            sample.analysis.edgesDistribution === "fail" ||
            sample.analysis.backgroundDust === "fail"
          ) {
            reportedConc = "Uncountable";
          } else if (sample.analysis.reportedConcentration) {
            const conc = sample.analysis.reportedConcentration;
            if (typeof conc === "string" && conc.startsWith("<")) {
              reportedConc = conc;
            } else if (typeof conc === "number") {
              reportedConc = conc.toFixed(2);
            } else {
              reportedConc = String(conc);
            }
          }
        }

        const sampleVals = [
          sample.fullSampleID || sample.sampleNumber || "",
          location,
          sample.type || "",
          formatTime(sample.startTime) || "",
          formatTime(sample.endTime) || "",
          sample.averageFlowrate != null ? sample.averageFlowrate.toFixed(1) : "",
          sample.initialFlowrate != null ? sample.initialFlowrate.toFixed(1) : "",
          sample.finalFlowrate != null ? sample.finalFlowrate.toFixed(1) : "",
          sample.pumpNo || "",
          sample.flowmeter || "",
          sample.filterSize || "",
          sample.analysis?.fieldsCounted !== undefined && sample.analysis?.fieldsCounted !== null
            ? sample.analysis.fieldsCounted
            : "",
          sample.analysis?.fibresCounted !== undefined && sample.analysis?.fibresCounted !== null
            ? sample.analysis.fibresCounted
            : "",
          reportedConc,
          sample.analysis?.microscope || "",
          sample.analysis?.testSlide || "",
          sample.analysis?.edgesDistribution || "",
          sample.analysis?.backgroundDust || "",
          sample.analysis?.uncountableDueToDust ? "Yes" : "No",
          formatPersonName(sample.collectedBy || sample.sampler) || "",
          formatPersonName(sample.analysedBy || sample.analysis?.analysedBy) || "",
          sample.status || "",
        ];

        const row = [...projectVals, ...jobVals, ...shiftVals, ...sampleVals];
        csvRows.push(row.map(escapeCsvCell).join(","));
      });

      if (samples.length === 0) {
        const emptySampleVals = sampleCols.map(() => "");
        csvRows.push([...projectVals, ...jobVals, ...shiftVals, ...emptySampleVals].map(escapeCsvCell).join(","));
      }

      const csvContent = csvRows.join("\r\n");
      const filename = `${project?.projectID || "shift"}_${shift?.name || "shift"}_${formatDate(shift?.date).replace(/\//g, "")}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send("\uFEFF" + csvContent);
    } catch (error) {
      console.error("Error exporting shift CSV:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Export archived clearance as comprehensive CSV (project + job + clearance + items)
router.get(
  "/archived-data/clearance/:clearanceId/export-csv",
  auth,
  checkPermission("asbestos.view"),
  async (req, res) => {
    try {
      const { clearanceId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(clearanceId)) {
        return res.status(400).json({ message: "Invalid clearance ID" });
      }

      const clearance = await AsbestosClearance.findById(clearanceId)
        .populate({
          path: "projectId",
          populate: { path: "client", select: "name" },
        })
        .populate("asbestosRemovalJobId")
        .lean();

      if (!clearance) {
        return res.status(404).json({ message: "Clearance not found" });
      }

      const project = clearance.projectId;
      const job = clearance.asbestosRemovalJobId;
      const clientName = project?.client && typeof project.client === "object" ? project.client.name : "";
      const items = clearance.items || [];

      const projectCols = [
        "Project ID",
        "Project Name",
        "Client",
        "Work Order",
        "Department",
        "Address",
      ];
      const jobCols = [
        "Job ID",
        "Asbestos Removalist",
        "Job Status",
      ];
      const clearanceCols = [
        "Clearance Date",
        "Clearance Type",
        "Jurisdiction",
        "LAA",
        "Asbestos Removalist",
        "Inspection Time",
        "Status",
        "Secondary Header",
        "Air Monitoring",
        "Site Plan",
        "Notes",
        "Vehicle/Equipment Description",
        "Report Approved By",
        "Report Issue Date",
      ];
      const itemCols = [
        "Item Location",
        "Level/Floor",
        "Room/Area",
        "Material Description",
        "Asbestos Type",
        "Item Notes",
      ];

      const headers = [...projectCols, ...jobCols, ...clearanceCols, ...itemCols];

      const projectVals = [
        project?.projectID || "",
        project?.name || "",
        clientName || "",
        project?.workOrder || "",
        project?.department || "",
        project?.address || "",
      ];
      const jobVals = [
        job?._id?.toString() || "",
        typeof job === "object" ? (job?.asbestosRemovalist || "") : "",
        typeof job === "object" ? (job?.status || "") : "",
      ];
      const clearanceVals = [
        formatDate(clearance?.clearanceDate) || "",
        clearance?.clearanceType || "",
        clearance?.jurisdiction || "",
        clearance?.LAA || "",
        clearance?.asbestosRemovalist || "",
        clearance?.inspectionTime || "",
        clearance?.status || "",
        clearance?.secondaryHeader || "",
        clearance?.airMonitoring ? "Yes" : "No",
        clearance?.sitePlan ? "Yes" : "No",
        clearance?.notes || "",
        clearance?.vehicleEquipmentDescription || "",
        clearance?.reportApprovedBy || "",
        formatDate(clearance?.reportIssueDate) || "",
      ];

      const csvRows = [headers.map(escapeCsvCell).join(",")];

      items.forEach((item) => {
        const itemVals = [
          item?.locationDescription || "",
          item?.levelFloor || "",
          item?.roomArea || "",
          item?.materialDescription || "",
          item?.asbestosType || "",
          item?.notes || "",
        ];
        const row = [...projectVals, ...jobVals, ...clearanceVals, ...itemVals];
        csvRows.push(row.map(escapeCsvCell).join(","));
      });

      if (items.length === 0) {
        const emptyItemVals = itemCols.map(() => "");
        csvRows.push([...projectVals, ...jobVals, ...clearanceVals, ...emptyItemVals].map(escapeCsvCell).join(","));
      }

      const csvContent = csvRows.join("\r\n");
      const filename = `${project?.projectID || "clearance"}_clearance_${formatDate(clearance?.clearanceDate).replace(/\//g, "")}.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send("\uFEFF" + csvContent);
    } catch (error) {
      console.error("Error exporting clearance CSV:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get asbestos removal job with related data by ID
router.get(
  "/:id/details",
  auth,
  checkPermission("asbestos.view"),
  async (req, res) => {
    const routeStart = performance.now();
    try {
      // Only select fields needed for the details page
      const job = await AsbestosRemovalJob.findById(req.params.id)
        .select("_id projectId projectName asbestosRemovalist status createdAt updatedAt")
        .populate({
          path: "projectId",
          select: "projectID name client",
          populate: {
            path: "client",
            select: "name",
          },
        })
        .lean();

      if (!job) {
        return res
          .status(404)
          .json({ message: "Asbestos removal job not found" });
      }

      const projectId =
        job.projectId?._id?.toString() ||
        (typeof job.projectId === "string" ? job.projectId : null);

      const metrics = {
        timings: {},
        counts: {},
      };

      if (!projectId) {
        metrics.timings.total = `${(performance.now() - routeStart).toFixed(
          2
        )}ms`;
        console.log("[AsbestosRemovalJobs] Details fetch metrics:", metrics);
        return res.json({
          job,
          shifts: [],
          clearances: [],
          sampleNumbers: [],
        });
      }

      // Check if clearances should be excluded (for lazy loading optimization)
      const excludeClearances = req.query.excludeClearances === "true";

      // Only fetch clearances if not excluded (for lazy loading)
      let clearances = [];
      if (!excludeClearances) {
        const clearancesStart = performance.now();
        // Fetch clearances for this asbestos removal job only (filter by asbestosRemovalJobId)
        clearances = await AsbestosClearance.find({
          asbestosRemovalJobId: job._id,
        })
          .select("_id projectId clearanceDate clearanceType status inspectionTime asbestosRemovalist LAA jurisdiction secondaryHeader vehicleEquipmentDescription notes useComplexTemplate jobSpecificExclusions reportApprovedBy reportIssueDate reportViewedAt authorisationRequestedBy")
          .populate({
            path: "projectId",
            select: "projectID name",
          })
          .lean();
        metrics.timings.clearances = `${(
          performance.now() - clearancesStart
        ).toFixed(2)}ms`;
        metrics.counts.clearances = clearances.length;
      } else {
        metrics.timings.clearances = "0.00ms (excluded)";
        metrics.counts.clearances = 0;
      }

      const jobIdStr = job._id.toString();

      const shiftsStart = performance.now();
      // Fetch shifts for this asbestos removal job only
      const shiftDocs = await Shift.find({
        job: jobIdStr,
        $or: [
          { jobModel: "AsbestosRemovalJob" },
          { jobModel: { $exists: false } },
          { jobModel: null },
        ],
      })
        .select("_id job date status jobModel reportApprovedBy reportIssueDate reportViewedAt authorisationRequestedBy")
        .lean();
      metrics.timings.shifts = `${(
        performance.now() - shiftsStart
      ).toFixed(2)}ms`;
      metrics.counts.shifts = shiftDocs.length;

      const decoratedShifts = shiftDocs.map((shift) => {
        const jobKey = shift.job?.toString();
        return {
          ...shift,
          jobId: jobKey,
          jobName: job.projectName || "Asbestos Removal Job",
        };
      });

      const shiftIds = decoratedShifts.map((shift) => shift._id);

      const samplesStart = performance.now();
      const sampleDocs = shiftIds.length
        ? await Sample.find({ shift: { $in: shiftIds } })
            .select("shift fullSampleID")
            .lean()
        : [];
      metrics.timings.samples = `${(
        performance.now() - samplesStart
      ).toFixed(2)}ms`;
      metrics.counts.samples = sampleDocs.length;

      const sampleMap = new Map();
      sampleDocs.forEach((sample) => {
        const shiftKey = sample.shift?.toString();
        if (!shiftKey) return;

        const match = sample.fullSampleID?.match(/AM(\d+)$/);
        if (!match) return;

        if (!sampleMap.has(shiftKey)) {
          sampleMap.set(shiftKey, []);
        }
        sampleMap.get(shiftKey).push(match[1]);
      });

      const sampleNumbers = Array.from(sampleMap.entries()).map(
        ([shiftId, numbers]) => ({
          shiftId,
          sampleNumbers: numbers
            .map((value) => parseInt(value, 10))
            .filter((n) => !Number.isNaN(n))
            .sort((a, b) => a - b)
            .map((value) => value.toString()),
        })
      );

      metrics.timings.total = `${(performance.now() - routeStart).toFixed(
        2
      )}ms`;

      console.log("[AsbestosRemovalJobs] Details fetch metrics:", {
        jobId: job._id,
        ...metrics,
      });

      res.json({
        job,
        shifts: decoratedShifts,
        clearances,
        sampleNumbers,
      });
    } catch (error) {
      console.error("Error fetching asbestos removal job details:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get clearances for an asbestos removal job (lazy loading endpoint)
router.get(
  "/:id/clearances",
  auth,
  checkPermission("asbestos.view"),
  async (req, res) => {
    const routeStart = performance.now();
    try {
      const job = await AsbestosRemovalJob.findById(req.params.id)
        .select("projectId")
        .lean();

      if (!job) {
        return res.status(404).json({ message: "Asbestos removal job not found" });
      }

      const clearancesStart = performance.now();
      // Fetch clearances for this asbestos removal job only (filter by asbestosRemovalJobId)
      const clearances = await AsbestosClearance.find({
        asbestosRemovalJobId: req.params.id,
      })
        .select("_id projectId clearanceDate clearanceType status inspectionTime asbestosRemovalist LAA jurisdiction secondaryHeader vehicleEquipmentDescription notes useComplexTemplate jobSpecificExclusions reportApprovedBy reportIssueDate")
        .populate({
          path: "projectId",
          select: "projectID name",
        })
        .lean();
      
      const queryTime = performance.now() - clearancesStart;
      console.log(`[AsbestosRemovalJobs] Fetched ${clearances.length} clearances in ${queryTime.toFixed(2)}ms`);

      res.json({ clearances });
    } catch (error) {
      console.error("Error fetching clearances:", error);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// Get asbestos removal job by ID
router.get("/:id", auth, checkPermission("asbestos.view"), async (req, res) => {
  try {
    const job = await AsbestosRemovalJob.findById(req.params.id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    res.json(job);
  } catch (error) {
    console.error("Error fetching asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Create new asbestos removal job
router.post("/", auth, checkPermission("asbestos.create"), async (req, res) => {
  try {
    const { projectId, projectName, client, asbestosRemovalist, airMonitoring, clearance } = req.body;

    const job = new AsbestosRemovalJob({
      projectId,
      projectName,
      client,
      asbestosRemovalist,
      airMonitoring,
      clearance,
      createdBy: req.user.id,
    });

    const savedJob = await job.save();
    
    // Update the project's reports_present field to true
    if (savedJob.projectId) {
      try {
        const projectId = savedJob.projectId._id || savedJob.projectId;
        await Project.findByIdAndUpdate(
          projectId,
          { reports_present: true }
        );
        console.log(`Updated project ${projectId} reports_present to true due to asbestos removal job creation`);
      } catch (error) {
        console.error("Error updating project reports_present field:", error);
        // Don't fail the main request if project update fails
      }
    }
    
    const populatedJob = await AsbestosRemovalJob.findById(savedJob._id)
      .populate("projectId", "projectID name client")
      .populate("createdBy", "firstName lastName");

    res.status(201).json(populatedJob);
  } catch (error) {
    console.error("Error creating asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update asbestos removal job
router.put("/:id", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { projectId, projectName, client, asbestosRemovalist, airMonitoring, clearance, status } = req.body;

    const job = await AsbestosRemovalJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    const previousStatus = job.status;

    // If status is being set to "completed", validate that all shifts and clearances are authorised
    if (status === "completed" && previousStatus !== "completed") {
      const Shift = require('../models/Shift');
      const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
      
      // Check all shifts for this job are complete AND authorised
      const shifts = await Shift.find({ 
        job: job._id,
        $or: [
          { jobModel: { $exists: false } },
          { jobModel: null },
          { jobModel: "AsbestosRemovalJob" },
        ]
      }).select("status reportApprovedBy").lean();
      
      if (shifts.length > 0) {
        const unauthorisedShifts = shifts.filter(
          (shift) => shift.status !== "shift_complete" || !shift.reportApprovedBy
        );
        
        if (unauthorisedShifts.length > 0) {
          return res.status(400).json({
            message: `Cannot complete job: ${unauthorisedShifts.length} shift(s) are not complete or not authorised. All shifts must be complete and authorised before completing the job.`
          });
        }
      }
      
      // Check all clearances for this project are complete AND authorised
      const projectIdToCheck = job.projectId?._id?.toString() || job.projectId?.toString() || job.projectId;
      if (projectIdToCheck) {
        const clearances = await AsbestosClearance.find({ projectId: projectIdToCheck })
          .select("status reportApprovedBy").lean();
        
        if (clearances.length > 0) {
          const unauthorisedClearances = clearances.filter(
            (clearance) => clearance.status !== "complete" || !clearance.reportApprovedBy
          );
          
          if (unauthorisedClearances.length > 0) {
            return res.status(400).json({
              message: `Cannot complete job: ${unauthorisedClearances.length} clearance(s) are not complete or not authorised. All clearances must be complete and authorised before completing the job.`
            });
          }
        }
      }
    }

    // Update fields
    if (projectId !== undefined) job.projectId = projectId;
    if (projectName !== undefined) job.projectName = projectName;
    if (client !== undefined) job.client = client;
    if (asbestosRemovalist !== undefined) job.asbestosRemovalist = asbestosRemovalist;
    if (airMonitoring !== undefined) job.airMonitoring = airMonitoring;
    if (clearance !== undefined) job.clearance = clearance;
    if (status !== undefined) job.status = status;
    job.updatedBy = req.user.id;

    const updatedJob = await job.save();

    // If job status is being updated to "completed", also update associated shifts
    if (status === "completed" && previousStatus !== "completed") {
      try {
        const Shift = require('../models/Shift');
        
        // Update all shifts associated with this job to "complete" status
        const shiftUpdateResult = await Shift.updateMany(
          { job: job._id },
          { 
            status: "complete",
            updatedBy: req.user.id
          }
        );
        
        console.log(`Updated ${shiftUpdateResult.modifiedCount} shifts to complete status for job ${job._id}`);
      } catch (shiftError) {
        console.error("Error updating shifts when completing asbestos removal job:", shiftError);
        // Don't fail the main request if shift update fails
      }
    }
    
    const populatedJob = await AsbestosRemovalJob.findById(updatedJob._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedJob);
  } catch (error) {
    console.error("Error updating asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update asbestos removal job status
router.patch("/:id/status", auth, checkPermission("asbestos.edit"), async (req, res) => {
  try {
    const { status } = req.body;

    const job = await AsbestosRemovalJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    const previousStatus = job.status;
    
    // If status is being set to "completed", validate that all shifts and clearances are authorised
    if (status === "completed" && previousStatus !== "completed") {
      const Shift = require('../models/Shift');
      const AsbestosClearance = require('../models/clearanceTemplates/asbestos/AsbestosClearance');
      
      // Check all shifts for this job are complete AND authorised
      const shifts = await Shift.find({ 
        job: job._id,
        $or: [
          { jobModel: { $exists: false } },
          { jobModel: null },
          { jobModel: "AsbestosRemovalJob" },
        ]
      }).select("status reportApprovedBy").lean();
      
      if (shifts.length > 0) {
        const unauthorisedShifts = shifts.filter(
          (shift) => shift.status !== "shift_complete" || !shift.reportApprovedBy
        );
        
        if (unauthorisedShifts.length > 0) {
          return res.status(400).json({
            message: `Cannot complete job: ${unauthorisedShifts.length} shift(s) are not complete or not authorised. All shifts must be complete and authorised before completing the job.`
          });
        }
      }
      
      // Check all clearances for this project are complete AND authorised
      const projectIdToCheck = job.projectId?._id?.toString() || job.projectId?.toString() || job.projectId;
      if (projectIdToCheck) {
        const clearances = await AsbestosClearance.find({ projectId: projectIdToCheck })
          .select("status reportApprovedBy").lean();
        
        if (clearances.length > 0) {
          const unauthorisedClearances = clearances.filter(
            (clearance) => clearance.status !== "complete" || !clearance.reportApprovedBy
          );
          
          if (unauthorisedClearances.length > 0) {
            return res.status(400).json({
              message: `Cannot complete job: ${unauthorisedClearances.length} clearance(s) are not complete or not authorised. All clearances must be complete and authorised before completing the job.`
            });
          }
        }
      }
    }
    
    job.status = status;
    job.updatedBy = req.user.id;

    const updatedJob = await job.save();

    // If job status is being updated to "completed", also update associated shifts
    if (status === "completed" && previousStatus !== "completed") {
      try {
        const Shift = require('../models/Shift');
        
        // Update all shifts associated with this job to "complete" status
        const shiftUpdateResult = await Shift.updateMany(
          { job: job._id },
          { 
            status: "complete",
            updatedBy: req.user.id
          }
        );
        
        console.log(`Updated ${shiftUpdateResult.modifiedCount} shifts to complete status for job ${job._id}`);
      } catch (shiftError) {
        console.error("Error updating shifts when completing asbestos removal job:", shiftError);
        // Don't fail the main request if shift update fails
      }
    }
    
    const populatedJob = await AsbestosRemovalJob.findById(updatedJob._id)
      .populate({
        path: "projectId",
        select: "projectID name client",
        populate: {
          path: "client",
          select: "name contact1Name contact1Email invoiceEmail contact2Email"
        }
      })
      .populate("createdBy", "firstName lastName")
      .populate("updatedBy", "firstName lastName");

    res.json(populatedJob);
  } catch (error) {
    console.error("Error updating asbestos removal job status:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete asbestos removal job
router.delete("/:id", auth, checkPermission("asbestos.delete"), async (req, res) => {
  try {
    const job = await AsbestosRemovalJob.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Asbestos removal job not found" });
    }

    // Soft-delete: set status to archived so data remains accessible
    job.status = "archived";
    job.updatedBy = req.user?.id;
    await job.save();

    res.json({ message: "Asbestos removal job archived successfully" });
  } catch (error) {
    console.error("Error deleting asbestos removal job:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router; 