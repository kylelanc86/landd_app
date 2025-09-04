const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const User = require('../models/User');

const mapUserNamesToIds = async () => {
  try {
    console.log('Starting user name to ID mapping...');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/air_monitoring', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected to database');
    
    // Read all users from database
    const users = await User.find({}, 'firstName lastName _id').lean();
    console.log(`Found ${users.length} users in database`);
    
    // Create a mapping object: "firstName lastName" -> ObjectId
    const userNameToIdMap = {};
    users.forEach(user => {
      const fullName = `${user.firstName} ${user.lastName}`.trim();
      userNameToIdMap[fullName] = user._id.toString();
    });
    
    console.log('User mapping created:', Object.keys(userNameToIdMap).length, 'users mapped');
    
    // Read the projects CSV file
    const projectsCsvPath = path.join(__dirname, 'projects_cleaned.csv');
    const outputCsvPath = path.join(__dirname, 'projects_final.csv');
    
    if (!fs.existsSync(projectsCsvPath)) {
      console.error(`Projects CSV file not found at: ${projectsCsvPath}`);
      console.log('Please ensure the projects_with_client_ids.csv file exists first.');
      return;
    }
    
    console.log('Reading projects CSV...');
    const projects = [];
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
    
    // Map user names to IDs
    const mappedProjects = projects.map((project, index) => {
      const userName = project.users;
      let userId = null;
      
      if (userName && userName.trim()) {
        const trimmedName = userName.trim();
        
        // Check if it's already an ObjectId (24 character hex string)
        if (/^[0-9a-fA-F]{24}$/.test(trimmedName)) {
          // It's already an ObjectId, keep it as is
          userId = trimmedName;
        } else {
          // It's a user name, try to map it
          userId = userNameToIdMap[trimmedName];
          
          if (!userId) {
            unmappedUsers.add(userName);
            console.warn(`Warning: User "${userName}" not found in database (row ${index + 1})`);
          }
        }
      }
      
      return {
        ...project,
        users: userId || userName // Keep original name if not found
      };
    });
    
    // Report unmapped users
    if (unmappedUsers.size > 0) {
      console.log(`\n⚠️  WARNING: ${unmappedUsers.size} users could not be mapped:`);
      Array.from(unmappedUsers).forEach(name => {
        console.log(`  - "${name}"`);
      });
      console.log('\nThese users may need to be created first or the names may be slightly different.');
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
      console.log(`  - Successfully mapped: ${projects.length - unmappedUsers.size}`);
      console.log(`  - Unmapped users: ${unmappedUsers.size}`);
    }
    
    // Create a summary report
    const summaryPath = path.join(__dirname, 'user_mapping_summary.txt');
    const summary = `
User Name to ID Mapping Summary
==============================

Total users in database: ${users.length}
Total projects processed: ${projects.length}
Successfully mapped users: ${projects.length - unmappedUsers.size}
Unmapped users: ${unmappedUsers.size}

Unmapped users:
${Array.from(unmappedUsers).map(name => `  - "${name}"`).join('\n')}

Available users in database:
${users.map(user => `  - "${user.firstName} ${user.lastName}" (${user._id})`).join('\n')}

Generated: ${new Date().toISOString()}
`;
    
    fs.writeFileSync(summaryPath, summary);
    console.log(`\n📋 Summary report created: ${summaryPath}`);
    
  } catch (error) {
    console.error('Error mapping user names to IDs:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  mapUserNamesToIds()
    .then(() => {
      console.log('\n🎉 User name to ID mapping completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ User name to ID mapping failed:', error);
      process.exit(1);
    });
}

module.exports = mapUserNamesToIds;
