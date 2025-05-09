const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Job = require('../models/Job');
const Sample = require('../models/Sample');
const Shift = require('../models/Shift');
const Invoice = require('../models/Invoice');

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(async () => {
  console.log('Connected to MongoDB\n');
  
  try {
    // Fetch and display users
    console.log('USERS:');
    const users = await User.find({});
    console.log(JSON.stringify(users, null, 2));
    console.log('\n-------------------\n');

    // Fetch and display clients
    console.log('CLIENTS:');
    const clients = await Client.find({});
    console.log(JSON.stringify(clients, null, 2));
    console.log('\n-------------------\n');

    // Fetch and display projects with client and project manager details
    console.log('PROJECTS:');
    const projects = await Project.find({})
      .populate('client', 'name')
      .populate('projectManager', 'firstName lastName');
    console.log(JSON.stringify(projects, null, 2));
    console.log('\n-------------------\n');

    // Fetch and display jobs with project details
    console.log('JOBS:');
    const jobs = await Job.find({})
      .populate('project', 'name')
      .populate('assignedTo', 'firstName lastName');
    console.log(JSON.stringify(jobs, null, 2));
    console.log('\n-------------------\n');

    // Fetch and display shifts with job and supervisor details
    console.log('SHIFTS:');
    const shifts = await Shift.find({})
      .populate('job', 'name')
      .populate('supervisor', 'firstName lastName');
    console.log(JSON.stringify(shifts, null, 2));
    console.log('\n-------------------\n');

    // Fetch and display samples with shift and collector details
    console.log('SAMPLES:');
    const samples = await Sample.find({})
      .populate('shift', 'name')
      .populate('collectedBy', 'firstName lastName');
    console.log(JSON.stringify(samples, null, 2));
    console.log('\n-------------------\n');

    // Fetch and display invoices with project and client details
    console.log('INVOICES:');
    const invoices = await Invoice.find({})
      .populate('project', 'name')
      .populate('client', 'name');
    console.log(JSON.stringify(invoices, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }
})
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
}); 