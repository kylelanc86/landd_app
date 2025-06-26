const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const AirPump = require('../models/AirPump');
require('dotenv').config();

// Connect to MongoDB Atlas
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// Function to parse date string
const parseDate = (dateString) => {
  if (!dateString) return null;
  
  // Handle different date formats
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    console.warn(`Invalid date format: ${dateString}`);
    return null;
  }
  return date;
};

// Function to import CSV data
const importAirPumps = async (csvFilePath) => {
  const pumps = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row) => {
        // Map CSV columns to AirPump model fields
        const pump = {
          pumpReference: row.pumpReference || row['L&D Pump Reference'],
          pumpDetails: row.pumpDetails || row['Pump Details'],
          calibrationDate: parseDate(row.calibrationDate || row['Calibration Date']),
          maxFlowrate: row.maxFlowrate || row['Max Flowrate'],
          status: row.status || 'Active',
          notes: row.notes || '',
          manufacturer: row.manufacturer || '',
          model: row.model || '',
          serialNumber: row.serialNumber || row['Serial Number'],
          location: row.location || '',
          purchaseDate: parseDate(row.purchaseDate || row['Purchase Date']),
          warrantyExpiry: parseDate(row.warrantyExpiry || row['Warranty Expiry'])
        };
        
        // Only add if required fields are present
        if (pump.pumpReference && pump.pumpDetails && pump.calibrationDate) {
          pumps.push(pump);
        } else {
          console.warn('Skipping row with missing required fields:', row);
        }
      })
      .on('end', () => {
        resolve(pumps);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

// Main function
const main = async () => {
  try {
    await connectDB();
    
    const csvFilePath = process.argv[2];
    if (!csvFilePath) {
      console.error('Please provide the path to your CSV file');
      console.log('Usage: node importAirPumps.js <path-to-csv-file>');
      process.exit(1);
    }
    
    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV file not found: ${csvFilePath}`);
      process.exit(1);
    }
    
    console.log(`Importing air pumps from: ${csvFilePath}`);
    
    const pumps = await importAirPumps(csvFilePath);
    console.log(`Found ${pumps.length} pumps to import`);
    
    if (pumps.length === 0) {
      console.log('No valid pumps found in CSV file');
      process.exit(0);
    }
    
    // Clear existing pumps (optional - comment out if you want to keep existing data)
    // await AirPump.deleteMany({});
    // console.log('Cleared existing air pumps');
    
    // Insert pumps
    const result = await AirPump.insertMany(pumps);
    console.log(`Successfully imported ${result.length} air pumps`);
    
    // Display imported pumps
    console.log('\nImported pumps:');
    result.forEach(pump => {
      console.log(`- ${pump.pumpReference}: ${pump.pumpDetails}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
};

// Run the script
main(); 