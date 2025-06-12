const fs = require('fs');
const csv = require('csv-parse');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Project = require('../models/Project');
const Client = require('../models/Client');
const path = require('path');

// Load environment variables
dotenv.config();

console.log('Starting import process...');
console.log('Current directory:', __dirname);
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'URI is set' : 'URI is not set');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB successfully');
    return importProjects();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

async function importProjects() {
  try {
    // Get the absolute path to the CSV file in frontend public directory
    const filePath = path.resolve(__dirname, '../../frontend/public/data/tradifyProjectData_120625.csv');
    console.log('Looking for CSV file at:', filePath);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('CSV file not found at:', filePath);
      console.error('Please ensure the file exists at:', filePath);
      process.exit(1);
    }

    console.log('File exists, starting to read CSV...');
    const records = [];
    const parser = fs
      .createReadStream(filePath)
      .pipe(csv.parse({
        columns: true,
        skip_empty_lines: true,
        trim: true
      }));

    console.log('CSV parser created, starting to read records...');
    
    for await (const record of parser) {
      records.push(record);
    }

    console.log(`Found ${records.length} records in CSV`);
    if (records.length === 0) {
      console.error('No records found in CSV file');
      process.exit(1);
    }

    // Log the first record to verify structure
    console.log('First record structure:', Object.keys(records[0]));
    console.log('Sample of first record:', records[0]);

    let successCount = 0;
    let errorCount = 0;
    let missingFields = {
      name: 0,
      projectID: 0,
      both: 0
    };

    // Process each record
    for (const [index, record] of records.entries()) {
      try {
        console.log(`\nProcessing record ${index + 1}/${records.length}`);
        
        // Check for missing fields
        const missingName = !record.name;
        const missingProjectID = !record.projectID;
        
        if (missingProjectID) {
            missingFields.projectID++;
            console.warn(`Skipping record ${index + 1}: Missing projectID`);
            console.warn('Record data:', record);
            errorCount++;
            continue;
        }

        if (missingName) {
            missingFields.name++;
            console.warn(`Record ${index + 1}: Missing project name, using default name`);
            console.warn('Record data:', record);
        }

        // Find or create client
        let client = await Client.findOne({ name: record.client });
        if (!client) {
          console.log(`Creating new client: ${record.client}`);
          client = await Client.create({
            name: record.client
          });
        }

        // Check if project with this ID already exists
        const existingProject = await Project.findOne({ projectID: record.projectID });
        if (existingProject) {
          console.log(`Project with ID ${record.projectID} already exists, skipping...`);
          errorCount++;
          continue;
        }

        // Create project with the existing projectID, bypassing the pre-validate hook
        const projectData = {
          projectID: record.projectID,
          name: record.name || 'Missing Site Name',
          client: client._id,
          department: record.department || 'Asbestos & HAZMAT',
          status: record.status || 'Assigned',
          address: record.address || '',
          workOrder: record.workOrder || '',
          notes: record.notes || '',
          categories: record.categories ? record.categories.split(',').map(cat => cat.trim()) : [],
          projectContact: {
            name: record.projectContact?.name || '',
            number: record.projectContact?.number || '',
            email: record.projectContact?.email || ''
          }
        };

        // Use insertOne to bypass mongoose middleware
        await Project.collection.insertOne(projectData);
        console.log(`✓ Imported project: ${projectData.name} (ID: ${projectData.projectID})`);
        successCount++;
      } catch (err) {
        console.error(`✗ Error importing record ${index + 1}:`, err.message);
        console.error('Record data:', record);
        errorCount++;
      }
    }

    console.log('\nImport Summary:');
    console.log(`Total records: ${records.length}`);
    console.log(`Successfully imported: ${successCount}`);
    console.log(`Failed to import: ${errorCount}`);
    console.log('\nMissing Fields Breakdown:');
    console.log(`Missing both name and projectID: ${missingFields.both}`);
    console.log(`Missing only name: ${missingFields.name}`);
    console.log(`Missing only projectID: ${missingFields.projectID}`);

    process.exit(0);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
} 