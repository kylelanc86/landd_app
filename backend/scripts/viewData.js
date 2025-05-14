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
    // View Projects
    console.log('Projects:');
    const projects = await Project.find({});
    console.log(JSON.stringify(projects, null, 2));
    console.log('\n');

    // View Clients
    console.log('Clients:');
    const clients = await Client.find({});
    console.log(JSON.stringify(clients, null, 2));
    console.log('\n');

    // View Invoices
    console.log('Invoices:');
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