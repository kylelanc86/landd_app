// Mock data with linked relationships between clients, projects, jobs, shifts, and samples

export const clients = [
  {
    id: 2001,
    name: "Acme Corporation Pty Ltd",
    invoiceEmail: "accounts@acme.com",
    address: "123 Business Rd, Sydney",
    contact1Name: "John Smith",
    contact1Number: "0400 000 001",
    contact1Email: "john@acme.com",
    contact2Name: "Sarah Johnson",
    contact2Number: "0400 100 001",
    contact2Email: "sarah@acme.com",
  },
  {
    id: 2002,
    name: "TechSolutions Inc",
    invoiceEmail: "finance@techsolutions.com",
    address: "456 Innovation St, Melbourne",
    contact1Name: "Michael Brown",
    contact1Number: "0400 000 002",
    contact1Email: "michael@techsolutions.com",
    contact2Name: "Emma Wilson",
    contact2Number: "0400 100 002",
    contact2Email: "emma@techsolutions.com",
  },
  {
    id: 2003,
    name: "Global Industries Ltd",
    invoiceEmail: "accounts@globalind.com",
    address: "789 Enterprise Ave, Brisbane",
    contact1Name: "David Lee",
    contact1Number: "0400 000 003",
    contact1Email: "david@globalind.com",
    contact2Name: "Lisa Chen",
    contact2Number: "0400 100 003",
    contact2Email: "lisa@globalind.com",
  },
];

export const projects = [
  {
    id: 1001,
    clientId: 2001,
    name: "Office Renovation",
    status: "In Progress",
    startDate: "2024-01-15",
    endDate: "2024-03-15",
    description: "Complete office renovation including asbestos removal",
    location: "Sydney CBD",
    projectManager: "John Smith",
  },
  {
    id: 1002,
    clientId: 2001,
    name: "Warehouse Assessment",
    status: "Completed",
    startDate: "2023-11-01",
    endDate: "2023-12-15",
    description: "Asbestos assessment for warehouse facility",
    location: "Sydney West",
    projectManager: "Sarah Johnson",
  },
  {
    id: 1003,
    clientId: 2002,
    name: "Tech Campus Air Quality",
    status: "In Progress",
    startDate: "2024-02-01",
    endDate: "2024-04-30",
    description: "Air quality monitoring for new tech campus",
    location: "Melbourne",
    projectManager: "Michael Brown",
  },
  {
    id: 1004,
    clientId: 2003,
    name: "Factory Compliance",
    status: "Pending",
    startDate: "2024-03-01",
    endDate: "2024-05-31",
    description: "Factory compliance assessment and monitoring",
    location: "Brisbane",
    projectManager: "David Lee",
  },
];

export const jobs = [
  {
    id: 4001,
    projectId: 1001,
    name: "Level 1 Asbestos Removal",
    status: "In Progress",
    startDate: "2024-01-20",
    endDate: "2024-01-25",
    description: "Asbestos removal in Level 1 office space",
    location: "Level 1, 123 Business Rd",
    supervisor: "John Smith",
  },
  {
    id: 4002,
    projectId: 1001,
    name: "Level 2 Air Quality Monitoring",
    status: "Pending",
    startDate: "2024-02-01",
    endDate: "2024-02-05",
    description: "Air quality monitoring during renovation",
    location: "Level 2, 123 Business Rd",
    supervisor: "Sarah Johnson",
  },
  {
    id: 4003,
    projectId: 1003,
    name: "Building A Monitoring",
    status: "In Progress",
    startDate: "2024-02-15",
    endDate: "2024-02-20",
    description: "Air quality monitoring in Building A",
    location: "Building A, Tech Campus",
    supervisor: "Michael Brown",
  },
];

export const shifts = [
  {
    id: 5001,
    jobId: 4001,
    name: "Morning Shift",
    date: "2024-01-20",
    startTime: "08:00",
    endTime: "16:00",
    supervisor: "John Smith",
    status: "Completed",
    notes: "Initial asbestos removal completed",
  },
  {
    id: 5002,
    jobId: 4001,
    name: "Afternoon Shift",
    date: "2024-01-20",
    startTime: "16:00",
    endTime: "00:00",
    supervisor: "Sarah Johnson",
    status: "In Progress",
    notes: "Continuation of removal work",
  },
  {
    id: 5003,
    jobId: 4003,
    name: "Day Shift",
    date: "2024-02-15",
    startTime: "08:00",
    endTime: "16:00",
    supervisor: "Michael Brown",
    status: "In Progress",
    notes: "Initial air quality monitoring",
  },
];

