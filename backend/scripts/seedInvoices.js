const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Invoice = require('../models/Invoice');
const Project = require('../models/Project');
const Client = require('../models/Client');

// Load environment variables
dotenv.config();

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
.then(async () => {
  console.log('Connected to MongoDB Atlas');

  try {
    // First, let's check what projects and clients we have
    const projects = await Project.find({});
    const clients = await Client.find({});

    console.log('\nAvailable Projects:', projects.map(p => ({ id: p._id, name: p.name })));
    console.log('\nAvailable Clients:', clients.map(c => ({ id: c._id, name: c.name })));

    if (projects.length === 0 || clients.length === 0) {
      console.error('\nNo projects or clients found. Please seed projects and clients first.');
      process.exit(1);
    }

    // Create test invoices using the first project and client
    const project = projects[0];
    const client = clients[0];

    // Clear existing invoices
    console.log('\nClearing existing invoices...');
    await Invoice.deleteMany({});

    // Create test invoices
    const invoices = [
      {
        invoiceID: "INV-2024-001",
        project: project._id,
        client: client._id,
        amount: 2500.00,
        status: 'pending',
        date: new Date('2024-02-01'),
        dueDate: new Date('2024-03-01'),
        description: 'Initial consultation and assessment'
      },
      {
        invoiceID: "INV-2024-002",
        project: project._id,
        client: client._id,
        amount: 5000.00,
        status: 'paid',
        date: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15'),
        description: 'Monthly monitoring services'
      },
      {
        invoiceID: "INV-2024-003",
        project: project._id,
        client: client._id,
        amount: 3500.00,
        status: 'overdue',
        date: new Date('2023-12-01'),
        dueDate: new Date('2024-01-01'),
        description: 'Equipment calibration and maintenance'
      }
    ];

    // Insert new invoices
    console.log('\nCreating new invoices...');
    const createdInvoices = await Invoice.create(invoices);

    // Verify the created invoices with populated fields
    const populatedInvoices = await Invoice.find({})
      .populate('project', 'name')
      .populate('client', 'name');

    console.log('\nCreated invoices with populated fields:', 
      JSON.stringify(populatedInvoices, null, 2));

    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\nError seeding invoices:', error);
    process.exit(1);
  }
})
.catch(err => {
  console.error('\nMongoDB connection error:', err);
  process.exit(1);
}); 