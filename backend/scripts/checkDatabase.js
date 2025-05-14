const mongoose = require('mongoose');
require('dotenv').config();

async function checkDatabase() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    console.log('Connection URL:', process.env.MONGODB_URI);
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB successfully');

    // Get all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nAvailable collections:', collections.map(c => c.name));

    // Check invoices collection
    const Invoice = require('../models/Invoice');
    const invoices = await Invoice.find()
      .populate('project', 'name')
      .populate('client', 'name');
    
    console.log('\nInvoices in database:', invoices.length);
    console.log('Raw invoice data:', JSON.stringify(invoices, null, 2));

    // Check projects collection
    const Project = require('../models/Project');
    const projects = await Project.find();
    console.log('\nProjects in database:', projects.length);
    console.log('Project data:', JSON.stringify(projects, null, 2));

    // Check clients collection
    const Client = require('../models/Client');
    const clients = await Client.find();
    console.log('\nClients in database:', clients.length);
    console.log('Client data:', JSON.stringify(clients, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
  }
}

checkDatabase(); 