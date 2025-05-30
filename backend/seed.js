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
  },
  {
    firstName: 'Employee',
    lastName: 'User',
    email: 'employee@example.com',
    password: 'employee',
    role: 'employee'
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

const projects = [
  {
    name: "Office Renovation",
    client: "Acme Corporation Pty Ltd",
    department: "Asbestos & HAZMAT",
    type: "air_quality",
    status: "Assigned",
    address: "123 Business Rd",
    startDate: new Date("2024-01-15"),
    endDate: new Date("2024-02-28"),
    description: "Air quality monitoring during office renovation",
    projectManager: "admin@example.com"
  },
  {
    name: "Factory Assessment",
    client: "TechSolutions Inc",
    department: "Occupational Hygiene",
    type: "air_quality",
    status: "In progress",
    address: "456 Industrial Ave",
    startDate: new Date("2024-02-01"),
    endDate: new Date("2024-03-15"),
    description: "Factory air quality assessment",
    projectManager: "manager@example.com"
  },
  {
    name: "Factory Compliance",
    client: "Global Industries Ltd",
    department: "Asbestos & HAZMAT",
    type: "air_quality",
    status: "Assigned",
    address: "Brisbane",
    startDate: new Date("2024-03-01"),
    endDate: new Date("2024-05-31"),
    description: "Factory compliance assessment and monitoring",
    projectManager: "manager@example.com"
  }
];

const jobs = [
  {
    name: "Level 1 Asbestos Removal",
    project: "Office Renovation",
    status: "Ongoing",
    startDate: new Date("2024-01-20"),
    endDate: new Date("2024-01-25"),
    description: "Asbestos removal in Level 1 office space",
    location: "Level 1, 123 Business Rd",
    assignedTo: "admin@example.com",
    asbestosRemovalist: "admin@example.com",
    jobID: "AMJ001"
  },
  {
    name: "Level 2 Air Quality Monitoring",
    project: "Office Renovation",
    status: "pending",
    startDate: new Date("2024-02-01"),
    endDate: new Date("2024-02-05"),
    description: "Air quality monitoring during renovation",
    location: "Level 2, 123 Business Rd",
    assignedTo: "manager@example.com",
    asbestosRemovalist: "manager@example.com",
    jobID: "AMJ002"
  },
  {
    name: "Building A Monitoring",
    project: "Factory Compliance",
    status: "Ongoing",
    startDate: new Date("2024-02-15"),
    endDate: new Date("2024-02-20"),
    description: "Air quality monitoring in Building A",
    location: "Building A, Tech Campus",
    assignedTo: "admin@example.com",
    asbestosRemovalist: "admin@example.com",
    jobID: "AMJ003"
  }
];

// Function to seed the database
const seedDatabase = async () => {
  try {
    // Create users if they don't exist
    for (const userData of users) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        await User.create(userData);
        console.log(`Created user: ${userData.email}`);
      } else {
        console.log(`User already exists: ${userData.email}`);
      }
    }

    // Create clients if they don't exist
    for (const clientData of clients) {
      const existingClient = await Client.findOne({ name: clientData.name });
      if (!existingClient) {
        await Client.create(clientData);
        console.log(`Created client: ${clientData.name}`);
      } else {
        console.log(`Client already exists: ${clientData.name}`);
      }
    }

    // Get all users and clients for project creation
    const allUsers = await User.find();
    const allClients = await Client.find();

    // Create projects if they don't exist
    for (const projectData of projects) {
      const existingProject = await Project.findOne({ name: projectData.name });
      if (!existingProject) {
        // Find the client by name
        const client = allClients.find(c => c.name === projectData.client);
        if (!client) {
          console.log(`Client not found for project: ${projectData.name}`);
          continue;
        }

        // Find the project manager by email
        const projectManager = allUsers.find(u => u.email === projectData.projectManager);
        if (!projectManager) {
          console.log(`Project manager not found for project: ${projectData.name}`);
          continue;
        }

        await Project.create({
          ...projectData,
          client: client._id,
          projectManager: projectManager._id
        });
        console.log(`Created project: ${projectData.name}`);
      } else {
        console.log(`Project already exists: ${projectData.name}`);
      }
    }

    // Create jobs if they don't exist
    for (const jobData of jobs) {
      const existingJob = await Job.findOne({ name: jobData.name });
      if (!existingJob) {
        // Find the project by name
        const project = await Project.findOne({ name: jobData.project });
        if (!project) {
          console.log(`Project not found for job: ${jobData.name}`);
          continue;
        }

        // Find the assigned user by email
        const assignedTo = allUsers.find(u => u.email === jobData.assignedTo);
        if (!assignedTo) {
          console.log(`Assigned user not found for job: ${jobData.name}`);
          continue;
        }

        await Job.create({
          ...jobData,
          project: project._id,
          assignedTo: assignedTo._id
        });
        console.log(`Created job: ${jobData.name}`);
      } else {
        console.log(`Job already exists: ${jobData.name}`);
      }
    }

    console.log('Database seeding completed');
  } catch (err) {
    console.error('Error seeding database:', err);
    process.exit(1);
  }
};

// Run the seed function
seedDatabase()
  .then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  })
  .catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  }); 