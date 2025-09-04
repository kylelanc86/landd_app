const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const Client = require('../models/Client');
const User = require('../models/User');

const mapNamesToIds = async () => {
  try {
    console.log('Starting name to ID mapping for clients and users...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to database');
    
    // Read all clients from database
    const clients = await Client.find({}, 'name _id').lean();
    console.log(`Found ${clients.length} clients in database`);
    
    // Create client mapping: client name -> ObjectId
    const clientNameToIdMap = {};
    clients.forEach(client => {
      clientNameToIdMap[client.name] = client._id.toString();
    });
    
    // Read all users from database
    const users = await User.find({}, 'firstName lastName _id').lean();
    console.log(`Found ${users.length} users in database`);
    
    // Create user mapping: "firstName lastName" -> ObjectId
    const userNameToIdMap = {};
    users.forEach(user => {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      userNameToIdMap[fullName] = user._id.toString();
    });
    
    console.log('Mappings created:');
    console.log(`  - Clients: ${Object.keys(clientNameToIdMap).length}`);
    console.log(`  - Users: ${Object.keys(userNameToIdMap).length}`);
    
    // Read the projects CSV file
    const projectsCsvPath = path.join(__dirname, 'projects_to_import.csv');
    const outputCsvPath = path.join(__dirname, 'projects_with_all_ids.csv');
    
    if (!fs.existsSync(projectsCsvPath)) {
      console.error(`Projects CSV file not found at: ${projectsCsvPath}`);
      console.log('Please place your projects CSV file at this location and name it "projects_to_import.csv"');
      return;
    }
    
    console.log('Reading projects CSV...');
    const projects = [];
    const unmappedClients = new Set();
    const unmappedUsers = new Set();
    
    // Read CSV file
    await new Promise((resolve, reject) => {
      fs.createReadStream(projectsCsvPath)
        .pipe(csv())
        .on('data', (row) => {
          projects.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`Read ${projects.length} projects from CSV`);
    
    // Map both client and user names to IDs
    const mappedProjects = projects.map((project, index) => {
      // Map client
      const clientName = project.client;
      const clientId = clientNameToIdMap[clientName];
      
      if (!clientId) {
        unmappedClients.add(clientName);
        console.warn(`Warning: Client "${clientName}" not found in database (row ${index + 1})`);
      }
      
      // Map users
      const userName = project.users;
      let userId = null;
      
      if (userName && userName.trim()) {
        userId = userNameToIdMap[userName.trim()];
        
        if (!userId) {
          unmappedUsers.add(userName);
          console.warn(`Warning: User "${userName}" not found in database (row ${index + 1})`);
        }
      }
      
      return {
        ...project,
        client: clientId || clientName, // Keep original name if not found
        users: userId || userName // Keep original name if not found
      };
    });
    
    // Report unmapped entities
    if (unmappedClients.size > 0) {
      console.log(`\n⚠️  WARNING: ${unmappedClients.size} clients could not be mapped:`);
      Array.from(unmappedClients).forEach(name => {
        console.log(`  - "${name}"`);
      });
    }
    
    if (unmappedUsers.size > 0) {
      console.log(`\n⚠️  WARNING: ${unmappedUsers.size} users could not be mapped:`);
      Array.from(unmappedUsers).forEach(name => {
        console.log(`  - "${name}"`);
      });
    }
    
    if (unmappedClients.size > 0 || unmappedUsers.size > 0) {
      console.log('\nThese entities may need to be created first or the names may be slightly different.');
    }
    
    // Write the mapped CSV
    if (projects.length > 0) {
      const headers = Object.keys(projects[0]).map(key => ({
        id: key,
        title: key
      }));
      
      const csvWriter = createCsvWriter({
        path: outputCsvPath,
        header: headers
      });
      
      await csvWriter.writeRecords(mappedProjects);
      console.log(`\n✅ Successfully created mapped CSV: ${outputCsvPath}`);
      console.log(`📊 Statistics:`);
      console.log(`  - Total projects: ${projects.length}`);
      console.log(`  - Successfully mapped clients: ${projects.length - unmappedClients.size}`);
      console.log(`  - Successfully mapped users: ${projects.length - unmappedUsers.size}`);
      console.log(`  - Unmapped clients: ${unmappedClients.size}`);
      console.log(`  - Unmapped users: ${unmappedUsers.size}`);
    }
    
    // Create a comprehensive summary report
    const summaryPath = path.join(__dirname, 'mapping_summary_complete.txt');
    const summary = `
Complete Name to ID Mapping Summary
===================================

CLIENTS:
--------
Total clients in database: ${clients.length}
Successfully mapped clients: ${projects.length - unmappedClients.size}
Unmapped clients: ${unmappedClients.size}

Unmapped clients:
${Array.from(unmappedClients).map(name => `  - "${name}"`).join('\n')}

Available clients in database:
${clients.map(client => `  - "${client.name}" (${client._id})`).join('\n')}

USERS:
------
Total users in database: ${users.length}
Successfully mapped users: ${projects.length - unmappedUsers.size}
Unmapped users: ${unmappedUsers.size}

Unmapped users:
${Array.from(unmappedUsers).map(name => `  - "${name}"`).join('\n')}

Available users in database:
${users.map(user => `  - "${user.firstName} ${user.lastName}" (${user._id})`).join('\n')}

PROJECTS:
---------
Total projects processed: ${projects.length}

Generated: ${new Date().toISOString()}
`;
    
    fs.writeFileSync(summaryPath, summary);
    console.log(`\n📋 Complete summary report created: ${summaryPath}`);
    
  } catch (error) {
    console.error('Error mapping names to IDs:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  mapNamesToIds()
    .then(() => {
      console.log('\n🎉 Complete name to ID mapping completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Name to ID mapping failed:', error);
      process.exit(1);
    });
}

module.exports = mapNamesToIds;
