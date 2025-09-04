const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const cleanCsvData = async () => {
  try {
    console.log('Starting CSV data cleaning...');
    
    // Read the projects CSV file
    const projectsCsvPath = path.join(__dirname, 'projects_with_user_ids.csv');
    const outputCsvPath = path.join(__dirname, 'projects_cleaned.csv');
    
    if (!fs.existsSync(projectsCsvPath)) {
      console.error(`Projects CSV file not found at: ${projectsCsvPath}`);
      return;
    }
    
    console.log('Reading projects CSV...');
    const projects = [];
    
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
    
    // Clean the data
    const cleanedProjects = projects.map((project, index) => {
      const cleanedProject = { ...project };
      
      // Clean user field - remove newlines and extra whitespace
      if (cleanedProject.users) {
        cleanedProject.users = cleanedProject.users.replace(/\r?\n/g, '').trim();
      }
      
      // Clean other text fields that might have newlines
      const textFields = ['name', 'description', 'notes', 'createdBy'];
      textFields.forEach(field => {
        if (cleanedProject[field]) {
          cleanedProject[field] = cleanedProject[field].replace(/\r?\n/g, ' ').trim();
        }
      });
      
      // Clean project contact fields
      if (cleanedProject['projectContact.name']) {
        cleanedProject['projectContact.name'] = cleanedProject['projectContact.name'].replace(/\r?\n/g, ' ').trim();
      }
      
      return cleanedProject;
    });
    
    // Write the cleaned CSV
    if (projects.length > 0) {
      const headers = Object.keys(projects[0]).map(key => ({
        id: key,
        title: key
      }));
      
      const csvWriter = createCsvWriter({
        path: outputCsvPath,
        header: headers
      });
      
      await csvWriter.writeRecords(cleanedProjects);
      console.log(`\n✅ Successfully created cleaned CSV: ${outputCsvPath}`);
      console.log(`📊 Statistics:`);
      console.log(`  - Total projects: ${projects.length}`);
      console.log(`  - Projects cleaned: ${cleanedProjects.length}`);
    }
    
    // Check for any remaining issues
    const usersWithNewlines = cleanedProjects.filter(project => 
      project.users && (project.users.includes('\n') || project.users.includes('\r'))
    );
    
    if (usersWithNewlines.length > 0) {
      console.log(`\n⚠️  WARNING: ${usersWithNewlines.length} projects still have newlines in user field:`);
      usersWithNewlines.slice(0, 5).forEach((project, index) => {
        console.log(`  - Row ${index + 1}: "${project.users}"`);
      });
    } else {
      console.log('\n✅ All user fields cleaned successfully!');
    }
    
  } catch (error) {
    console.error('Error cleaning CSV data:', error);
    throw error;
  }
};

// Run the script
if (require.main === module) {
  cleanCsvData()
    .then(() => {
      console.log('\n🎉 CSV data cleaning completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ CSV data cleaning failed:', error);
      process.exit(1);
    });
}

module.exports = cleanCsvData;
