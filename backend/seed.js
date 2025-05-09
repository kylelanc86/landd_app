const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Client = require('./models/Client');
const Project = require('./models/Project');
const Job = require('./models/Job');
const Sample = require('./models/Sample');
const Shift = require('./models/Shift');
const Invoice = require('./models/Invoice');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Sample data
const users = [
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin'
  },
  {
    firstName: 'Manager',
    lastName: 'User',
    email: 'manager@example.com',
    password: 'manager123',
    role: 'manager'
  }
];

const clients = [
  {
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
    name: "Global Industries Ltd",
    invoiceEmail: "accounts@globalind.com",
    address: "789 Enterprise Ave, Brisbane",
    contact1Name: "David Lee",
    contact1Number: "0400 000 003",
    contact1Email: "david@globalind.com",
    contact2Name: "Lisa Chen",
    contact2Number: "0400 100 003",
    contact2Email: "lisa@globalind.com",
  }
];

// Function to seed the database
const seedDatabase = async () => {
  try {
    // Clear existing data
    await User.deleteMany({});
    await Client.deleteMany({});
    await Project.deleteMany({});
    await Job.deleteMany({});
    await Sample.deleteMany({});
    await Shift.deleteMany({});
    await Invoice.deleteMany({});

    console.log('Cleared existing data');

    // Create users
    const createdUsers = await User.create(users);
    console.log('Created users');

    // Create clients
    const createdClients = await Client.create(clients);
    console.log('Created clients');

    // Create projects
    const projects = [
      {
        name: "Office Renovation",
        client: createdClients[0]._id,
        type: "air_quality",
        status: "in_progress",
        address: "Sydney CBD",
        startDate: new Date("2024-01-15"),
        endDate: new Date("2024-03-15"),
        description: "Complete office renovation including asbestos removal",
        projectManager: createdUsers[0]._id
      },
      {
        name: "Warehouse Assessment",
        client: createdClients[0]._id,
        type: "air_quality",
        status: "completed",
        address: "Sydney West",
        startDate: new Date("2023-11-01"),
        endDate: new Date("2023-12-15"),
        description: "Asbestos assessment for warehouse facility",
        projectManager: createdUsers[1]._id
      },
      {
        name: "Tech Campus Air Quality",
        client: createdClients[1]._id,
        type: "air_quality",
        status: "in_progress",
        address: "Melbourne",
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-04-30"),
        description: "Air quality monitoring for new tech campus",
        projectManager: createdUsers[0]._id
      },
      {
        name: "Factory Compliance",
        client: createdClients[2]._id,
        type: "air_quality",
        status: "pending",
        address: "Brisbane",
        startDate: new Date("2024-03-01"),
        endDate: new Date("2024-05-31"),
        description: "Factory compliance assessment and monitoring",
        projectManager: createdUsers[1]._id
      }
    ];

    const createdProjects = await Project.create(projects);
    console.log('Created projects');

    // Create jobs
    const jobs = [
      {
        name: "Level 1 Asbestos Removal",
        project: createdProjects[0]._id,
        status: "in_progress",
        startDate: new Date("2024-01-20"),
        endDate: new Date("2024-01-25"),
        description: "Asbestos removal in Level 1 office space",
        location: "Level 1, 123 Business Rd",
        assignedTo: createdUsers[0]._id
      },
      {
        name: "Level 2 Air Quality Monitoring",
        project: createdProjects[0]._id,
        status: "pending",
        startDate: new Date("2024-02-01"),
        endDate: new Date("2024-02-05"),
        description: "Air quality monitoring during renovation",
        location: "Level 2, 123 Business Rd",
        assignedTo: createdUsers[1]._id
      },
      {
        name: "Building A Monitoring",
        project: createdProjects[2]._id,
        status: "in_progress",
        startDate: new Date("2024-02-15"),
        endDate: new Date("2024-02-20"),
        description: "Air quality monitoring in Building A",
        location: "Building A, Tech Campus",
        assignedTo: createdUsers[0]._id
      }
    ];

    const createdJobs = await Job.create(jobs);
    console.log('Created jobs');

    // Create shifts
    const shifts = [
      {
        job: createdJobs[0]._id,
        name: "Morning Shift",
        date: new Date("2024-01-20"),
        startTime: "08:00",
        endTime: "16:00",
        supervisor: createdUsers[0]._id,
        status: "completed",
        notes: "Initial asbestos removal completed"
      },
      {
        job: createdJobs[0]._id,
        name: "Afternoon Shift",
        date: new Date("2024-01-20"),
        startTime: "16:00",
        endTime: "00:00",
        supervisor: createdUsers[1]._id,
        status: "in_progress",
        notes: "Continuation of removal work"
      },
      {
        job: createdJobs[2]._id,
        name: "Day Shift",
        date: new Date("2024-02-15"),
        startTime: "08:00",
        endTime: "16:00",
        supervisor: createdUsers[0]._id,
        status: "in_progress",
        notes: "Initial air quality monitoring"
      }
    ];

    const createdShifts = await Shift.create(shifts);
    console.log('Created shifts');

    // Create samples
    const samples = [
      {
        shift: createdShifts[0]._id,
        sampleNumber: "AM-001",
        type: "personal",
        location: "Level 1, Office A",
        startTime: "09:00",
        endTime: "11:00",
        flowRate: 2.0,
        status: "at_lab",
        notes: "Personal sample for worker in Office A",
        collectedBy: createdUsers[0]._id
      },
      {
        shift: createdShifts[0]._id,
        sampleNumber: "AM-002",
        type: "area",
        location: "Level 1, Corridor",
        startTime: "09:00",
        endTime: "11:00",
        flowRate: 2.0,
        status: "at_lab",
        notes: "Area sample in main corridor",
        collectedBy: createdUsers[0]._id
      },
      {
        shift: createdShifts[1]._id,
        sampleNumber: "AM-003",
        type: "personal",
        location: "Level 1, Office B",
        startTime: "16:00",
        endTime: "18:00",
        flowRate: 2.0,
        status: "in_progress",
        notes: "Personal sample for worker in Office B",
        collectedBy: createdUsers[1]._id
      },
      {
        shift: createdShifts[2]._id,
        sampleNumber: "AM-004",
        type: "area",
        location: "Building A, Level 1",
        startTime: "09:00",
        endTime: "11:00",
        flowRate: 2.0,
        status: "in_progress",
        notes: "Area sample in Building A",
        collectedBy: createdUsers[0]._id
      }
    ];

    await Sample.create(samples);
    console.log('Created samples');

    // Create invoices
    const invoices = [
      {
        project: createdProjects[0]._id,
        client: createdClients[0]._id,
        amount: 25000,
        status: "pending",
        date: new Date("2024-02-01"),
        dueDate: new Date("2024-03-01"),
        description: "Office Renovation - Initial Assessment"
      },
      {
        project: createdProjects[1]._id,
        client: createdClients[0]._id,
        amount: 15000,
        status: "paid",
        date: new Date("2023-12-01"),
        dueDate: new Date("2024-01-01"),
        description: "Warehouse Assessment - Final Report"
      },
      {
        project: createdProjects[2]._id,
        client: createdClients[1]._id,
        amount: 35000,
        status: "pending",
        date: new Date("2024-02-15"),
        dueDate: new Date("2024-03-15"),
        description: "Tech Campus - Air Quality Monitoring Phase 1"
      },
      {
        project: createdProjects[3]._id,
        client: createdClients[2]._id,
        amount: 20000,
        status: "draft",
        date: new Date("2024-02-20"),
        dueDate: new Date("2024-03-20"),
        description: "Factory Compliance - Initial Assessment"
      }
    ];

    await Invoice.create(invoices);
    console.log('Created invoices');

    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase(); 