export const samples = [
  {
    id: 6001,
    shiftId: 5001,
    sampleNumber: "AM-001",
    type: "Personal",
    location: "Level 1, Office A",
    startTime: "09:00",
    endTime: "11:00",
    flowRate: 2.0,
    status: "At Lab",
    notes: "Personal sample for worker in Office A",
  },
  {
    id: 6002,
    shiftId: 5001,
    sampleNumber: "AM-002",
    type: "Area",
    location: "Level 1, Corridor",
    startTime: "09:00",
    endTime: "11:00",
    flowRate: 2.0,
    status: "At Lab",
    notes: "Area sample in main corridor",
  },
  {
    id: 6003,
    shiftId: 5002,
    sampleNumber: "AM-003",
    type: "Personal",
    location: "Level 1, Office B",
    startTime: "16:00",
    endTime: "18:00",
    flowRate: 2.0,
    status: "In Progress",
    notes: "Personal sample for worker in Office B",
  },
  {
    id: 6004,
    shiftId: 5003,
    sampleNumber: "AM-004",
    type: "Area",
    location: "Building A, Level 1",
    startTime: "09:00",
    endTime: "11:00",
    flowRate: 2.0,
    status: "In Progress",
    notes: "Area sample in Building A",
  },
];

export const invoices = [
  {
    id: 3001,
    projectId: 1001,
    clientId: 2001,
    amount: 25000,
    status: "Pending",
    date: "2024-02-01",
    dueDate: "2024-03-01",
    description: "Office Renovation - Initial Assessment",
  },
  {
    id: 3002,
    projectId: 1002,
    clientId: 2001,
    amount: 15000,
    status: "Paid",
    date: "2023-12-01",
    dueDate: "2024-01-01",
    description: "Warehouse Assessment - Final Report",
  },
  {
    id: 3003,
    projectId: 1003,
    clientId: 2002,
    amount: 35000,
    status: "Pending",
    date: "2024-02-15",
    dueDate: "2024-03-15",
    description: "Tech Campus - Air Quality Monitoring Phase 1",
  },
  {
    id: 3004,
    projectId: 1004,
    clientId: 2003,
    amount: 20000,
    status: "Draft",
    date: "2024-02-20",
    dueDate: "2024-03-20",
    description: "Factory Compliance - Initial Assessment",
  },
];

export const readings = [
  {
    id: 7001,
    sampleId: 6001,
    time: "09:00",
    parameter: "PM2.5",
    value: "12",
    unit: "μg/m³",
    status: "Normal",
    notes: "Initial reading",
  },
  {
    id: 7002,
    sampleId: 6001,
    time: "10:00",
    parameter: "PM2.5",
    value: "15",
    unit: "μg/m³",
    status: "Normal",
    notes: "Mid-shift reading",
  },
  {
    id: 7003,
    sampleId: 6001,
    time: "11:00",
    parameter: "PM2.5",
    value: "18",
    unit: "μg/m³",
    status: "Warning",
    notes: "Final reading - slightly elevated",
  },
  {
    id: 7004,
    sampleId: 6002,
    time: "09:00",
    parameter: "PM10",
    value: "25",
    unit: "μg/m³",
    status: "Normal",
    notes: "Initial reading",
  },
  {
    id: 7005,
    sampleId: 6002,
    time: "10:00",
    parameter: "PM10",
    value: "35",
    unit: "μg/m³",
    status: "Warning",
    notes: "Mid-shift reading - elevated",
  },
];

// Helper functions to get related data
export const getClientProjects = (clientId) => {
  return projects.filter(project => project.clientId === clientId);
};

export const getProjectJobs = (projectId) => {
  return jobs.filter(job => job.projectId === projectId);
};

export const getJobShifts = (jobId) => {
  return shifts.filter(shift => shift.jobId === jobId);
};

export const getShiftSamples = (shiftId) => {
  return samples.filter(sample => sample.shiftId === shiftId);
};

export const getProjectClient = (projectId) => {
  const project = projects.find(p => p.id === projectId);
  return project ? clients.find(c => c.id === project.clientId) : null;
};

export const getJobProject = (jobId) => {
  const job = jobs.find(j => j.id === jobId);
  return job ? projects.find(p => p.id === job.projectId) : null;
};

export const getShiftJob = (shiftId) => {
  const shift = shifts.find(s => s.id === shiftId);
  return shift ? jobs.find(j => j.id === shift.jobId) : null;
};

export const getSampleShift = (sampleId) => {
  const sample = samples.find(s => s.id === sampleId);
  return sample ? shifts.find(s => s.id === sample.shiftId) : null;
};

export const getProjectInvoices = (projectId) => {
  return invoices.filter(invoice => invoice.projectId === projectId);
};

export const getClientInvoices = (clientId) => {
  return invoices.filter(invoice => invoice.clientId === clientId);
};

export const getInvoiceProject = (invoiceId) => {
  const invoice = invoices.find(i => i.id === invoiceId);
  return invoice ? projects.find(p => p.id === invoice.projectId) : null;
};

export const getInvoiceClient = (invoiceId) => {
  const invoice = invoices.find(i => i.id === invoiceId);
  return invoice ? clients.find(c => c.id === invoice.clientId) : null;
};

export const getSampleReadings = (sampleId) => {
  return readings.filter(reading => reading.sampleId === sampleId);
}; 